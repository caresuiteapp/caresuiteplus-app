#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, statSync, createReadStream } from 'node:fs';
import { join, basename } from 'node:path';

const MIB = 1024 * 1024;
const tarBinary = process.env.CARESUITE_GITBASH_TAR || 'tar';
const unzipBinary = process.env.CARESUITE_GITBASH_UNZIP || 'unzip';
export const publicCommand = (command, args, options = {}) => {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 4 * MIB, ...options });
  if (result.status !== 0 || result.error) throw new Error('Werkzeug fehlgeschlagen: ' + basename(command));
  return result.stdout;
};

export async function streamCommand(command, args, limit, consume, options = {}) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
  let bytes = 0;
  let failed = null;
  const finished = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error('Dateiprüfung fehlgeschlagen: ' + basename(command))));
  });
  finished.catch(() => {});
  // Keep stderr out of terminal output; credential tool failures must not
  // inadvertently expose private inputs. Public command names identify errors.
  child.stderr.resume();
  try {
    for await (const chunk of child.stdout) {
      bytes += chunk.length;
      if (bytes > limit) throw new Error('Datei überschreitet die Prüfgrenze von ' + limit + ' Bytes.');
      consume(chunk);
    }
  } catch (error) { failed = error; child.kill(); }
  try { await finished; } catch (error) { failed ??= error; }
  if (failed) throw failed;
  return bytes;
}

async function digestCommand(command, args, limit) {
  const hash = createHash('sha256');
  const bytes = await streamCommand(command, args, limit, chunk => hash.update(chunk));
  return { sha256: hash.digest('hex'), bytes };
}

async function readCommand(command, args, limit) {
  const chunks = [];
  await streamCommand(command, args, limit, chunk => chunks.push(chunk));
  return Buffer.concat(chunks);
}

function fields(data) {
  let offset = 0;
  function varint() {
    let value = 0n;
    for (let shift = 0n; shift < 70n; shift += 7n) {
      if (offset >= data.length) throw new Error('Unvollständiges Manifest-Protobuf.');
      const byte = data[offset++];
      value |= BigInt(byte & 127) << shift;
      if (byte < 128) {
        if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Ungültige Manifest-Zahl.');
        return Number(value);
      }
    }
    throw new Error('Ungültiges Manifest-Protobuf.');
  }
  const result = [];
  while (offset < data.length) {
    const tag = varint(), number = Math.floor(tag / 8), wire = tag & 7;
    if (!number) throw new Error('Ungültiges Manifest-Feld.');
    if (wire === 0) result.push([number, varint()]);
    else if ([1, 2, 5].includes(wire)) {
      const size = wire === 2 ? varint() : wire === 1 ? 8 : 4;
      if (offset + size > data.length) throw new Error('Unvollständiges Manifest-Feld.');
      result.push([number, data.subarray(offset, offset + size)]);
      offset += size;
    } else throw new Error('Nicht unterstütztes Manifest-Feld.');
  }
  return result;
}

export function manifestIdentity(data) {
  const root = new Map(fields(data)).get(1);
  if (!Buffer.isBuffer(root)) throw new Error('Manifest-Wurzel fehlt.');
  const attributes = new Map();
  let rootName;
  for (const [number, value] of fields(root)) {
    if (number === 3) rootName = value.toString('utf8');
    if (number !== 4) continue;
    const attr = new Map(fields(value));
    const key = (attr.get(1)?.toString('utf8') ?? '') + '|' + (attr.get(2)?.toString('utf8') ?? '');
    let text = attr.get(3)?.toString('utf8') ?? '';
    if (!text && attr.has(6)) {
      const item = new Map(fields(attr.get(6)));
      if (item.has(7)) {
        const primitive = new Map(fields(item.get(7)));
        const numberValue = primitive.get(6) ?? primitive.get(7);
        if (typeof numberValue === 'number') text = String(numberValue);
      } else if (item.has(2) || item.has(3)) {
        text = new Map(fields(item.get(2) ?? item.get(3))).get(1)?.toString('utf8') ?? '';
      }
    }
    if (attributes.has(key)) throw new Error('Doppeltes Manifest-Attribut.');
    attributes.set(key, text);
  }
  if (rootName !== 'manifest') throw new Error('Keine Manifest-Wurzel.');
  return {
    applicationId: attributes.get('|package'),
    versionName: attributes.get('http://schemas.android.com/apk/res/android|versionName'),
    versionCode: Number(attributes.get('http://schemas.android.com/apk/res/android|versionCode') ?? 0),
  };
}

