import { createHash, randomBytes } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawnSync } from 'node:child_process';

const metadataUrl = 'https://api.adoptium.net/v3/assets/latest/17/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse';
const maximumArchiveBytes = 512 * 1024 * 1024;

export function compilerArchiveMetadata(records) {
  const matches = Array.isArray(records) ? records.filter(value => value?.version?.major === 17 && value?.vendor === 'eclipse' && value?.binary?.os === 'windows' && value.binary.architecture === 'x64' && value.binary.image_type === 'jdk' && value.binary.jvm_impl === 'hotspot') : [];
  if (matches.length !== 1) throw new Error('Kein eindeutiges offizielles Temurin-JDK-17-Paket für Windows x64 bestätigt.');
  const pkg = matches[0].binary.package;
  if (!pkg || !/^[a-f0-9]{64}$/i.test(pkg.checksum) || !/^OpenJDK17U-jdk_x64_windows_hotspot_[a-z0-9_.+-]+\.zip$/i.test(pkg.name) || !Number.isSafeInteger(pkg.size) || pkg.size <= 0 || pkg.size > maximumArchiveBytes) throw new Error('JDK-Paketdaten oder SHA-256-Prüfsumme nicht bestätigt.');
  const url = new URL(pkg.link);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password || !url.pathname.startsWith('/adoptium/temurin17-binaries/releases/download/')) throw new Error('Der JDK-Download stammt nicht aus dem freigegebenen offiziellen Temurin-17-Repository.');
  return { name: pkg.name, sha256: pkg.checksum.toLowerCase(), size: pkg.size, url: url.href };
}

export function compilerArchiveRoot(names) {
  const entries = names.filter(Boolean);
  if (!entries.length || entries.length > 40000 || entries.some(name => /^[a-z]:|^\//i.test(name) || /[\\\r\n\0]/.test(name) || name.split('/').some(part => part === '..'))) throw new Error('Das JDK-Archiv besitzt ungültige oder außerhalb des Zielordners liegende Pfade.');
  const roots = [...new Set(entries.map(name => name.split('/')[0]))];
  if (roots.length !== 1 || !/^jdk-17(?:\.[0-9]+)*(?:\+[0-9]+)?$/.test(roots[0])) throw new Error('Das JDK-Archiv besitzt keinen eindeutigen JDK-17-Ordner.');
  return roots[0];
}

function checkCompiler(home, run) {
  if (['java', 'javac', 'keytool', 'jarsigner'].some(name => !existsSync(join(home, 'bin', name + '.exe')))) throw new Error('Das entpackte JDK enthält nicht alle vier benötigten Werkzeuge.');
  for (const name of ['java', 'javac']) {
    const r = run(join(home, 'bin', name + '.exe'), ['-version'], { encoding: 'utf8', timeout: 15000, windowsHide: true });
    const output = String(r.stderr || '') + '\n' + String(r.stdout || '');
    const pattern = name === 'java' ? /(?:openjdk|java)\s+(?:version\s+)?"?17(?:\.|\s|")/i : /javac\s+17(?:\.|\s|$)/;
    if (r.error || r.status !== 0 || !pattern.test(output)) throw new Error('Die tatsächliche Java-/Javac-Version des JDK-17-Archivs wurde nicht bestätigt.');
  }
}

export async function prepareCompilerJdk17({ compilerHome, userProfile, state, unzip }, { approved = false, fetcher = fetch, run = spawnSync, windows = process.platform === 'win32' } = {}) {
  if (!approved) throw new Error('Ergänzung der JDK-17-Compiler-Toolchain nicht freigegeben.');
  if (!windows || !userProfile) throw new Error('Die lokale Windows-Buildumgebung wurde nicht bestätigt.');
  if (compilerHome) { checkCompiler(compilerHome, run); return { compilerHome, downloaded: false }; }
  const unzipProbe = run(unzip || 'unzip', ['-v'], { encoding: 'utf8', timeout: 10000 });
  if (unzipProbe.error || unzipProbe.status !== 0) throw new Error('Das vorhandene Git-Bash-unzip fehlt. Kein JDK heruntergeladen.');
  const response = await fetcher(metadataUrl);
  if (!response.ok) throw new Error('Die offiziellen Temurin-JDK-17-Paketdaten konnten nicht gelesen werden.');
  const text = await response.text();
  if (text.length > 1024 * 1024) throw new Error('Unerwartet große JDK-Paketdaten.');
  const metadata = compilerArchiveMetadata(JSON.parse(text));
  console.log('Freigegebene portable JDK-17-Toolchain laden: ' + metadata.name);
  const downloads = join(state, 'tool-downloads');
  const jdks = join(userProfile, '.jdks');
  const target = join(jdks, 'caresuite-temurin17-' + metadata.sha256.slice(0, 12));
  if (existsSync(target)) throw new Error('Der vorgesehene JDK-Zielordner existiert bereits und wird nicht überschrieben.');
  const asset = await fetcher(metadata.url);
  if (!asset.ok || !asset.body) throw new Error('Das offizielle JDK-17-Archiv konnte nicht geladen werden.');
  const finalUrl = new URL(asset.url || metadata.url);
  if (finalUrl.protocol !== 'https:' || !['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(finalUrl.hostname)) throw new Error('Unerwartete JDK-Downloadweiterleitung.');
  mkdirSync(downloads, { recursive: true });
  const archive = join(downloads, metadata.name + '.' + randomBytes(6).toString('hex'));
  const hash = createHash('sha256');
  let bytes = 0;
  const verifier = new Transform({ transform(chunk, encoding, callback) {
    bytes += chunk.length;
    if (bytes > metadata.size || bytes > maximumArchiveBytes) { callback(new Error('Das JDK-Archiv überschreitet die bestätigte Größe.')); return; }
    hash.update(chunk); callback(null, chunk);
  } });
  await pipeline(Readable.fromWeb(asset.body), verifier, createWriteStream(archive, { flags: 'wx' }));
  if (bytes !== metadata.size || hash.digest('hex') !== metadata.sha256) throw new Error('Die Größe oder SHA-256-Prüfsumme des JDK-Archivs stimmt nicht. Es wurde kein JDK entpackt.');
  console.log('Offizielle JDK-17-Archivgröße und SHA-256-Prüfsumme bestätigt.');
  const listing = run(unzip || 'unzip', ['-Z1', archive], { encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
  if (listing.error || listing.status !== 0) throw new Error('Die Einträge des bestätigten JDK-Archivs konnten nicht geprüft werden.');
  const folder = compilerArchiveRoot(String(listing.stdout || '').split(/\r?\n/));
  mkdirSync(jdks, { recursive: true });
  // A new staging directory outside the automatically scanned JDK caches.
  const stage = mkdtempSync(join(userProfile, '.caresuite-jdk17-stage-'));
  const extracted = run(unzip || 'unzip', ['-q', archive, '-d', stage], { stdio: 'inherit' });
  if (extracted.error || extracted.status !== 0) throw new Error('Das bestätigte JDK-Archiv konnte nicht vollständig entpackt werden.');
  checkCompiler(join(stage, folder), run);
  if (existsSync(target)) throw new Error('Der JDK-Zielordner wurde zwischenzeitlich angelegt und wird nicht überschrieben.');
  renameSync(stage, target);
  return { compilerHome: join(target, folder), downloaded: true, provider: 'Eclipse Temurin', javaMajor: 17, archiveSha256: metadata.sha256, archiveBytes: bytes };
}
