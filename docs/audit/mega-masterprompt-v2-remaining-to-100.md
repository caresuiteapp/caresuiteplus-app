# MEGA Masterprompt v2 — Remaining Blockers to True 100%

**Stand:** 2026-06-14 (Sprint 116)  
**Aktueller UI/demo spec:** ~97–99%  
**Gesamt vs. 5M-Zeichen-Spec:** ~91–95%  
**Verdict:** Hochwertiger Demo-Prototyp — **NOT production/store ready**

---

## Warum nicht 100%?

Die verbleibenden Punkte sind **keine kosmetischen Lücken**, sondern strukturelle Blocker:

1. **Live Supabase Backend** (~70%) — Migrationen 0021–0036 nicht remote angewendet
2. **Store/EAS** (~48%) — kein Preview-Build, Platzhalter-Credentials
3. **Pflege Dashboards** — parallel design agent (Listen/Details/Forms Sprint 114 ✅)
4. **5M-Zeichen-Spec Tiefe** — viele Work Packages nur als Scaffold/Blueprint

---

## P0 — Blockiert Produktion (Dokumentation)

### Remote-Migrationen 0021–0036

| Migration | Modul / Zweck | Live-Flip nach Apply |
|-----------|---------------|----------------------|
| `0021`–`0022` | Fahrten Listen/Details | `isTripsLiveReady()` |
| `0023`–`0024` | Assist Nachweise | `isCareRecordsLiveReady()` |
| `0025`–`0026` | Office Kataloge | `isCatalogsLiveReady()` |
| `0027`–`0029` | Business Reporting / PDL | `isReportsListLiveReady()`, `isPdlCockpitLiveReady()` |
| `0030` | Assist Tracking Dashboard | Assist Live KPIs |
| `0031`–`0032` | DSGVO Betroffenenanfragen | Admin-Status-Update RLS |
| `0033` | Office Mitarbeiter HR-Detail | Employee Vollprofil Backfill |
| `0034` | GPS Trip Events | `isGpsTrackingLiveReady()` |
| `0035` | InsightCenter Tabellen | `isInsightLiveReady()` — **Code-Prep Sprint 116 ✅, Flip bleibt false** |
| `0036` | Stationär/Akademie Extensions | `isStationaerExtensionLiveReady()`, `isAkademieExtensionLiveReady()` |

**Apply (manuell, kein Auto-Remote):** `npm run apply:live-migrations` oder Supabase Dashboard SQL-Editor.  
**Seed:** Live-Pilot-Seed nach 0021–0033 für 3 ambulante Mandanten.

### EAS Preview Build

| Schritt | Status | Anmerkung |
|---------|--------|-----------|
| `eas whoami` / `EXPO_TOKEN` | ❌ Nicht eingeloggt | Credentials erforderlich |
| `eas project:init` | ❌ Offen | Projekt-ID in `app.config` |
| Preview Build (Android/iOS) | ❌ Offen | Siehe `docs/audit/eas-first-preview-build-report.md` |
| `npm run store:audit` | ✅ PASS | 3 erwartete Warnungen (EAS-ID, Apple/Google Creds) |

### Edge Functions + Resend (DSGVO Admin-Mail)

| Artefakt | Status |
|----------|--------|
| `notify-data-subject-request-admin` Edge Function | Code ✅, Deploy ❌ |
| `RESEND_API_KEY` Secret | ❌ Nicht gesetzt |
| `send_failed` bei Resend-Fehler | ✅ Sprint 77 Hardening |

**Deploy (manuell):** `supabase functions deploy notify-data-subject-request-admin` + Secrets im Dashboard.

### is*LiveReady() Flips

15+ Module haben `preparedOnly`-Repos und ehrliche `false`-Gates. Flip erst nach Remote-Migration + Seed + QA — **kein Code-Flip ohne Backend**.

---

## P0 — Blockiert Produktion (Kurz)

| Blocker | Warum | Geschätzter Impact |
|---------|-------|-------------------|
| Remote-Migrationen 0021–0036 | Live-Listen/Details, DSGVO, GPS, Insight, Extensions | ~8% Gesamt-Spec |
| EAS Preview Build | Kein geräteseitiger Nachweis | Store-Readiness |
| Edge Functions deploy + Secrets | DSGVO Admin-Mail, TI-Proxy | Compliance |
| `is*LiveReady()` Flips | 15+ Module noch `preparedOnly` | ~5% UI-Vertrauen |

---

## P1 — UI-Spec Lücken (~1–2%)

### Noch ohne Premium Hero (Nicht-Pflege)

