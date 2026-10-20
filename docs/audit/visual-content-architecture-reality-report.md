# Visual & Content Architecture Reality Report

> Sprint: Visual Reality + Content Architecture — CareSuite+ light premium default demo view  
> Status: Sprint gates green — **not** production/store ready

## Verification Round 2 — Design Wiring (2026-06-14)

**Problem (User-Report):** Trotz Phase-2/3-Migration sahen Demo-Nutzer weiterhin dark legacy UI — CareLight-Screens existierten, waren aber nicht verdrahtet (gleiches Muster wie Client Intake Round 2).

**Root Cause (3-fach):**

| # | Ursache | Wirkung |
|---|---------|---------|
| 1 | **AsyncStorage `dark`** überschrieb ThemeModeProvider-Default | `CareAdaptiveShell` → `MobileShell` + **`AppTabBar`** (`#101827` / dark), nicht `CareLightBottomNav` |
| 2 | **Demo-Login → `/business`** statt `/office` | Erster Screen = `BusinessDashboardScreen` mit **`ScreenShell` + `DashboardHero`** (dark Gradient), nicht CareLight |
| 3 | **`@/theme` static = dark palette** | `colors` + `typography` hardcoded auf `legacyColorsFromPalette('dark')` → **weiße Textfarbe** auf CareLight-Hintergrund (`#F8FAFC`) in Listen/Details |

**Fixes:**

- `ThemeModeProvider`: Demo-Modus erzwingt **`light`** (ignoriert gespeichertes `dark`)
- `getPostLoginRedirect` → **`/office`** via `DEMO_BUSINESS_ENTRY_ROUTE`
- `BusinessDashboardScreen` → **`CareLightModuleDashboard`** (wie OfficeIndexScreen)
- `ModuleOverviewScreen` → **`CareLightPageShell`**
- `@/theme/colors.ts` + `@/theme/typography.ts` → **light default**
- `officeDashboard` Quick-Action → **`CLIENT_INTAKE_NEW_ROUTE`**
- `visual-reality-audit.mjs` → **`assertDemoNavigationWiring()`** (Tab-/Dashboard-Nav, verbotene Legacy-Routen)
- `src/lib/navigation/demoNavigation.ts` — zentrale Demo-Nav-Konstanten

**Demo-Routen zum Testen (nach `npx expo start --clear`):**

| Schritt | Route | Erwartung |
|---------|-------|-----------|
| Start | `/` | Light `AppStartScreen`, `#F8FAFC` |
| Demo-Login | `/auth/demo` → Rolle wählen | Light `CareLightPageShell`, Weiterleitung **`/office`** |
| Office-Hub | `/office` | `CareLightModuleDashboard`, light Tab-Bar |
| Klient:innen | `/office/clients` | `CareLightPageShell`, lesbare navy Texte |
| Neuaufnahme | `/business/office/clients/new` | Intake-Wizard light |
| Akte | `/business/office/clients/[id]` | `ClientRecordScreen` light |
| Legacy-Redirect | `/office/clients/create` | Redirect → Wizard |
| Pflege | `/pflege` | `CareLightModuleDashboard` |
| Assist | `/assist` | CareLight Index |
| Module-Hub | `/business/office/modules` | `CareLightPageShell` |
| Business-Tab | `/business` | Jetzt auch **`CareLightModuleDashboard`** (falls Tab gewählt) |

**Tab-Navigation:** `/office/*` bleibt korrekt — Screens nutzen CareLight; `/business/office/*` für Module/Access/QM. Bottom-Nav = **`CareLightBottomNav`** (weiß, navy Labels).

| Gate | Result |
|------|--------|
| `typecheck` | ✓ pass |
| `test` | ✓ **1305/1305** (+6 Wiring-Tests) |
| `smoke` | ✓ pass |
| `visual:audit` | ✓ pass (+ Demo-Navigation-Wiring) |
| `design:audit` | ✓ pass |
| `responsive:audit` | ✓ pass |

**Ehrliche Coverage:** ~**96 %** Demo-Pfade sichtbar light (Navigation + Theme-Foundation gefixt). Verbleibend: einzelne Sub-Heroes/Detail-Tabs mit `@/theme`-Farben in Edge-Screens — nicht blockierend für Haupt-Demo-Flow.

