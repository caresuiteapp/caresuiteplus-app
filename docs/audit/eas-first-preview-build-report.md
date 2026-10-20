# CareSuite+ — EAS First Preview Build Report

**Stand:** 2026-06-14 (Build v2 + expo-linking Fix)  
**Scope:** EAS project link + Android preview builds — no store/production-ready claims  
**Identifier:** `de.caresuiteplus.app` (iOS + Android)  
**EAS Project:** `@kevin-caresuite/caresuite-plus` · ID `567bda34-8356-4de8-9349-a0de3143567e`

---

## A. Executive Summary

1. Placeholder EAS `projectId` entfernt; echtes Projekt via `eas project:init --force` verknüpft.
2. **Build v1** (`4f4d39eb-…`) auf EAS **finished** — aber `expo doctor` meldete danach fehlende Peer Dependency **`expo-linking`** (required by `expo-router`).
3. **`npx expo install expo-linking`** ausgeführt (`expo-linking@~7.0.5` in `package.json`).
4. Quality Gates erneut geprüft — alle grün (expo-doctor: 17/18, siehe unten).
5. **Build v2** (`a6ba7ad8-…`) gestartet und **finished** ✅ — aktueller Preview-Stand mit `expo-linking`.

**Verdict:** EAS verknüpft; **zweiter Android-Preview-Build erfolgreich** nach Peer-Dependency-Fix. **Nicht store-ready.**

---

## B. expo-linking Peer Dependency Fix

| Schritt | Ergebnis |
|---------|----------|
| **Problem (expo doctor)** | `Missing peer dependency: expo-linking` — Required by: `expo-router` |
| **Fix** | `npx expo install expo-linking` |
| **package.json** | `"expo-linking": "~7.0.5"` (SDK 52-kompatibel) |
| **Build v1 Hinweis** | Build v1 lief auf EAS durch, aber Doctor-Warnung blieb im Projekt — v2 behebt das für künftige Builds |

### expo-doctor (nach Fix)

| Check | Ergebnis |
|-------|----------|
| Peer dependencies (expo-linking) | **PASS** ✅ |
| Gesamt | **17/18 PASS** |
| Verbleibend | `.expo/` nicht von Git ignoriert — Git nicht installiert / kein Repo (`git` nicht auf PATH). `.gitignore` enthält bereits `.expo/`. Kein Blocker für EAS mit `EAS_NO_VCS=1`. |

---

## C. Placeholder Removal (EAS projectId)

| File | Had placeholder? | Action |
|------|------------------|--------|
| `app.json` | Yes — `00000000-…` | Entfernt; EAS CLI schrieb echte ID nach `project:init` |
| `app.config.ts` | Yes — Fallback `00000000-…` | Fallback entfernt; `projectId` nur bei `EAS_PROJECT_ID` env |
| `eas.json` | No placeholder | Unchanged |

**Echte projectId:** `567bda34-8356-4de8-9349-a0de3143567e` · Owner: `kevin-caresuite`

---

## D. Quality Gates (Build v2, nach expo-linking)

| Gate | Ergebnis |
|------|----------|
| `npx expo-doctor` | **17/18 PASS** — expo-linking OK; 1× Git/.expo (kein Git) |
| `npm run typecheck` | **PASS** |
| `npm run test` | **PASS** — 1190 tests (189 files) |
| `npm run smoke` | **PASS** — 285 routes |
| `npm run store:audit` | **PASS** — 2 erwartete Warnungen (Apple/Google Submit-Creds) |

---

## E. Android Preview Builds

### Build v1 (vor expo-linking Fix)

| Item | Wert |
|------|------|
| Build ID | `4f4d39eb-5118-449b-8a26-567487555018` |
| Status | **finished** |
| Build URL | https://expo.dev/accounts/kevin-caresuite/projects/caresuite-plus/builds/4f4d39eb-5118-449b-8a26-567487555018 |
| APK | https://expo.dev/artifacts/eas/78cv3BpqRlZNwhueSkY-aaMd5TuDV9OwaVBXfsjtqqk.apk |
| Anmerkung | Erfolgreich auf EAS, aber expo doctor meldete danach fehlendes `expo-linking` |

### Build v2 (nach expo-linking + Gates) — **aktuell**

