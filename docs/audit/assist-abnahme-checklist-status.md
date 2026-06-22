# CareSuite+ Assist — Abnahme-Checklist-Status

**Datum:** 2026-06-20  
**Referenz:** `02_ABNAHME_CHECKLISTE_ASSIST.md` (Downloads-Paket)  
**Scope:** Abnahme-Stand nach Assist Phase 4.6 E2E Proof Portal Release  
**HEAD (Repo):** Phase-4.6-Commit · **B.1h:** applied · **B.1k:** applied · **0156:** applied · **0157:** applied · **0158:** applied (2026-06-20)

Legende: ✅ erfüllt · 🟡 teilweise / mit Lücken · ❌ offen · ⏸ nicht geprüft / Blocker dokumentiert

---

## A. Sicherheitsgrenzen

| # | Kriterium | Status | Nachweis |
|---|-----------|--------|----------|
| A1 | Migration 0154 nicht verändert | ✅ | `git diff` auf 0154 leer |
| A2 | Migration 0154 während Assist pausiert | ✅ | Assist-Zwischenauftrag eingehalten; **B.1h Apply** (2026-06-20) |
| A3 | Assist Phase 3.2: einmaliger `db push` nur 0156 | ✅ | `.audit-supabase-assist-phase32-apply.log` |
| A4 | Kein Deploy außer 0156 Apply | ✅ | Kein Netlify `[deploy]` in diesem Lauf |
| A5 | Keine Permission-Dateien geändert | ✅ | `src/lib/permissions/` diff leer |
| A6 | `staticRolePermissions.ts` unverändert | ✅ | Kein WT-Diff |
| A7 | Keine RLS-Änderungen | ✅ | — |
| A8 | Kein B.2 | ✅ | — |
| A9 | Kein ProductAccess-Fix | ✅ | — |
| A10 | Kein `assignmentWorkflowService`-Umbau | ✅ | Nicht angefasst |
| A11 | Kein `git add .` | ✅ | Phase 2.2: 82 Pfade einzeln gestaged |
| A12 | Kein Push ohne Freigabe | ✅ | Phase 2.3: `32d30d8` → `origin/main` |

**A — Gesamt:** ✅ **12/12**

---

## B. Assist-Navigation

| # | Kriterium | Status | Nachweis |
|---|-----------|--------|----------|
| B1 | Dashboard | ✅ | `/assist`, `AssistIndexScreen` |
| B2 | Einsätze | ✅ | `/assist/assignments`, `/assist/einsaetze` |
| B3 | Durchführung | ✅ | `/assist/durchfuehrung` |
| B4 | Nachweise | ✅ | `/assist/nachweise` |
| B5 | Aufgaben | ✅ | `/assist/aufgaben` |
| B6 | Fahrten | ✅ | `/assist/fahrten` |
| B7 | Touren | ✅ | `/assist/touren` — eigene `AssistTourenScreen`, kein Redirect zu Fahrten (System-Navigation 2026-06-20) |
| B8 | Kalender | 🟡 | `/assist/calendar` + `/assist/kalender`; zentrale Kalender-Integration über 0117/0118 — Sync-Lücken möglich |
| B9 | Live-Status | ✅ | `/assist/live-status` |
| B10 | Qualität | ✅ | `/assist/qualitaet` |
| B11 | Zugeordnete Klient:innen | ✅ | `/assist/zugeordnete-klienten` → `ModuleAssignedClientsScreen` |
| B12 | Einstellungen | ✅ | `/assist/einstellungen` → `AssistSettingsScreen`; Web/Desktop optional Modal `assist.settings` |

Nav-Konfiguration: `src/lib/navigation/modulenav/assistnav.ts` deckt alle Bereiche ab.

**R.1 (2026-06-22):** Assist nutzt unter 1024px `CompactPlatformShell` / `MobileAppShell` (AppBar + Bottom Nav + Drawer). Desktop Assist-Shell unverändert.

**B — Gesamt:** ✅ **11/12**, 🟡 **1/12**

---

## C. Office-Integration

| # | Kriterium | Status | Nachweis |
|---|-----------|--------|----------|
| C1 | Office-Klient:innen | ✅ | `fetchClientList`, `visitRepository` → `clients` |
| C2 | Office-Mitarbeitende | ✅ | `fetchAssignmentEmployeeList` |
| C3 | Keine doppelte Stammdatenanlage | ✅ | Wizard nutzt Office-Listen |
| C4 | Fehlende Office-Daten sichtbar | 🟡 | Wizard teilweise; Pflegegrad/Kostenträger/Vertrag nicht überall |
| C5 | Link Office-Akte | 🟡 | `ModuleAssignedClientsScreen` → `clientRecordRoute`; nicht überall |
| C6 | Assist-Freigabe/Status | 🟡 | `moduleAssignmentService`; Detailprüfungen unvollständig |
| C7 | Pflegegrad/Kostenträger/Vertrag | 🟡 | Nicht in allen Assist-Listen sichtbar |

