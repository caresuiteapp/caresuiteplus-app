#!/usr/bin/env bash
set -Eeuo pipefail

EXPECTED_PACKAGE='app.caresuitehealthos'
EXPECTED_VERSION='0.3.1'
EAS_CLI_VERSION='21.8.0'

die() {
  printf 'FEHLER: %s\n' "$*" >&2
  exit 1
}

command -v node >/dev/null 2>&1 || die 'Node.js fehlt.'
command -v npm >/dev/null 2>&1 || die 'npm fehlt.'
command -v git >/dev/null 2>&1 || die 'Git fehlt.'

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || die 'Kein CareSuite-Git-Repository.'
cd "$ROOT"

[[ -z "$(git status --porcelain)" ]] || die 'Der Release-Stand muss committed und sauber sein.'

node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
const app = JSON.parse(readFileSync('app.json', 'utf8')).expo;
const eas = JSON.parse(readFileSync('eas.json', 'utf8'));
if (app.android?.package !== 'app.caresuitehealthos') throw new Error('Falsche Paket-ID.');
if (app.version !== '0.3.1') throw new Error('Falsche Nutzer-Version.');
if (app.android?.versionCode < 24) throw new Error('Falsche lokale versionCode-Baseline.');
if (eas.cli?.appVersionSource !== 'remote') throw new Error('EAS Remote-Versionierung fehlt.');
if (eas.build?.['portal-only-aab']?.env?.EXPO_PUBLIC_APP_EDITION !== 'portal-only') {
  throw new Error('Portal-only Build-Profil fehlt.');
}
if (eas.submit?.['portal-only-internal']?.android?.applicationId !== 'app.caresuitehealthos') {
  throw new Error('Interner Play-Submit ist nicht auf die stabile Paket-ID festgelegt.');
}
NODE

[[ -f google-services.json ]] || die 'google-services.json fehlt.'

printf 'Google-Play-Freigabeprüfung für %s %s ...\n' "$EXPECTED_PACKAGE" "$EXPECTED_VERSION"
npm ci
npm run typecheck
npm run portal-only:audit
npm run android:api36:audit
node scripts/store-readiness-check.mjs
npx vitest run \
  src/__tests__/platform/googlePlayUpdateV0_3_0.test.ts \
  src/__tests__/platform/storeConfig.test.ts \
  src/__tests__/platform/portalOnlyEdition.test.ts \
  src/__tests__/platform/portalAppSecurityR14C.test.ts \
  src/__tests__/portal/assignmentWorkflowRegressionGate.test.ts \
  src/__tests__/portal/employeePortalMobileBottomNavR18_6.test.ts \
  src/__tests__/portal/employeePortalDayWorkflowR14.test.ts \
  src/__tests__/portal/employeePortalVisitAttachmentService.test.ts \
  src/__tests__/portal/employeeLogbookAutomaticWorkflowR11.test.ts \
  src/__tests__/assistWorkflow/finalizeVisitDeferredSignature.test.ts \
  src/__tests__/assistWorkflow/deferredSignatureE2eChain.test.ts
npm run portal-only:export
npm run portal-only:export:audit

printf 'EAS-Konto und Projekt werden geprüft ...\n'
npx --yes "eas-cli@${EAS_CLI_VERSION}" whoami
npx --yes "eas-cli@${EAS_CLI_VERSION}" project:info

printf 'Aktuelle Android-Remote-Version (nur Information):\n'
npx --yes "eas-cli@${EAS_CLI_VERSION}" build:version:get \
  --platform android \
  --profile portal-only-aab \
  --non-interactive || printf 'Hinweis: Remote-Version konnte vorab nicht angezeigt werden; autoIncrement bleibt aktiv.\n'

printf 'Portal-only AAB wird gebaut. EAS erhöht den Remote-versionCode automatisch ...\n'
npx --yes "eas-cli@${EAS_CLI_VERSION}" build \
  --platform android \
  --profile portal-only-aab \
  --non-interactive \
  --wait

printf 'Der neueste AAB-Build wird in den internen Google-Play-Track übertragen ...\n'
npx --yes "eas-cli@${EAS_CLI_VERSION}" submit \
  --platform android \
  --profile portal-only-internal \
  --latest \
  --non-interactive \
  --wait

printf '\nGoogle-Play-Update 0.3.1 wurde in den internen Track übertragen.\n'
printf 'Es wurde bewusst noch kein Produktions-Rollout gestartet.\n'