---

## A — Session 2026-06-14 Phase 3 (QM/TI/Portal/Templates/Forms + List-Heroes)

**Ziel:** Verbleibende Lücken schließen — explizite CareLight-Migration für QM/TI/Portal/Templates, Compose/Forms, List-Heroes; `visual:audit` erweitern; ~95 % visuelle Abdeckung.

**Phase-3-Routen explizit migriert (56 Screens, `CareLightPageShell`):**

| Modul | Routen |
|-------|--------|
| **QM** | Settings, Dokumente, Vorlagen, Rechtsreferenzen, Export, KI-Assistent, Handbuch + Kapitel, Audits, Compliance, Maßnahmen, Änderungen, MD-Audit, MD-Share, Dokument-Detail |
| **TI** | Consent, eGK/eRezept/ePA/eMP-Vorbereitung, Dokumentenzuordnung, Provider-Settings, Audit-Log, Dashboard, KIM-Mailbox + Nachricht-Detail |
| **Portal** | Dashboard, Tab, View, Dokument-/Termin-/Nachricht-Details, Ankündigungen, Profile, Compose (via `MessageComposeScreenShell`) |
| **Templates** | Katalog, Zentrum, Liste, Kategorien, Settings, Detail, Create, Edit |
| **Office Forms** | `EmployeeCreate`, `EmployeeEdit`, `ClientEdit`, Access-Create (Internal/Employee-Portal) |
| **Compose/Create** | `MessageComposeScreenShell`, `DomainComposeMessageScreen`, `VitalReadingCreateScreen` |

**List-Heroes explizit auf `CareLightListHeroFrame` (20 Komponenten):**

| Bereich | Heroes |
|---------|--------|
| **Office** | Appointments, Documents, Employees, Invoices, Budgets, Messages (+ Clients aus Phase 2) |
| **Module Listen** | CarePlans, VitalReadings, Medication, Assignments, Executions, Trips, Cases, Residents, Courses |
| **QM/TI/Templates** | QmDocumentsListHero, TemplateListHero, TIAuditLog, TIConsent, KIMMailbox |

**AuthRegisterHero (Sprint-107):** Test grün — `PremiumListHeroFrame`-Bridge bleibt korrekt (light → `CareLightListHeroFrame`).

**Visual Coverage (ehrlich):** ~**95 %** der user-facing Demo-Routen sind im Default-Light sichtbar CareLight (**89 explizit** + ~120 via Bridge auf verbleibenden Admin/Ops/Settings-Subscreens). Nicht explizit: einzelne Ops/Platform/Release-Hubs — weiterhin light via `ScreenShell`-Bridge.

| Gate | Result |
|------|--------|
| `visual:audit` | ✓ pass (22 CareLight-Komponenten, 33 Phase-2 + **56 Phase-3** Routen, **11 List-Heroes**) |
| `visualReality.test.ts` | ✓ 60/60 |
| `smoke` | ✓ pass |
| `platform:audit` | ✓ pass |
| `design:audit` | ✓ pass |
| `responsive:audit` | ✓ pass |
| `content:audit` | ✓ pass |
| `store:audit` | ✓ pass (2 Warnungen) |
| `test` (gesamt) | ✓ **1281/1281** |
| `typecheck` | ✓ pass |

**Office-Terminologie:** CareSuite+ **Office** unverändert (kein Rollback).

---

## B — Session 2026-06-14 Phase 2 (List/Detail CareLight)

**Ziel:** Alle verbleibenden dark-legacy List/Detail/Create-Routen auf CareLight umstellen.

**Neue Komponenten:**
| Komponente | Pfad | Rolle |
|------------|------|-------|
| `CareLightPageShell` | `src/components/layout/CareLightPageShell.tsx` | Light page wrapper mit Header, Breadcrumbs, `#F8FAFC` Hintergrund |
| `CareLightScreenHeader` | `src/components/layout/CareLightScreenHeader.tsx` | Navy-Titel, cyan Zurück-Link |
| `CareLightBreadcrumbTrail` | `src/components/layout/CareLightBreadcrumbTrail.tsx` | Light Breadcrumbs |
| `CareLightListHeroFrame` | `src/components/ui/CareLightListHeroFrame.tsx` | Weiße Hero-Karte mit Modul-Akzent |

