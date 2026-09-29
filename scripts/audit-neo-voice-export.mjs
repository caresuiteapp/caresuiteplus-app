import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(root, process.argv[2] || 'dist');
const manifest = JSON.parse(await readFile(path.join(root, 'scripts/neo-voice-assets.json'), 'utf8'));
const sha256 = data => createHash('sha256').update(data).digest('hex');
for (const asset of [...manifest.runtime, ...manifest.model.parts]) {
  const bytes = await readFile(path.join(output, 'neo-voice/v1', asset.file));
  assert.equal(bytes.length, asset.bytes, `Neo export size: ${asset.file}`);
  assert.equal(sha256(bytes), asset.sha256, `Neo export SHA-256: ${asset.file}`);
}
for (const file of manifest.bundledFiles) {
  const expected = await readFile(path.join(root, 'public/neo-voice/v1', file));
  const exported = await readFile(path.join(output, 'neo-voice/v1', file));
  assert.ok(expected.equals(exported), `Neo export missing or changed: ${file}`);
}
const bundleDirectory = path.join(output, '_expo/static/js/web');
const recording = await readFile(path.join(root, 'src/ai/robot/neoFixedAudio.web.ts'), 'utf8');
const encoded = JSON.parse(recording.slice(recording.indexOf('=') + 1).trim().replace(/;$/, ''));
const signature = Object.values(encoded)[0].slice(2000, 2200);
let workerIncluded = false, recordingIncluded = false;
for (const file of await readdir(bundleDirectory)) {
  if (!file.endsWith('.js')) continue;
  const script = await readFile(path.join(bundleDirectory, file), 'utf8');
  workerIncluded ||= script.includes('/neo-voice/v1/neo-worker.js');
  recordingIncluded ||= script.includes(signature);
}
assert.ok(workerIncluded && recordingIncluded, 'Neo web integration or updated introduction is missing from the bundle.');
console.log('Neo export verified: worker, complete local model, runtime and license/source files.');
