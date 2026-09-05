#!/usr/bin/env bash
set -Eeuo pipefail

EXPECTED_PACKAGE='app.caresuitehealthos'
EXPECTED_VERSION='0.3.6'
EAS_CLI_VERSION='21.8.0'
OUTPUT_PATH="${1:-CareSuite-HealthOS-0.3.6.aab}"

die() {
  printf 'FEHLER: %s\n' "$*" >&2
  exit 1
}

command -v node >/dev/null 2>&1 || die 'Node.js fehlt.'
command -v npm >/dev/null 2>&1 || die 'npm fehlt.'
command -v git >/dev/null 2>&1 || die 'Git fehlt.'
command -v curl >/dev/null 2>&1 || die 'curl fehlt.'

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || die 'Kein CareSuite-Git-Repository.'
cd "$ROOT"

[[ -z "$(git status --porcelain)" ]] || die 'Der Release-Stand muss committed und sauber sein.'

node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
const app = JSON.parse(readFileSync('app.json', 'utf8')).expo;
const eas = JSON.parse(readFileSync('eas.json', 'utf8'));
if (app.android?.package !== 'app.caresuitehealthos') throw new Error('Falsche Paket-ID.');
if (app.version !== '0.3.6') throw new Error('Falsche Nutzer-Version.');
if (app.android?.versionCode < 27) throw new Error('Falsche lokale versionCode-Baseline.');
if (eas.cli?.appVersionSource !== 'remote') throw new Error('EAS Remote-Versionierung fehlt.');
if (eas.build?.['portal-only-aab']?.env?.EXPO_PUBLIC_APP_EDITION !== 'portal-only') {
  throw new Error('Portal-only Build-Profil fehlt.');
}
if (eas.build?.['portal-only-aab']?.env?.EXPO_PUBLIC_DEMO_MODE !== 'false') {
  throw new Error('Produktionsprofil ist nicht zwingend auf Live-Betrieb festgelegt.');
}
if (eas.build?.['portal-only-aab']?.environment !== 'production') {
  throw new Error('Portal-only Build ist nicht dem EAS-Environment production zugeordnet.');
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
npm run audit:assignment-workflow-gate -- --testTimeout=15000
npx vitest run \
  src/__tests__/platform/googlePlayUpdateV0_3_6.test.ts \
  src/__tests__/auth/portalProductionRuntimeR20_5.test.ts \
  src/__tests__/auth/portalWriteSessionRecoveryR20_4.test.ts \
  src/__tests__/portal/employeePortalRuntimeUnblockR20_6.test.ts \
  src/__tests__/assist/employeeLiveTrackingContinuous.test.ts \
  src/__tests__/portal/appP0QualityR20.test.ts \
  src/__tests__/portal/appP0RuntimeR20_3.test.ts \
  src/__tests__/auth/portalWriteSessionGateR20_3.test.ts \
  src/__tests__/auth/employeeLoginPasswordInputRegression.test.ts \
  src/__tests__/platform/storeConfig.test.ts \
  src/__tests__/platform/portalOnlyEdition.test.ts \
  src/__tests__/platform/portalAppSecurityR14C.test.ts \
  src/__tests__/portal/employeePortalMobileBottomNavR18_6.test.ts \
  src/__tests__/portal/employeePortalDayWorkflowR14.test.ts \
  src/__tests__/portal/employeeVisitTaskSpeedR104.test.ts \
  src/__tests__/portal/employeePortalP0TaskPersistence.test.ts \
  src/__tests__/portal/employeePortalVisitAttachmentService.test.ts \
  src/__tests__/portal/employeePortalCameraMediaUploadR1.test.ts \
  src/__tests__/portal/employeePortalCameraPersistenceR5.test.ts \
  src/__tests__/portal/clientPortalMessagesVisitsRepair.test.ts \
  src/__tests__/portal/employeeLogbookAutomaticWorkflowR11.test.ts \
  src/__tests__/office/officemessagelifecycle.test.ts \
  src/__tests__/office/officemessagemappers.test.ts
npm run portal-only:export
npm run portal-only:export:audit

printf 'EAS-Konto und Projekt werden geprüft ...\n'
npx --yes "eas-cli@${EAS_CLI_VERSION}" whoami
npx --yes "eas-cli@${EAS_CLI_VERSION}" project:info

printf 'Produktive AAB-Live-Konfiguration wird im echten EAS-Environment geprüft ...\n'
npx --yes "eas-cli@${EAS_CLI_VERSION}" env:exec production \
  --non-interactive \
  'node scripts/verify-portal-production-env.mjs'

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

printf 'Der fertig geprüfte AAB wird für den manuellen Play-Upload heruntergeladen ...\n'
AAB_URL="$({ npx --yes "eas-cli@${EAS_CLI_VERSION}" build:list \
  --platform android \
  --status finished \
  --limit 1 \
  --json \
  --non-interactive 2>/dev/null || true; } | node --input-type=module -e '
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { raw += chunk; });
    process.stdin.on("end", () => {
      try {
        const rows = JSON.parse(raw);
        const url = rows?.[0]?.artifacts?.buildUrl;
        if (typeof url === "string") process.stdout.write(url);
      } catch {}
    });
  ')"
[[ -n "$AAB_URL" ]] || die 'Download-Adresse des fertigen AAB konnte nicht ermittelt werden.'
curl --fail --location --output "$OUTPUT_PATH" "$AAB_URL"
sha256sum "$OUTPUT_PATH"

printf '\nGoogle-Play-Update 0.3.6 wurde vollständig gebaut und heruntergeladen:\n%s\n' "$OUTPUT_PATH"
printf 'Es wurde nichts automatisch zu Google Play hochgeladen. Sie können diesen AAB selbst hochladen.\n'
