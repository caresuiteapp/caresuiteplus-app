# Assist kontrollierter Einbau — Arbeitsplan (Phase 1)

**Datum:** 2026-06-20  
**Branch:** `main`  
**HEAD (Baseline):** `ad0474b4b34bb0720a513bbbea2c6ecf9a0832b2` (soll = `origin/main`)  
**Migration 0154:** unverändert, nicht angewendet  
**B.1h:** nicht fortgesetzt  

## Baseline-Prüfung

| Prüfpunkt | Status |
|-----------|--------|
| Branch `main` | erwartet |
| HEAD `ad0474b` | erwartet |
| Staged files | keine (Pflicht) |
| `0154_sync_b1_permission_keys.sql` unverändert | ja |
| `src/lib/permissions/` unverändert | ja (Tabu) |
| B.1-P0-Guard-Dateien unverändert | ja (Tabu) |

---

## 1. Gefundene Assist-Routen

| Route | Screen / Datei | Nav-Gruppe |
|-------|----------------|------------|
| `/assist` | `AssistIndexScreen` | Übersicht |
| `/assist/(tabs)/index` | Tab-Dashboard | Übersicht |
| `/assist/assignments` | `AssignmentsListScreen` | Einsätze |
| `/assist/einsaetze` | `EinsaetzeListScreen` | Einsätze |
| `/assist/einsaetze/new`, `[id]`, `[id]/edit` | Assignment CRUD | Einsätze |
| `/assist/durchfuehrung` | `ExecutionsListScreen` | Durchführung |
| `/assist/durchfuehrung/[id]` | `AssignmentExecutionScreen` | Durchführung |
| `/assist/nachweise` | `LeistungsnachweiseListScreen` | Nachweise |
| `/assist/nachweise/[id]` | Nachweis-Detail | Nachweise |
| `/assist/aufgaben` | Aufgaben | Einsätze |
| `/assist/fahrten` | `TripsListScreen` | Mobilität |
| `/assist/touren` | Touren | Mobilität |
| `/assist/touren-vertretung` | `ToursReplacementScreen` | Mobilität |
| `/assist/calendar`, `/assist/kalender` | Kalender | Mobilität |
| `/assist/live-status` | Live-Status | Mobilität |
| `/assist/qualitaet` | Qualität | Qualität |
| `/assist/zugeordnete-klienten` | Office-Klient:innen | Qualität |
| `/assist/einstellungen` | Einstellungen | Qualität |
| `/assist/signaturen` | Signaturen | Nachweise |
| `/assist/abrechnungsquellen` | Abrechnungsquellen | Einstellungen |
| `/assist/portal-preview` | Portal-Vorschau | Portale |

Nav-Konfiguration: `src/lib/navigation/modulenav/assistnav.ts` (vollständig).

---

## 2. Gefundene Assist-Komponenten

**Layout / Listen:** `AssistDashboardHero`, `AssignmentsListView`, `AssignmentsListHero`, `ExecutionsListView`, `TripsListView`, `TrackingListView`, `CareRecordsListView`, `AssignmentListCard`, `AssignmentCreateWizard`, `AssignmentDetailGlassModal`, `VisitDispositionBadge`.

**Neu in diesem Auftrag:** `AssistDataSourceBanner`.

**Portal:** `src/components/portal/assist/*` (Overview, KPI, Modals).

---

## 3. Gefundene Office-Datenservices

- Klient:innen: `src/lib/clients/*`, Office-Listen
- Mitarbeitende: `src/lib/office/employee*`
- Termine/Kalender: `src/lib/calendar/calendarSyncService.ts`
- Dokumente: `src/lib/documents/*`
- Mandant: `guardServiceTenant`, `useServiceTenantId`

Assist referenziert Office-Stammdaten über `client_id` / `employee_id` in Repositories, nicht eigene Stammdatenwelten.

---

## 4. Mitarbeiter:innen-Portal-Strukturen

- `app/employee-portal/*` mit Assist-Ausführung
- `src/components/portal/assist/*`
- Migration `0102_portal_assist_workflows.sql`
- Execution-Screens: `AssignmentExecutionScreen`, Statusbuttons über `visitWorkflow`

---

## 5. Klient:innen-/Angehörigen-Portal-Strukturen

- Adaptive Portal Engine (`0099_adaptive_portal_engine.sql`)
- `portalActivityService`, Portal-Freigabe über `portal_status` / `portal_release_enabled` in `assist_visits`
- Route `/assist/portal-preview`

---

## 6. Gefundene Kalenderkomponenten

- `src/lib/assist/calendarService.ts` (Demo-Gruppierung)
- `src/lib/calendar/calendarSyncService.ts` (Sync bei Visit-Create, Migration 0118)
- Routes: `/assist/calendar`, `/assist/kalender`
- **Regel:** kein zweiter Kalender — Office-Hauptkalender + Assist-Filter

---

## 7. Gefundene Nachrichtenkomponenten

- Zentrales Modul: `app/business/messages/*`
- Assist-Compose: `AssistComposeMessageScreen`, `ExecutionComposeMessageScreen`, `TripComposeMessageScreen`
- **Regel:** keine Chat-Insel — Integrationspunkte dokumentiert

---

## 8. Dokument-/PDF-/Signaturfunktionen

