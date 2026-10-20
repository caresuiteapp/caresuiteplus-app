# CareSuite+ WFM — Ist-Abgleich (Spec vs. Codebase)

**Stand:** 2026-06-28  
**Methode:** Code-Grep, Migration-Review, Service-/Screen-Inventar  
**Gesamt-Schätzung:** **~24 %** der WFM-Spezifikation ist im Code vorhanden (fragmentiert, nicht zentral integriert)

---

## Zusammenfassung nach Bereich

| Bereich | Ist-Anteil | Hauptfundstellen |
|---------|------------|------------------|
| Homeoffice-Zeiterfassung | ~65 % | Migration 0161, `src/lib/timeTracking/` |
| Assist Einsatz-Zeit/GPS | ~40 % | Migration 0156, Assist Live-Status |
| Abwesenheiten (Schema/Service) | ~30 % | Migration 0051, `absenceService.ts` |
| Portal Arbeitszeit | ~35 % | `/portal/employee/arbeitszeit` |
| Office Live-Anwesenheit | ~15 % | Nur Assist Live-Status, kein MA-Dashboard |
| Zeitkonto / Export / Regeln | ~5–10 % | Ampel HO, CSV-Export HO |
| Zentrale Architektur | ~10 % | Mehrere Silo-DBs, kein `workforce_*` |

---

## Detail-Matrix: Spec §1–20

