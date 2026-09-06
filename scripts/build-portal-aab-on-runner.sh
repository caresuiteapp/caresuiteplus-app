#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [[ "${GITHUB_ACTIONS:-}" != true || "$(uname -s)" != Linux ]]; then
  echo 'Dieses Skript läuft im GitHub-Linux-Workflow. Zum Starten: bash scripts/build-portal-update-aab.sh' >&2
  exit 1
fi
: "${EXPO_TOKEN:?Repository-Secret EXPO_TOKEN fehlt}"
: "${CARESUITE_AAB_DIR:?Ausgabeordner fehlt}"

node scripts/verify-portal-production-env.mjs
npm run typecheck
npm run audit:portal-update
npm run portal-only:export
npm run portal-only:export:audit

mkdir -p "$CARESUITE_AAB_DIR"
caresuite_eas_artifacts="$(mktemp -d "$CARESUITE_AAB_DIR/eas-artifacts.XXXXXX")"
echo 'Baue den produktiven AAB lokal auf dem GitHub-Runner.'
# --local ist fest vorgegeben: kein EAS-Cloud-Build und kein Cloud-Kontingent.
# Das Profil behält die verwaltete Upload-Signierung und erhöht versionCode.
# Kein --output: EAS schreibt AAB und zusätzliche Build-Artefakte nacheinander.
# Ein fester Dateipfad würde die AAB mit dem zusätzlichen tar.gz überschreiben.
env -u EAS_LOCAL_BUILD_ARTIFACT_PATH \
  EAS_LOCAL_BUILD_ARTIFACTS_DIR="$caresuite_eas_artifacts" \
  eas build --local --platform android --profile portal-only-aab --non-interactive

shopt -s nullglob
caresuite_aab_candidates=("$caresuite_eas_artifacts"/*.aab)
if [[ ${#caresuite_aab_candidates[@]} -ne 1 ]]; then
  echo "FEHLER: Genau eine AAB erwartet, gefunden: ${#caresuite_aab_candidates[@]}." >&2
  exit 1
fi
cp -- "${caresuite_aab_candidates[0]}" "$CARESUITE_AAB_DIR/CareSuite-Portal.aab"
test -s "$CARESUITE_AAB_DIR/CareSuite-Portal.aab"
