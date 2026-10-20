# CareSuite+ — Full App Bug Audit Report

**Datum:** 2026-06-14  
**Scope:** Gesamte App — Quality Gates, Code-Audit, P0/P1-Fixes, Demo-Journey  
**Status:** Nicht production/store-ready (Pilot/Demo)

---

## Executive Summary

CareSuite+ wurde mit allen 14 npm-Audit-Skripten, Typecheck, Vitest (1305 Tests) und Smoke-Check geprüft. **Zwei P1-Testfehler** wurden behoben (veraltete Assertions nach Client-Intake-Rebuild und Light-Default-Design). Alle Gates bestehen jetzt; **expo-doctor** meldet weiterhin eine Warnung zu `.expo/` in Git (P3). Store-Submission ist bewusst nicht ready (Apple/Google-Credentials fehlen).

**Kernbefunde:**
- Client-Intake-Wizard korrekt unter `/business/office/clients/new` verdrahtet; Legacy-Routen leiten per Redirect weiter
- Keine verbotenen „OfficeCore“-UI-Begriffe; Free-Platform ohne Payment-Gates
- Dual-Routing `/office/*` ↔ `/business/office/*` funktional, aber inkonsistent in Demo-Dashboard-Links (P2)
- 305 Expo-Router-Routen; Smoke-Check bestanden

---

## Quality Gates

| Gate | Status | Anmerkung |
|------|--------|-----------|
| `npm run typecheck` | ✅ PASS | 0 TS-Fehler |
| `npm run test` | ✅ PASS | 193 Dateien, 1305 Tests |
| `npm run smoke` | ✅ PASS | 259 Kern-Dateien, 305 Routen |
| `npm run platform:audit` | ✅ PASS | Tablet, Bundle-ID, EAS-Profile |
| `npm run store:audit` | ⚠️ PASS (2 Warnungen) | Build OK; Store-Submit nicht ready |
| `npm run design:audit` | ✅ PASS | CareLight, ThemeModeProvider |
| `npm run responsive:audit` | ✅ PASS | CareAdaptiveShell |
| `npm run visual:audit` | ✅ PASS | Light-default, keine Dark-BG-Leaks |
| `npm run content:audit` | ✅ PASS | 20 Klient:innen, 15 MA, Modulzuordnungen |
| `npm run free-platform:audit` | ✅ PASS | Kein „Modul kaufen“ |
| `npm run office:terminology:audit` | ✅ PASS | 1787 Dateien, 0 OfficeCore-UI |
| `npm run client-intake:audit` | ✅ PASS | Wizard + Redirects |
| `npm run locale:audit` | ✅ PASS | de-DE / Europe/Berlin / EUR |
| `npm run catalog:audit` | ✅ PASS | 47 Systemkataloge |
| `npx expo-doctor` | ⚠️ 17/18 | `.expo/` nicht von Git ignoriert (laut Tool) |

### store:audit Warnungen (erwartet, kein Bug)

- `eas.json submit.production.ios`: Apple-Credentials Platzhalter
- Google Play Service-Account-Key fehlt

### expo-doctor (P3)

- `.expo/` steht in `.gitignore`; expo-doctor meldet dennoch fehlende Ignorierung — ggf. bereits getrackte `.expo`-Dateien im Repo prüfen und aus Index entfernen

---

## Bugs Found

### Fixed (P0/P1)

| ID | Schwere | Beschreibung | Fix |
|----|---------|--------------|-----|
| BUG-001 | P1 | `officeContentArchitecture.test.ts`: erwartete `/office/clients/`, Code nutzt `clientRecordRoute()` → `/business/office/clients/:id` | Test auf `clientRecordRoute` aktualisiert |
| BUG-002 | P1 | `themeBridge.test.ts`: erwartete Dark als Default für `colors`, nach Design-Verifikation ist Light Default | Test prüft jetzt `darkColors` + Light-Default separat |

### Open (P2)

| ID | Schwere | Beschreibung | Datei/Route |
|----|---------|--------------|-------------|
| BUG-101 | P2 | Demo-Dashboard Quick-Actions nutzen Legacy-Pfade `/office/*` statt kanonischer Business-Routen | `src/data/demo/officeDashboard.ts` |
| BUG-102 | P2 | `/business/office/dashboard` leitet auf `/office` statt auf kanonisches Business-Office-Dashboard | `app/business/office/dashboard.tsx` |
| BUG-103 | P2 | `clientEditRoute()` zeigt noch auf `/office/clients/:id/edit`, nicht `/business/office/...` | `src/lib/navigation/clientRoutes.ts` |
| BUG-104 | P2 | `OfficeModulesHubScreen` verlinkt Stammdaten über `/office/clients` | `src/screens/business/office/OfficeModulesHubScreen.tsx` |
| BUG-105 | P2 | `moduleAssignmentService` hardcoded `officeLink: '/office/documents'` | `src/lib/officeModules/moduleAssignmentService.ts` |
| BUG-106 | P2 | Einige Screens importieren statisches `@/theme/colors` (Light) statt `useLegacyTheme()` — bei Dark-Mode-Toggle inkonsistent | diverse `src/screens/*` |