| § | Modul | Ist | Gap | Phase | Relevante Dateien / Migrationen |
|---|-------|-----|-----|-------|--------------------------------|
| **1** | Live-Anwesenheit (Office Dashboard) | **partial** | Kein „Live-Mitarbeiter“-Dashboard; nur Assist Einsatz-Live-Status | 1 | `src/screens/assist/AssistLiveStatusScreen.tsx`, `src/lib/assist/assistLiveTrackingViewService.ts`, `src/lib/assist/liveMonitorService.ts`, `supabase/migrations/0129_live_monitor_operations.sql` |
| **2** | Live-Karte | **partial** | GPS/Geofence nur Einsatz-Kontext; keine Office-Gesamtkarte aller MA | 3 | `src/lib/assist/gpsTrackingConfig.ts`, `src/screens/portal/EmployeePortalVisitExecutionScreen.tsx`, `assist_geofence_events` (0156) |
| **3** | Arbeitszeiterfassung (zentral) | **partial** | Drei getrennte Systeme: `homeoffice_*`, `assist_time_events`, `time_entries` | 1 | `supabase/migrations/0161_homeoffice_time_tracking.sql`, `src/lib/timeTracking/*`, `src/types/modules/timeTracking.ts` |
| **4** | Einsatzzeiten | **partial** | Visit-Timer + Status persistiert; kein Auto-Rückkanal zu zentralem WFM | 1 | `src/lib/assist/assistTrackingPersistenceService.ts`, `src/hooks/useAssignmentExecution.ts`, `src/hooks/useEmployeePortalVisitExecution.ts` |
| **5** | Home Office | **exists** | Modul weitgehend; kein zentraler WFM-Sync; HO-Override via `employee_work_settings` | 1 | `0161`, `0172`, `src/lib/timeTracking/timeTrackingWorkdayService.ts`, `src/lib/office/employeeHomeOfficeService.ts`, `TimeTrackingEmployeeScreen.tsx` |
| **6** | Büro Check-In | **none** | Kein QR/NFC/Beacon/PIN Check-In | 4+ | — |
| **7** | Live Timer (Portal) | **partial** | HO-Timer + `EmployeePortalLiveTimersPanel` (Einsatz); kein Soll/Ist/Zeitkonto | 1 | `src/components/portal/EmployeePortalLiveTimersPanel.tsx`, `TimeTrackingEmployeeScreen.tsx` |
| **8** | Mitarbeiterportal „Arbeitszeit“ | **partial** | Route + HO-Screen; fehlen Urlaub, Krank, Zeitkonto-Tabs | 1–2 | `app/portal/employee/arbeitszeit/index.tsx`, `TIME_TRACKING_PORTAL_ROUTE` in `src/lib/timeTracking/index.ts` |
| **9** | Live-Uhr (Portal Header) | **none** | Kein persistentes Header-Widget | 1 | — |
| **10** | Urlaub | **partial** | DB + Service + Kalender-Sync; keine vollständige Portal-/Office-UI | 2 | `supabase/migrations/0051_employee_absences.sql`, `src/lib/office/absenceService.ts`, `src/lib/calendar/calendarSyncService.ts`, CSV `urlaubsanspruch` |
| **11** | Abwesenheiten | **partial** | Schema + Permissions + Demo-Store; UI dünn | 2 | `src/types/modules/employeeAbsence.ts`, `src/__tests__/office/employeeAbsence.test.ts`, `personalComplianceCockpitBuilder.ts` |
| **12** | Genehmigungen | **partial** | `homeoffice_correction_requests`, `employee_absence_requests`; kein unified Inbox | 2 | `0161` (corrections), `0051` (requests), `timeTrackingCorrectionService.ts` |
| **13** | Office Zeitkonten | **none** | Keine dedizierte Verwaltungsseite | 4 | — |
| **14** | Zeitkonto (Monat) | **none** | Keine `workforce_time_accounts`; HO-Ampel nur Tagesbasis | 4 | `src/lib/timeTracking/timeTrackingAmpelService.ts` |
| **15** | Korrekturen (revisionssicher) | **partial** | HO-Korrekturen + Audit-Hash-Kette; nicht mandantenweit | 2 | `timeTrackingCorrectionService.ts`, `timeTrackingAuditService.ts`, `homeoffice_audit_logs` |
| **16** | Automatische Regeln | **partial** | Inaktivitäts-Checks HO; kein ArbZG-Engine | 4 | `timeTrackingInactivityService.ts`, `timeTrackingAmpelService.ts` |
| **17** | Benachrichtigungen | **partial** | Office Notifications Infra; keine WFM-spezifischen Trigger | 4 | `supabase/migrations/0152_office_notifications_table.sql` |
| **18** | Dashboard Geschäftsführung | **none** | Kein WFM-KPI-Dashboard | 4 | Office-Dashboard ohne WFM-KPIs |
| **19** | Auswertungen / Exporte | **partial** | HO-CSV-Export; DATEV nur Rechnungen (`InvoiceDetailHero`) | 5 | `timeTrackingExportService.ts`, `src/components/integrations/IntegrationsHubHero.tsx` |
| **20** | Architektur (zentral) | **none** | Explizit getrennte Tabellen; Kommentar in Code: „distinct from legacy Assist GPS“ | 1 | `homeofficeTableNames.ts`, `assistExecutionPersistence.ts` |

**Legende Ist:** `exists` = produktionsnah für Teilmodul · `partial` = Schema/UI/Service fragmentarisch · `none` = nicht vorhanden

---

## Codebase-Audit — Dateipfade nach Thema

### Zeiterfassung / Homeoffice

| Pfad | Beschreibung |
|------|--------------|
| `supabase/migrations/0161_homeoffice_time_tracking.sql` | HO-Schema (workdays, entries, audit, RLS) |
| `supabase/migrations/0187_homeoffice_time_tracking_rls_grants.sql` | RLS/Grants-Nachzug |
| `src/lib/timeTracking/` | 18 Service-Dateien (Workday, Inactivity, Export, …) |
| `src/components/timeTracking/` | Employee, Settings, Audit Screens |
| `src/types/modules/timeTracking.ts` | TypeScript-Typen |
| `src/__tests__/timeTracking/timeTracking.test.ts` | Unit-Tests |
| `app/portal/employee/arbeitszeit/index.tsx` | Portal-Route |
| `app/business/office/time-tracking/` | Office-Routen |

### Assist / Einsatz / GPS

