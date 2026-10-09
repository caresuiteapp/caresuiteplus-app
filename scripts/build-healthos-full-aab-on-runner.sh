#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [[ "${GITHUB_ACTIONS:-}" != true || "$(uname -s)" != Linux ]]; then
  echo 'Dieses Skript läuft im GitHub-Linux-Workflow. Zum Starten: den mitgelieferten Release-Installer' >&2
  exit 1
fi
: "${EXPO_TOKEN:?Repository-Secret EXPO_TOKEN fehlt}"
: "${CARESUITE_AAB_DIR:?Ausgabeordner fehlt}"

node scripts/verify-healthos-full-production.mjs
npm run typecheck
npm run audit:portal-update -- --maxWorkers=2
npm run audit:android-update
npm run audit:assignment-workflow-gate -- --maxWorkers=2 --testTimeout=15000
node --experimental-vm-modules scripts/optional-visit-tasks.test.mjs
python3 scripts/verify-github-aab.test.py
node scripts/store-readiness-check.mjs
node scripts/audit-android-api36.mjs
node scripts/audit-android-release-performance.mjs
npm run healthos-full:export
npm run healthos-full:export:audit

mkdir -p "$CARESUITE_AAB_DIR"
eas build:version:get --platform android --profile healthos-full-aab --non-interactive --json > "$CARESUITE_AAB_DIR/EAS-VERSION-BASELINE.json"
node - "$CARESUITE_AAB_DIR/EAS-VERSION-BASELINE.json" <<'NODE'
const fs = require('node:fs');
const value = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).versionCode;
if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 40) {
  throw new Error('EAS-Versionsbasis liegt unter dem bereits in Play verwendeten Code 40. Build abgebrochen.');
}
NODE
caresuite_eas_artifacts="$(mktemp -d "$CARESUITE_AAB_DIR/eas-artifacts.XXXXXX")"
echo 'Baue den produktiven AAB lokal auf dem GitHub-Runner.'
# --local ist fest vorgegeben: kein EAS-Cloud-Build und kein Cloud-Kontingent.
# Das Profil behält die verwaltete Upload-Signierung und erhöht versionCode.
# Kein --output: EAS schreibt AAB und zusätzliche Build-Artefakte nacheinander.
# Ein fester Dateipfad würde die AAB mit dem zusätzlichen tar.gz überschreiben.
env -u EAS_LOCAL_BUILD_ARTIFACT_PATH \
  EAS_LOCAL_BUILD_ARTIFACTS_DIR="$caresuite_eas_artifacts" \
  eas build --local --platform android --profile healthos-full-aab --non-interactive --freeze-credentials

shopt -s nullglob
caresuite_aab_candidates=("$caresuite_eas_artifacts"/*.aab)
if [[ ${#caresuite_aab_candidates[@]} -ne 1 ]]; then
  echo "FEHLER: Genau eine AAB erwartet, gefunden: ${#caresuite_aab_candidates[@]}." >&2
  exit 1
fi
cp -- "${caresuite_aab_candidates[0]}" "$CARESUITE_AAB_DIR/CareSuite-HealthOS.aab"
test -s "$CARESUITE_AAB_DIR/CareSuite-HealthOS.aab"
# Retain additional EAS artifacts, including the exact R8 mapping for this build.
for caresuite_extra_artifact in "$caresuite_eas_artifacts"/*.tar.gz; do
  cp -- "$caresuite_extra_artifact" "$CARESUITE_AAB_DIR/R8-build-artifacts.tar.gz"
done
