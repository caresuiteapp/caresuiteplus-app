# Android Internal Test Build — Abnahmebericht (A.0/A.1)

**Datum:** 2026-06-21  
**Scope:** Google Play Internal Test — AAB (`app.caresuiteplus`) + EAS-Konfiguration  
**EAS Account:** `kevin-caresuite` (angemeldet)

---

## 1. App-Konfiguration

| Prüfung | Ergebnis | Wert |
|---------|----------|------|
| `android.package` | ✅ | `app.caresuiteplus` (von `de.caresuiteplus.app` angepasst) |
| `name` | ✅ | `CareSuite+` |
| `version` (versionName) | ✅ | `1.0.0` |
| `versionCode` (lokal) | ✅ | `2` in app.json / app.config.ts |
| `versionCode` (EAS remote) | ✅ | **4** (autoIncrement via `production-aab`) |
| Icon | ✅ | `./assets/icon.png` |
| Adaptive Icon | ✅ | foreground / background / monochrome |
| Splash | ✅ | `./assets/splash-icon.png`, `#070B12` |
| iOS bundleIdentifier | ℹ️ unverändert | `de.caresuiteplus.app` |

---

## 2. EAS-Profile (`eas.json`)

| Profil | Zweck | buildType | Status |
|--------|-------|-----------|--------|
| `production-aab` | **Play Store AAB** | `app-bundle` | ✅ neu, extends `production`, autoIncrement |
| `preview-apk` | Direkt-Install APK | `apk` | ✅ neu, extends `preview`, internal |
| `production` | Store (Legacy) | `app-bundle` | ✅ |
| `preview` | Internal APK | `apk` | ✅ |

**Remote Versioning:** `cli.appVersionSource: remote` — versionCode wird auf EAS-Server verwaltet.

---

## 3. Play-Anforderungen

| Prüfung | Ergebnis | Anmerkung |
|---------|----------|-----------|
| AAB (nicht nur APK) | ✅ | `production-aab` → `.aab` |
| Target SDK | ⚠️ | Expo SDK **52** Standard: **targetSdk 34**, compileSdk 35. Google Play verlangt für neue Uploads ab 2025 i. d. R. **API 35**. Für Internal Test ggf. ausreichend; vor Production-Track `expo-build-properties` mit `targetSdkVersion: 35` empfohlen. |
| Berechtigungen | ✅ / ⚠️ | `INTERNET`, `RECORD_AUDIO` (VoiceCore). `expo-location`-Plugin registriert Standort-Permission („Funktion in Vorbereitung“) — kein aktives GPS-Tracking im Live-Pfad. |
| Debug/Demo im Startup | ✅ | `app/index.tsx` → `AppStartScreen`; Demo-Link in Production per Footer ausgeblendet (`googlePlayReadiness.test.ts`) |

---

## 4. Build-Ergebnisse

### Erster Versuch (fehlgeschlagen)

- **Build-ID:** `c841965e-3b4b-4670-85bc-3348a9f6c417`
- **Ursache:** Metro konnte Node-Modul `crypto` nicht auflösen (`documentHashService.ts`, `assistExecutionHashService.ts`)
- **Fix:** Pure-JS SHA-256 in `src/lib/crypto/sha256Hex.ts`, Node-`crypto`-Import entfernt

### Erfolgreicher AAB-Build

| Feld | Wert |
|------|------|
| **Status** | ✅ FINISHED |
| **Build-ID** | `e71ff1bc-d06f-4a32-8891-58cf698b478c` |
| **Profil** | `production-aab` |
| **versionCode** | 4 |
| **Build-Logs** | https://expo.dev/accounts/kevin-caresuite/projects/caresuite-plus/builds/e71ff1bc-d06f-4a32-8891-58cf698b478c |
| **AAB-Download** | https://expo.dev/artifacts/eas/kz5QRvU82gB6-a5Vdui3tEkC2LZfEK0NBOFK5YOgfx0.aab |

**APK (optional):** nicht in diesem Lauf erstellt. Ein Befehl:

```bash
npx eas-cli build -p android --profile preview-apk --non-interactive
```

---

## 5. Lokale Checks

| Check | Ergebnis |
|-------|----------|
| `npx expo export --platform android` | ✅ (4509+ Module, kein crypto-Fehler) |
| Auth/Login-Routen | ✅ `app/auth/*`, Redirect über `/` |
| Office-Routen | ✅ `app/office/(tabs)/index.tsx`, `app/business/office/*` |
| Assist-Routen | ✅ `app/assist/index.tsx`, Einsätze/Fahrten/etc. |
| Keystore | ✅ EAS Remote (`Build Credentials jZclBmB5N_`) |

---

## 6. Play Console — nächste Schritte

1. Play Console → App mit Package **`app.caresuiteplus`** anlegen (falls noch nicht vorhanden; frühere Docs nutzten `de.caresuiteplus.app`).
2. **Internal testing** → Release erstellen → AAB hochladen (Link oben).
3. Tester hinzufügen, Release reviewen.
4. Optional: `eas submit -p android --profile production` (Service Account unter `./secrets/google-play-service-account.json` — lokal, nicht committed).

---

## 7. One-Command Rebuild

```bash
npx eas-cli build -p android --profile production-aab --non-interactive
```

Voraussetzungen: `npx eas-cli whoami` → angemeldet; kein `.env` im Git.

---

## 8. Geänderte Dateien (dieser Lauf)

- `app.json`, `app.config.ts` — Package + versionCode
- `eas.json` — `production-aab`, `preview-apk`
- `src/lib/crypto/sha256Hex.ts` — RN-kompatibles Hashing
- `src/lib/documents/documentHashService.ts`, `src/lib/assist/assistExecutionHashService.ts`
- `src/__tests__/ui/googlePlayReadiness.test.ts` — Package + Profile

**Nicht committed:** Secrets, `.env`, Audit-Logs, `.audit-expo-export-android/`
