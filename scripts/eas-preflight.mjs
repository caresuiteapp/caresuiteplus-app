#!/usr/bin/env node
/**
 * EAS preview-build preflight — config audit + optional CLI checks (no build).
 * Sprint 73: dry-run only; does not claim store-ready.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLACEHOLDER_EAS_ID = '00000000-0000-0000-0000-000000000000';

const BLOCKERS = [];
const WARNINGS = [];

function warn(msg) {
  WARNINGS.push(msg);
  console.warn(`⚠ ${msg}`);
}

function blocker(msg) {
  BLOCKERS.push(msg);
  console.error(`✗ Blocker: ${msg}`);
}

function readJson(rel) {
  return JSON.parse(readFileSync(join(root, rel), 'utf8'));
}

console.log('CareSuite+ EAS preflight (Sprint 73 — dry-run)\n');

// --- eas.json profiles ---
const eas = readJson('eas.json');
for (const profile of ['development', 'preview', 'production']) {
  if (!eas.build?.[profile]) blocker(`eas.json: Profil "${profile}" fehlt`);
  else console.log(`✓ eas.json build.${profile}`);
}

if (eas.cli?.appVersionSource !== 'remote') {
  warn('eas.json: cli.appVersionSource sollte "remote" sein für autoIncrement');
} else {
  console.log('✓ eas.json cli.appVersionSource = remote');
}

const preview = eas.build?.preview;
if (preview?.distribution !== 'internal') warn('preview-Profil: distribution sollte internal sein');
if (preview?.env?.APP_ENV !== 'preview') warn('preview-Profil: APP_ENV sollte "preview" sein');
else console.log('✓ preview-Profil: internal + APP_ENV=preview');

// --- projectId ---
const appJson = readJson('app.json');
const projectId = appJson.expo?.extra?.eas?.projectId;
if (!projectId || projectId === PLACEHOLDER_EAS_ID) {
  blocker(
    'EAS projectId ist Platzhalter — vor Preview-Build: npx eas login && npx eas project:init',
  );
} else {
  console.log('✓ EAS projectId gesetzt (nicht Platzhalter)');
}

const appConfig = readFileSync(join(root, 'app.config.ts'), 'utf8');
if (!appConfig.includes('EAS_PROJECT_ID')) {
  warn('app.config.ts: EAS_PROJECT_ID env-Fallback fehlt');
} else {
  console.log('✓ app.config.ts liest EAS_PROJECT_ID aus Umgebung');
}

// --- submit placeholders ---
const submit = eas.submit?.production;
if (submit?.ios?.appleId?.startsWith('REPLACE_')) {
  warn('eas.json submit.production.ios: Apple-Credentials noch Platzhalter');
}
if (submit?.android?.serviceAccountKeyPath?.includes('secrets/')) {
  const keyPath = join(root, submit.android.serviceAccountKeyPath);
  if (!existsSync(keyPath)) warn('Google Play Service-Account-Key fehlt');
}

// --- docs ---
const previewDoc = join(root, 'docs/deployment/eas-preview-builds.md');
if (!existsSync(previewDoc)) {
  warn('docs/deployment/eas-preview-builds.md fehlt');
} else {
  console.log('✓ docs/deployment/eas-preview-builds.md vorhanden');
}

// --- optional EAS CLI (login / project:info) ---
let easLoggedIn = false;
try {
  execSync('npx eas-cli whoami', { cwd: root, stdio: 'pipe', encoding: 'utf8' });
  easLoggedIn = true;
  console.log('✓ EAS CLI: angemeldet');
} catch {
  blocker('EAS CLI: nicht angemeldet — `npx eas login` erforderlich vor project:init / build');
}

if (easLoggedIn && projectId && projectId !== PLACEHOLDER_EAS_ID) {
  try {
    execSync('npx eas-cli project:info', { cwd: root, stdio: 'pipe', encoding: 'utf8' });
    console.log('✓ eas project:info erfolgreich');
  } catch {
    warn('eas project:info fehlgeschlagen — projectId evtl. ungültig oder Projekt nicht verknüpft');
  }
}

console.log('\n--- Zusammenfassung ---');
console.log(`Blocker: ${BLOCKERS.length}`);
console.log(`Warnungen: ${WARNINGS.length}`);
console.log('\nVerdict: EAS-Konfiguration vorbereitet — kein Preview-Build ohne project:init + Login.');
console.log('NOT store-ready.\n');

if (BLOCKERS.length > 0) process.exit(1);
process.exit(0);