- `CareRecordDetailScreen`, Signaturen-Route
- PDF-Export-Typen in `assist.ts` (`PdfExportResult`)
- Visit-Signatur-Sollmodell: `assist_visit_signatures` (Schema-Gap)
- `jspdf` im Web-Bundle vorhanden

---

## 9. Live-/Realtime-Funktionen

- `liveMonitorService`, `liveMonitorStore`, `assist_tracking_dashboard` (0114)
- `subscribeToAssistOperationsChanges` in `useAssistDashboard`
- GPS: `gpsTrackingConfig`, extern vorbereitet
- Route `/assist/live-status`

---

## 10. Fahrtenbuch-/Tourenfunktionen

- **Fahrten:** `trips`-Tabelle (0114), `tripLogService`, `TripsListScreen`
- **Touren:** `routePlanningService`, `/assist/touren` (UI), `assist_routes` fehlt (Gap)
- **Tracking:** `TrackingListView`, `assist_tracking_dashboard`

---

## 11. Existierende Supabase-Tabellen (Assist-nutzbar)

| Tabelle | Migration | Nutzung |
|---------|-----------|---------|
| `assist_visits` | 0116 | Einsatz-Disposition (Repository live) |
| `assist_visit_tasks` | 0116 | Einsatzaufgaben |
| `assist_visit_status_history` | 0116 | Statushistorie |
| `assist_visit_budget_snapshots` | 0116 | Budget |
| `assist_visit_billing_snapshots` | 0116 | Abrechnung |
| `assist_visit_audit_logs` | 0116 | Audit |
| `trips` | 0114 | Fahrtenbuch |
| `assist_tracking_dashboard` | 0114/0030 | Live-Tracking |
| `assist_task_packages` / `assist_task_templates` | 0069 | Aufgabenbibliothek |
| `assist_service_catalog_*` | 0053 | Leistungskatalog |
| `assignments` (legacy) | älter | Fallback in `visitService` |

---

## 12. Fehlende Tabellen/Spalten (Kurz — Details im Schema-Gap-Bericht)

- `assist_assignments`, `assist_visit_series`, `assist_visit_documentations`
- `assist_visit_signatures`, `assist_visit_proofs` (vollständig)
- `assist_live_status`, `assist_tracking_points`
- `assist_routes`, `assist_route_items`
- `assist_quality_cases`, `assist_quality_actions`
- `assist_module_settings`, `assist_portal_events`
- Erweiterte Soll-Felder in `assist_visits` (Snapshots, Serien-ID, etc.)

---

## 13. Erlaubte Datei-Scope-Liste (dieser Auftrag)

**Geändert:**
- `src/screens/assist/AssistIndexScreen.tsx`
- `src/types/modules/assist.ts`
- `src/lib/assist/assignmentListService.ts`
- `src/lib/assist/assistDashboardStats.ts`
- `src/lib/assist/assistDataSourceProbe.ts` (neu)
- `src/lib/navigation/moduleExtensionNav.ts`
- `src/lib/adaptive/kpiGridItems.tsx`
- `src/components/assist/AssistDashboardHero.tsx`
- `src/components/assist/AssistDataSourceBanner.tsx` (neu)
- `src/components/assist/index.ts`
- `src/hooks/useAssistDataSource.ts` (neu)
- `src/__tests__/assist/assistDashboardHero.test.ts`
- `docs/audit/assist-controlled-build-plan.md`
- `docs/audit/assist-schema-gap-report.md`
- `docs/audit/assist-controlled-build-abschlussbericht.md`

**Gelesen:** alle Assist-Routen, Services, Repositories, Migrationen 0114/0116, `assistnav.ts`, Master-Prompt, Sollmodell.

---

## 14. Tabu-Dateien

- `supabase/migrations/**` (insb. 0154)
- `src/lib/permissions/**`, `staticRolePermissions.ts`
- B.1-P0-Guard-Dateien
- `assignmentWorkflowService.ts`
- Globale Theme-/Kalender-/Nachrichten-Reparaturen außerhalb Assist
- Git: add, commit, push, pull, merge, rebase, stash

---

## 15. Risikoanalyse

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| `assist_visits` remote nicht angewendet | mittel | hoch | `AssistDataSourceBanner` blockiert |
| Demo-Fallback maskiert Live-Fehler | mittel | mittel | Probe nur bei `supabase`-Modus |
| KPI-Navigation auf unvollständige Screens | niedrig | niedrig | Routes existieren, Empty States vorhanden |
| Typecheck-Altfehler | hoch | niedrig | Keine Verschlechterung in Assist-Dateien |
| Permission-Lücken (0154 pending) | bekannt | mittel | Keine Permission-Änderung — Folgeauftrag B.1h |
| CareLight-Entfernung bricht Tests | mittel | niedrig | Test aktualisiert |

---

## Umsetzungsplan Phase 2 (Minimal)

1. **A** — `AssistIndexScreen`: ScreenShell + AssistDashboardHero + SectionPanel
2. **B** — Extended KPIs: `atRiskCount`, `incompleteCount`, `openProofCount`
3. **C** — `AssistDataSourceBanner` + Probe
4. **D** — `moduleExtensionNav` sync mit `assistnav.ts`
