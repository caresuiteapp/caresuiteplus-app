#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
export APP_ENV=production
export EXPO_PUBLIC_APP_EDITION=full
export EXPO_PUBLIC_DEMO_MODE=false
export EXPO_PUBLIC_FOLDER=public-portal
export EXPO_NO_TELEMETRY=1
export CI=true
if command -v cygpath >/dev/null; then
  export CARESUITE_GITBASH_TAR="$(cygpath -am "$(command -v tar)")"
  export CARESUITE_GITBASH_UNZIP="$(cygpath -am "$(command -v unzip)")"
fi

if [[ "$#" == 1 && "$1" == --inside-production ]]; then
  node scripts/build-healthos-full-gitbash.mjs --build
  exit 0
fi
if [[ "$#" != 0 ]]; then
  echo 'Aufruf ohne zusätzliche Argumente.' >&2
  exit 1
fi
command -v node >/dev/null || { echo 'Node.js ist in Git Bash nicht vorhanden.' >&2; exit 1; }
node scripts/build-healthos-full-gitbash.mjs --preflight
eas whoami
if [[ ! -s credentials.json && -z "$(printenv CARESUITE_CREDENTIALS_FILE || true)" ]]; then
  echo 'Vorhandene Expo-Signierung herunterladen: healthos-full-aab auswählen.'
  echo 'Dann credentials.json > Download credentials from EAS to credentials.json auswählen.'
  echo 'Die lokale Datei und Passwörter nicht in den Chat kopieren.'
  eas credentials --platform android
fi
node scripts/build-healthos-full-gitbash.mjs --signing
eas build:version:get --platform android --profile healthos-full-aab --non-interactive --json > .healthos-gitbash/EAS-CURRENT.json
if [[ ! -s .healthos-gitbash/VERSION-RESERVED.json ]]; then
  node scripts/build-healthos-full-gitbash.mjs --plan-version
  eas build:version:set --platform android --profile healthos-full-aab
  eas build:version:get --platform android --profile healthos-full-aab --non-interactive --json > .healthos-gitbash/EAS-CURRENT.json
  node scripts/build-healthos-full-gitbash.mjs --confirm-version
else
  node scripts/build-healthos-full-gitbash.mjs --check-reserved
fi
node scripts/build-healthos-full-gitbash.mjs --packages
eas env:exec production --non-interactive 'bash scripts/build-healthos-full-gitbash.sh --inside-production'
