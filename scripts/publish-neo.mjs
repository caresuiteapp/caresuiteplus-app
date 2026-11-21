import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const NEO_ORIGIN = 'caresuiteapp/caresuiteplus-app';
export const neoCanonicalHash = content => crypto.createHash('sha256').update(content.replace(/\r\n?/g, '\n')).digest('hex');
export function assertNeoOrigin(value) {
  if (!['https://github.com/caresuiteapp/caresuiteplus-app.git', 'https://github.com/caresuiteapp/caresuiteplus-app', 'git@github.com:caresuiteapp/caresuiteplus-app.git', 'ssh://git@github.com/caresuiteapp/caresuiteplus-app.git'].includes(value.trim())) throw Error('Der vorhandene Git-Remote gehört nicht zum bestätigten CareSuite-Repository.');
}
export function assertNeoReleasePaths(paths, allowed) {
  const rejected = paths.filter(file => !allowed.has(file) || /(?:^|\/)(?:\.env(?:\.[^/]*)?|\.neo-runtime|node_modules|\.vercel)(?:\/|$)/.test(file));
  if (rejected.length) throw Error('Der Arbeitsstand enthält Änderungen außerhalb des NEO-Pakets. Diese werden nicht mit veröffentlicht: ' + rejected.join(', '));
}
export function parseNeoPublishArgs(args) {
  let root = '', publish = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--repo' && args[i + 1]) root = path.resolve(args[++i]);
    else if (args[i] === '--publish') publish = true;
    else if (args[i] !== '--prepare') throw Error('Erlaubt sind --publish, --prepare und --repo ORDNER.');
  }
  return { root, publish };
}
export function findNeoReleaseRoot(explicit = '') {
  const valid = folder => fs.existsSync(path.join(folder, '.neo-runtime', 'release-manifest.json')) && fs.existsSync(path.join(folder, 'scripts', 'verify-neo.mjs'));
  if (explicit) { if (!valid(explicit)) throw Error('Der angegebene Ordner enthält kein vorbereitetes NEO-Veröffentlichungspaket.'); return explicit; }
  const candidates = [process.cwd(), path.join(os.homedir(), 'CareSuite_NEO_R1_20261121-003048-1668')];
  try { candidates.push(...fs.readdirSync(os.homedir(), { withFileTypes: true }).filter(item => item.isDirectory() && /^CareSuite_NEO_R1_/.test(item.name)).map(item => path.join(os.homedir(), item.name)).sort().reverse()); } catch {}
  const root = candidates.find(valid); if (!root) throw Error('Kein vorbereiteter NEO-Arbeitsordner gefunden. Bitte --repo verwenden.'); return root;
}
export function createNeoPublisher({ root, publish, manifest, git: suppliedGit, run: suppliedRun, log = console.log, stamp = Date.now().toString(36) }) {
  const git = suppliedGit ?? ((args, options = {}) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, ...options });
    if (result.error || result.status !== 0) { const error = Error('Git-Schritt fehlgeschlagen: ' + args.slice(0, 3).join(' ') + '\n' + (result.stderr || result.error?.message || '')); error.gitArgs = args; throw error; }
    return result.stdout?.trim() ?? '';
  });
  const run = suppliedRun ?? ((file, args = []) => {
    const result = spawnSync(process.execPath, [file, ...args], { cwd: root, stdio: 'inherit' });
    if (result.error || result.status !== 0) throw Error('Prüfung fehlgeschlagen: ' + file + '. Es wurde nichts gepusht.');
  });
  const paths = manifest.files.map(item => item.path), allowed = new Set([...paths, ...(manifest.removed ?? [])]);
  const lines = output => output ? output.split(/\r?\n/).filter(Boolean) : [];
  const changedPaths = () => [...new Set([...lines(git(['diff', '--cached', '--name-only', '--no-renames'])), ...lines(git(['diff', '--name-only', '--no-renames']))])];
  const identity = ['-c', 'user.name=caresuiteapp', '-c', 'user.email=291815573+caresuiteapp@users.noreply.github.com'];
  const staged = () => Boolean(git(['diff', '--cached', '--name-only']));
  const commit = message => { if (staged()) git([...identity, 'commit', '-m', message], { stdio: 'inherit' }); };
  const stage = () => {
    assertNeoReleasePaths(changedPaths(), allowed);
    // Deleted files that were only staged additions have already disappeared from
    // the index. Do not feed those nonexistent pathspecs to Git on later retries.
    const present = paths.filter(file => fs.existsSync(path.join(root, file)));
    const deleted = (manifest.removed ?? []).filter(file => lines(git(['ls-files', '--', file])).length);
    git(['add', '--', ...present, ...deleted]);
  };
  return function execute() {
    if (!manifest.files.length || !manifest.files.every(item => typeof item.path === 'string' && /^[a-f0-9]{64}$/.test(item.sha256))) throw Error('Das NEO-Veröffentlichungsmanifest ist ungültig.');
    assertNeoOrigin(git(['remote', 'get-url', 'origin']));
    const branch = git(['branch', '--show-current']);
    if (!/^neo\//.test(branch)) throw Error('Zum Veröffentlichen den vorbereiteten lokalen NEO-Branch verwenden. Der Hauptzweig wird nicht umgeschaltet.');
    if (git(['diff', '--name-only', '--diff-filter=U'])) throw Error('Zuerst die bereits offenen Git-Konflikte lösen.');
    assertNeoReleasePaths(changedPaths(), allowed);
    for (const item of manifest.files) {
      if (item.generated) continue;
      const file = path.join(root, item.path);
      if (!fs.existsSync(file) || neoCanonicalHash(fs.readFileSync(file, 'utf8')) !== item.sha256) throw Error('Die geprüfte NEO-Datei wurde unabhängig geändert: ' + item.path);
    }
    const backupBranch = 'backup/neo-before-publish-' + stamp;
    git(['branch', backupBranch, 'HEAD']);
    log('Sicherung des bisherigen Git-Stands: ' + backupBranch);
    if (publish) {
      log('Lade nur die aktuellen Git-Verweise; das Repository wird nicht erneut geklont.');
      git(['fetch', 'origin', 'main'], { stdio: 'inherit' });
    }
    stage(); commit(manifest.commitMessage ?? 'NEO: Aussprache, stille Dokumentation und geprüfte Arbeitsaufträge');
    if (publish) {
      try { git([...identity, 'merge', '--no-edit', 'origin/main'], { stdio: 'inherit' }); }
      catch (error) {
        const conflicts = lines(git(['diff', '--name-only', '--diff-filter=U']));
        if (conflicts.length !== 1 || conflicts[0] !== 'docs/native-workspace-source-map.json') throw error;
        git(['checkout', '--ours', '--', conflicts[0]], { stdio: 'inherit' });
        run('scripts/port-native-workspaces.mjs', ['--write']);
        git(['add', '--', conflicts[0]]); git([...identity, 'commit', '--no-edit'], { stdio: 'inherit' });
      }
    }
    run('scripts/port-native-workspaces.mjs', ['--write']);
    stage(); commit('NEO: aktuellen Web- und App-Quellabgleich sichern');
    run('scripts/verify-neo.mjs');
    if (manifest.recordConstruction) run('scripts/record-neo-construction.mjs');
    if (changedPaths().length) throw Error('Während der Prüfungen wurden versionierte Dateien verändert. Vor dem Push erneut prüfen.');
    const head = git(['rev-parse', 'HEAD']);
    if (!publish) { log('NEO lokal geprüft. Zur Veröffentlichung dasselbe Skript mit --publish ausführen.'); return { published: false, head }; }
    log('Veröffentliche den geprüften Stand auf GitHub main. Der bestehende Vercel-Git-Build startet anschließend.');
    // No force update: a newer remote main causes a rejection rather than data loss.
    git(['push', 'origin', 'HEAD:refs/heads/main'], { stdio: 'inherit' });
    log('GitHub-Push abgeschlossen: ' + head);
    log('Die Web-Freigabe erfolgt erst nach den vollständigen bestehenden Vercel-Releaseprüfungen.');
    log('Build und Veröffentlichung prüfen: https://vercel.com/caresuiteapps-projects/caresuiteplus-app');
    return { published: true, head };
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseNeoPublishArgs(process.argv.slice(2)), root = findNeoReleaseRoot(options.root);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, '.neo-runtime', 'release-manifest.json'), 'utf8'));
    console.log('NEO-Veröffentlichungsordner: ' + root);
    createNeoPublisher({ root, publish: options.publish, manifest })();
  } catch (error) { console.error(error instanceof Error ? error.message : 'NEO konnte nicht veröffentlicht werden.'); process.exitCode = 1; }
}
