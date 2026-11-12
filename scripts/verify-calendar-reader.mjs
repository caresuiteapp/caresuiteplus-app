// Uses the repository's existing Playwright installation. No production data or login.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
const root = path.resolve('public/calendar-reader/v1');
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/') {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end('<!doctype html><meta charset="utf-8"><title>Local reader verification</title><script type="module" src="/reader.mjs"></script>'); return;
  }
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  try {
    response.setHeader('Content-Type', /\.m?js$/.test(file) ? 'text/javascript; charset=utf-8' : file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.CALENDAR_READER_BROWSER_EXECUTABLE ? { executablePath: process.env.CALENDAR_READER_BROWSER_EXECUTABLE } : {}) });
  const context = await browser.newContext();
  const requests = [];
  await context.route('**/*', (route) => {
    const request = route.request(); requests.push({ url: request.url(), method: request.method() });
    return request.url().startsWith(origin + '/') ? route.continue() : route.abort();
  });
  const page = await context.newPage(); await page.goto(origin); await page.waitForFunction(() => window.CareSuitePlanReaderV1);
  const pdf = new jsPDF(); pdf.setFontSize(16); pdf.text(['Oktober 2026', 'Name: Alex Muster', '01.10.2026 08:00 - 12:00', '02.10.2026 14:00 - 18:00'], 20, 25, { lineHeightFactor: 2 });
  const bytes = Array.from(new Uint8Array(pdf.output('arraybuffer')));
  for (const forceOcr of [false, true]) {
    const result = await page.evaluate(async ({ bytes, forceOcr }) => window.CareSuitePlanReaderV1.read(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), { forceOcr }), { bytes, forceOcr });
    assert.match(result.text, /01\.10\.2026/); assert.match(result.text, /08:00/); assert.equal(result.ocrPages, Number(forceOcr));
  }
  const photo = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 900;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 1600, 900); ctx.fillStyle = 'black'; ctx.font = '40px Arial';
    ['Oktober 2026', 'Name: Alex Muster', '01.10.2026 08:00 - 12:00', '02.10.2026 14:00 - 18:00'].forEach((line, i) => ctx.fillText(line, 80, 120 + i * 130));
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const recognized = await window.CareSuitePlanReaderV1.read(blob);
    const controller = new AbortController();
    const job = window.CareSuitePlanReaderV1.read(blob, { signal: controller.signal }); setTimeout(() => controller.abort(), 50);
    let cancelled = false; try { await job; } catch (error) { cancelled = error.name === 'AbortError'; }
    return { recognized, cancelled, dataUrl: canvas.toDataURL('image/png') };
  });
  assert.match(photo.recognized.text, /02\.10\.2026/); assert.equal(photo.cancelled, true);
  const hybrid = new jsPDF(); hybrid.text('Dienstplan Oktober 2026 - gescannte Tabelle unter einem Textkopf', 10, 15);
  hybrid.addImage(photo.dataUrl, 'PNG', 15, 35, 180, 101.25);
  const hybridResult = await page.evaluate(async (bytes) => window.CareSuitePlanReaderV1.read(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })), Array.from(new Uint8Array(hybrid.output('arraybuffer'))));
  assert.equal(hybridResult.ocrPages, 1); assert.match(hybridResult.text, /01\.10\.2026/);
  const rejected = await page.evaluate(async () => {
    const failures = [];
    for (const blob of [new Blob(['not a PDF'], { type: 'application/pdf' }), new Blob([new Uint8Array(11 * 1024 * 1024)])]) {
      try { await window.CareSuitePlanReaderV1.read(blob); failures.push(false); } catch { failures.push(true); }
    } return failures;
  });
  assert.deepEqual(rejected, [true, true]);
  const bmp = JSON.parse(await readFile('scripts/calendar-reader/fixtures/synthetic-bmp-ecc200.json', 'utf8'));
  const bmpPhoto = await page.evaluate(async ({ width, height, bits }) => {
    const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1800;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black'; ctx.font = '40px Arial'; ctx.fillText('Synthetischer Medikationsplan', 60, 100);
    const bytes = Uint8Array.from(atob(bits), char => char.charCodeAt(0));
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (bytes[i >> 3] & (1 << (7 - (i & 7)))) ctx.fillRect(910 + x * 4, 130 + y * 4, 4, 4);
    }
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const decoded = await window.CareSuitePlanReaderV1.readBmp(blob);
    const dataUrl = canvas.toDataURL('image/png');
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const blank = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    let blankRejected = false;
    try { await window.CareSuitePlanReaderV1.readBmp(blank); } catch (error) { blankRejected = error.name === 'CareSuiteBmpReadError'; }
    return { decoded, blankRejected, dataUrl };
  }, bmp);
  assert.deepEqual(bmpPhoto.decoded, [bmp.text]);
  assert.equal(bmpPhoto.blankRejected, true);

  const bmpScan = new jsPDF({ compress: true });
  bmpScan.addImage(bmpPhoto.dataUrl, 'PNG', 10, 20, 190, 213.75, undefined, 'FAST');
  const scanBytes = Array.from(new Uint8Array(bmpScan.output('arraybuffer')));
  const pdfWithAttachment = await PDFDocument.create(); pdfWithAttachment.addPage();
  await pdfWithAttachment.attach(Buffer.from(bmp.text, 'latin1'), 'medikationsplan.xml', { mimeType: 'application/xml' });
  const attachmentBytes = Array.from(await pdfWithAttachment.save());
  const bmpPdfs = await page.evaluate(async ({ scanBytes, attachmentBytes }) => {
    const read = async (bytes) => window.CareSuitePlanReaderV1.readBmp(new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' }));
    return { scan: await read(scanBytes), attachment: (await read(attachmentBytes)).map(bytes => Array.from(bytes)) };
  }, { scanBytes, attachmentBytes });
  assert.deepEqual(bmpPdfs.scan, [bmp.text]);
  assert.deepEqual(bmpPdfs.attachment, [Array.from(Buffer.from(bmp.text, 'latin1'))]);

  assert.ok(requests.every((r) => r.method === 'GET' && r.url.startsWith(origin + '/')), 'Documents must never be uploaded / sent to a third party');
  console.log('Browserprüfung bestanden: Kalendererkennung, BMP-ECC200 in Foto/PDF, eingebettetes BMP-XML, Fehlerfälle und ausschließlich lokale Asset-Abrufe.');
} finally { await browser?.close(); server.close(); }
