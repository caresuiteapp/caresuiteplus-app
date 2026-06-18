import fs from 'node:fs';
import sharp from 'sharp';

async function analyze(path) {
  if (!fs.existsSync(path)) {
    console.log('MISSING:', path);
    return;
  }
  const meta = await sharp(path).metadata();
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparent = 0;
  let opaque = 0;
  let blackOpaque = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 10) transparent++;
    else if (a > 245) {
      opaque++;
      if (r < 25 && g < 25 && b < 25) blackOpaque++;
    }
  }
  const total = info.width * info.height;
  console.log('\n===', path.split(/[/\\]/).pop(), '===');
  console.log(`${info.width}x${info.height} channels=${info.channels}`);
  console.log(`transparent=${transparent} opaque=${opaque} blackOpaque=${blackOpaque} total=${total}`);
}

const files = [
  'assets/images/caresuite-mascot.png',
  'assets/images/caresuite-icon.png',
  'C:/Users/Kevin Reinhardt/.cursor/projects/c-Users-Kevin-Reinhardt-Documents-CareSuite/assets/c__Users_Kevin_Reinhardt_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images__-b34d7f6a-ad8b-40bd-a061-68545c275c29.png',
];

for (const f of files) await analyze(f);
