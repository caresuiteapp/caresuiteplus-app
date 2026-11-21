import { chmod, copyFile, lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { downloadNeoAsset, verifyNeoAsset } from './prepare-neo-local.mjs';
import { createNeoVercelEngine, NEO_VERCEL_MODELS, NEO_VERCEL_WASM } from '../api/_lib/neo-vercel-engine.mjs';
const revision = '5359861c739e955e79d9a303bcbc70fb988958b1';
const modelAsset = { file: 'ggml-base-q5_1.bin', ...NEO_VERCEL_MODELS['ggml-base-q5_1.bin'], url: `https://huggingface.co/ggerganov/whisper.cpp/resolve/${revision}/ggml-base-q5_1.bin` };
const wasmAsset = { ...NEO_VERCEL_WASM, url: 'https://ggml.ai/whisper.cpp/main.js' };
const FIXTURE_SHA = '07834b6a84e35a9e8f6c803a24fbc2b4c5b0834fe8a6438024d40b4ba769fb66';
async function digest(file) { const hash = createHash('sha256'); for await (const part of createReadStream(file)) hash.update(part); return hash.digest('hex'); }

export async function normalizeNeoVercelPermissions(directory, hasNative) {
  await chmod(directory, 0o755);
  for (const name of [modelAsset.file, wasmAsset.file, 'manifest.json']) await chmod(join(directory, name), 0o644);
  if (hasNative) await chmod(join(directory, 'whisper-cli'), 0o755);
  try { await chmod(join(directory, 'native-build.json'), 0o644); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

export async function testNeoVercelAssets(directory, manifest) {
  const fixture = JSON.parse(await readFile(new URL('../api/_lib/neo-readiness-fixture.json', import.meta.url), 'utf8'));
  if (fixture.synthetic !== true || fixture.audioSha256 !== FIXTURE_SHA || createHash('sha256').update(Buffer.from(fixture.audioBase64, 'base64')).digest('hex') !== FIXTURE_SHA) throw Error('Der synthetische NEO-Prüfsatz ist beschädigt.');
  const checks = [];
  // Verify the portable path too: build-machine AVX2 availability may differ
  // from a later Lambda instance. This is a bounded smoke test, not clinical QA.
  for (const forceWasm of [false, true]) {
    const engine = createNeoVercelEngine({ assetDirectory: directory, allowUnvalidatedArtifacts: true, forceWasm });
    try {
      const status = await engine.status();
      if (!status.transcriptionReady) throw Error('Die vorbereitete NEO-Engine ist nicht startbereit.');
      if (forceWasm && checks.some(check => check.backend === 'wasm')) continue;
      const started = performance.now(), result = await engine.transcribe(fixture.audioBase64, AbortSignal.timeout(90000));
      const normalized = result.text.normalize('NFKC').toLocaleLowerCase('de-DE').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      if (result.engine !== 'whisper.cpp-vercel' || !['keine schmerzen', 'neo', 'blutdruck', 'morgen'].every(phrase => (' ' + normalized + ' ').includes(' ' + phrase + ' '))) throw Error('Der synthetische NEO-Sprachtest hat Verneinung, Anrede oder Aufgabeninhalt nicht bestätigt.');
      checks.push({ backend: status.backend, passed: true, elapsedMs: Math.round(performance.now() - started) });
      console.log(`NEO-Sprachtest bestanden: ${status.backend}, ${checks.at(-1).elapsedMs} ms, ausschließlich synthetisches Prüfaudio.`);
    } finally { await engine.dispose(); }
  }
  return { passed: true, synthetic: true, fixtureSha256: FIXTURE_SHA, modelSha256: manifest.model.sha256, wasmSha256: manifest.wasm.sha256, nativeSha256: manifest.native?.sha256 ?? null, node: process.version, checkedAt: new Date().toISOString(), checks };
}

/** Build assets only. Public model/source downloads never receive audio or account data. */
export async function prepareNeoVercel(args = process.argv.slice(2)) {
  const options = { binary: '', binaryHash: '', model: '', output: resolve('api/_lib/neo-assets'), check: false, requiredNative: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check') options.check = true;
    else if (args[i] === '--prepare') {}
    else if (args[i] === '--require-native') options.requiredNative = true;
    else if (args[i] === '--binary' && args[i + 1]) options.binary = resolve(args[++i]);
    else if (args[i] === '--binary-sha256' && args[i + 1]) options.binaryHash = args[++i];
    else if (args[i] === '--model' && args[i + 1]) options.model = resolve(args[++i]);
    else if (args[i] === '--output' && args[i + 1]) options.output = resolve(args[++i]);
    else throw Error('Erlaubt: --prepare, --check, --require-native, --output ORDNER sowie ausdrücklich vorhandene Artefakte --binary DATEI --binary-sha256 SHA256 --model DATEI.');
  }
  if (options.check) {
    if (options.binary || options.model || options.binaryHash || options.requiredNative) throw Error('--check verändert keine Artefakte.');
    const engine = createNeoVercelEngine({ assetDirectory: options.output });
    try { const status = await engine.status(); console.log(status.transcriptionReady ? `NEO-Sprachdateien geprüft; Laufzeit: ${status.backend}.` : 'NEO-Sprachdateien sind noch nicht vollständig vorbereitet.'); return status; }
    finally { await engine.dispose(); }
  }
  await mkdir(options.output, { recursive: true });
  const targetModel = join(options.output, modelAsset.file), targetWasm = join(options.output, wasmAsset.file);
  if (options.model) {
    if (!await verifyNeoAsset(options.model, modelAsset)) throw Error('Das vorhandene Sprachmodell stimmt nicht mit dem bestätigten Basis-Modell überein.');
    if (options.model !== targetModel) await copyFile(options.model, targetModel);
  } else await downloadNeoAsset(targetModel, modelAsset);
  await downloadNeoAsset(targetWasm, wasmAsset);
  let native;
  if (options.binary || options.binaryHash) {
    if (!options.binary || !/^[a-f0-9]{64}$/.test(options.binaryHash)) throw Error('Die übergebene Linux-Engine benötigt ihre bestätigte SHA-256.');
    const stat = await lstat(options.binary);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 64 || stat.size > 40000000 || await digest(options.binary) !== options.binaryHash) throw Error('Die Linux-Engine stimmt nicht mit ihrem bestätigten Stand überein.');
    const header = (await readFile(options.binary)).subarray(0, 20);
    if (header[0] !== 0x7f || header.toString('ascii', 1, 4) !== 'ELF' || header[4] !== 2 || header[5] !== 1 || header.readUInt16LE(18) !== 62) throw Error('Die Engine muss eine Linux-x64-ELF-Datei sein.');
    const target = join(options.output, 'whisper-cli'); if (options.binary !== target) await copyFile(options.binary, target); await chmod(target, 0o500);
    native = { file: 'whisper-cli', size: stat.size, sha256: options.binaryHash, version: 'whisper.cpp-v1.8.4' };
  } else {
    try {
      const { buildNeoNative } = await import('./build-neo-native.mjs');
      const built = await buildNeoNative({ outputDirectory: options.output, required: options.requiredNative });
      if (built.available) native = built.native;
    } catch (error) { if (options.requiredNative) throw error; }
  }
  if (options.requiredNative && !native) throw Error('Die erforderliche native Sprachengine konnte nicht gebaut werden.');
  if (!native) await rm(join(options.output, 'whisper-cli'), { force: true });
  const manifest = { version: 'neo-asr-v2', model: { file: modelAsset.file, size: modelAsset.size, sha256: modelAsset.sha256 }, wasm: { file: wasmAsset.file, size: wasmAsset.size, sha256: wasmAsset.sha256 }, ...(native ? { native } : {}), provenance: { modelRevision: revision, wasmUrl: wasmAsset.url, inferenceProviders: ['Vercel'], activation: 'verified-bundled-artifacts' } };
  const manifestPath = join(options.output, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
  const selfTest = await testNeoVercelAssets(options.output, manifest);
  await writeFile(manifestPath, JSON.stringify({ ...manifest, selfTest }, null, 2) + '\n', { mode: 0o600 });
  // Public build artifacts contain no user data. Lambda's runtime user may
  // differ from the build user, so private download modes are not appropriate.
  await normalizeNeoVercelPermissions(options.output, Boolean(native));
  console.log(native ? 'NEO-Sprachdateien vorbereitet: native Linux-Engine mit geprüftem WASM-Ausweichweg.' : 'NEO-Sprachdateien vorbereitet: eigener WASM-Ausweichweg ohne zusätzlichen Sprachdienst.');
  console.log('Keine Audiodaten übertragen. Die Vorbereitung ersetzt keine Prüfung am Mikrofon und keine klinische Freigabe.');
  return { prepared: true, backend: native ? 'native' : 'wasm' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) prepareNeoVercel().catch(error => { console.error(error instanceof Error ? error.message : 'NEO-Sprachdateien konnten nicht vorbereitet werden.'); process.exitCode = 1; });