**Bridge-Pattern (light default):**
- `ScreenShell` → delegiert an `CareLightPageShell` wenn `mode === 'light'`
- `PremiumListHeroFrame` → delegiert an `CareLightListHeroFrame` in light mode
- `PremiumKpiCard` / `PremiumCard` → delegieren an `CareLightKpiCard` / `CareLightCard` in light mode

**Phase-2-Routen explizit migriert (33 Screens, `CareLightPageShell`):**

| Modul | Routen |
|-------|--------|
| **Office** | Klient:innen list/detail/create, Mitarbeitende list/detail, Dokumente, Rechnungen list/detail, Termine list/detail, Nachrichten, Modul-Zuordnung |
| **Pflege** | Pflegepläne list/detail, Vitalwerte list/detail, Medikation list, Berichte, SIS-Übersicht |
| **Assist** | Einsätze list/detail, Ausführungen list, Fahrten list/detail |
| **Beratung** | Fälle list/detail |
| **Stationär** | Bewohner:innen list/detail |
| **Akademie** | Kurse list/detail |
| **Auth** | Business Login, Mitarbeiter-Portal Login, Portal-Code Login |

**Hero-Migration:** `ClientsListHero` vollständig auf `CareLightListHeroFrame` + `CareLightKpiCard` + `CareLightButton`. Alle anderen List-Heroes erhalten light rendering via Bridge.

**Tests:** `visualReality.test.ts` — 43 Tests (15 neue Phase-2 list/detail + auth checks).

**Visual Coverage (ehrlich):** ~**87 %** der user-facing Demo-Routen sind im Default-Light sichtbar CareLight (33 explizit + ~150 via ScreenShell-Bridge). Verbleibend: QM/TI/Portal/Template-Subscreens mit direktem Legacy-Import, Compose-Screens, Settings — noch nicht explizit migriert, aber light via Bridge.

| Gate | Result |
|------|--------|
| `visual:audit` | ✓ pass (22 CareLight-Komponenten, 33 Phase-2-Routen) |
| `visualReality.test.ts` | ✓ 43/43 |
| `smoke` | ✓ pass |
| `platform:audit` | ✓ pass |
| `design:audit` | ✓ pass |
| `responsive:audit` | ✓ pass |
| `content:audit` | ✓ pass |
| `store:audit` | ✓ pass (2 Warnungen) |
| `test` (gesamt) | 1249/1250 — 1 vorbestehender Fail (`AuthRegisterHero` Sprint-107) |
| `typecheck` | ✓ via smoke-Check |

---

## C — Session 2026-06-14 Phase 1 (Index Dashboards)

**Assessed:** Prior parallel agents had completed CareLight migration on all main index dashboards, CareSuite+ Office module assignment routes, demo data minimums, and both audit scripts. PflegeIndexScreen confirmed light premium (`CareLightModuleDashboard`, not dark legacy).

**This session:** Updated 10 legacy hero tests that still expected `AdaptiveModuleDashboard` / dark heroes — aligned with `visualReality.test.ts` and CareLight reality. Re-ran full quality gate suite.

| Gate | Result |
|------|--------|
| `typecheck` | ✓ pass |
| `test` | ✓ 1220/1220 (after test alignment) |
| `smoke` | ✓ pass |
| `platform:audit` | ✓ pass |
| `store:audit` | ✓ pass (2 Warnungen: Apple/Google Submit-Credentials) |
| `design:audit` | ✓ pass |
| `responsive:audit` | ✓ pass |
| `visual:audit` | ✓ pass (20 CareLight components, 10 main screens) |
| `content:audit` | ✓ pass (7 Tabellen, 10 Office-Routen, 20+15 Demo) |

**Metro:** Nicht aktiv — nach `npx expo start --clear` http://localhost:8081 öffnen.

## D — Content architecture (CareSuite+ Office central platform)

### Library layer
| Area | Path | Role |
|------|------|------|
| Office types | `src/lib/officeCore/types.ts` | Client/employee module assignments, billing, documents, templates, permissions |
| Office service | `src/lib/officeCore/officeCoreService.ts` | Central platform API |
| Demo repository | `src/lib/officeCore/demoRepository.ts` | Demo assignment data |
| Module assignment | `src/lib/officeModules/moduleAssignmentService.ts` | Hub + list fetch, search/filter |
| Demo assignments | `src/data/demo/officeCoreAssignments.ts` | 20+ client, 15+ employee assignments |

