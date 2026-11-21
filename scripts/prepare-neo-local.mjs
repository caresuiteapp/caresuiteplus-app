import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, chmod, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform, Readable } from 'node:stream';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
const execute = promisify(execFile);
export const NEO_ASSETS = Object.freeze({
  model: { file: 'ggml-small-q5_1.bin', size: 190085487, sha256: 'ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb', url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-small-q5_1.bin' },
  windows: { file: 'whisper-bin-x64.zip', size: 4078768, sha256: '74f973345cb52ef5ba3ec9e7e7af8e48cc8c71722d1528603b80588a11f82e3e', url: 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.4/whisper-bin-x64.zip' },
});
export async function verifyNeoAsset(path, asset) {
  try { const hash = createHash('sha256'); let bytes = 0; for await (const chunk of createReadStream(path)) { bytes += chunk.length; hash.update(chunk); } return bytes === asset.size && hash.digest('hex') === asset.sha256; } catch { return false; }
}
export async function downloadNeoAsset(path, asset, fetcher = fetch) {
  if (await verifyNeoAsset(path, asset)) return;
  const partial = path + '.' + randomBytes(6).toString('hex') + '.partial';
  try {
    const response = await fetcher(asset.url, { signal: AbortSignal.timeout(10 * 60 * 1000) });
    if (!response.ok || !response.body) throw Error('NEO-Download nicht erreichbar.');
    let bytes = 0; const hash = createHash('sha256');
    await pipeline(Readable.fromWeb(response.body), new Transform({ transform(chunk, _, callback) { bytes += chunk.length; if (bytes > asset.size) return callback(Error('NEO-Download ist größer als erwartet.')); hash.update(chunk); callback(null, chunk); } }), createWriteStream(partial, { flags: 'wx', mode: 0o600 }));
    if (bytes !== asset.size || hash.digest('hex') !== asset.sha256) throw Error('Die Integritätsprüfung des NEO-Downloads ist fehlgeschlagen.');
    await rename(partial, path);
  } finally { await rm(partial, { force: true }); }
}
async function findBinary(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) { const found = await findBinary(join(directory, entry.name)); if (found) return found; }
    if (entry.isFile() && entry.name === 'whisper-cli.exe') return join(directory, entry.name);
  }
  return '';
}
export async function prepareNeoLocal(args = process.argv.slice(2)) {
  if (args.some(arg => !['--model-only'].includes(arg))) throw Error('Verfügbare Option: --model-only');
  const directory = resolve('.neo-runtime'); await mkdir(directory, { recursive: true, mode: 0o700 });
  const model = join(directory, NEO_ASSETS.model.file);
  console.log('NEO-Sprachmodell wird geprüft / vorbereitet (190 MB).'); await downloadNeoAsset(model, NEO_ASSETS.model);
  let binary = process.env.NEO_WHISPER_BINARY ?? '';
  if (process.platform === 'win32' && process.arch === 'x64' && !args.includes('--model-only') && !binary) {
    const archive = join(directory, NEO_ASSETS.windows.file), target = join(directory, 'whisper-v1.8.4');
    await downloadNeoAsset(archive, NEO_ASSETS.windows); await mkdir(target, { recursive: true });
    const quote = value => "'" + value.replaceAll("'", "''") + "'";
    const command = `Expand-Archive -LiteralPath ${quote(archive)} -DestinationPath ${quote(target)} -Force`;
    await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(command, 'utf16le').toString('base64')], { windowsHide: true, timeout: 60000 });
    binary = await findBinary(target); if (!binary) throw Error('whisper-cli.exe fehlt im geprüften Windows-Paket.');
  }
  const settingsPath = join(directory, 'settings.json'); let existing = {};
  try { existing = JSON.parse(await readFile(settingsPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw Error('Die vorhandene private NEO-Konfiguration ist ungültig; sie wurde nicht überschrieben.'); }
  if (binary) await access(binary);
  const settings = { ...existing, token: typeof existing.token === 'string' && existing.token.length >= 32 ? existing.token : randomBytes(48).toString('base64url'), model, ...(binary ? { binary } : {}) };
  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', { mode: 0o600 }); await chmod(settingsPath, 0o600);
  console.log(binary ? 'Eigener NEO-Sprachdienst vorbereitet. Start: node scripts/start-neo-local.mjs' : 'Sprachmodell vorbereitet. Auf diesem System benötigt der Dienst den vorhandenen whisper-cli-Pfad als NEO_WHISPER_BINARY.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) prepareNeoLocal().catch(() => { console.error('NEO konnte nicht vollständig vorbereitet werden. Download, Plattform und vorhandene lokale Engine prüfen. Keine Zugangsdaten wurden ausgegeben.'); process.exitCode = 1; });