**C — Gesamt:** ✅ **3/7**, 🟡 **4/7**

---

## D. Einsätze

| # | Kriterium | Status | Nachweis |
|---|-----------|--------|----------|
| D1 | Einsatzliste | ✅ | `AssignmentsListView`, `EinsaetzeListScreen` |
| D2 | Filter | ✅ | List view filters |
| D3 | Neuer-Einsatz-Modal | ✅ | `AssignmentCreateWizard` (Glass-Modal) |
| D4 | Klient:in aus Office | ✅ | Wizard Schritt 1 |
| D5 | Mitarbeitende aus Office | ✅ | Wizard Schritt 4 |
| D6 | Leistungsart | ✅ | Service catalog step |
| D7 | Datum/Zeit | ✅ | Wizard |
| D8 | Aufgaben | 🟡 | Tasks in wizard; Paket-Katalog abhängig von DB |
| D9 | Persistenz oder sauberer Block | 🟡 | `createVisitFromWizard` → `assist_visits` (Supabase); Demo-In-Memory fallback |
| D10 | Keine fachkritischen In-Memory-only | 🟡 | Demo-Modus nutzt Demo-Daten; Live nutzt 0116 |

**D — Gesamt:** ✅ **7/10**, 🟡 **3/10**

---

## E. Durchführung

| # | Kriterium | Status | Nachweis |
|---|-----------|--------|----------|
| E1–E7 | Status-Buttons / Aufgaben / Doku / Beenden | 🟡 | `VisitExecutionScreen`, `visitExecutionService`, `VisitTasksPanel`; A→H-Flow Phase 2; `assignments/[id]/execute` |
| E8 | Nicht angetroffen | 🟡 | Status `no_show` / Events vorhanden; dedizierter UI-Workflow unvollständig |
| E9 | Persistenz Statuslog | 🟡 | `assist_visit_status_history` (0116); Demo-Pfade prüfen |

**E — Gesamt:** 🟡 **~6/9** — operativer Kernablauf nutzbar; Nicht-angetroffen offen

---

## F. Signatur

| # | Kriterium | Status | Nachweis |
|---|-----------|--------|----------|
| F1 | Signaturfeld / Blocker | 🟡 | `VisitSignatureSection` + `CareSignatureModal` in Durchführung; Session-Store |
| F2–F4 | Touch/Maus, leer blockiert, Klarname/Rolle | 🟡 | Phase 2 UI erfüllt; DB-Persistenz fehlt |
| F5–F7 | Payload-Hash, Signatur-Hash, Invalidierung | 🟡 | **0156** wired — `saveVisitSignaturePersistent` (Storage + DB); aktiv wenn `assist_visits` aufgelöst |

**F — Gesamt:** 🟡 **4/7**, 🟡 **3/7** (Persistenz wired Phase 4; Session-Fallback Demo)

---

## G. Leistungsnachweis

| # | Kriterium | Status | Nachweis |
|---|-----------|--------|----------|
| G1–G13 | Vorschau, Snapshots, Freigabe, PDF, Abrechnung | 🟡 | Preview + persist; **Phase 4.5/4.6:** Prüfung/Freigabe/PDF/Portal-Release + E2E smoke (`assistProofToPortalFlow.test.ts`); Abrechnung offen |

**G — Gesamt:** 🟡 **~10/13** — Approval + PDF + Portal-Release Phase 4.5; Abrechnung offen

---

## H. Live-Status / Karte

| # | Kriterium | Status | Nachweis |
|---|-----------|--------|----------|
| H1 | Live-Status UI | ✅ | `AssistLiveStatusScreen`, `assistLiveTrackingViewService` |
| H2 | Tracking nur MA-Portal | ✅ | `EmployeePortalVisitExecutionScreen`; Assist read-only Banner |
| H3 | Consent vor GPS | ✅ | `EmployeePortalLocationConsentBanner` |
| H4 | Live-Timer (Fahrt/Einsatz/Pause) | 🟡 | DB `assist_time_events` + In-Memory; Assist live-status liest beides |
| H5 | Geofence weich | 🟡 | `geofenceSoftCheck` + `recordGeofenceEvent` bei Ankunft (MA-Portal) |
| H6 | Karte / Backend-Streaming | 🟡 | `appendLocationPoint` + read-only latest point in Assist; volle Karte offen |

**H — Gesamt:** ✅ **3/6**, 🟡 **3/6** (GPS-Nachtrag 2026-06-20)

---

## J. Portale

| # | Kriterium | Status | Nachweis |
|---|-----------|--------|----------|
| J1 | Mitarbeiterportal Durchführung | ✅ | `/portal/employee/assignments/[id]/execute` |
| J2 | Klientenportal Tracking-Sicht | 🟡 | `restrictedLiveStatus` + **released visit proofs** via `portalAssistVisitProofService` (ohne GPS/interne Notizen/Fahrtenbuch) — E2E smoke Phase 4.6 |
| J3–J5 | Nachrichten, Terminwunsch | 🟡 | `src/lib/portal/assist/*`, portal-preview routes |

