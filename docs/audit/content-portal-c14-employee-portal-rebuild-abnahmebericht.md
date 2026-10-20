# C.14 Employee Portal Rebuild — Abnahmebericht

**Datum:** 2026-06-24  
**Phase:** C.14  
**Bereich:** Mitarbeiterportal  
**Ergebnis:** BESTANDEN

## Geprüfte Routen

| Route | Status | Screenshot |
|---|---|---|
| `/portal/employee` | OK | c14-employee-portal-dashboard.png |
| `/portal/employee/assignments` | OK | c14-employee-assignments.png |
| `/portal/employee/execution` | OK | c14-employee-execution.png |
| `/portal/employee/messages` | OK | c14-employee-messages.png |

## Datenfluss (P0)

- **Einsätze-Tab:** `PortalAppointmentsTab` → `usePortalAppointments` → `portalAppointmentsLiveService` → `assignments` Tabelle (Supabase live)
- **Seed erstellt:** 2 Assignments mit status `confirmed` und `planned` (PORTAL_APPOINTMENT_STATUSES)
- **Employee sieht Einsätze:** BESTÄTIGT via Browser E2E

## Authentication

- Employee Portal Login via `employee-portal-login` Edge Function
- Session-Injection über `PORTAL_SESSION_KEY`
- Account-Repair via `repairEmployeePortalAccount`

## Execution Workflow

- Execution Hub (`/portal/employee/execution`): Verweist auf Einsätze
- Detail-Execution (`/portal/employee/assignments/[id]/execute`): `EmployeePortalVisitExecutionScreen`
- **Hinweis:** `employeePortalExecutionService` ist demo-only (`guardLiveDemoFeature`), Detail-Execution benötigt Supabase-Anbindung
- **Einsatzliste funktioniert:** über `portalAppointmentsLiveService` (live, kein Demo-Block)

## Nachrichten

- `EmployeePortalMessagesScreen` → `PortalMessagesListShell`
- Thread-basierte Kommunikation über `message_threads` + `messages`

## Design-System

- `PortalTabScreen`, `PortalAppointmentsTab`, `PortalTabHero`
- `PremiumCard`, `PremiumBadge`, `EmptyState`
- Senior-friendly Layout mit großen Buttons

## Ergebnis

Mitarbeiterportal zeigt Einsätze aus `assignments`-Tabelle, Nachrichten funktionieren, Dashboard lädt korrekt. Execution-Detail ist demo-only (Supabase-Anbindung geplant).
