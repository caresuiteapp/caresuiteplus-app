#!/usr/bin/env bash
set -Eeuo pipefail

EXPECTED_PACKAGE='app.caresuitehealthos'
EXPECTED_VERSION='0.3.4'
EAS_CLI_VERSION='21.8.0'
OUTPUT_PATH="${1:-CareSuite-HealthOS-0.3.4.aab}"
RELEASE_MIGRATION='20260903090000_portal_runtime_write_probe_r20_5.sql'
RELEASE_DB_ROOT=''

die() {
  printf 'FEHLER: %s\n' "$*" >&2
  exit 1
}

cleanup_release_database() {
  [[ -n "$RELEASE_DB_ROOT" && -d "$RELEASE_DB_ROOT" ]] || return 0
  case "$RELEASE_DB_ROOT" in
    /tmp/*|/c/Users/*/AppData/Local/Temp/*)
      rm -rf -- "$RELEASE_DB_ROOT"
      ;;
    *)
      printf 'WARNUNG: Unerwarteter temporärer Pfad wird nicht entfernt: %s\n' "$RELEASE_DB_ROOT" >&2
      ;;
  esac
  RELEASE_DB_ROOT=''
}

deploy_release_database_migration() {
  local isolated_supabase_dir
  local migration_list_file
  local local_only_versions
  local remote_only_versions

  [[ -f "supabase/migrations/$RELEASE_MIGRATION" ]] \
    || die "Release-Migration fehlt: $RELEASE_MIGRATION"
  [[ -f supabase/config.toml ]] || die 'supabase/config.toml fehlt.'
  [[ -f supabase/.temp/project-ref ]] \
    || die 'Die Supabase-Projektverknüpfung fehlt (supabase/.temp/project-ref).'

  RELEASE_DB_ROOT="$(mktemp -d)"
  isolated_supabase_dir="$RELEASE_DB_ROOT/supabase"
  mkdir -p "$isolated_supabase_dir/migrations" "$isolated_supabase_dir/.temp"
  cp supabase/config.toml "$isolated_supabase_dir/config.toml"
  cp -R supabase/.temp/. "$isolated_supabase_dir/.temp/"

  printf 'Produktive Migrationshistorie wird isoliert geladen ...\n'
  (
    cd "$RELEASE_DB_ROOT"
    npx --yes supabase@latest migration fetch --linked
  )
  cp "supabase/migrations/$RELEASE_MIGRATION" \
    "$isolated_supabase_dir/migrations/$RELEASE_MIGRATION"

  migration_list_file="$RELEASE_DB_ROOT/migration-list.txt"
  (
    cd "$RELEASE_DB_ROOT"
    npx --yes supabase@latest migration list --linked 2>&1 | tee "$migration_list_file"
  )

  local_only_versions="$(awk -F'|' '
    {
      local_version=$1; remote_version=$2;
      gsub(/[^0-9]/, "", local_version); gsub(/[^0-9]/, "", remote_version);
      if (local_version != "" && remote_version == "") print local_version;
    }
  ' "$migration_list_file" | LC_ALL=C sort -u | tr '\n' ' ' | sed 's/[[:space:]]*$//')"
  remote_only_versions="$(awk -F'|' '
    {
      local_version=$1; remote_version=$2;
      gsub(/[^0-9]/, "", local_version); gsub(/[^0-9]/, "", remote_version);
      if (local_version == "" && remote_version != "") print remote_version;
    }
  ' "$migration_list_file" | LC_ALL=C sort -u | tr '\n' ' ' | sed 's/[[:space:]]*$//')"

  [[ -z "$remote_only_versions" ]] \
    || die "Isolierte Historie ist unvollständig; fehlende Remote-Versionen: $remote_only_versions"
  if [[ -z "$local_only_versions" ]]; then
    printf 'Rollback-Schreibprüfung ist bereits produktiv installiert.\n'
  elif [[ "$local_only_versions" = '20260903090000' ]]; then
    printf 'Rollback-Schreibprüfung wird isoliert geprüft und produktiv installiert ...\n'
    (
      cd "$RELEASE_DB_ROOT"
      npx --yes supabase@latest db push --linked --dry-run
      npx --yes supabase@latest db push --linked
    )
  else
    die "Unerwartete lokale Release-Migrationen: $local_only_versions"
  fi
  cleanup_release_database
}

trap cleanup_release_database EXIT

command -v node >/dev/null 2>&1 || die 'Node.js fehlt.'
command -v npm >/dev/null 2>&1 || die 'npm fehlt.'
command -v git >/dev/null 2>&1 || die 'Git fehlt.'
command -v curl >/dev/null 2>&1 || die 'curl fehlt.'
command -v awk >/dev/null 2>&1 || die 'awk fehlt.'
command -v cp >/dev/null 2>&1 || die 'cp fehlt.'
command -v mktemp >/dev/null 2>&1 || die 'mktemp fehlt.'
command -v sort >/dev/null 2>&1 || die 'sort fehlt.'
command -v tee >/dev/null 2>&1 || die 'tee fehlt.'
command -v tr >/dev/null 2>&1 || die 'tr fehlt.'

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || die 'Kein CareSuite-Git-Repository.'
cd "$ROOT"

[[ -z "$(git status --porcelain)" ]] || die 'Der Release-Stand muss committed und sauber sein.'

node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
const app = JSON.parse(readFileSync('app.json', 'utf8')).expo;
const eas = JSON.parse(readFileSync('eas.json', 'utf8'));
if (app.android?.package !== 'app.caresuitehealthos') throw new Error('Falsche Paket-ID.');
if (app.version !== '0.3.4') throw new Error('Falsche Nutzer-Version.');
if (app.android?.versionCode < 27) throw new Error('Falsche lokale versionCode-Baseline.');
if (eas.cli?.appVersionSource !== 'remote') throw new Error('EAS Remote-Versionierung fehlt.');
if (eas.build?.['portal-only-aab']?.env?.EXPO_PUBLIC_APP_EDITION !== 'portal-only') {
  throw new Error('Portal-only Build-Profil fehlt.');
}
if (eas.build?.['portal-only-aab']?.env?.EXPO_PUBLIC_DEMO_MODE !== 'false') {
  throw new Error('Produktionsprofil ist nicht zwingend auf Live-Betrieb festgelegt.');
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
npm run audit:assignment-workflow-gate
npx vitest run \
  src/__tests__/platform/googlePlayUpdateV0_3_3.test.ts \
  src/__tests__/auth/portalProductionRuntimeR20_5.test.ts \
  src/__tests__/auth/portalWriteSessionRecoveryR20_4.test.ts \
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

deploy_release_database_migration

printf 'Korrigierte Portal-Identität und Sitzungsreparatur werden zusammengehörig ausgerollt ...\n'
npx --yes supabase@latest functions deploy employee-portal-login --no-verify-jwt
npx --yes supabase@latest functions deploy client-portal-login --no-verify-jwt
npx --yes supabase@latest functions deploy portal-session-refresh --no-verify-jwt

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

printf '\nGoogle-Play-Update 0.3.4 wurde vollständig gebaut und heruntergeladen:\n%s\n' "$OUTPUT_PATH"
printf 'Es wurde nichts automatisch zu Google Play hochgeladen. Sie können diesen AAB selbst hochladen.\n'
