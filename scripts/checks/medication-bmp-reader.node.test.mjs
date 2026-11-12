import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { BarcodeFormat, DataMatrixWriter } from '@zxing/library';
import { readBmpDataMatrix } from '../calendar-reader/bmp-datamatrix.mjs';

const pageWidth = 1600, pageHeight = 1800;
const bmpFixture = JSON.parse(await readFile(new URL('../calendar-reader/fixtures/synthetic-bmp-ecc200.json', import.meta.url), 'utf8'));
function draw(pixels, width, height, isBlack, left, top, scale) {
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!isBlack(x, y)) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const i = 4 * ((top + y * scale + dy) * pageWidth + left + x * scale + dx);
      pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
    }
  }
}

test('decodes a large, independently encoded BMP ECC200 outside the image center, preserving Latin-1', () => {
  const { width, height, bits, text } = bmpFixture;
  const code = Buffer.from(bits, 'base64');
  const pixels = new Uint8ClampedArray(pageWidth * pageHeight * 4).fill(255);
  draw(pixels, width, height, (x, y) => {
    const i = y * width + x;
    return code[i >> 3] & (1 << (7 - (i & 7)));
  }, 910, 130, 4);
  assert.deepEqual(readBmpDataMatrix(pixels, pageWidth, pageHeight), [text]);
});

test('sees distinct BMP codes and ignores unrelated ECC200 content without guessing', () => {
  const pixels = new Uint8ClampedArray(pageWidth * pageHeight * 4).fill(255);
  const bmp1 = '<MP v="028"><P g="Märtä" f="Testperson" b="19800101"/></MP>';
  const bmp2 = '<MP v="028"><P g="Änne" f="Testperson" b="19800101"/></MP>';
  const codes = [[bmp1, 1010, 100], [bmp2, 90, 900], ['https://example.com/not-bmp', 1200, 1300]];
  for (const [text, x, y] of codes) {
    const matrix = new DataMatrixWriter().encode(text, BarcodeFormat.DATA_MATRIX, 0, 0);
    draw(pixels, matrix.getWidth(), matrix.getHeight(), (u, v) => matrix.get(u, v), x, y, 6);
  }
  assert.deepEqual(new Set(readBmpDataMatrix(pixels, pageWidth, pageHeight)), new Set([bmp1, bmp2]));
});