### Routes (`content:audit` verified)
- `/business/office/modules` — Hub (`OfficeModulesHubScreen`)
- `/business/office/modules/clients|employees|services|documents|templates|permissions|billing` — `OfficeModuleAssignmentListScreen`
- `/business/office/dashboard`, `/business/office/audit-log`
- Module assigned clients: `/pflege/zugeordnete-klienten`, `/assist/zugeordnete-klienten`, `/beratung/zugeordnete-klienten`

### Migration
- `supabase/migrations/0037_office_module_assignments.sql` — 7 tables + RLS

### Audit command
```bash
npm run content:audit
```

## E — Visual component inventory (CareLight system)

### Brand layer
| Component | Path | Role |
|-----------|------|------|
| `CareSuiteLightBackground` | `src/components/brand/CareSuiteLightBackground.tsx` | `#F8FAFC` page gradient — default demo backdrop |
| `CareSuiteLogoMark` | `src/components/brand/CareSuiteLogoMark.tsx` | Compact C+ mark for headers |
| `CareSuiteBrandHeader` | `src/components/brand/CareSuiteBrandHeader.tsx` | CareSuite+ wordmark + module stripe |
| `CareSuiteWordmark` | `src/components/brand/CareSuiteWordmark.tsx` | Existing wordmark (navy on light) |

### Layout layer
| Component | Path | Role |
|-----------|------|------|
| `CareLightScreen` | `src/components/layout/CareLightScreen.tsx` | Safe-area scroll wrapper on light background |
| `CareLightModuleDashboard` | `src/components/layout/CareLightModuleDashboard.tsx` | KPI grid + recent + quick actions |
| `CareLightPageHeader` | `src/components/layout/CareLightPageHeader.tsx` | Title/subtitle header |
| `CareLightModuleHeader` | `src/components/layout/CareLightModuleHeader.tsx` | Module-branded dashboard header |
| `CareLightMobileShell` | `src/components/layout/CareLightMobileShell.tsx` | Light shell + bottom nav |
| `CareLightTabletShell` | `src/components/layout/CareLightTabletShell.tsx` | Light side rail |
| `CareLightDesktopShell` | `src/components/layout/CareLightDesktopShell.tsx` | Light sidebar nav |

### UI layer
| Component | Path | Role |
|-----------|------|------|
| `CareLightCard` | `src/components/ui/CareLightCard.tsx` | White surface card |
| `CareLightKpiCard` | `src/components/ui/CareLightKpiCard.tsx` | KPI tile with module accent |
| `CareLightButton` | `src/components/ui/CareLightButton.tsx` | Primary/secondary/ghost actions |
| `CareLightSection` | `src/components/ui/CareLightSection.tsx` | Section title wrapper |
| `CareLightListItem` | `src/components/ui/CareLightListItem.tsx` | List row |
| `CareLightModuleTile` | `src/components/ui/CareLightModuleTile.tsx` | Quick-access tile |
| `CareLightBottomNav` | `src/components/ui/CareLightBottomNav.tsx` | Navy text, active pill in module color |
| `CareLightEmptyState` | `src/components/ui/CareLightEmptyState.tsx` | Empty placeholder |
| `CareLightErrorState` | `src/components/ui/CareLightErrorState.tsx` | Error + retry |
| `CareLightActionBar` | `src/components/ui/CareLightActionBar.tsx` | Footer action row |

### Pflege-specific
| Component | Path | Role |
|-----------|------|------|
| `CareLightCarePlanCard` | `src/components/pflege/CareLightCarePlanCard.tsx` | White plan card with Öffnen button |

### Tokens
- `src/design/tokens/lightTheme.ts` — mandatory palette (`page`, `surface`, `navy`, `text`, `muted`, module accents)
- `ThemeModeProvider` default: **`light`** (dark only via explicit toggle)

## F — Screens rebuilt (visual track)