### Open (P3)

| ID | Schwere | Beschreibung | Datei/Route |
|----|---------|--------------|-------------|
| BUG-201 | P3 | Store-Submission: Apple/Google Credentials fehlen | `eas.json`, Play Console |
| BUG-202 | P3 | expo-doctor: `.expo/` Git-Ignore-Warnung | `.gitignore` / ggf. getrackte Dateien |
| BUG-203 | P3 | Design-System Showcase: `onPress={() => {}}` (absichtlich, nur Demo-Komponenten) | `app/design-system/components.tsx` |
| BUG-204 | P3 | GPS/Foto-Capture `preparedOnly` — Features dokumentiert, nicht live | `app.config.ts`, Assist-Modul |
| BUG-205 | P3 | Live-Supabase abhängig von Remote-Migrationen/Env — Demo-Modus unabhängig | `.env`, Supabase |

---

## Code-Level Audit Checklist

| Prüfpunkt | Ergebnis |
|-----------|----------|
| Broken route wiring `/office` vs `/business/office` | Legacy `/office/*` funktioniert; Client Create/Detail redirecten korrekt; einige Links noch Legacy (P2) |
| Navigation dead ends / no-op buttons | Keine in Hauptflows; Design-System Showcase noop (P3) |
| Missing screen exports | Alle 305 Router-Routen in Smoke-Check |
| Import errors / circular deps | Typecheck clean |
| Dark/light mixed layouts in Demo | visual:audit PASS; statische `colors`-Imports in älteren Screens (P2) |
| Client wizard linked from list | ✅ `CLIENT_INTAKE_NEW_ROUTE` in `ClientsListView.tsx` |
| Forbidden OfficeCore in UI text | ✅ office:terminology:audit clean |
| Payment gates blocking free platform | ✅ free-platform:audit clean |
| Placeholder EAS projectId | ✅ store:audit: projectId gesetzt (nicht Platzhalter) |

---

## Demo Journey Test Checklist

Manuell im Demo-Modus (`EXPO_PUBLIC_DEMO_MODE=true`) prüfen:

- [ ] **Start** → `/` → AppStartScreen → Demo-Login Business
- [ ] **Office Dashboard** → `/office` → KPIs, Quick-Actions klickbar
- [ ] **Klient:innen-Liste** → `/office/clients` → „Neuaufnahme“ → `/business/office/clients/new`
- [ ] **Intake-Wizard** → Leistungsart wählen → Schritte durchlaufen → Speichern → Akte `/business/office/clients/:id`
- [ ] **Legacy-Redirect** → `/office/clients/create` → Redirect auf Wizard
- [ ] **Legacy-Detail** → `/office/clients/:id` → Redirect auf Akte
- [ ] **Module-Zuordnung** → Pflege/Assist → Zugeordnete Klient:innen → Tap → Akte öffnet
- [ ] **Business-Hub** → `/business` → Module, Ops, Templates
- [ ] **Portal** → Demo Client/Employee Login → Tabs laden
- [ ] **Theme** → Light default; Dark-Toggle (falls UI vorhanden) auf Startseite prüfen

---

## Top 5 Routes — Manuelle Verifikation

1. **`/`** — App-Start, Demo-Einstieg, Responsive Layout
2. **`/office/clients`** — Liste + Neuaufnahme-Button → Wizard
3. **`/business/office/clients/new`** — Client-Intake-Wizard (Leistungsart-first)
4. **`/business/office/clients/[id]`** — Client-Akte mit dynamischen Tabs
5. **`/office`** — Office-Dashboard, Quick-Actions, Modul-Navigation

---

## Recommendations

1. **Route-Konsolidierung (P2):** Demo-Dashboard und OfficeModulesHub auf kanonische `/business/office/*`-Pfade umstellen; Legacy `/office/*` als Redirect-Aliase behalten
2. **Theme-Migration abschließen (P2):** Verbleibende Screens von statischem `colors`-Import auf `useLegacyTheme()` oder CareLight-Komponenten migrieren
3. **Store-Readiness (P3):** Apple ASC API Key + Google Play Service Account vor Submit eintragen
4. **Git-Hygiene (P3):** `.expo/` aus Git-Index entfernen falls getrackt
5. **Live-Pilot (P3):** Remote-Migrationen + Seed vor Live-Demo anwenden (`npm run apply:live-migrations`, `npm run seed:live-pilot`)

---

## Fixes Applied in This Audit

```
src/__tests__/office/officeContentArchitecture.test.ts  — clientRecordRoute assertion
src/__tests__/design/themeBridge.test.ts                — light default + darkColors split
```

---

*Report generiert im Rahmen des Full-App-Bug-Audits. Nicht als Store-Release-Freigabe zu interpretieren.*
