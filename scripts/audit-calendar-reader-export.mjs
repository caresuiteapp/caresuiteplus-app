import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const directory = path.resolve(process.argv[2] || 'dist', 'calendar-reader/v1');
const required = ['reader.mjs', 'pdf.mjs', 'pdf.worker.mjs', 'tesseract.esm.min.js', 'worker.min.js', 'lang/deu.traineddata.gz', 'lang/eng.traineddata.gz', 'versions.json'];
for (const variant of ['', '-simd', '-relaxedsimd', '-lstm', '-simd-lstm', '-relaxedsimd-lstm']) {
  required.push(`core/tesseract-core${variant}.wasm`, `core/tesseract-core${variant}.wasm.js`);
}
for (const name of required) assert.ok((await stat(path.join(directory, name))).size > 0, `Missing reader asset: ${name}`);
assert.equal(await readFile(path.join(directory, 'reader.mjs'), 'utf8'), await readFile('scripts/calendar-reader/reader.mjs', 'utf8'), 'Export contains stale reader code');
console.log(`Lokale Kalender-Erkennung: ${required.length} exportierte Dateien geprüft.`);
