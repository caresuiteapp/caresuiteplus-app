import { getDocument, GlobalWorkerOptions } from './pdf.mjs';
const base = new URL('.', import.meta.url).href;
GlobalWorkerOptions.workerSrc = `${base}pdf.worker.mjs`;

// Read stored originals only. Rasterized annex copies never replace those files.
window.CareSuiteInvoicePdfV1 = {
  async render(bytes, title, remainingPages) {
    const task = getDocument({ data: new Uint8Array(bytes), cMapUrl: `${base}cmaps/`, cMapPacked: true,
      standardFontDataUrl: `${base}standard_fonts/`, wasmUrl: `${base}wasm/`, isEvalSupported: false });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > remainingPages) throw new Error('Die ausgewählten Anlagen umfassen mehr als 100 Seiten. Bitte die Auswahl verkleinern.');
      const pages = [];
      for (let index = 1; index <= pdf.numPages; index += 1) {
        const page = await pdf.getPage(index);
        const initial = page.getViewport({ scale: 1 });
        const scale = Math.min(2, 2200 / Math.max(initial.width, initial.height));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Die PDF-Anlage konnte nicht dargestellt werden.');
        try {
          await page.render({ canvasContext: context, canvas, viewport, background: 'rgb(255,255,255)' }).promise;
          pages.push({ title, sourcePage: index, sourcePages: pdf.numPages, width: canvas.width, height: canvas.height, dataUrl: canvas.toDataURL('image/png') });
        } finally { canvas.width = 0; canvas.height = 0; page.cleanup(); }
      }
      return pages;
    } finally { await task.destroy(); }
  },
};
