import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const magic = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ n >>> 1 : n >>> 1;
  return n >>> 0;
});
export function pngCrc(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8;
  return (crc ^ 0xffffffff) >>> 0;
}
const fail = () => { throw new Error('MONTHLY_SIGNATURE_PNG'); };
const paeth = (a, b, c) => {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Bounded RGB/RGBA8, non-interlaced canvas PNG. No SVG, animation, remote
 * resources or native image decoder. This checks image integrity and reuse,
 * never handwriting, identity, legal authority or the fact of human signing. */
export function inspectMonthlySignature(input) {
  if (!(input instanceof Uint8Array) || input.length < 57 || input.length > 2 * 1024 * 1024) fail();
  const bytes = Buffer.from(input);
  if (!bytes.subarray(0, 8).equals(magic)) fail();
  let offset = 8, width, height, channels, ended = false, seenData = false, dataClosed = false, chunks = 0;
  const compressed = [], metadata = new Set();
  while (offset < bytes.length) {
    if (++chunks > 1024 || offset + 12 > bytes.length || ended) fail();
    const size = bytes.readUInt32BE(offset), end = offset + size + 12;
    if (end > bytes.length) fail();
    const type = bytes.subarray(offset + 4, offset + 8);
    if ([...type].some(c => !(c >= 65 && c <= 90 || c >= 97 && c <= 122)) || type[2] >= 97) fail();
    const kind = type.toString('ascii'), data = bytes.subarray(offset + 8, end - 4);
    if (pngCrc(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) fail();
    if (offset === 8 && kind !== 'IHDR') fail();
    if (kind === 'IHDR') {
      if (offset !== 8 || size !== 13 || data[8] !== 8 || ![2, 6].includes(data[9]) || data[10] || data[11] || data[12]) fail();
      width = data.readUInt32BE(0); height = data.readUInt32BE(4); channels = data[9] === 6 ? 4 : 3;
      if (width < 12 || height < 3 || width > 4096 || height > 2048 || width * height > 2_097_152) fail();
    } else if (kind === 'IDAT') {
      if (dataClosed) fail();
      seenData = true; compressed.push(data);
    } else if (kind === 'IEND') {
      if (!seenData || size !== 0) fail();
      ended = true;
    } else {
      // ICC, EXIF, compressed metadata and APNG are deliberately unsupported.
      if (!['pHYs', 'sRGB', 'gAMA', 'cHRM', 'tEXt'].includes(kind) || size > 8192) fail();
      if (kind !== 'tEXt' && (seenData || metadata.has(kind))) fail();
      metadata.add(kind);
      if (kind === 'pHYs' && (size !== 9 || data[8] > 1) || kind === 'sRGB' && (size !== 1 || data[0] > 3)
        || kind === 'gAMA' && (size !== 4 || data.readUInt32BE(0) === 0) || kind === 'cHRM' && size !== 32) fail();
      if (kind === 'tEXt') {
        const separator = data.indexOf(0), keyword = data.subarray(0, separator);
        if (separator < 1 || separator > 79 || data.indexOf(0, separator + 1) !== -1
          || keyword[0] === 32 || keyword.at(-1) === 32 || keyword.includes(Buffer.from('  '))
          || [...keyword].some(c => c < 32 || c > 126 && c < 161)) fail();
      }
      if (seenData) dataClosed = true;
    }
    offset = end;
  }
  if (!ended) fail();
  const stride = width * channels, expected = height * (stride + 1), packed = Buffer.concat(compressed);
  let raw;
  try {
    const result = inflateSync(packed, { maxOutputLength: expected, info: true });
    if (result.engine.bytesWritten !== packed.length || result.buffer.length !== expected) fail();
    raw = result.buffer;
  } catch { fail(); }
  const pixels = Buffer.alloc(width * height * 3), previous = Buffer.alloc(stride), row = Buffer.alloc(stride);
  let left = width, top = height, right = -1, bottom = -1, ink = 0;
  for (let y = 0; y < height; y++) {
    const base = y * (stride + 1), filter = raw[base];
    if (filter > 4) fail();
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0, b = previous[x], c = x >= channels ? previous[x - channels] : 0;
      const predict = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : paeth(a, b, c);
      row[x] = (raw[base + 1 + x] + predict) & 255;
    }
    for (let x = 0; x < width; x++) {
      const src = x * channels, dst = (y * width + x) * 3, alpha = channels === 4 ? row[src + 3] : 255;
      for (let c = 0; c < 3; c++) pixels[dst + c] = Math.round((row[src + c] * alpha + 255 * (255 - alpha)) / 255);
      if (Math.min(...pixels.subarray(dst, dst + 3)) < 245) {
        ink++; left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
    row.copy(previous);
  }
  const inkWidth = right - left + 1, inkHeight = bottom - top + 1;
  if (ink < 24 || inkWidth < 12 || inkHeight < 3 || ink > width * height * 0.65) fail();
  // Crop empty padding and hash decoded appearance, independent of filters,
  // compression, metadata, RGB/RGBA encoding and transparent white margins.
  const normalized = createHash('sha256').update(`gkv-signature-rgb-v1:${inkWidth}:${inkHeight}:`);
  for (let y = top; y <= bottom; y++) normalized.update(pixels.subarray((y * width + left) * 3, (y * width + right + 1) * 3));
  return { bytes, sha256: digest(bytes), inkSha256: normalized.digest('hex'), width, height };
}