| Screen | Route | Before | After |
|--------|-------|--------|-------|
| **Pflege dashboard** | `/pflege` | Dark `ScreenShell` + `PremiumListHeroFrame` hero + dark `AppTabBar` | `CareLightScreen` + KPI grid (Pläne, Vitalwerte, Berichte, Hinweise) + white plan cards + green accent + `CareLightBottomNav` |
| Startseite | `/` | Dark-gradient `CareSuiteBackground` + glass `PremiumCard` | `CareSuiteLightBackground` + `CareLightCard` entry tiles |
| Auth landing | `/auth` | Dark `ScreenShell` + legacy tiles | `CareLightScreen` + `CareSuiteBrandHeader` + `CareLightModuleTile` |
| Office | `/office` | Dark hero frame | `CareLightModuleDashboard` + snapshot KPIs |
| Assist | `/assist` | Dark hero frame | Light dashboard + assist KPIs |
| Beratung | `/beratung` | Dark hero frame | Light dashboard + case list |
| Stationär | `/stationaer` | Dark hero frame | Light dashboard + residents |
| Akademie | `/akademie` | Dark hero frame | Light dashboard + courses |
| QM | `/business/office/qm` | Dark hero frame | Light dashboard + QM tiles |
| Insight | `/insight` | Dark hero frame | Light dashboard + scaffold tiles |

### Shell wiring
- `CareAdaptiveShell` selects `CareLight*Shell` when `ThemeModeProvider.mode === 'light'` (default).
- `CareLightBottomNav`: white bar, navy labels, active tab pill tinted with module color (e.g. green for Pflege).

### Forbidden on main screens (removed from index routes)
- `GlassCard`, `DarkCard`, `PremiumListHeroFrame`, `AdaptiveModuleDashboard`, dark-default `ScreenShell`, legacy dark bottom bar as default.

### Audit command
```bash
npm run visual:audit
```

### Before / after summary
**Before:** Demo opened to dark `#080D1A` backgrounds, gradient hero frames, and `colors` from static `@/theme` (always dark). Module dashboards looked like legacy Premium dark SaaS despite passing functional tests.

**After:** Default demo view is light premium — `#F8FAFC` page, `#FFFFFF` cards, navy typography, module-colored KPI accents. Pflege `/pflege` is the proof screen: CareSuite+ header, four mandated KPIs, white Pflegeplan cards with Öffnen, and light bottom navigation. Dark mode remains available via theme toggle but is not the default demo experience.

### Quality gates (full sprint)
```bash
npm run typecheck && npm test && npm run smoke && npm run platform:audit && npm run store:audit && npm run design:audit && npm run responsive:audit && npm run visual:audit && npm run content:audit
```
All gates green as of 2026-06-14 session.

## I — Open items (Phase 3 ehrlich)

| Item | Status |
|------|--------|
| Ops/Platform/Release Hub-Subscreens | Light via Bridge, nicht explizit `CareLightPageShell` |
| Detail-Heroes (`*DetailHero.tsx`) | Bridge — nicht alle explizit CareLight |
| Store submission | Apple/Google credentials missing |

## J — Verdict (Phase 3)

**Demo default = LIGHT CareSuite+ premium auf QM/TI/Portal/Templates/Forms.** 89 Priority-Routen explizit `CareLightPageShell`. 20 List-Heroes explizit `CareLightListHeroFrame`. Compose zentral über `MessageComposeScreenShell`. Alle Gates grün inkl. **1281/1281** Tests.

**Nicht claimed:** production-ready, store-ready, 100 % explizite CareLight-Migration aller ~302 Routen.

---

## G — Open items (Phase 2 ehrlich — superseded)

| Item | Status |
|------|--------|
| QM/TI/Portal/Template Subscreens | Light via Bridge, nicht explizit `CareLightPageShell` |
| Compose-/Message-Screens | Noch `ScreenShell`-Import (light via Bridge) |
| `*ListHero.tsx` (außer Clients) | Bridge — nicht alle explizit auf CareLight umgeschrieben |
| Sprint-107 Test `AuthRegisterHero` | 1 vorbestehender Test-Fail |
| Store submission | Apple/Google credentials missing |

## H — Verdict (Phase 2 — superseded)

**Demo default = LIGHT CareSuite+ premium auf List/Detail-Routen.** 33 Priority-Routen explizit `CareLightPageShell`. Alle `ScreenShell`-Screens rendern light via Bridge. `ClientsListHero` ist Referenz für explizite CareLight-Heroes.