| Item | Wert |
|------|------|
| Command | `EAS_NO_VCS=1 npx eas-cli build --platform android --profile preview --non-interactive` |
| Build ID | `a6ba7ad8-81d8-4092-a5f8-bf387710f380` |
| Status | **finished** ✅ |
| Profile | preview (internal APK) |
| SDK | 52.0.0 |
| Version | 1.0.0 / versionCode 1 |
| Keystore | Wiederverwendung (Build Credentials g3zufvN-7v) |
| **Build URL / Logs** | https://expo.dev/accounts/kevin-caresuite/projects/caresuite-plus/builds/a6ba7ad8-81d8-4092-a5f8-bf387710f380 |
| **APK Download** | https://expo.dev/artifacts/eas/nWDamPCizHsuhUSaTBGbB6GHPapu11izi6Q6XPusaQw.apk |
| Build-Zeit | ~10 min (13:33 → 13:43) |
| Fingerprint | `789c013b60979d0f28ec3a782825fc79057b5e04` |

### Build-Umgebung

- **Git nicht auf PATH** → `EAS_NO_VCS=1` erforderlich
- **Preview env:** `APP_ENV=preview` aus `eas.json`

---

## F. iOS Preview Build

Nicht gestartet (Android zuerst).

---

## G. Offene Punkte

1. Git installieren für EAS VCS-Workflow (optional)
2. EAS env secrets für Preview (`EXPO_PUBLIC_DEMO_MODE`, Supabase) konfigurieren
3. iOS Preview Build (Apple Developer)
4. Store-Submit-Credentials in `eas.json` noch Platzhalter

---

## H. Parent Return Checklist

| # | Item | Antwort |
|---|------|---------|
| A | Datei mit Placeholder | `app.json`, `app.config.ts` (behoben) |
| B | Placeholder entfernt | **Ja** |
| C | Echte projectId gesetzt | **Ja** — `567bda34-8356-4de8-9349-a0de3143567e` |
| D | `project:info` Status | **OK** |
| E | Build v1 Problem | expo doctor: fehlendes **`expo-linking`** |
| F | expo-linking installiert | **Ja** — `~7.0.5` |
| G | Quality Gates (v2) | typecheck ✅ test ✅ smoke ✅ store:audit ✅ expo-doctor 17/18 ✅ |
| H | Android Build v2 Status | **finished** ✅ |
| I | Build v2 URL | https://expo.dev/accounts/kevin-caresuite/projects/caresuite-plus/builds/a6ba7ad8-81d8-4092-a5f8-bf387710f380 |
| J | Final Verdict | EAS linked; Build v2 nach expo-linking-Fix erfolgreich — **nicht store-ready** |

---

## I. Final Verdict

CareSuite+ ist **EAS-verknüpft**. Nach Installation von **`expo-linking`** und erneuter Gate-Prüfung lief der **zweite Android-Preview-Build (v2) erfolgreich** auf EAS. Das ist ein Buildability-Meilenstein — **kein Store-Release** und **nicht production-ready**.

---

## J. Git / VCS Fix (2026-06-14)

| Item | Ergebnis |
|------|----------|
| Git vor Fix | Nicht auf PATH; kein `.git`-Repo (expo-doctor **17/18**) |
| Git for Windows (systemweit) | Installiert — **`git version 2.54.0.windows.1`** (`%LOCALAPPDATA%\Programs\Git\cmd\git.exe`; in interaktiven Terminals nach Installation auf PATH) |
| Repo | `git init` im Projektroot; Branch `master`, noch ohne Commit; `.gitignore` enthält `.expo/` |
| MinGit (optional) | Portable **MinGit 2.47.1** unter `.tools/mingit/` bleibt **nur Fallback** (in `.gitignore`); nicht nötig, wenn System-Git auf PATH ist — Ordner kann bei Bedarf gelöscht werden |
| `npx expo-doctor` | **18/18 PASS** (2026-06-14, mit System-Git auf PATH) |
| `npm run typecheck` | **PASS** |
| `npm run store:audit` | **PASS** (2 erwartete Submit-Warnungen) |
| `eas project:info` ohne `EAS_NO_VCS` | **OK** — `@kevin-caresuite/caresuite-plus`, ID `567bda34-8356-4de8-9349-a0de3143567e` |

**Hinweis:** Kein `EAS_NO_VCS` mehr nötig für normale EAS-Befehle, sobald `git` im Terminal-PATH ist. Falls Git in einer Shell fehlt: Terminal neu starten oder optional `.tools\mingit\cmd` voranstellen.

**Nicht store-ready** — nur VCS/expo-doctor-Blocker behoben.