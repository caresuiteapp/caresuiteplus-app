import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const files = [
  'assets/icon.png',
  'assets/favicon.png',
  'assets/splash-icon.png',
  'assets/notification-icon.png',
  'assets/android-icon-foreground.png',
];

for (const rel of files) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.log('MISSING', rel);
    continue;
  }
  const { data, info } = await sharp(abs).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparent = 0;
  let blackOpaque = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 10) transparent++;
    else if (a > 200 && r < 25 && g < 25 && b < 25) blackOpaque++;
  }
  console.log(`${rel}: ${info.width}x${info.height} transparent=${transparent} blackOpaque=${blackOpaque}`);
}
