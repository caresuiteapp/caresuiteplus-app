/**
 * Generate CareSuite+ store/web icons from the robot mascot PNG.
 * Usage: node scripts/generate-robot-icons.mjs [sourcePath]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const defaultSource = path.join(
  process.env.USERPROFILE ?? '',
  '.cursor',
  'projects',
  'c-Users-Kevin-Reinhardt-Documents-CareSuite',
  'assets',
  'c__Users_Kevin_Reinhardt_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_CARESUITE-97b11485-e38f-476c-9aac-8dbe192140cc.png',
);
const sourcePath = process.argv[2] ?? defaultSource;
const assetsDir = path.join(root, 'assets');

const APP_BG = { r: 7, g: 11, b: 18, alpha: 1 }; // #070B12

async function squareRobot(size, { padding = 0.08, background = APP_BG } = {}) {
  const inner = Math.round(size * (1 - padding * 2));
  const robot = await sharp(sourcePath)
    .resize(inner, inner, { fit: 'contain', background })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: robot, gravity: 'centre' }])
    .png()
    .toBuffer();
}

async function splashImage() {
  const width = 1242;
  const height = 2436;
  const robotSize = Math.round(width * 0.55);
  const robot = await squareRobot(robotSize, { padding: 0.04, background: APP_BG });

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: APP_BG,
    },
  })
    .composite([{ input: robot, gravity: 'centre' }])
    .png()
    .toBuffer();
}

async function solidBackground(size, color) {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: color,
    },
  })
    .png()
    .toBuffer();
}

async function monochromeIcon(size) {
  const fg = await squareRobot(size, { padding: 0.12, background: { r: 0, g: 0, b: 0, alpha: 0 } });
  return sharp(fg).grayscale().negate().png().toBuffer();
}

async function main() {
  if (!fs.existsSync(sourcePath)) {
    console.error(`Source image not found: ${sourcePath}`);
    process.exit(1);
  }

  fs.mkdirSync(assetsDir, { recursive: true });

  const meta = await sharp(sourcePath).metadata();
  console.log(`Source: ${sourcePath} (${meta.width}x${meta.height})`);

  const outputs = [
    ['icon.png', await squareRobot(1024)],
    // favicon: use scripts/generate-favicon.py (transparent, max-scale)
    ['splash-icon.png', await splashImage()],
    ['android-icon-foreground.png', await squareRobot(1024, { padding: 0.18 })],
    ['android-icon-background.png', await solidBackground(1024, APP_BG)],
    ['android-icon-monochrome.png', await monochromeIcon(1024)],
    ['notification-icon.png', await squareRobot(96, { padding: 0.1 })],
  ];

  for (const [file, data] of outputs) {
    const dest = path.join(assetsDir, file);
    fs.writeFileSync(dest, data);
    console.log(`Wrote ${file} (${data.length} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
