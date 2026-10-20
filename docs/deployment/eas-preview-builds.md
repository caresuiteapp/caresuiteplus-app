# EAS Preview Builds — CareSuite+

**Sprint 73** — Vorbereitung interner Preview-Builds (APK / TestFlight-ähnlich).  
**Verdict:** Konfiguration vorbereitet — **NOT store-ready**, kein verifizierter Build in diesem Sprint.

---

## Aktueller Stand

| Prüfung | Status |
|---------|--------|
| `eas.json` Profile (development / preview / production) | ✅ angelegt |
| `app.config.ts` + `EAS_PROJECT_ID` env | ✅ vorbereitet |
| `extra.eas.projectId` in `app.json` | ⚠ Platzhalter `00000000-0000-0000-0000-000000000000` |
| EAS Login | ⚠ **Blocker** — `npx eas whoami` → Not logged in |
| `eas project:init` | ⚠ ausstehend (nach Login) |
| Preview-Build ausgeführt | ❌ nicht in Sprint 73 |
| Store-Submit-Credentials | ⚠ Platzhalter in `eas.json` |

---

## Quality Gates (vor jedem Build)

```bash
npm run typecheck
npm run test
npm run smoke
npm run platform:audit
npm run store:audit
npm run eas:preflight
```

`eas:preflight` prüft `eas.json`, `projectId`, Docs und optional EAS-Login — **kein Build**.

---

## Einmaliges Projekt-Setup

```bash
npm install
npx eas login
npx eas project:init
```

Nach `project:init` die generierte UUID **eine** der folgenden Stellen zuweisen:

1. Umgebungsvariable `EAS_PROJECT_ID` (bevorzugt für CI / EAS Secrets)
2. `app.json` → `expo.extra.eas.projectId`

**Nicht erfinden** — nur die ID aus `eas project:init` verwenden.

Verifikation:

```bash
npx eas project:info
```

---

## Preview-Build (interne QA)

Profil `preview` in `eas.json`:

- `distribution: internal`
- Android: APK
- iOS: Geräte-Build (kein Simulator)
- `APP_ENV=preview`

```bash
# Nach project:init + Login
npx eas build --profile preview --platform android
npx eas build --profile preview --platform ios
```

EAS Secrets für Live-Pilot (optional, siehe `mobile-env-strategy.md`):

```bash
npx eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://..."
npx eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "..."
npx eas secret:create --name EXPO_PUBLIC_DEMO_MODE --value "false"
npx eas secret:create --name EAS_PROJECT_ID --value "<uuid-from-project-init>"
```

---

## Development vs. Preview vs. Production

| Profil | Zweck | Verteilung |
|--------|-------|------------|
| `development` | Dev Client / Simulator | internal |
| `preview` | Interne QA auf Geräten | internal |
| `production` | Store-Artefakte (AAB / App Store) | store |

Production-Builds und Submit erfordern echte Apple-/Google-Credentials — siehe `docs/store/eas-build-preflight.md`.

---

## Bekannte Blocker (Sprint 73)

1. **EAS Login fehlt** — `npx eas login` vor `project:init`
2. **projectId Platzhalter** — kein echter EAS-Build möglich
3. **Assets** — 1×1-Platzhalter, nicht store-tauglich
4. **Submit-Credentials** — `REPLACE_WITH_*` in `eas.json`
5. **GPS Live-Tracking** — `expo-location` integriert, `isGpsTrackingLiveReady(): false` (Sprint 74)

---

## Verwandte Docs

- [`docs/store/eas-build-preflight.md`](../store/eas-build-preflight.md)
- [`docs/store/build-commands.md`](../store/build-commands.md)
- [`docs/deployment/mobile-env-strategy.md`](mobile-env-strategy.md)
- [`docs/deployment/apply-live-migrations-0021-0030.md`](apply-live-migrations-0021-0030.md) — Remote-Migrationen (dry-run default)
