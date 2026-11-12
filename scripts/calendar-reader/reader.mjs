import { getDocument, GlobalWorkerOptions, Util } from './pdf.mjs';
import Tesseract from './tesseract.esm.min.js';

const base = new URL('.', import.meta.url).href;
const { createWorker } = Tesseract;
GlobalWorkerOptions.workerSrc = `${base}pdf.worker.mjs`;
const abortError = () => new DOMException('Analyse abgebrochen.', 'AbortError');
function check(signal) { if (signal?.aborted) throw abortError(); }

// Keep words in their visual row; ordinary PDF text order often walks entire columns.
function rowsFromWords(words) {
  const rows = [];
  for (const word of words.filter((w) => w.text.trim()).sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.findLast((r) => Math.abs(r.y - word.y) < Math.max(3, Math.min(r.h, word.h) * 0.48));
    if (row) { row.words.push(word); row.h = Math.min(row.h, word.h); }
    else rows.push({ y: word.y, h: word.h, words: [word] });
  }
  return rows.map((row) => row.words.sort((a, b) => a.x - b.x).map((w) => w.text).join(' ').replace(/\s+/g, ' ').trim()).join('\n');
}
function canvasFor(width, height) {
  if (!width || !height || !Number.isFinite(width * height)) throw new Error('Bildgröße ist ungültig.');
  const scale = Math.min(2.5, 2600 / Math.max(width, height), Math.sqrt(5_000_000 / (width * height)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
  return { canvas, scale };
}
async function read(file, { signal, onProgress = () => {}, forceOcr = false, rotation = 0 } = {}) {
  check(signal);
  if (!file || file.size > 10 * 1024 * 1024) throw new Error('Bitte eine Datei bis höchstens 10 MB wählen.');
  let worker, loading, renderTask, creating, stopped = false, cancelReject;
  const cancelPromise = new Promise((_, reject) => { cancelReject = reject; });
  const stop = () => { stopped = true; renderTask?.cancel(); void worker?.terminate(); void loading?.destroy(); cancelReject(abortError()); };
  signal?.addEventListener('abort', stop, { once: true });
  const timeout = setTimeout(() => {
    stopped = true; renderTask?.cancel(); void worker?.terminate(); void loading?.destroy();
    cancelReject(new Error('Die lokale Erkennung dauert zu lange. Bitte Datei aufteilen oder Text manuell übernehmen.'));
  }, 180_000);
  let currentPage = 1, totalPages = 1;
  const report = (message, progress = 0) => { if (!stopped) onProgress({ message, progress: Math.max(0, Math.min(1, progress)), page: currentPage, pages: totalPages }); };
  async function ocr(canvas) {
    if (!worker) {
      report('Texterkennung wird auf diesem Gerät geladen…');
      creating = createWorker(['deu', 'eng'], 1, {
        workerPath: `${base}worker.min.js`, workerBlobURL: false,
        corePath: `${base}core`, langPath: `${base}lang`, cachePath: 'caresuite-calendar-reader-v1',
        logger: (m) => { if (m.status === 'recognizing text') report(`Seite ${currentPage}/${totalPages}: Text wird erkannt…`, m.progress); },
        errorHandler: () => { /* Errors propagate to the caller; never log document contents. */ },
      }).then(async (created) => { if (stopped) { await created.terminate(); throw abortError(); } worker = created; return created; });
      await creating;
      await worker.setParameters({ tessedit_pageseg_mode: '3', preserve_interword_spaces: '1', user_defined_dpi: '200' });
    }
    check(signal);
    const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
    const words = (data.blocks ?? []).flatMap((b) => b.paragraphs ?? []).flatMap((p) => p.lines ?? []).flatMap((l) => l.words ?? [])
      .map((w) => ({ text: w.text, x: w.bbox.x0, y: (w.bbox.y0 + w.bbox.y1) / 2, h: w.bbox.y1 - w.bbox.y0 }));
    return { text: words.length ? rowsFromWords(words) : data.text, confidence: data.confidence, method: 'ocr' };
  }
  const work = async () => {
    const bytes = new Uint8Array(await file.arrayBuffer()); check(signal);
    const header = new TextDecoder('latin1').decode(bytes.slice(0, 12));
    const pdf = header.startsWith('%PDF-');
    const image = (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
      || [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
      || (header.startsWith('RIFF') && header.slice(8) === 'WEBP');
    if (!pdf && !image) throw new Error('Bitte eine gültige PDF-, JPG-, PNG- oder WebP-Datei auswählen.');
    const pages = [];
    if (pdf) {
      report('PDF wird auf diesem Gerät gelesen…');
      loading = getDocument({ data: bytes, isEvalSupported: false, enableXfa: false, cMapUrl: `${base}cmaps/`, cMapPacked: true, standardFontDataUrl: `${base}standard_fonts/`, wasmUrl: `${base}wasm/` });
      loading.onPassword = () => { void loading.destroy(); cancelReject(new Error('Das PDF ist passwortgeschützt. Bitte eine ungeschützte Kopie verwenden.')); };
      const doc = await loading.promise; totalPages = doc.numPages;
      if (totalPages > 12) throw new Error('Bitte höchstens 12 Seiten je Import auswählen.');
      for (currentPage = 1; currentPage <= totalPages; currentPage++) {
        check(signal); report(`Seite ${currentPage}/${totalPages}: PDF wird gelesen…`);
        const page = await doc.getPage(currentPage);
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();
        const words = content.items.filter((i) => 'str' in i && i.str.trim()).map((i) => {
          const t = Util.transform(viewport.transform, i.transform);
          return { text: i.str, x: t[4], y: t[5] - Math.abs(i.height) / 2, h: Math.max(1, Math.abs(i.height)) };
        });
        const text = rowsFromWords(words);
        // A text-only title above a scanned table is not a usable text layer.
        const datedText = /\d{1,2}\s*\.\s*\d{1,2}\s*\.|20\d{2}-\d{2}-\d{2}|\b(?:mo|di|mi|do|fr|sa|so)\w*[, .]*\d{1,2}\b/i.test(text);
        if (!forceOcr && text.trim().length >= 40 && datedText) pages.push({ text, confidence: 100, method: 'pdf-text' });
        else {
          const { canvas, scale } = canvasFor(viewport.width, viewport.height);
          try {
            renderTask = page.render({ canvas, viewport: page.getViewport({ scale }) }); await renderTask.promise; renderTask = undefined;
            pages.push(await ocr(canvas));
          } finally { canvas.width = canvas.height = 1; }
        }
        page.cleanup();
        if (pages.reduce((n, p) => n + p.text.length, 0) > 100_000) throw new Error('Zu viel Text. Bitte die Datei auf einen Monatsplan begrenzen.');
      }
    } else {
      report('Foto wird für die Texterkennung vorbereitet…');
      const bitmap = await createImageBitmap(file);
      let canvas;
      try {
        check(signal);
        if (bitmap.width * bitmap.height > 40_000_000) throw new Error('Das Foto ist zu groß. Bitte eine kleinere Bildkopie (höchstens 40 Megapixel) verwenden.');
        const quarterTurn = rotation === 90 || rotation === 270;
        ({ canvas } = canvasFor(quarterTurn ? bitmap.height : bitmap.width, quarterTurn ? bitmap.width : bitmap.height));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(rotation * Math.PI / 180);
        const w = quarterTurn ? canvas.height : canvas.width, h = quarterTurn ? canvas.width : canvas.height;
        ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
        pages.push(await ocr(canvas));
      } finally { bitmap.close(); if (canvas) canvas.width = canvas.height = 1; }
    }
    check(signal); report('Text erkannt. Tage und Zeiten werden zugeordnet…', 1);
    return { text: pages.map((p) => p.text).join('\n\n'), pages: pages.length, ocrPages: pages.filter((p) => p.method === 'ocr').length,
      lowConfidence: pages.some((p) => p.method === 'ocr' && p.confidence < 80) };
  };
  try { return await Promise.race([work(), cancelPromise]); }
  finally { stopped = true; clearTimeout(timeout); signal?.removeEventListener('abort', stop); await worker?.terminate(); await loading?.destroy(); }
}
function bmpError(message) {
  const error = new Error(message);
  error.name = 'CareSuiteBmpReadError';
  return error;
}

function bmpCanvas(width, height) {
  if (!(width > 0 && height > 0) || !Number.isFinite(width * height)) throw bmpError('Die Bildgröße ist ungültig.');
  const scale = Math.min(4, 3600 / Math.max(width, height), Math.sqrt(8_000_000 / (width * height)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(width * scale));
  canvas.height = Math.max(1, Math.floor(height * scale));
  return { canvas, scale };
}

/** Extract only structured BMP data. Nothing is sent to an OCR or barcode API. */
async function readBmp(file, { signal } = {}) {
  check(signal);
  if (!file || file.size < 1 || file.size > 3 * 1024 * 1024) throw bmpError('Bitte eine Datei bis 3 MiB auswählen.');
  let loading, renderTask, cancel, stopped = false;
  const cancelled = new Promise((_, reject) => { cancel = reject; });
  const stop = (error) => {
    stopped = true;
    renderTask?.cancel();
    void loading?.destroy().catch(() => {});
    cancel(error);
  };
  const onAbort = () => stop(abortError());
  signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => stop(bmpError('Der Medikationsplan konnte nicht rechtzeitig gelesen werden. Bitte die BMP-XML-Datei verwenden.')), 75_000);
  const current = () => { if (stopped) throw abortError(); check(signal); };
  const work = async () => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    current();
    const header = String.fromCharCode(...bytes.subarray(0, 12));
    const isPdf = header.startsWith('%PDF-');
    const isImage = (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
      || [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
      || (header.startsWith('RIFF') && header.slice(8) === 'WEBP');
    if (!isPdf && !isImage) throw bmpError('Bitte einen Medikationsplan als BMP-XML, PDF oder Bilddatei auswählen.');
    const { looksLikeBmpXml, readBmpDataMatrix } = await import('./bmp-datamatrix.mjs');
    current();
    const decodeCanvas = (canvas) => {
      current();
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw bmpError('Die lokale Bildanalyse ist nicht verfügbar. Bitte BMP-XML verwenden.');
      const matches = readBmpDataMatrix(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
      if (matches.length > 1) throw bmpError('Die Seite enthält mehrere unterschiedliche BMP-Codes. Bitte einen eindeutigen Medikationsplan auswählen.');
      if (!matches.length) throw bmpError('Eine Seite enthält keinen lesbaren BMP-Code. Bitte eine klarere Vorlage oder die BMP-XML-Datei verwenden.');
      return matches[0];
    };

    if (isPdf) {
      loading = getDocument({ data: bytes, isEvalSupported: false, enableXfa: false, stopAtErrors: true, useSystemFonts: false,
        maxImageSize: 40_000_000, canvasMaxAreaInBytes: 32_000_000,
        cMapUrl: `${base}cmaps/`, cMapPacked: true, standardFontDataUrl: `${base}standard_fonts/`, wasmUrl: `${base}wasm/` });
      loading.onPassword = () => stop(bmpError('Das PDF ist passwortgeschützt. Bitte eine ungeschützte Kopie verwenden.'));
      const doc = await loading.promise;
      current();
      if (doc.numPages < 1 || doc.numPages > 12) throw bmpError('Bitte höchstens 12 Seiten je Medikationsplan auswählen.');
      const attachments = Object.values(await doc.getAttachments() ?? {});
      current();
      if (attachments.length > 24) throw bmpError('Das PDF enthält zu viele eingebettete Dateien. Bitte den Medikationsplan separat auswählen.');
      const structured = attachments.flatMap(({ content }) => {
        if (!(content instanceof Uint8Array) || !content.length) return [];
        const skip = content[0] === 239 && content[1] === 187 && content[2] === 191 ? 3 : 0;
        const prefix = String.fromCharCode(...content.subarray(skip, skip + 384));
        if (!looksLikeBmpXml(prefix)) return [];
        if (content.length > 131072) throw bmpError('Die eingebetteten BMP-Daten sind zu groß. Bitte die BMP-XML-Datei verwenden.');
        return [content];
      });
      if (structured.length) return structured;

      const codes = [];
      for (let number = 1; number <= doc.numPages; number++) {
        current();
        const page = await doc.getPage(number);
        const viewport = page.getViewport({ scale: 1 });
        const { canvas, scale } = bmpCanvas(viewport.width, viewport.height);
        try {
          current();
          renderTask = page.render({ canvas, viewport: page.getViewport({ scale }) });
          await renderTask.promise;
          renderTask = undefined;
          codes.push(decodeCanvas(canvas));
        } finally { canvas.width = canvas.height = 1; page.cleanup(); }
      }
      return codes;
    }

    if (typeof createImageBitmap !== 'function') throw bmpError('Dieser Browser kann die Bilddatei nicht lokal lesen. Bitte BMP-XML verwenden.');
    const bitmap = await createImageBitmap(file);
    let canvas;
    try {
      current();
      if (bitmap.width * bitmap.height > 40_000_000) throw bmpError('Das Bild ist zu groß. Bitte eine kleinere Kopie mit lesbarem BMP-Code auswählen.');
      ({ canvas } = bmpCanvas(bitmap.width, bitmap.height));
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw bmpError('Die lokale Bildanalyse ist nicht verfügbar. Bitte BMP-XML verwenden.');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return [decodeCanvas(canvas)];
    } finally { bitmap.close(); if (canvas) canvas.width = canvas.height = 1; }
  };
  try { return await Promise.race([work(), cancelled]); }
  finally {
    stopped = true;
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
    void loading?.destroy().catch(() => {});
  }
}

window.CareSuitePlanReaderV1 = { read, readBmp };
