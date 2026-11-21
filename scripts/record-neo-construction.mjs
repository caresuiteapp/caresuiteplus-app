import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, '.neo-runtime/release-manifest.json'), 'utf8'));
const sha = text => crypto.createHash('sha256').update(text.replace(/\r\n?/g, '\n')).digest('hex');
const files = manifest.files.map(item => {
  if (item.path.startsWith('/') || item.path.includes('\\') || item.path.split('/').some(part => ['..', '.neo-runtime', '.env', 'node_modules', '.vercel'].includes(part)) || /(?:^|\/)\.env/.test(item.path)) throw Error('Ungültiger Pfad im technischen Nachweis.');
  const source = path.join(root, item.path), content = fs.readFileSync(source, 'utf8'), digest = sha(content);
  if (!item.generated && digest !== item.sha256) throw Error('Quellstand wurde nach der Prüfung geändert: ' + item.path);
  return { path: item.path, sha256CanonicalLF: digest, bytes: Buffer.byteLength(content) };
});
const digest = sha(JSON.stringify(files));
const destination = path.join(root, '.neo-runtime/construction-records', digest);
if (!fs.existsSync(destination)) {
  fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
  for (const item of files) {
    const target = path.join(destination, 'source', item.path); fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    fs.writeFileSync(target, fs.readFileSync(path.join(root, item.path)), { mode: 0o600 });
  }
  fs.writeFileSync(path.join(destination, 'record.json'), JSON.stringify({ product: manifest.product, createdAtUTC: new Date().toISOString(),
    timestampStatus: 'local-clock-not-independent-trusted-timestamp', baseCommit: manifest.baseCommit,
    repository: 'caresuiteapp/caresuiteplus-app', canonicalSourceSetSHA256: digest, files,
    legalStatus: 'engineering-evidence-only-no-patent-or-inventorship-determination', includesAudioOrPatientRecords: false }, null, 2) + '\n', { mode: 0o600 });
}
console.log('Technischer Quellnachweis und Bauunterlagen gesichert: ' + destination);
