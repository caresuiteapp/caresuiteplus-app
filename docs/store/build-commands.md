# EAS & Build Commands — CareSuite+

**Stand:** 2026-06-13

---

## Lokale Entwicklung

```bash
npm install
npm run start          # Expo Dev Server
npm run ios            # iOS Simulator (lokal)
npm run android        # Android Emulator (lokal)
npm run web            # Web Dev Server
```

---

## Quality Gates (vor jedem Build)

```bash
npm run typecheck
npm run test
npm run smoke
npm run platform:audit
npm run store:audit
npm run eas:preflight   # EAS Login + projectId (exit 1 erwartet bis project:init)
```

---

## Web Export (Desktop Phase 1)

```bash
npx expo export --platform web
# Output: dist/
```

Statischer Export für Hosting (Netlify, Vercel, S3). Siehe `docs/platform/web-desktop-readiness.md`.

---

## EAS Build Profiles (`eas.json`)

| Profil | Verteilung | iOS | Android | APP_ENV |
|--------|------------|-----|---------|---------|
| `development` | internal | Simulator | APK | development |
| `preview` | internal | Device | APK | preview |
| `production` | store | Device | AAB | production |

### Development

```bash
npx eas build --profile development --platform ios
npx eas build --profile development --platform android
```

- iOS: Simulator-Build (`simulator: true`)
- Android: APK für schnelle interne Tests

### Preview (TestFlight / interne QA)

```bash
npx eas build --profile preview --platform ios
npx eas build --profile preview --platform android
```

- Geräte-Builds, interne Verteilung
- Vor Store-Submission für QA nutzen

### Production (Store)

```bash
npx eas build --profile production --platform all
```

- iOS: App Store / TestFlight
- Android: App Bundle (`.aab`) für Play Console
- `autoIncrement: true` — Build-Nummern über EAS Remote Version Source

---

## EAS Submit (nach erfolgreichem Production-Build)

```bash
npx eas submit --profile production --platform ios
npx eas submit --profile production --platform android
```

**Voraussetzungen:** `eas.json` → `submit.production` mit echten Apple-/Google-Credentials (siehe `eas-build-preflight.md`).

---

## EAS Projekt-Setup (einmalig)

```bash
npx eas login
npx eas project:init
# projectId in app.json oder EAS_PROJECT_ID setzen
npx eas credentials
```

---

## Umgebungsvariablen für Builds

Siehe `docs/deployment/mobile-env-strategy.md` und `.env.example`.

EAS-Profile setzen `APP_ENV` — für Live-Supabase zusätzlich in EAS Secrets:

```bash
npx eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://..."
npx eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "..."
npx eas secret:create --name EXPO_PUBLIC_DEMO_MODE --value "false"
```

---

## Assets generieren (Platzhalter)

```bash
node scripts/create-assets.mjs
```

Erzeugt minimale PNGs für lokale Builds. **Nicht** für Store-Submission verwenden.
