#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [[ "${GITHUB_ACTIONS:-}" != true || "$(uname -s)" != Linux ]]; then
  echo 'Dieses Skript läuft im GitHub-Linux-Workflow. Zum Starten: den mitgelieferten Release-Installer' >&2
  exit 1
fi
: "${EXPO_TOKEN:?Repository-Secret EXPO_TOKEN fehlt}"
: "${CARESUITE_AAB_DIR:?Ausgabeordner fehlt}"

caresuite_build_phase="${1:-all}"
case "$caresuite_build_phase" in all|--checks-only|--build-only) ;; *) echo 'Ungültige Buildphase.' >&2; exit 1 ;; esac
[[ $# -le 1 ]] || { echo 'Zu viele Buildargumente.' >&2; exit 1; }
: "${GITHUB_SHA:?GitHub-Quellcommit fehlt}"
[[ $(git rev-parse HEAD) == "$GITHUB_SHA" ]] || { echo 'Quellcommit stimmt nicht mit dem Workflow überein.' >&2; exit 1; }
if [[ $caresuite_build_phase != --build-only ]]; then
  bash scripts/check-healthos-full-release.sh
  python3 scripts/verify-github-aab.test.py
  export CARESUITE_FULL_SOURCE_VERIFIED="$GITHUB_SHA"
  if [[ $caresuite_build_phase == --checks-only ]]; then
    : "${GITHUB_ENV:?GitHub-Umgebungsübergabe fehlt}"
    printf 'CARESUITE_FULL_SOURCE_VERIFIED=%s\n' "$GITHUB_SHA" >> "$GITHUB_ENV"
    exit 0
  fi
fi
if [[ $caresuite_build_phase == all ]]; then
  : "${RUNNER_TEMP:?GitHub-Temporärordner fehlt}"
  export GRADLE_USER_HOME="$RUNNER_TEMP/caresuite-healthos-gradle"
  node scripts/configure-healthos-gradle-memory.mjs "$GRADLE_USER_HOME" "$CARESUITE_AAB_DIR/BUILD-MEMORY.json"
fi
[[ ${CARESUITE_FULL_SOURCE_VERIFIED:-} == "$GITHUB_SHA" ]] || { echo 'Die vollständige App-Prüfung für diesen Quellstand fehlt.' >&2; exit 1; }
[[ -z $(git status --porcelain=v1 --untracked-files=all) ]] || { echo 'Der geprüfte Quellstand wurde lokal verändert.' >&2; exit 1; }
: "${GRADLE_USER_HOME:?Geprüftes Gradle-Speicherbudget fehlt}"
test -s "$CARESUITE_AAB_DIR/BUILD-MEMORY.json"

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
node scripts/configure-healthos-gradle-memory.mjs --verify "$CARESUITE_AAB_DIR/BUILD-MEMORY.json"

shopt -s nullglob
caresuite_aab_candidates=("$caresuite_eas_artifacts"/*.aab)
if [[ ${#caresuite_aab_candidates[@]} -ne 1 ]]; then
  echo "FEHLER: Genau eine AAB erwartet, gefunden: ${#caresuite_aab_candidates[@]}." >&2
  exit 1
fi
cp -- "${caresuite_aab_candidates[0]}" "$CARESUITE_AAB_DIR/CareSuite-HealthOS.aab"
test -s "$CARESUITE_AAB_DIR/CareSuite-HealthOS.aab"
# Retain exactly one archive containing the mapping and merged configuration.
caresuite_r8_candidates=("$caresuite_eas_artifacts"/*.tar.gz)
if [[ ${#caresuite_r8_candidates[@]} -ne 1 ]]; then
  echo "FEHLER: Genau ein R8-Archiv erwartet, gefunden: ${#caresuite_r8_candidates[@]}." >&2
  exit 1
fi
cp -- "${caresuite_r8_candidates[0]}" "$CARESUITE_AAB_DIR/R8-build-artifacts.tar.gz"
