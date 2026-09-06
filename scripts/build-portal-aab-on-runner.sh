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
echo 'Baue den produktiven AAB lokal auf dem GitHub-Runner.'
# --local ist fest vorgegeben: kein EAS-Cloud-Build und kein Cloud-Kontingent.
# Das Profil behält die verwaltete Upload-Signierung und erhöht versionCode.
eas build --local --platform android --profile portal-only-aab --non-interactive \
  --output "$CARESUITE_AAB_DIR/CareSuite-Portal.aab"
test -s "$CARESUITE_AAB_DIR/CareSuite-Portal.aab"
