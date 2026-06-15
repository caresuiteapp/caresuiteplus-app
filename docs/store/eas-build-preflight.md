# EAS Build Preflight — CareSuite+

**Stand:** 2026-06-13  
**Zweck:** Checkliste vor dem ersten echten `eas build`

---

## Voraussetzungen

| Schritt | Status | Aktion |
|---------|--------|--------|
| Expo-Account | ☐ | `npx eas login` |
| EAS CLI ≥ 13 | ☐ | `npm i -g eas-cli` oder `npx eas` |
| EAS-Projekt verknüpft | ⚠ Platzhalter | `npx eas project:init` → `projectId` in `app.json` / `EAS_PROJECT_ID` |
| Assets vorhanden | ⚠ Platzhalter | `node scripts/create-assets.mjs` erzeugt 1×1 PNGs — vor Store durch echte Grafiken ersetzen |
| `.env` für Live-Pilot | ☐ | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_DEMO_MODE=false` |
| Apple Developer Program | ☐ | Team-ID, App-ID `de.caresuiteplus.app` registrieren |
| Google Play Console | ☐ | App `de.caresuiteplus.app` anlegen |
| Service-Account (Play) | ☐ | JSON unter `secrets/google-play-service-account.json` (nicht committen) |

---

## EAS_PROJECT_ID

Aktuell in `app.json` / `app.config.ts`:

```
00000000-0000-0000-0000-000000000000
```

**Das ist ein Platzhalter.** Vor dem ersten Build:

```bash
npx eas login
npx eas project:init
```

Die generierte UUID in **eine** der folgenden Stellen eintragen:

- `app.json` → `expo.extra.eas.projectId`
- oder Umgebungsvariable `EAS_PROJECT_ID` (bevorzugt für CI; `app.config.ts` liest sie ein)

**Nicht erfinden** — nur die ID aus `eas project:init` verwenden.

---

## Credentials (nicht in diesem Sprint ausgeführt)

| Plattform | Benötigt | Blocker |
|-----------|----------|---------|
| iOS | Distribution Certificate, Provisioning Profile | Apple Developer Account |
| Android | Keystore (EAS verwaltet oder upload) | Play Console App angelegt |
| Submit iOS | `appleId`, `ascAppId`, `appleTeamId` in `eas.json` | Noch `REPLACE_WITH_*` |
| Submit Android | `secrets/google-play-service-account.json` | Datei fehlt |

---

## Preflight-Befehle (lokal, ohne Build)

```bash
npm run typecheck
npm run test
npm run smoke
npm run platform:audit
npm run store:audit
npx expo export --platform web   # Web-Bundle prüfen
npx eas build:configure          # optional, eas.json bereits vorhanden
npx eas credentials               # nach project:init
```

---

## Erwarteter erster Build-Flow

```bash
# 1. Projekt initialisieren
npx eas project:init

# 2. Development (Simulator / APK intern)
npx eas build --profile development --platform ios
npx eas build --profile development --platform android

# 3. Preview (Gerät, interne Verteilung)
npx eas build --profile preview --platform all

# 4. Production (Store-Artefakte)
npx eas build --profile production --platform all
```

---

## Bekannte Blocker (Stand 2026-06-13)

1. **EAS projectId** — Platzhalter, `eas project:init` ausstehend
2. **Assets** — technisch vorhanden (Platzhalter), nicht store-tauglich
3. **Kein verifizierter EAS-Build** in diesem Repo-Sprint
4. **Submit-Credentials** — Platzhalter in `eas.json`
5. **Demo-Modus** — Standard in `.env.example`; Live-Build braucht `EXPO_PUBLIC_DEMO_MODE=false`

---

## Verdict

**EAS-Konfiguration vorbereitet** — Profile und `eas.json` sind angelegt. Erster echter Build blockiert durch fehlende `projectId`, Store-Credentials und echte Assets.