| Pfad | Beschreibung |
|------|--------------|
| `supabase/migrations/0156_assist_execution_persistence.sql` | assist_time_events, tracking_sessions, geofence |
| `src/lib/assist/assistTrackingPersistenceService.ts` | Persistenz-Service |
| `src/lib/assist/assistLiveTrackingViewService.ts` | Live-Status-Aggregation |
| `src/screens/assist/AssistLiveStatusScreen.tsx` | Live-Status UI |
| `src/hooks/useAssistLiveStatus.ts` | Hook |
| `src/lib/assist/gpsTrackingConfig.ts` | GPS-Konfiguration |
| `src/lib/realtime/presets.ts` | Realtime: assist_time_events, live_operation_events |
| `supabase/migrations/0129_live_monitor_operations.sql` | live_operation_events |

### Abwesenheit / Urlaub / Kalender

| Pfad | Beschreibung |
|------|--------------|
| `supabase/migrations/0051_employee_absences.sql` | employee_absences, requests, balances |
| `supabase/migrations/0118_backfill_calendar_events.sql` | Absence → calendar_events |
| `src/lib/office/absenceService.ts` | CRUD + Genehmigung (Demo/Live-Guard) |
| `src/types/modules/employeeAbsence.ts` | Typen |
| `src/lib/calendar/calendarSyncService.ts` | Kalender-Sync aus Abwesenheiten |

### Personal / HO-Einstellungen

| Pfad | Beschreibung |
|------|--------------|
| `supabase/migrations/0172_employee_personnel_live_extensions.sql` | employee_work_settings |
| `src/lib/office/employeeHomeOfficeService.ts` | HO-Override pro MA |
| `src/components/office/EmployeeRolesPermissionsHub.tsx` | HO-Toggle in Rollen & Rechte |

### Permissions

| Pfad | Beschreibung |
|------|--------------|
| `src/lib/permissions/staticRolePermissions.ts` | `time.*`, `office.employees.absences.*`, `portal.employee.absences.*` |
| `supabase/migrations/0161_*` (Seeds) | role_permissions für time.tracking |

### Portal / Mitarbeiter

| Pfad | Beschreibung |
|------|--------------|
| `src/components/portal/EmployeePortalLiveTimersPanel.tsx` | Live-Timer Einsatz (sessionbasiert) |
| `src/screens/portal/EmployeePortalVisitExecutionScreen.tsx` | Einsatz mit GPS/Geofence |
| `src/screens/portal/EmployeeProfileScreen.tsx` | „Zeiterfassung (letzte Einsätze)“ |
| `src/lib/portal/employeePortalExecutionLiveService.ts` | Live Execution |

### Navigation

| Pfad | Beschreibung |
|------|--------------|
| `src/lib/navigation/modulenav/officenav.ts` | Office → Arbeitszeit |
| `src/lib/navigation/modulenav/assistnav.ts` | Assist → Live-Status |

---

## Architektur-Gap (Kernproblem)

```
[Ist — fragmentiert]

homeoffice_workdays / homeoffice_time_entries     →  Office/Portal HO
assist_time_events / assist_tracking_sessions     →  Assist/Portal Einsatz
time_entries (legacy GPS)                         →  Assist alt
employee_absences                                 →  Office Abwesenheit
live_operation_events                             →  Live Monitor

[Soll — Spec §20]

workforce_time_events  ←── single write path
workforce_work_sessions
workforce_absences / workforce_approvals / workforce_time_accounts
```

---

## Empfehlung

1. **Phase 1 starten** mit Migration `0190_wfm_foundation.sql` (Review, dann Staging-Apply).
2. **Nicht** weiter ausbauen ohne Zentral-DB — vermeidet vierte Silo-Tabelle.
3. Homeoffice-Modul (0161) als **Referenzimplementierung** für RLS/Permissions nutzen.
4. Assist-Adapter früh anbinden — größter Nutzen für „Im Einsatz“-Live-Status.

---

## Referenzen

- Spezifikation: `docs/spec/wfm-workforce-management-spezifikation.md`
- Architektur: `docs/spec/wfm-architektur-zentral.md`
- Phasenplan: `docs/roadmap/wfm-phasenplan.md`
