#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "ABBRUCH: Node.js wurde nicht gefunden."
  exit 1
fi

echo "Prüfe CareSuite HealthOS Kernedition ..."
npm run typecheck
npx vitest run \
  src/__tests__/platform/healthOSStoreEdition.test.ts \
  src/__tests__/platform/storeConfig.test.ts \
  src/__tests__/ui/googlePlayReadiness.test.ts

if ! npx --yes eas-cli@21.8.0 whoami >/dev/null 2>&1; then
  echo
  echo "ABBRUCH: EAS ist noch nicht angemeldet."
  echo "Bitte zuerst ausführen: npx --yes eas-cli@21.8.0 login"
  exit 1
fi

echo "Starte installierbares APK ..."
npx --yes eas-cli@21.8.0 build \
  --platform android \
  --profile healthos-core-apk

echo "Starte Google-Play-AAB ..."
npx --yes eas-cli@21.8.0 build \
  --platform android \
  --profile healthos-core-aab

echo "Fertig: EAS zeigt die Download-Links für APK und AAB an."