export function requireIdentity(identity, baseline) {
  if (identity.applicationId !== 'app.caresuitehealthos' || identity.versionName !== '0.4.0') throw new Error('AAB gehört nicht zur vollständigen CareSuite HealthOS 0.4.0.');
  if (!Number.isInteger(baseline) || baseline < 40 || !Number.isInteger(identity.versionCode) || identity.versionCode <= baseline || identity.versionCode > 2100000000) throw new Error('AAB enthält keinen gültigen erhöhten Versionscode.');
}

export async function verifyR8Archive(path, expectedMappingHash) {
  const members = publicCommand(tarBinary, ['--force-local', '-tzf', path]).trim().split(/\r?\n/).filter(Boolean);
  function one(name) {
    const found = members.filter(x => x.split('/').at(-1) === name);
    if (found.length !== 1) throw new Error('R8-Artefakt ' + name + ': genau eine Datei erwartet, gefunden: ' + found.length);
    return found[0];
  }
  const mapping = one('mapping.txt'), configuration = one('configuration.txt');
  const hash = createHash('sha256'), decoder = new TextDecoder('utf-8', { fatal: true });
  const prefix = [];
  let prefixBytes = 0;
  const mappingBytes = await streamCommand(tarBinary, ['--force-local', '-xOzf', path, '--', mapping], 512 * MIB, chunk => {
    hash.update(chunk);
    decoder.decode(chunk, { stream: true });
    const piece = chunk.subarray(0, Math.max(0, 65536 - prefixBytes));
    prefix.push(piece); prefixBytes += piece.length;
  });
  decoder.decode();
  if (!mappingBytes || !/^#\s*compiler:\s*r8\b/im.test(Buffer.concat(prefix).toString('utf8'))) throw new Error('Das Mapping gehört nicht zu einem R8-Build.');
  const mappingSha256 = hash.digest('hex');
  if (expectedMappingHash && mappingSha256 !== expectedMappingHash) throw new Error('R8-Mapping stimmt nicht mit dem signierten Mapping im AAB überein.');
  const rules = new TextDecoder('utf-8', { fatal: true }).decode(await readCommand(tarBinary, ['--force-local', '-xOzf', path, '--', configuration], 50 * MIB));
  if (!rules || /^\s*-(?:dontoptimize|dontshrink|dontobfuscate)\b/m.test(rules)) throw new Error('Die tatsächlichen R8-Regeln deaktivieren Release-Optimierungen.');
  return { mappingSha256, mappingBytes };
}

export async function verifyLocalAab({ bundle, r8Archive, baseline, code, sourceRoot, commit, javaHome }) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Geprüfter Quellcommit fehlt.');
  const names = publicCommand(unzipBinary, ['-Z1', bundle]).trim().split(/\r?\n/);
  if (new Set(names).size !== names.length) throw new Error('Doppelte AAB-Dateieinträge.');
  if (!names.includes('BundleConfig.pb') || names.filter(x => /^META-INF\/[^/]+\.(RSA|DSA|EC)$/i.test(x)).length !== 1) throw new Error('Keine eindeutig signierte AAB-Struktur.');
  const identity = manifestIdentity(await readCommand(unzipBinary, ['-p', bundle, 'base/manifest/AndroidManifest.xml'], MIB));
  requireIdentity(identity, baseline);
  if (identity.versionCode !== code) throw new Error('AAB-Versionscode stimmt nicht mit der reservierten EAS-Version überein.');
  const native = names.filter(x => x.startsWith('base/assets/') && x.endsWith('.bundle'));
  if (native.length !== 1) throw new Error('Genau ein nativer Hermes-Bundle erwartet.');
  const hermes = await readCommand(unzipBinary, ['-p', bundle, native[0]], 128 * MIB);
  const markers = ['native-administration-desktop', 'Neues Passwort speichern', 'Ohne Anmeldung ein Support-Ticket einreichen', 'Neo-Assistent', 'Google Workspace'];
  for (const marker of markers) if (!hermes.includes(Buffer.from(marker)) && !hermes.includes(Buffer.from(marker, 'utf16le'))) throw new Error('Native Oberfläche fehlt: ' + marker);
  const intro = JSON.parse(readFileSync(join(sourceRoot, 'assets/brand/intro/manifest.json'), 'utf8'));
  const videoHashes = new Set();
  for (const name of names.filter(x => x.startsWith('base/') && x.endsWith('.mp4'))) videoHashes.add((await digestCommand(unzipBinary, ['-p', bundle, name], 128 * MIB)).sha256);
  for (const item of intro.formats) if (!videoHashes.has(item.sha256)) throw new Error('Original-Intro fehlt oder wurde verändert: ' + item.file);
  const exportProof = JSON.parse(readFileSync(join(sourceRoot, 'docs/store/releases/20261009-android-export-verification.json'), 'utf8'));
  const fontHashes = new Set();
  for (const name of names.filter(x => x.startsWith('base/') && x.toLowerCase().endsWith('.ttf'))) fontHashes.add((await digestCommand(unzipBinary, ['-p', bundle, name], 16 * MIB)).sha256);
  if (!fontHashes.has(exportProof.nativeFont.sha256)) throw new Error('Die Originalschrift fehlt im AAB.');
  const javaTool = name => join(javaHome, 'bin', name + (process.platform === 'win32' ? '.exe' : ''));
  const signature = publicCommand(javaTool('jarsigner'), ['-J-Duser.language=en', '-J-Duser.country=US', '-verify', bundle]);
  if (!/\bjar verified\./.test(signature)) throw new Error('Die vollständige JAR-Signatur ist nicht bestätigt.');
  const publicCert = publicCommand(javaTool('keytool'), ['-J-Duser.language=en', '-printcert', '-jarfile', bundle, '-rfc']);
  const pem = publicCert.match(/-----BEGIN CERTIFICATE-----\s+([A-Za-z0-9+/=\s]+)-----END CERTIFICATE-----/);
  if (!pem) throw new Error('Uploadzertifikat konnte nicht gelesen werden.');
  const uploadCertificateSha256 = createHash('sha256').update(Buffer.from(pem[1].replace(/\s/g, ''), 'base64')).digest('hex').toUpperCase().match(/../g).join(':');
  const expected = JSON.parse(readFileSync(join(sourceRoot, 'docs/store/android-signing-identity.json'), 'utf8'));
  if (uploadCertificateSha256 !== expected.uploadCertificateSha256) throw new Error('AAB passt nicht zum bestätigten Uploadzertifikat.');
  const embeddedMapping = 'BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map';
  if (!names.includes(embeddedMapping)) throw new Error('Signiertes R8-Mapping im AAB fehlt.');
  const mapping = await digestCommand(unzipBinary, ['-p', bundle, embeddedMapping], 512 * MIB);
  const r8 = await verifyR8Archive(r8Archive, mapping.sha256);
  const bundleHash = createHash('sha256');
  for await (const chunk of createReadStream(bundle)) bundleHash.update(chunk);
  return {
    repository: 'caresuiteapp/caresuiteplus-app', commit, builder: 'Git Bash / Windows Gradle',
    profile: 'healthos-full-aab', file: basename(bundle), sha256: bundleHash.digest('hex'), bytes: statSync(bundle).size,
    ...identity, previousEasVersionCode: baseline, uploadCertificateSha256,
    introVersion: intro.version, verifiedIntroFormats: intro.formats.length, originalFontVerified: true,
    verifiedNativeSurfaceMarkers: markers.length, r8MappingSha256: r8.mappingSha256,
    r8MappingBytes: r8.mappingBytes, r8MergedOptimizationsVerified: true,
  };
}
