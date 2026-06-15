#!/usr/bin/env node
/**
 * Store & EAS build readiness audit — config, docs, assets, permissions.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLACEHOLDER_EAS_ID = '00000000-0000-0000-0000-000000000000';
const STABLE_BUNDLE_ID = 'de.caresuiteplus.app';

const STORE_DOCS = [
  'docs/store/app-store-checklist.md',
  'docs/store/google-play-checklist.md',
  'docs/store/screenshots-plan.md',
  'docs/store/store-listing-texts.md',
  'docs/store/privacy-data-map.md',
  'docs/store/reviewer-notes.md',
  'docs/store/eas-build-preflight.md',
  'docs/store/build-commands.md',
  'docs/store/assets-readiness.md',
  'docs/store/legal-links-checklist.md',
  'docs/deployment/mobile-env-strategy.md',
  'docs/deployment/eas-preview-builds.md',
  'docs/platform/web-desktop-readiness.md',
  'docs/audit/eas-store-build-readiness-report.md',
];

const ASSET_FILES = [
  'assets/icon.png',
  'assets/favicon.png',
  'assets/splash-icon.png',
  'assets/android-icon-foreground.png',
  'assets/android-icon-background.png',
  'assets/android-icon-monochrome.png',
];

const WARNINGS = [];

function fail(message) {
  console.error(`\n✗ store:audit fehlgeschlagen: ${message}\n`);
  process.exit(1);
}

function warn(message) {
  WARNINGS.push(message);
  console.warn(`⚠ ${message}`);
}

function readJson(rel) {
  return JSON.parse(readFileSync(join(root, rel), 'utf8'));
}

console.log('CareSuite+ store-readiness-check\n');

// --- Store docs ---
const missingDocs = STORE_DOCS.filter((rel) => !existsSync(join(root, rel)));
if (missingDocs.length > 0) {
  fail(`Fehlende Store-/Deployment-Dokumente:\n  - ${missingDocs.join('\n  - ')}`);
}
console.log(`✓ ${STORE_DOCS.length} Store-/Deployment-Dokumente vorhanden`);

// --- App identity ---
const appJson = readJson('app.json');
const expo = appJson.expo ?? {};

if (expo.name !== 'CareSuite+') fail(`app.json: name muss "CareSuite+" sein, ist "${expo.name}"`);
if (expo.slug !== 'caresuite-plus') fail(`app.json: slug muss "caresuite-plus" sein`);
if (expo.scheme !== 'caresuiteplus') fail(`app.json: scheme muss "caresuiteplus" sein`);

const iosId = expo.ios?.bundleIdentifier;
const androidPkg = expo.android?.package;
if (iosId !== STABLE_BUNDLE_ID) {
  fail(`app.json: iOS bundleIdentifier muss ${STABLE_BUNDLE_ID} sein, ist ${iosId}`);
}
if (androidPkg !== STABLE_BUNDLE_ID) {
  fail(`app.json: Android package muss ${STABLE_BUNDLE_ID} sein, ist ${androidPkg}`);
}
if (expo.ios?.supportsTablet !== true) fail('app.json: ios.supportsTablet muss true sein');
if (!expo.ios?.buildNumber) fail('app.json: ios.buildNumber fehlt');
if (!expo.android?.versionCode) fail('app.json: android.versionCode fehlt');

const appConfig = readFileSync(join(root, 'app.config.ts'), 'utf8');
if (!appConfig.includes('supportsTablet: true')) fail('app.config.ts: supportsTablet fehlt');
if (!appConfig.includes(STABLE_BUNDLE_ID)) fail('app.config.ts: Bundle-ID fehlt');
if (!appConfig.includes('SUPPORT_LINKS') || !appConfig.includes('supportLinks: { ...SUPPORT_LINKS }')) {
  warn('app.config.ts: supportLinks nicht vollständig aus supportLinks.ts gespiegelt');
} else {
  console.log('✓ app.config.ts spiegelt supportLinks (Hilfe, Datenschutz, Impressum, AGB, Support-E-Mail)');
}
if (!appConfig.includes('expo-location')) {
  warn('app.config.ts: expo-location Plugin fehlt (GPS preparedOnly Sprint 74)');
} else if (!appConfig.includes('isIosBackgroundLocationEnabled: false')) {
  warn('app.config.ts: Background-GPS sollte deaktiviert bleiben bis Live-Ready');
} else {
  console.log('✓ app.config.ts: expo-location Plugin (Foreground-only, preparedOnly)');
}
console.log('✓ App-Identität konsistent (CareSuite+, caresuite-plus, caresuiteplus)');
console.log(`✓ Bundle-ID / Package: ${STABLE_BUNDLE_ID}`);

// --- EAS ---
const eas = readJson('eas.json');
for (const profile of ['development', 'preview', 'production']) {
  if (!eas.build?.[profile]) fail(`eas.json: Build-Profil "${profile}" fehlt`);
}
console.log('✓ eas.json Profile development/preview/production');

const easProjectId = expo.extra?.eas?.projectId;
if (!easProjectId || easProjectId === PLACEHOLDER_EAS_ID) {
  warn(
    'EAS_PROJECT_ID ist Platzhalter — vor Build: `npx eas project:init` und ID in app.json / .env setzen',
  );
} else {
  console.log('✓ EAS projectId gesetzt (nicht Platzhalter)');
}

const easPreflightPath = join(root, 'scripts/eas-preflight.mjs');
if (!existsSync(easPreflightPath)) {
  warn('scripts/eas-preflight.mjs fehlt — npm run eas:preflight nicht verfügbar');
} else {
  console.log('✓ eas-preflight.mjs vorhanden (npm run eas:preflight)');
}

const gpsConfigPath = join(root, 'src/lib/assist/gpsTrackingConfig.ts');
if (existsSync(gpsConfigPath)) {
  const gpsConfig = readFileSync(gpsConfigPath, 'utf8');
  if (gpsConfig.includes('isGpsTrackingLiveReady') && gpsConfig.includes('return false')) {
    console.log('✓ GPS Tracking preparedOnly (isGpsTrackingLiveReady: false)');
  } else {
    warn('gpsTrackingConfig: Live-Ready-Guard unklar — kein Fake-GPS');
  }
}

// --- Submit placeholders ---
const submit = eas.submit?.production;
if (submit?.ios?.appleId?.startsWith('REPLACE_')) {
  warn('eas.json submit.production.ios: Apple-Credentials noch Platzhalter');
}
if (submit?.android?.serviceAccountKeyPath?.includes('secrets/')) {
  const keyPath = join(root, submit.android.serviceAccountKeyPath);
  if (!existsSync(keyPath)) {
    warn('Google Play Service-Account-Key fehlt (erwartet vor Submit)');
  }
}

// --- Assets ---
const missingAssets = ASSET_FILES.filter((rel) => !existsSync(join(root, rel)));
if (missingAssets.length > 0) {
  fail(`Fehlende referenzierte Assets:\n  - ${missingAssets.join('\n  - ')}`);
}

let placeholderCount = 0;
for (const rel of ASSET_FILES) {
  const size = statSync(join(root, rel)).size;
  if (size < 500) placeholderCount += 1;
}
if (placeholderCount > 0) {
  warn(
    `${placeholderCount}/${ASSET_FILES.length} Assets sind 1×1-Platzhalter — vor Store-Submission durch echte Grafiken ersetzen`,
  );
} else {
  console.log('✓ Referenzierte Store-Assets vorhanden (nicht Platzhalter-Größe)');
}

// --- Permissions (only declared vs used) ---
const declaredPerms = expo.android?.permissions ?? [];
const allowedPerms = ['INTERNET'];
const unexpected = declaredPerms.filter((p) => !allowedPerms.includes(p));
if (unexpected.length > 0) {
  fail(`Android permissions enthalten unerwartete Einträge: ${unexpected.join(', ')}`);
}
console.log('✓ Android permissions: nur INTERNET (keine preparedOnly-Features)');

// --- Privacy map ---
const privacyMap = readFileSync(join(root, 'docs/store/privacy-data-map.md'), 'utf8');
if (!privacyMap.includes('Supabase') || !privacyMap.includes('Datenschutz')) {
  fail('privacy-data-map.md: Mindestinhalt fehlt');
}
console.log('✓ privacy-data-map.md vorhanden');

// --- Legal links ---
const supportLinks = readFileSync(join(root, 'src/lib/platform/supportLinks.ts'), 'utf8');
for (const key of ['help', 'privacy', 'imprint', 'terms']) {
  if (!supportLinks.includes(`${key}:`)) fail(`supportLinks.ts: ${key} fehlt`);
}
console.log('✓ supportLinks.ts enthält Hilfe/Datenschutz/Impressum/AGB');

// --- Settings screens (data request / deletion) ---
const dataRequestPath = join(root, 'src/screens/settings/DataRequestScreen.tsx');
const deletionPath = join(root, 'src/screens/settings/AccountDeletionRequestScreen.tsx');
const panelPath = join(root, 'src/components/privacy/DataSubjectRequestPanel.tsx');
const hasDataRequestScreen = existsSync(dataRequestPath);
const hasDeletionScreen = existsSync(deletionPath);
if (!hasDataRequestScreen || !hasDeletionScreen) {
  warn(
    'DataRequestScreen / AccountDeletionRequestScreen fehlen — DSGVO-Links nur über supportLinks (DesktopShell), kein dedizierter Screen',
  );
} else {
  const panelSource = readFileSync(panelPath, 'utf8');
  if (!panelSource.includes('isDataSubjectRequestBackendReady')) {
    warn('DSGVO-Screens ohne Backend-Readiness-Guard — Fake-Erfolg vermeiden');
  } else if (
    panelSource.includes('SuccessState') &&
    !panelSource.includes('backendReady && submitted')
  ) {
    warn('DSGVO-Screens enthalten SuccessState ohne Live-Guard — kein Fake-Erfolg erlaubt');
  } else {
    console.log('✓ DSGVO Screens vorhanden (Live-Submit wenn Supabase + Migration 0031)');
  }
}

if (WARNINGS.length > 0) {
  console.log(`\n⚠ ${WARNINGS.length} Warnung(en) — Build-Vorbereitung OK, Store-Submission noch nicht ready\n`);
} else {
  console.log('\n✓ store-readiness-check ohne Warnungen abgeschlossen\n');
}
