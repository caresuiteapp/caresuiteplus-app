import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, copyFile, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createNeoVercelEngine } from '../api/_lib/neo-vercel-engine.mjs';
const modelAsset = { file: 'ggml-small-q5_1.bin', size: 190085487, sha256: 'ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb' };
async function digest(file) { const hash = createHash('sha256'); for await (const part of createReadStream(file)) hash.update(part); return hash.digest('hex'); }
/** Copies only explicitly supplied artifacts; never downloads or executes an unverified engine. */
export async function prepareNeoVercel(args = process.argv.slice(2)) {
  const options = { binary: '', binaryHash: '', model: '', output: resolve('api/_lib/neo-assets'), check: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check') options.check = true;
    else if (args[i] === '--binary' && args[i + 1]) options.binary = resolve(args[++i]);
    else if (args[i] === '--binary-sha256' && args[i + 1]) options.binaryHash = args[++i];
    else if (args[i] === '--model' && args[i + 1]) options.model = resolve(args[++i]);
    else if (args[i] === '--output' && args[i + 1]) options.output = resolve(args[++i]);
    else throw Error('Erlaubt: --check oder --binary DATEI --binary-sha256 SHA256 --model DATEI [--output ORDNER].');
  }
  if (!args.length || options.check) {
    if (options.binary || options.model || options.binaryHash) throw Error('--check schreibt keine Assets und akzeptiert keine neuen Artefakte.');
    const status = await createNeoVercelEngine({ assetDirectory: options.output }).status();
    console.log(status.transcriptionReady ? 'NEO-Linux-Dateiintegrität und Laufzeitstart bestätigt. Erkennungsqualität gesondert prüfen.' : 'NEO-Cloud-Erkennung ist nicht aktiviert: Freigabe oder geprüfte Linux-Artefakte fehlen.');
    return status;
  }
  if (!options.binary || !options.model || !/^[a-f0-9]{64}$/.test(options.binaryHash)) throw Error('Für die Vorbereitung fehlen eine vorab geprüfte Linux-Engine, deren SHA-256 und das vorhandene NEO-Modell.');
  const binaryStat = await lstat(options.binary), modelStat = await lstat(options.model);
  if (!binaryStat.isFile() || binaryStat.isSymbolicLink() || binaryStat.size < 64 || binaryStat.size > 40_000_000 || !modelStat.isFile() || modelStat.isSymbolicLink() || modelStat.size !== modelAsset.size) throw Error('Die übergebenen Artefakte sind keine passenden regulären Dateien.');
  if (await digest(options.binary) !== options.binaryHash || await digest(options.model) !== modelAsset.sha256) throw Error('Die Artefakt-Prüfsummen stimmen nicht mit dem bestätigten Stand überein.');
  const header = (await readFile(options.binary)).subarray(0, 20);
  if (header[0] !== 0x7f || header.toString('ascii', 1, 4) !== 'ELF' || header[4] !== 2 || header[5] !== 1 || header.readUInt16LE(18) !== 62) throw Error('Die Engine ist keine Linux-x64-ELF-Datei. Die Windows-Engine kann auf Vercel nicht verwendet werden.');
  await mkdir(options.output, { recursive: true });
  const binary = join(options.output, 'whisper-cli'), model = join(options.output, modelAsset.file);
  if (binary !== options.binary) await copyFile(options.binary, binary); if (model !== options.model) await copyFile(options.model, model);
  await chmod(binary, 0o500); await chmod(model, 0o400);
  await writeFile(join(options.output, 'manifest.json'), JSON.stringify({ version: 'whisper.cpp-v1.8.4', platform: 'linux-x64', binary: { file: 'whisper-cli', size: binaryStat.size, sha256: options.binaryHash }, model: modelAsset }, null, 2) + '\n', { mode: 0o600 });
  console.log('NEO-Artefakte vorbereitet. Die Dateiprüfung bestätigt weder Linux-Laufzeitkompatibilität noch Erkennungsqualität. Kein Deployment ausgeführt.');
  return { transcriptionReady: false, prepared: true };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) prepareNeoVercel().catch(error => { console.error(error instanceof Error ? error.message : 'NEO-Artefakte konnten nicht vorbereitet werden.'); process.exitCode = 1; });