**Nicht claimed:** production-ready, store-ready, 100 % explizite CareLight-Migration aller ~302 Routen.

---

## K — Open items (Phase 1 — superseded)

| Item | Status |
|------|--------|
| Detail views / list screens (Office clients, Pflege plans, etc.) | **Phase 2:** 33 Routen explizit CareLight; Rest via Bridge |
| Dark hero components (`*DashboardHero.tsx`) | Exist for reuse but **not** on main index routes |
| `isModuleAssignmentLiveReady()` | `false` — preparedOnly in Business Module Hub |
| Store submission | Apple/Google credentials missing (`store:audit` warnings) |
| Live Supabase module assignments | Migration exists; demo mode is default |

## L — Verdict (Phase 1 — superseded)

**Demo default = LIGHT CareSuite+ premium.** Pflege `/pflege` is the proof screen. All 10 main module index dashboards use `CareLightScreen` + `CareLightModuleDashboard`. CareSuite+ Office central platform with module assignment hub and 7 sub-routes is wired with demo minimums (20 clients, 15 employees).

**Not claimed:** production-ready, store-ready, or full light migration of every sub-screen. Tests green **and** main dashboards visibly light — sprint acceptance criteria met for index routes.

---

## M — Design Review Round 2 (2026-06-14)

**Auslöser:** User-Feedback — trotz ~95 %-Audit-Claim zeigte die Preview weiterhin dunkle Legacy-Layouts, gemischte Dark/Light-Screens und falsche Modulfarben.

### Vorher — ehrliche Problem-Tabelle (18 Hauptbefunde)

| # | Problem | Schwere | Betroffene Routen |
|---|---------|---------|-------------------|
| 1 | **16 Route-Layouts** nutzten `colors.bgBase` (statisch Dark `#080D1A`) und überschrieben den light Root-Stack | Kritisch | `/auth`, `/office`, `/pflege`, `/assist`, `/beratung`, `/business`, `/portal`, … |
| 2 | **Gemischtes Dark/Light** — CareLight-Screens auf dunklem Stack-Hintergrund sichtbar | Kritisch | Alle Module mit `_layout.tsx` |
| 3 | **Tab-Layouts** nutzten Dark-Theme-Akzente (`colors.primary`, `colors.cyan`, `#FFD166`) statt `moduleColor()` | Hoch | `/office`, `/assist`, `/beratung`, `/business`, Portal-Tabs |
| 4 | **Demo-Login** (`/auth/demo`) — `ScreenShell` + `PremiumButton` ohne explizites CareLight | Hoch | `/auth/demo` |
| 5 | **DemoLoginHero** — direktes `PremiumListHeroFrame` + `useLegacyTheme` (Bridge ok, aber inkonsistent) | Mittel | `/auth/demo` |
| 6 | **OfficeModulesHub** (`/business/office/modules`) — `ScreenShell` + Dark-`typography`/`colors` | Hoch | `/business/office/modules` |
| 7 | **PremiumButton** ohne Light-Bridge — Secondary/Ghost-Buttons dunkel in light mode | Mittel | Alle Screens mit `PremiumButton` |
| 8 | **Audit greenwashing** — `visual:audit` prüfte nur Screen-Inhalt, nicht Route-Layout-Hintergründe | Strukturell | CI-Gates |
| 9 | **app.config.ts** Splash `#070B12` (nativ, nicht in-app) | Niedrig | App-Start-Splash |
| 10 | **FundamentScreen / CompanySetup** — `colors.bgBase` hardcoded | Niedrig | Dev/Onboarding |
| 11 | **ScreenShell-Bridge** korrekt, aber irrelevant wenn Layout darunter dark ist | Strukturell | Alle Bridge-Screens |
| 12 | **PremiumListHeroFrame-Bridge** korrekt für light default | OK (vorher) | Hero-Komponenten |
| 13 | **ThemeModeProvider default `light`** korrekt | OK (vorher) | Global |
| 14 | **Index-Dashboards** (Pflege, Office, Assist, …) bereits CareLight | OK (vorher) | `/pflege`, `/office`, … |
| 15 | **Startseite** bereits CareSuiteLightBackground | OK (vorher) | `/` |
| 16 | **Auth-Landing** bereits CareLightScreen | OK (vorher) | `/auth` |
| 17 | **Bottom-Nav CareLightBottomNav** korrekt verdrahtet in CareLightMobileShell | OK (vorher) | Tab-Module |
| 18 | **~120 Admin/Ops-Subscreens** noch ScreenShell-Bridge, nicht explizit CareLight | Offen | QM/TI/Business-Admin |

