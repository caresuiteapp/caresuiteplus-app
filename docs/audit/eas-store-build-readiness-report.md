# CareSuite+ — EAS & Store Build Readiness Report

**Stand:** 2026-06-13  
**Sprint:** EAS/Store-Build-Readiness vorbereitet  
**Projekt:** `C:\Users\Kevin Reinhardt\Documents\CareSuite+`

---

## A. Executive Summary

CareSuite+ wurde für echte mobile Builds und Store-Submission **vorbereitet**: App-Identität finalisiert, EAS-Profile dokumentiert, Store-/Legal-Docs ergänzt, Audit-Skripte und Tests erweitert, Platzhalter-Assets angelegt, Web-Export verifiziert.

**Ehrliches Fazit:** EAS/Store-Build-Readiness vorbereitet. **Noch nicht store-ready** — kein `eas project:init`, keine verifizierten TestFlight/Play-Builds, Assets sind 1×1-Platzhalter, Submit-Credentials fehlen.

---

## B. App Identity Status

| Feld | Wert | Status |
|------|------|--------|
| name | CareSuite+ | ✓ |
| slug | caresuite-plus | ✓ |
| scheme | caresuiteplus | ✓ |
| iOS bundleIdentifier | `de.caresuiteplus.app` | ✓ stabil |
| Android package | `de.caresuiteplus.app` | ✓ stabil |
| iOS supportsTablet | `true` | ✓ |
| iOS buildNumber | `1` | ✓ |
| Android versionCode | `1` | ✓ |
| orientation | `default` | ✓ |
| splash | `./assets/splash-icon.png`, `#070B12` | ⚠ Platzhalter |
| adaptive icon | foreground/background/monochrome | ⚠ Platzhalter |

**Bundle-ID-Entscheidung:** `com.caresuiteplus.app` wurde geprüft; **`de.caresuiteplus.app`** bleibt die eine stabile ID (bereits in app.json, app.config.ts, Tests, Store-Docs). Kein `helferhasen`-Bundle-Variant — `helferhasen.app` nur in Test-E-Mail-Fixtures.

---

## C. EAS Status

| Aspekt | Status |
|--------|--------|
| eas.json | ✓ development / preview / production |
| appVersionSource | remote |
| production autoIncrement | ✓ |
| EAS_PROJECT_ID | ⚠ Platzhalter `00000000-0000-0000-0000-000000000000` |
| submit.production | ⚠ REPLACE_WITH_* Platzhalter |
| Verifizierter eas build | ❌ Nicht ausgeführt (Credentials fehlen) |

**Aktion:** `npx eas project:init` → echte UUID in `EAS_PROJECT_ID` oder `app.json`.

---

## D. Assets Status

| Datei | Existiert | Store-ready |
|-------|-----------|-------------|
| icon.png | ✓ | ❌ 1×1 Platzhalter |
| splash-icon.png | ✓ | ❌ |
| favicon.png | ✓ | ❌ |
| android-icon-foreground.png | ✓ | ❌ |
| android-icon-background.png | ✓ | ❌ |
| android-icon-monochrome.png | ✓ | ❌ |

Siehe `docs/store/assets-readiness.md`.

---

## E. Permissions Audit

| Permission | Deklariert | Im Code genutzt | preparedOnly (nicht deklariert) |
|------------|------------|-----------------|--------------------------------|
| INTERNET | ✓ Android | ✓ Supabase/API | — |
| CAMERA | ❌ | ❌ | BodyMap, Foto-Doku (vorbereitet) |
| LOCATION | ❌ | ❌ | Einsatz-Geo (geplant) |
| RECORD_AUDIO | ❌ | ❌ | Sprachnachrichten (UI vorbereitet) |
| POST_NOTIFICATIONS | ❌ | ❌ | Push (geplant) |
| READ/WRITE_STORAGE | ❌ | ❌ | Dokument-Upload (teilweise) |

**Verdict:** Nur tatsächlich genutzte Permissions deklariert. preparedOnly-Features fordern keine Store-Permissions.

---

## F. Store Docs Status

| Dokument | Status |
|----------|--------|
| app-store-checklist.md | ✓ |
| google-play-checklist.md | ✓ |
| screenshots-plan.md | ✓ |
| store-listing-texts.md | ✓ |
| privacy-data-map.md | ✓ erweitert (Volltabelle) |
| reviewer-notes.md | ✓ (keine Passwörter) |
| eas-build-preflight.md | ✓ neu |
| build-commands.md | ✓ neu |
| assets-readiness.md | ✓ neu |
| legal-links-checklist.md | ✓ neu |
| mobile-env-strategy.md | ✓ neu |
| web-desktop-readiness.md | ✓ neu |

---

## G. Legal & Privacy

| Anforderung | Status |
|-------------|--------|
| supportLinks.ts (Hilfe, Datenschutz, Impressum, AGB) | ✓ |
| URLs live | ❌ Platzhalter-Domain |
| DataRequestScreen | ✓ preparedOnly (`/settings/data-request`) |
| AccountDeletionRequestScreen | ✓ preparedOnly (`/settings/account-deletion`) |
| DSGVO über Mandanten-Admin + Support | Dokumentiert + In-App Screens |

---

## H. Tablet Layout Verification

| Screen | Route | MasterDetail | Tablet Shell | Status |
|--------|-------|--------------|--------------|--------|
| Klient:innen | `app/office/(tabs)/clients.tsx` | `ClientsAdaptiveScreen` | Side Rail | ✓ |
| Kommunikationszentrum | `app/business/messages/index.tsx` | `CommunicationAdaptiveScreen` | Side Rail | ✓ |
| Office Nachrichten | `app/office/(tabs)/messages.tsx` | `OfficeMessagesAdaptiveScreen` | Side Rail | ✓ |
| Mitarbeiter | `app/office/(tabs)/employees.tsx` | — | Side Rail + Stack | ☐ später |
| Rechnungen | `app/office/(tabs)/invoices.tsx` | — | Side Rail + Stack | ☐ später |
| KIM Mailbox | `app/business/ti/kim` | — | Side Rail + Stack | ☐ später |

