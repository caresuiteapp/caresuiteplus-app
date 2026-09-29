// Reproducible, same-origin browser assets. No runtime CDN or API keys.
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public/calendar-reader/v1');
await mkdir(out, { recursive: true });
const copy = async (source, target) => cp(path.join(root, source), path.join(out, target), { recursive: true });
await copy('scripts/calendar-reader/reader.mjs', 'reader.mjs');
await copy('node_modules/pdfjs-dist/legacy/build/pdf.mjs', 'pdf.mjs');
await copy('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs', 'pdf.worker.mjs');
for (const dir of ['cmaps', 'standard_fonts', 'wasm']) await copy(`node_modules/pdfjs-dist/${dir}`, dir);
await copy('node_modules/pdfjs-dist/LICENSE', 'PDFJS-LICENSE.txt');
await copy('node_modules/tesseract.js/dist/tesseract.esm.min.js', 'tesseract.esm.min.js');
await copy('node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js');
await copy('node_modules/tesseract.js/LICENSE.md', 'TESSERACT-LICENSE.txt');
await copy('node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt', 'worker.min.js.LICENSE.txt');
await copy('node_modules/tesseract.js/dist/tesseract.min.js.LICENSE.txt', 'tesseract.min.js.LICENSE.txt');
await copy('node_modules/tesseract.js-core/LICENSE', 'TESSERACT-CORE-LICENSE.txt');
await copy('node_modules/tesseract.js/LICENSE.md', 'TESSDATA-APACHE-2.0.txt');
await copy('scripts/calendar-reader/THIRD_PARTY.md', 'THIRD_PARTY.md');
await mkdir(path.join(out, 'core'), { recursive: true });
for (const name of await readdir(path.join(root, 'node_modules/tesseract.js-core'))) {
  if (/\.wasm(?:\.js)?$/.test(name)) await copy(`node_modules/tesseract.js-core/${name}`, `core/${name}`);
}
await mkdir(path.join(out, 'lang'), { recursive: true });
for (const lang of ['deu', 'eng']) {
  await copy(`node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`, `lang/${lang}.traineddata.gz`);
  await copy(`node_modules/@tesseract.js-data/${lang}/package.json`, `lang/${lang}.package.json`);
}
const packages = ['pdfjs-dist', 'tesseract.js', 'tesseract.js-core', '@tesseract.js-data/deu', '@tesseract.js-data/eng'];
const versions = {};
for (const name of packages) {
  const pkg = JSON.parse(await readFile(path.join(root, 'node_modules', name, 'package.json'), 'utf8'));
  versions[name] = { version: pkg.version, license: pkg.license };
}
await writeFile(path.join(out, 'versions.json'), JSON.stringify(versions, null, 2) + '\n');
console.log('Lokale Kalender-Erkennung vorbereitet: public/calendar-reader/v1');