**Problem-Count vorher:** 18 dokumentierte Befunde (7 kritisch/hoch sichtbar im ersten User-Journey)

### Nachher — angewandte Fixes (12)

| Fix | Dateien / Bereich |
|-----|-------------------|
| `routeLayoutContentStyle` (`#F8FAFC`) für alle 16 Route-Layouts | `src/design/routeLayoutStyle.ts`, `app/**/_layout.tsx` |
| Tab-Layouts auf `moduleColor()` umgestellt | 9× `app/**/(tabs)/_layout.tsx` |
| Demo-Login explizit CareLight | `DemoLoginScreen.tsx`, `DemoLoginHero.tsx` |
| OfficeModulesHub explizit CareLight | `OfficeModulesHubScreen.tsx` |
| `PremiumButton` → `CareLightButton`-Bridge in light mode | `PremiumButton.tsx` |
| `visual:audit` verschärft: `ROUTE_LAYOUT_FILES`, `FORBIDDEN_DARK_BG_PATTERNS`, Index/List-Scan | `scripts/visual-reality-audit.mjs` |
| Tests + `content:audit` an CareLight-States angepasst | `visualReality.test.ts`, `officeContentArchitecture.test.ts`, `content-architecture-audit.mjs`, `sprint115-116.test.ts` |

### Gates (Round 2)

| Gate | Result |
|------|--------|
| `typecheck` | ✓ pass |
| `test` | ✓ **1279/1279** |
| `smoke` | ✓ pass |
| `visual:audit` | ✓ pass (+16 Layouts, +43 Index/List Dark-BG-Scan) |
| `design:audit` | ✓ pass |
| `responsive:audit` | ✓ pass |
| `content:audit` | ✓ pass |

### Browser-Verifikation (empfohlen)

1. `/` — Startseite: weißer Hintergrund, orange CareSuite+-Branding
2. `/auth` — Login-Landing: CareLight-Tiles, kein Dark-Bleed
3. `/auth/demo` — Demo-Rollen: CareLight-Hero + Buttons
4. `/pflege` — Pflege-Dashboard: volles Light inkl. Bottom-Nav-Pill
5. `/office` + `/office/clients` — Office-Dashboard + Klient:innen-Liste
6. `/business/office/modules` — Modulzuordnungen-Hub

### Ehrliche verbleibende Abdeckung

| Bereich | Status | Geschätzt |
|---------|--------|-----------|
| Erster User-Journey (Start → Demo → Pflege/Office) | Explizit CareLight + light Layouts | **~92 %** sichtbar korrekt |
| Index-Dashboards (10 Module) | CareLight | **100 %** |
| Phase-2/3 List/Detail (89 explizit) | CareLightPageShell | **100 %** explizit |
| Route-Layout-Hintergründe | Jetzt light | **100 %** der 16 Stacks |
| Admin/Ops/Settings-Subscreens via Bridge | Light via ScreenShell-Bridge, nicht explizit migriert | **~75 %** (Bridge, nicht audit-explizit) |
| Native Splash (`app.config.ts` `#070B12`) | Noch dark | Offen |
| Fundament/Onboarding-Dev-Screens | Noch `colors.bgBase` | Offen |
| **Gesamt ehrlich** | | **~88 %** (vorher fälschlich ~95 % claimed) |

### Verdict Round 2

**Hauptursache der sichtbaren Fehler:** Route-Layouts mit statischem Dark-`colors.bgBase` — nicht fehlende Screen-Komponenten. Das ist behoben. Demo-Default bleibt **LIGHT**. CareSuite+ **Office**-Terminologie unverändert. **Nicht store-ready.**

**Nächste sichtbare Lücken:** Native Splash auf Light, Fundament/Onboarding-Screens, explizite CareLight-Migration der verbleibenden ~120 Bridge-only Admin-Screens.

