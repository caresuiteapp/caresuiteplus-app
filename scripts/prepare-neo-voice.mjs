// Build-time provisioning only. The browser loads every speech asset from CareSuite.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'scripts/neo-voice-assets.json'), 'utf8'));
const out = path.join(root, 'public/neo-voice/v1');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const valid = async asset => {
  try {
    const bytes = await readFile(path.join(out, asset.file));
    return bytes.length === asset.bytes && sha256(bytes) === asset.sha256;
  } catch { return false; }
};
async function download(asset) {
  let lastError;
  for (const url of asset.urls ?? [asset.url]) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(180_000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length !== asset.bytes || sha256(bytes) !== asset.sha256) throw new Error('size or SHA-256 mismatch');
        return bytes;
      } catch (error) { lastError = error; }
    }
  }
  throw new Error(`Neo asset unavailable: ${asset.file ?? 'voice model'} (${lastError?.message}).`);
}
async function write(asset, bytes) {
  if (bytes.length !== asset.bytes || sha256(bytes) !== asset.sha256) throw new Error(`Neo asset invalid: ${asset.file}`);
  const target = path.join(out, asset.file), temporary = target + `.neo-${process.pid}.tmp`;
  await mkdir(path.dirname(target), { recursive: true });
  try { await writeFile(temporary, bytes); await rename(temporary, target); }
  finally { await rm(temporary, { force: true }); }
}
await mkdir(out, { recursive: true });
// Keep download concurrency bounded for hosted builds.
for (let index = 0; index < manifest.runtime.length; index += 3) {
  await Promise.all(manifest.runtime.slice(index, index + 3).map(async asset => {
    if (await valid(asset)) return;
    await write(asset, await download(asset));
    console.log(`Neo: verified ${asset.file}`);
  }));
}
if (!(await Promise.all(manifest.model.parts.map(valid))).every(Boolean)) {
  console.log('Neo: preparing pinned local voice model (114 MB).');
  const bytes = await download(manifest.model);
  let offset = 0;
  for (const part of manifest.model.parts) {
    await write(part, bytes.subarray(offset, offset + part.bytes));
    offset += part.bytes;
  }
  if (offset !== bytes.length) throw new Error('Neo model part sizes do not match.');
}
console.log('Neo local speech assets ready; browser speech requires no external TTS API.');
