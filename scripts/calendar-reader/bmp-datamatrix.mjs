import { BinaryBitmap, ChecksumException, DataMatrixReader, DecodeHintType, FormatException, HybridBinarizer, IllegalArgumentException, NotFoundException, RGBLuminanceSource, ZXingStringEncoding } from '@zxing/library';

// KBV uses ISO-8859-1, including for Base256 codewords. Browser TextDecoder
// aliases this label to Windows-1252, and ZXing's Node fallback assumes UTF-8.
ZXingStringEncoding.customDecoder = (bytes, encoding) => {
  if (encoding.toUpperCase() !== 'ISO-8859-1') return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  let result = '';
  for (let start = 0; start < bytes.length; start += 8192) result += String.fromCharCode(...bytes.subarray(start, start + 8192));
  return result;
};

// BMP carries XML in ECC200 DataMatrix, never in an arbitrary URL or OCR line.
export function looksLikeBmpXml(value) {
  return typeof value === 'string' && value.length <= 131072 && !value.includes('\uFFFD')
    && /^\uFEFF?\s*(?:<\?xml\s[^?]*\?>\s*)?<MP(?:\s|>)/.test(value);
}

// Locate possible ECC200 L-borders anywhere on a page. Only the actual
// decoder can accept a region; black page rules and letters aren't data.
function candidateRegions(gray, width, height) {
  const step = Math.max(1, Math.ceil(Math.sqrt(width * height / 1_500_000)));
  const w = Math.ceil(width / step), h = Math.ceil(height / step);
  const cells = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    cells[y * w + x] = gray[y * step * width + x * step] < 130 ? 1 : 0;
  }
  const queue = new Int32Array(cells.length);
  const candidates = [];
  for (let i = 0; i < cells.length; i++) {
    if (!cells[i]) continue;
    let start = 0, end = 1, minX = w, minY = h, maxX = 0, maxY = 0;
    cells[i] = 0;
    queue[0] = i;
    const add = (n) => { if (cells[n]) { cells[n] = 0; queue[end++] = n; } };
    while (start < end) {
      const next = queue[start++];
      const y = Math.floor(next / w), x = next - y * w;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      if (x > 0) add(next - 1);
      if (x < w - 1) add(next + 1);
      if (y > 0) add(next - w);
      if (y < h - 1) add(next + w);
    }
    const bw = maxX - minX + 1, bh = maxY - minY + 1, area = bw * bh;
    if (bw < 12 || bh < 12 || area > cells.length * 0.8 || bw > 5 * bh || bh > 5 * bw || end < area / 25 || end > area * 0.93) continue;
    const pad = Math.max(8, Math.ceil(Math.max(bw, bh) * step * 0.16));
    const left = Math.max(0, minX * step - pad), top = Math.max(0, minY * step - pad);
    const right = Math.min(width, (maxX + 1) * step + pad), bottom = Math.min(height, (maxY + 1) * step + pad);
    candidates.push({ left, top, width: right - left, height: bottom - top, area });
  }
  return candidates.sort((a, b) => b.area - a.area).slice(0, 16);
}

export function readBmpDataMatrix(pixels, width, height) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 12 || height < 12
    || width * height > 8_000_000 || pixels.length !== width * height * 4) throw new Error('Bildgröße ist ungültig.');
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0; i < gray.length; i++) {
    const a = pixels[4 * i + 3] / 255;
    gray[i] = a * ((pixels[4 * i] + 2 * pixels[4 * i + 1] + pixels[4 * i + 2]) / 4) + (1 - a) * 255;
  }
  const source = new RGBLuminanceSource(gray, width, height);
  const reader = new DataMatrixReader();
  const found = new Set();
  const pureHints = new Map([[DecodeHintType.PURE_BARCODE, true]]);
  const detect = (candidate) => {
    const bitmap = new BinaryBitmap(new HybridBinarizer(candidate));
    for (const hints of [undefined, pureHints]) {
      try {
        const value = reader.decode(bitmap, hints).getText();
        if (looksLikeBmpXml(value)) found.add(value);
        return;
      } catch (error) {
        // The second pass handles a tight, unskewed code, still with ECC validation.
        if (!(error instanceof NotFoundException || error instanceof ChecksumException || error instanceof FormatException
          || hints && error instanceof IllegalArgumentException)) throw error;
      }
    }
  };
  detect(source);
  for (const region of candidateRegions(gray, width, height)) detect(source.crop(region.left, region.top, region.width, region.height));
  return [...found];
}
