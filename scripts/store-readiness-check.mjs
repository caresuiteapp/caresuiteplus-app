#!/usr/bin/env node
/**
 * Store & EAS build readiness audit — config, docs, assets, permissions.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLACEHOLDER_EAS_ID = '00000000-0000-0000-0000-000000000000';
const STABLE_IOS_BUNDLE_ID = 'de.caresuiteplus.app';
const STABLE_ANDROID_PACKAGE = 'app.caresuitehealthos';

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
if (iosId !== STABLE_IOS_BUNDLE_ID) {
  fail(`app.json: iOS bundleIdentifier muss ${STABLE_IOS_BUNDLE_ID} sein, ist ${iosId}`);
}
if (androidPkg !== STABLE_ANDROID_PACKAGE) {
  fail(`app.json: Android package muss ${STABLE_ANDROID_PACKAGE} sein, ist ${androidPkg}`);
}
if (expo.ios?.supportsTablet !== true) fail('app.json: ios.supportsTablet muss true sein');
if (!expo.ios?.buildNumber) fail('app.json: ios.buildNumber fehlt');
if (!expo.android?.versionCode) fail('app.json: android.versionCode fehlt');

const appConfig = readFileSync(join(root, 'app.config.ts'), 'utf8');
if (!appConfig.includes('supportsTablet: true')) fail('app.config.ts: supportsTablet fehlt');
if (!appConfig.includes(STABLE_IOS_BUNDLE_ID)) fail('app.config.ts: iOS Bundle-ID fehlt');
if (!appConfig.includes(STABLE_ANDROID_PACKAGE)) fail('app.config.ts: Android Package fehlt');
if (!appConfig.includes('SUPPORT_LINKS') || !appConfig.includes('supportLinks: { ...SUPPORT_LINKS }')) {
  warn('app.config.ts: supportLinks nicht vollständig aus supportLinks.ts gespiegelt');
} else {
  console.log('✓ app.config.ts spiegelt supportLinks (Hilfe, Datenschutz, Impressum, AGB, Support-E-Mail)');
}
if (!appConfig.includes('expo-location')) {
  fail('app.config.ts: expo-location Plugin fehlt');
} else if (!appConfig.includes('isAndroidBackgroundLocationEnabled: true')) {
  fail('app.config.ts: Android-Hintergrund-GPS muss für die gestartete Tagesaufzeichnung aktiv sein');
} else {
  console.log('✓ app.config.ts: nutzerinitiierte Android-Hintergrundaufzeichnung aktiv');
}
if (!appConfig.includes("root: isPortalOnlyEdition ? 'app-portal' : 'app'")) {
  fail('app.config.ts: Portal-only Router-Isolation fehlt');
}
console.log('✓ App-Identität konsistent (CareSuite+, caresuite-plus, caresuiteplus)');
console.log(`✓ iOS Bundle-ID: ${STABLE_IOS_BUNDLE_ID}`);
console.log(`✓ Android Package: ${STABLE_ANDROID_PACKAGE}`);

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
  if (gpsConfig.includes('isGpsTrackingLiveReady') && gpsConfig.includes('isAssistTrackingPersistenceActive')) {
    console.log('✓ GPS-Tracking ist an die produktive Persistenzbereitschaft gekoppelt');
  } else {
    fail('gpsTrackingConfig: Live-Ready-Guard unklar');
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
const requiredPerms = [
  'INTERNET',
  'POST_NOTIFICATIONS',
  'CAMERA',
  'RECORD_AUDIO',
  'ACCESS_COARSE_LOCATION',
  'ACCESS_FINE_LOCATION',
  'ACCESS_BACKGROUND_LOCATION',
  'FOREGROUND_SERVICE',
  'FOREGROUND_SERVICE_LOCATION',
];
const missingPermissions = requiredPerms.filter((permission) => !declaredPerms.includes(permission));
const unexpected = declaredPerms.filter((permission) => !requiredPerms.includes(permission));
if (missingPermissions.length > 0) {
  fail(`Android permissions fehlen: ${missingPermissions.join(', ')}`);
}
if (unexpected.length > 0) {
  fail(`Android permissions enthalten unerwartete Einträge: ${unexpected.join(', ')}`);
}
console.log('✓ Android permissions entsprechen GPS, Push sowie Foto-/Video-Dokumentation');

// --- Privacy map ---
const privacyMap = readFileSync(join(root, 'docs/store/privacy-data-map.md'), 'utf8');
if (!privacyMap.includes('Supabase') || !privacyMap.includes('Datenschutz')) {
  fail('privacy-data-map.md: Mindestinhalt fehlt');
}
for (const marker of ['Präziser Standort', 'Fotos und Videos', 'Push-Token', 'app.caresuitehealthos']) {
  if (!privacyMap.includes(marker)) fail(`privacy-data-map.md: ${marker} fehlt`);
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