| Screen/Route | Priorität | Anmerkung |
|--------------|-----------|-----------|
| ~~`PilotReadinessScreen`~~ | ~~P3~~ | ✅ Sprint 115 — `PilotReadinessHero` |
| `FundamentScreen` / `AppStartScreen` | P3 | Public entry — bewusst minimal / parallel agent |
| ~~`DemoLoginScreen` / `DemoModeHintScreen`~~ | ~~P3~~ | ✅ Sprint 115 — `DemoLoginHero`, `DemoModeHintHero` |
| ~~`WorkflowBuilderScreen`~~ | ~~P2~~ | ✅ Sprint 112 |
| ~~`EmployeeFirstLoginPasswordScreen`~~ | ~~P2~~ | ✅ Sprint 112 |
| ~~Create/Edit Screens (Client, Employee, Catalog)~~ | ~~P2~~ | ✅ Sprint 113 |
| ~~Pflege CarePlan Create~~ | ~~P2~~ | ✅ Sprint 114 |

### Cross-Cutting List States — Sprint 109–114 ✅

| Bereich | Status | Gap |
|---------|--------|-----|
| Insight Snapshots/Exports Listen | ✅ Sprint 109 | — |
| Catalog List/Detail | ✅ Sprint 110 | Live nach 0025–0026 |
| Outbox List | ✅ Sprint 110 | Hero + preparedOnly |
| TI Vorbereitung (eGK, ePA, eMP, eRezept) | ✅ Sprint 110 | preparedOnly Scaffold |
| Communication Archived | ✅ Sprint 111 | Hero |
| Stationär/Akademie Extension Live Wiring | ✅ Sprint 111 | `is*ExtensionLiveReady()` false |
| Workflow Builder | ✅ Sprint 112 | Route + Hero |
| Employee First Login | ✅ Sprint 112 | Hero |
| Office Create/Edit Forms | ✅ Sprint 113 | FormScreenHero |
| Pflege CarePlan Create | ✅ Sprint 114 | FormScreenHero |

### APP_ROUTES

| Gap | Anmerkung |
|-----|-----------|
| Dynamische `[id]`-Pfade | Prefix-Matching via `getRouteByPath` — OK für Guards |
| `/business/ti/providers` etc. | TI-Subrouten nicht alle explizit |
| Module Settings-Routen | z. B. `/akademie/settings` — implizit via Modul |
| ~~Office Catalogs + Workflow~~ | ✅ Sprint 112–114 |

---

## P2 — Backend & Store (~15–20% Gesamt-Spec)

| Blocker | Details |
|---------|---------|
| Live Supabase Production | Trips, Stationär, Akademie, Reporting, QM, DSGVO, GPS, Insight, Extensions 0036 |
| Stripe/Billing Live | `SubscriptionScreen` Demo-only |
| TI-Gateway | Kein produktives KIM/ePA |
| GPS Streaming | Migration 0034 + Backend |
| Push Notifications | Nicht implementiert |
| Offline/Sync | Nicht implementiert |
| App Store Assets | Platzhalter-Icons teilweise |
| Apple/Google Credentials | Platzhalter in eas.json |

---

## P3 — Spec-Tiefe (5M-Zeichen)

| Bereich | ~% | Warum nicht 100% |
|---------|-----|------------------|
| CareSuite+ Office | ~97% | Live HR-Backfill nach 0033 |
| Assist/Beratung/Portale | ~99% | GPS Live, einige Extension-Randfälle |
| Stationär/Akademie | ~92% | Extension Repo wired; Live-Flip nach 0036 remote |
| Business/QM/TI | ~97% | TI Live, Integrations Outbox Live |
| Design System | ~89% | Canvas-Komponenten, Animation Polish — parallel agent |
| Pflege | ~96–100% | Dashboards parallel agent; Listen/Details/Forms ✅ |
| InsightCenter | ~90% | Live Wiring Prep Sprint 116 ✅; Flip nach 0035 remote |
| Kommunikation | ~94% | Live-Thread-Sync |
| Store/EAS | ~48% | Siehe P0 |

---

## Empfohlene Reihenfolge (post-Sprint 116)

1. Remote-Migrationen anwenden + Live-Pilot-Seed
2. EAS `project:init` + erster Preview Build
3. `is*LiveReady()` Flips Modul für Modul
4. Store-Assets + Submit-Credentials
5. Fundament/AppStart Hero (parallel design agent — nicht blockierend)

---

## Ehrliche Gesamtformel

```
UI/demo spec     ≈ 97–99%  (Premium Pattern nahezu vollständig; Demo-Entry ✅ Sprint 115)
Backend live     ≈ 72%     (Code + Extension Repos, DB nicht applied)
Store readiness  ≈ 48%     (Audit PASS, kein Build)
5M Spec depth    ≈ 91–95%  (Scaffold + Blueprint, Insight Flip-Checklist Sprint 116)
```

**CareSuite+ ist ein sensationaler Demo-Prototyp — kein Store-Release-Kandidat.**
