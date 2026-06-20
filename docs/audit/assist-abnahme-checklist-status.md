# CareSuite+ Assist — Abnahme-Checklist-Status

**Datum:** 2026-06-20  
**Referenz:** `02_ABNAHME_CHECKLISTE_ASSIST.md` (Downloads-Paket)  
**Scope:** Read-only Abnahme gegen aktuellen Repo-Stand während Zwischenauftrag (ohne DB-Deploy)  
**HEAD:** `ad0474b4b34bb0720a513bbbea2c6ecf9a0832b2` · **B.1h:** pausiert

Legende: ✅ erfüllt · 🟡 teilweise / mit Lücken · ❌ offen · ⏸ nicht geprüft / Blocker dokumentiert

---

## A. Sicherheitsgrenzen

| # | Kriterium | Status | Nachweis |
|---|-----------|--------|----------|
| A1 | Migration 0154 nicht verändert | ✅ | `git diff` auf 0154 leer |
| A2 | Migration 0154 nicht angewendet | ✅ | B.1h gestoppt; nur 0154 remote pending |
| A3 | Kein `supabase db push` | ✅ | Kein Deploy in Assist-Zwischenauftrag |
| A4 | Kein Supabase Remote Deploy | ✅ | — |
| A5 | Keine Permission-Dateien geändert | ✅ | `src/lib/permissions/` diff leer |
| A6 | `staticRolePermissions.ts` unverändert | ✅ | Kein WT-Diff |
| A7 | Keine RLS-Änderungen | ✅ | — |
| A8 | Kein B.2 | ✅ | — |
| A9 | Kein ProductAccess-Fix | ✅ | — |
| A10 | Kein `assignmentWorkflowService`-Umbau | ✅ | Nicht angefasst |
| A11 | Kein `git add .` | ✅ | — |
| A12 | Kein Commit ohne Freigabe | ✅ | Assist-Arbeit uncommitted |

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
| B7 | Touren | ✅ | `/assist/touren` |
| B8 | Kalender | 🟡 | `/assist/calendar` + `/assist/kalender`; zentrale Kalender-Integration über 0117/0118 — Sync-Lücken möglich |
| B9 | Live-Status | ✅ | `/assist/live-status` |
| B10 | Qualität | ✅ | `/assist/qualitaet` |
| B11 | Zugeordnete Klient:innen | ✅ | `/assist/zugeordnete-klienten` → `ModuleAssignedClientsScreen` |
| B12 | Einstellungen | ✅ | `/assist/einstellungen` |

Nav-Konfiguration: `src/lib/navigation/modulenav/assistnav.ts` deckt alle Bereiche ab.

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
| F5–F7 | Payload-Hash, Signatur-Hash, Invalidierung | ❌ | Schema-Gap P0 — keine `assist_visit_signatures` (0116) |

**F — Gesamt:** 🟡 **4/7**, ❌ **3/7** (Hash/Persistenz)

---

## G. Leistungsnachweis

| # | Kriterium | Status | Nachweis |
|---|-----------|--------|----------|
| G1–G13 | Vorschau, Snapshots, Freigabe, PDF, Abrechnung | 🟡 | `VisitProofPreviewPanel`, `visitProofPreviewService`; Preview nutzbar; PDF/Ablage/Abrechnung Schema-Gap |

**G — Gesamt:** 🟡 **~5/13** — Preview Phase 2; Persistenz/PDF offen

---

## H. Live-Status / Karte

| # | Kriterium | Status | Nachweis |
|---|-----------|--------|----------|
| H1 | Live-Status UI | ✅ | `AssistLiveStatusScreen`, `assistLiveTrackingViewService` |
| H2 | Tracking nur MA-Portal | ✅ | `EmployeePortalVisitExecutionScreen`; Assist read-only Banner |
| H3 | Consent vor GPS | ✅ | `EmployeePortalLocationConsentBanner` |
| H4 | Live-Timer (Fahrt/Einsatz/Pause) | 🟡 | Session-Rekonstruktion; DB `assist_time_events` fehlt |
| H5 | Geofence weich | 🟡 | `geofenceSoftCheck.ts`; Ziel-Lat/Lng fehlt |
| H6 | Karte / Backend-Streaming | 🟡 | Text-Position; `isGpsTrackingLiveReady()` false; `assist_tracking_points` fehlt |

**H — Gesamt:** ✅ **3/6**, 🟡 **3/6** (GPS-Nachtrag 2026-06-20)

---

## J. Portale

| # | Kriterium | Status | Nachweis |
|---|-----------|--------|----------|
| J1 | Mitarbeiterportal Durchführung | ✅ | `/portal/employee/assignments/[id]/execute` |
| J2 | Klientenportal Tracking-Sicht | 🟡 | Gap dokumentiert; `clientPortalVisible: false` |
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
| L6 | B.1h-Rückkehr / Commit-Freigabe | 🟡 81 Pfade commitfähig, WT kontaminiert |

**L — Gesamt:** ✅ **5 Pflichtberichte** · Commit-Readiness dokumentiert

---

## Zusammenfassung

| Bereich | Erfüllung |
|---------|-----------|
| **A Sicherheitsgrenzen** | ✅ 100 % |
| **B Navigation** | ✅ ~92 % |
| **C Office-Integration** | 🟡 ~43 % voll |
| **D Einsätze** | 🟡 ~70 % |
| **E–J Fachtiefe** | 🟡 E/F/G verbessert (Phase 2); P0-Persistenz offen |
| **K Design** | ✅ Dashboard; 🟡 Kalender/Nachrichten |
| **L Berichte** | ✅ Phase 1–2.1 inkl. Commit-Readiness |

### Top-Abnahme-Blocker (verbleibend)

1. **F/G P0:** DB-Persistenz Signatur/Nachweis (`assist_visit_signatures`, `assist_visit_proofs`) — UI/Session/Preview vorhanden
2. **E8/I:** Nicht-angetroffen-Workflow, Touren-/Monats-Fahrtenbuch — Folge-Migration
3. **C:** Office-Snapshots (Pflegegrad/Kostenträger/Vertrag) in Assist-Listen ausbauen

### Nicht verletzt

- B.1h / Migration 0154 / Permissions / RLS / Commit / Push

### Nächster Schritt

1. **Assist Phase 2.2** — selektiver Commit der 81 Scope-Pfade (Freigabe; kein `git add .`)
2. Assist Phase 3 — Schema-Gaps Signatur/Nachweis/Tracking (Freigabe)
3. B.1h — Migration 0154 anwenden (Freigabe)
