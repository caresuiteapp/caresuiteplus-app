#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export EXPO_PUBLIC_APP_EDITION="portal-only"
export EXPO_PUBLIC_FOLDER="public-portal"
export EXPO_NO_TELEMETRY=1

fail() {
  echo
  echo "ABBRUCH: $1"
  exit 1
}

command -v node >/dev/null 2>&1 || fail "Node.js wurde nicht gefunden."
command -v npm >/dev/null 2>&1 || fail "npm wurde nicht gefunden."
command -v java >/dev/null 2>&1 || fail "Java/JDK wurde nicht gefunden. Android Studio mit JDK 17 installieren."

JAVA_VERSION="$(java -version 2>&1 | head -n 1)"
echo "Java: $JAVA_VERSION"

if [[ -z "${ANDROID_HOME:-}" ]]; then
  if [[ -n "${LOCALAPPDATA:-}" && -d "$LOCALAPPDATA/Android/Sdk" ]]; then
    export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
  elif [[ -n "${USERPROFILE:-}" && -d "$USERPROFILE/AppData/Local/Android/Sdk" ]]; then
    export ANDROID_HOME="$USERPROFILE/AppData/Local/Android/Sdk"
  fi
fi

[[ -n "${ANDROID_HOME:-}" && -d "$ANDROID_HOME" ]] || fail \
  "Android SDK nicht gefunden. In Android Studio den SDK-Pfad prüfen und ANDROID_HOME setzen."

export ANDROID_SDK_ROOT="$ANDROID_HOME"
echo "Android SDK: $ANDROID_HOME"

echo
echo "1/5 Abhängigkeiten installieren ..."
npm ci

echo
echo "2/5 Portal-only-Edition prüfen ..."
npm run typecheck
npx vitest run \
  src/__tests__/platform/healthOSStoreEdition.test.ts \
  src/__tests__/platform/storeConfig.test.ts \
  src/__tests__/ui/googlePlayReadiness.test.ts

echo
echo "3/5 Android-Projekt erzeugen/aktualisieren ..."
npx expo prebuild --platform android --no-install

[[ -f android/gradlew ]] || fail "Gradle-Wrapper wurde nicht erzeugt."
chmod +x android/gradlew

echo
echo "4/5 Installierbare APK bauen ..."
(
  cd android
  ./gradlew --no-daemon clean assembleDebug
)

SOURCE_APK="android/app/build/outputs/apk/debug/app-debug.apk"
[[ -f "$SOURCE_APK" ]] || fail "Die APK wurde nicht im erwarteten Ausgabeordner gefunden."

OUTPUT_DIR="$ROOT_DIR/release/android"
mkdir -p "$OUTPUT_DIR"
OUTPUT_APK="$OUTPUT_DIR/CareSuite-HealthOS-Portale-v0.2.0-code14-debug.apk"
cp "$SOURCE_APK" "$OUTPUT_APK"

echo
echo "5/5 Prüfsumme erzeugen ..."
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$OUTPUT_APK"
fi

echo
echo "======================================================================"
echo "APK FERTIG"
echo "$OUTPUT_APK"
echo "======================================================================"
echo "Hinweis: Diese APK ist zum Installieren und Testen."
echo "Für Google Play ist zusätzlich ein AAB mit dem bestehenden Upload-Schlüssel erforderlich."
