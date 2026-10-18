import { Worker } from 'node:worker_threads';

/** Independent extraction from an immutable original, isolated from the API event loop. */
export function extractEInvoicePdfXml(original) {
  if (!(original instanceof Uint8Array) || !original.length || original.length > 10 * 1024 * 1024) return Promise.reject(new Error('Die Original-PDF ist leer oder überschreitet 10 MB.'));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./einvoice-pdf-worker.mjs', import.meta.url), { workerData: new Uint8Array(original),
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 } });
    let settled = false;
    const finish = (error, bytes) => {
      if (settled) return; settled = true; clearTimeout(timer); void worker.terminate();
      if (error) reject(error); else resolve(bytes);
    };
    const failure = () => new Error('Die Original-PDF muss genau eine sicher auslesbare XML-Anlage enthalten. Bitte den Absender um Prüfung bitten.');
    const timer = setTimeout(() => finish(new Error('Die eingebettete Rechnungs-XML konnte nicht innerhalb von 20 Sekunden geprüft werden.')), 20_000);
    worker.once('message', result => {
      if (result?.ok !== true || !(result.bytes instanceof Uint8Array) || !result.bytes.length || result.bytes.length > 5 * 1024 * 1024) finish(failure());
      else finish(null, new Uint8Array(result.bytes));
    });
    worker.once('error', () => finish(failure()));
    worker.once('exit', () => { if (!settled) finish(failure()); });
  });
}