**J — Gesamt:** ✅ **1/5**, 🟡 **4/5**

---

## I. Fahrtenbuch

| # | Kriterium | Status | Nachweis |
|---|-----------|--------|----------|
| I1–I7 | Start/Ende, km, Korrektur, Tour, Monat | 🟡 | `TripsListScreen`, Migration 0114; Monatsübersicht / Korrektur-Grund teilweise |

**I — Gesamt:** 🟡 **teilweise**

---

## K. Design

| # | Kriterium | Status | Nachweis |
|---|-----------|--------|----------|
| K1–K3 | Kein Weiß, Aurora, Glass | ✅ | Dashboard auf `ScreenShell` + `AssistDashboardHero` (Zwischenauftrag) |
| K4 | Modals einheitlich | 🟡 | Wizard = Glass; übrige Screens gemischt |
| K5–K6 | Kalender/Nachrichten einheitlich | 🟡 | Nicht Assist-isoliert repariert (Scope) |
| K7 | Shell-konform | ✅ | `_layout.tsx` + Dashboard Shell |

**K — Gesamt:** ✅ **Dashboard/Shell**, 🟡 Modals/Kalender

---

## L. Berichte (Zwischenauftrag + Phase 2 + 2.1)

| # | Kriterium | Status |
|---|-----------|--------|
| L1 | `assist-controlled-build-plan.md` | ✅ |
| L2 | `assist-schema-gap-report.md` | ✅ (+ Phase-2/GPS-Anhang) |
| L3 | `assist-controlled-build-abschlussbericht.md` | ✅ |
| L4 | `assist-phase2-durchfuehrung-nachweis-abschlussbericht.md` | ✅ |
| L5 | `assist-phase21-commit-readiness-abschlussbericht.md` | ✅ |
| L6 | `assist-phase22-selective-commit-abschlussbericht.md` | 🟡 erstellt, noch nicht committed |
| L7 | Assist-Commit `32d30d8` (82 Dateien) | ✅ gepusht · `main` = `origin/main` |
| L8 | `assist-phase23-push-abschlussbericht.md` | 🟡 erstellt, uncommitted |
| L9 | `assist-phase3-persistence-schema-abschlussbericht.md` | ✅ Phase 3 Schema + 3.1/3.2 Abschlussberichte |
| L10 | Migration 0156 im Repo | ✅ remote applied (Phase 3.2) |
| L11 | `assist-phase4-persistence-wiring-abschlussbericht.md` | 🟡 erstellt, uncommitted |
| L12 | Migration 0157 Storage policies | ✅ remote applied |
| L13 | Migration 0158 portal release | ✅ remote applied |
| L14 | `assist-phase45-proof-pdf-portal-release-abschlussbericht.md` | ✅ committed Phase 4.6 |
| L15 | Remote types nach 0158 (`fetch-remote-types`) | ✅ Phase 4.6 |
| L16 | `assist-phase46-e2e-proof-portal-abnahmebericht.md` | ✅ Phase 4.6 |
| L17 | E2E smoke `assistProofToPortalFlow.test.ts` | ✅ 10/10 |

**L — Gesamt:** ✅ Phase 4.5/4.6 committed

---

## Zusammenfassung

| Bereich | Erfüllung |
|---------|-----------|
| **A Sicherheitsgrenzen** | ✅ 100 % |
| **B Navigation** | ✅ ~92 % |
| **C Office-Integration** | 🟡 ~43 % voll |
| **D Einsätze** | 🟡 ~70 % |
| **E–J Fachtiefe** | 🟡 E/F/G verbessert; **0156 vorbereitet** — Apply erledigt (Phase 3.2) |
| **K Design** | ✅ Dashboard; 🟡 Kalender/Nachrichten |
| **L Berichte** | ✅ Phase 1–2.1 inkl. Commit-Readiness |

### Top-Abnahme-Blocker (verbleibend)

1. **F/G Abrechnung:** Billing-Release aus freigegebenen Proofs (`billing_released`) — Folge-Phase
2. **E8/I:** Nicht-angetroffen-Workflow, Touren-/Monats-Fahrtenbuch
3. **C:** Office-Snapshots in Assist-Listen ausbauen

### Nicht verletzt

- B.1h/B.1k applied · 0154–0158 / Permissions unverändert in Phase 4.5/4.6

### Nächster Schritt

1. Live-E2E (manuell): Einsatz abschließen → Nachweis-Prüfung → PDF → Klientenportal
2. Billing-Release aus freigegebenen Proofs (`billing_released`) — Folge-Phase
3. Klient:innen Core — bewusst **nicht** gestartet