Breakpoint: `supportsMasterDetail` ab 768px (`src/lib/platform/breakpoints.ts`).

---

## I. Web / Desktop Basis

| Test | Ergebnis |
|------|----------|
| `npx expo export --platform web` | **PASS** (nach Install: react-native-web, react-dom, @expo/metro-runtime, expo-font, @opentelemetry/api) |
| Output | `dist/`, 254 statische Routen |
| `npm run web` (Dev) | ✓ konfiguriert |
| Tauri Desktop | ❌ Phase 2 |
| Production Hosting | ❌ |

---

## J. Settings Screens (DSGVO)

| Screen | Existiert | Hinweis |
|--------|-----------|---------|
| DataRequestScreen | ✓ | preparedOnly — Submit disabled, Support-E-Mail |
| AccountDeletionRequestScreen | ✓ | preparedOnly — Art. 17 UI, kein Fake-Erfolg |
| Modul-Settings (Pflege, QM, …) | ✓ | Fachliche Einstellungen, keine DSGVO-Flows |

---

## K. Scripts

| Script | Zweck | Status |
|--------|-------|--------|
| `scripts/store-readiness-check.mjs` | Vollständiger Store/EAS-Audit | ✓ neu |
| `scripts/store-audit.mjs` | Delegiert an store-readiness-check | ✓ |
| `scripts/platform-audit.mjs` | Plattform-Dateien + neue Docs | ✓ erweitert |
| `npm run store:audit` | package.json | ✓ |
| `npm run platform:audit` | package.json | ✓ |

---

## L. Tests

Erweitert: `src/__tests__/platform/storeConfig.test.ts`

- App-Identität (name, slug, scheme, bundle, supportsTablet, buildNumber, versionCode)
- app.config.ts Spiegelung
- Asset-Existenz (6 Dateien)
- EAS-Profile inkl. production AAB
- Android permissions nur INTERNET
- Store-/Deployment-Docs + store-readiness-check.mjs
- Shell-Module (Desktop/Tablet/Mobile/MasterDetail)

Bestehend: `breakpoints.test.ts`, `platformLayout.test.ts` (DeviceClass, Shells).

---

## M. Quality Gates (dieser Sprint)

| Gate | Status |
|------|--------|
| `npm run typecheck` | **PASS** |
| `npm run test` | **PASS** (300 Tests) |
| `npm run smoke` | **PASS** |
| `npm run platform:audit` | **PASS** |
| `npm run store:audit` | **PASS** (mit Warnungen: EAS-ID, Platzhalter-Assets, fehlende DSGVO-Screens) |
| `npx expo export --platform web` | **PASS** |

---

## N. Offene Store-Blocker

1. `npx eas project:init` — echte EAS_PROJECT_ID
2. Echte App-Icons und Splash (Design-Freigabe)
3. Apple Developer + Google Play Accounts + Submit-Credentials
4. `secrets/google-play-service-account.json`
5. Live Legal-URLs (Datenschutz, Impressum)
6. Reviewer-Demo-Credentials in Store Consoles (nicht im Repo)
7. ~~DataRequest / AccountDeletion UI~~ ✓ preparedOnly (Sprint 47) — Live-Submit + Web-URLs vor Launch
8. Erster erfolgreicher `eas build --profile preview`
9. Store-Screenshots (siehe screenshots-plan.md)
10. `EXPO_PUBLIC_DEMO_MODE=false` für Production-Builds

---

## O. Web-Export Abhängigkeiten (neu installiert)

Für erfolgreichen statischen Web-Export wurden ergänzt:

- `react-native-web`, `react-dom`, `@expo/metro-runtime`
- `expo-font`
- `@opentelemetry/api` (Supabase-JS Peer für Metro Web)

---

## P. Environment Strategy

Siehe `docs/deployment/mobile-env-strategy.md`. `.env.example` um `EAS_PROJECT_ID` und Audit-Gates erweitert.

---

## Q. Preflight Checklist (Kurz)

```bash
npm run typecheck && npm run test && npm run smoke
npm run platform:audit && npm run store:audit
npx eas login
npx eas project:init
npx eas build --profile preview --platform all
```

---

## R. Referenz-Dokumente

- Multi-Platform Basis: `docs/audit/multiplatform-store-desktop-readiness-report.md`
- EAS Preflight: `docs/store/eas-build-preflight.md`
- Build Commands: `docs/store/build-commands.md`

---

## S. Nicht behauptet

- ❌ Store-ready / Production-ready
- ❌ Verifizierte TestFlight- oder Play-Internal-Builds
- ❌ Live Store-Listings veröffentlicht
- ❌ Placebo-Buttons oder Demo-only Screens als fertig

---

## T. Final Verdict

> **EAS/Store-Build-Readiness vorbereitet. Noch nicht store-ready.**

Konfiguration, Dokumentation, Audit-Automatisierung und Quality Gates sind angelegt. Der nächste Schritt ist `eas project:init`, echte Assets und ein Preview-Build — nicht Store-Submission.

---

*Report erstellt im EAS/Store-Build-Readiness Sprint 2026-06-13. Aktualisiert Sprint 48 (2026-06-14): DSGVO-Screens preparedOnly, app.config supportLinks-Sync, store:audit 3 Warnungen.*
