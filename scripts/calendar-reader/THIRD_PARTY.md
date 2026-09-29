# Local calendar reader: third-party components

CareSuite's reader integration and date/time parser use these unmodified open
source components. Exact installed versions are recorded in `versions.json`.

- PDF.js / pdfjs-dist, Mozilla and contributors: Apache-2.0.
  Source: https://github.com/mozilla/pdf.js
  License: `PDFJS-LICENSE.txt`; additional font/WASM notices remain in their
  respective copied directories.
- Tesseract.js, Project Naptha and contributors: Apache-2.0.
  Source: https://github.com/naptha/tesseract.js
  License: `TESSERACT-LICENSE.txt`; bundled dependency notices:
  `tesseract.min.js.LICENSE.txt` and `worker.min.js.LICENSE.txt`.
- Tesseract.js-core: Apache-2.0.
  Source: https://github.com/naptha/tesseract.js-core
  License: `TESSERACT-CORE-LICENSE.txt`.
- German and English `4.0.0_best_int` trained data from
  https://github.com/naptha/tessdata, integerized Tesseract language models.
  Upstream data license: Apache-2.0 (`TESSDATA-APACHE-2.0.txt`).
  The language package metadata is preserved in `lang/*.package.json`.
  See also https://github.com/tesseract-ocr/tessdata_best.

No document contents are sent to these projects, their services, or a CDN.
