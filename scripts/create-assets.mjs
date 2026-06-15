import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/** Minimal PNG encoder — solid color tile >= 500 bytes for store readiness tests. */
function createSolidPng(width, height, r, g, b) {
  const rowSize = 1 + width * 3;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y += 1) {
    const offset = y * rowSize;
    raw[offset] = 0;
    for (let x = 0; x < width; x += 1) {
      const px = offset + 1 + x * 3;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
    }
  }
  const compressed = zlib.deflateSync(raw);

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i += 1) {
      c ^= buf[i];
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = path.join(process.cwd(), 'assets');
fs.mkdirSync(dir, { recursive: true });

const lightBg = createSolidPng(64, 64, 248, 250, 252);
const splashBg = createSolidPng(64, 128, 255, 255, 255);

const files = [
  { file: 'icon.png', data: lightBg },
  { file: 'favicon.png', data: lightBg },
  { file: 'splash-icon.png', data: splashBg },
  { file: 'android-icon-foreground.png', data: lightBg },
  { file: 'android-icon-background.png', data: splashBg },
  { file: 'android-icon-monochrome.png', data: lightBg },
  { file: 'notification-icon.png', data: lightBg },
];

for (const { file, data } of files) {
  fs.writeFileSync(path.join(dir, file), data);
}
console.log(`Created ${files.length} build-capable assets in assets/`);
