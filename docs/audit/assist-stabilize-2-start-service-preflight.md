# ASSIST.STABILIZE.2 — Start Service Preflight

**Date:** 2026-06-29  
**Tenant:** Helferhasen (`56180c22-b894-4fab-b55e-a563c94dd6e7`)  
**Kevin visit:** `3a24ee90-5dd3-4ab5-9f02-ae74060e0a8a`  
**Employee:** `e036ecd3-8ff7-4453-af93-ebbcbd0820f2`  
**Production:** https://caresuiteplus.app

## 15 Preflight Questions

### 1. Welcher Button löst den Hang aus?

**Einsatz starten** (`start_service`) auf `EmployeePortalVisitExecutionScreen` — Primary Action wenn `derivedStatus === 'angekommen'`.

### 2. Welcher Handler wird aufgerufen?

`runAllowedAction('start_service')` → `startService()` aus Hook → `runWorkflow((ctx) => startService(ctx))` → `startService.ts`.

### 3. Welche Service-Funktion persistiert?

`startService` ruft je nach Zustand:

- **Backfill:** `ensureVisitTimeEvent({ eventType: 'service_start' })` + `upsertAssistVisitExecutionState(..., 'gestartet')`
- **Transition:** `transitionAssistExecutionStatus(ctx, 'gestartet')` → `transitionLiveEmployeePortalAssignment` → `persistEmployeePortalStatusTransition` (service_start)

### 4. Wie wird der Kontext geladen?

`resolveAssistExecutionContext` → `fetchEmployeePortalAssignmentDetail` + `resolveEmployeeLiveContext` + `fetchTimeEventsForVisit` + `deriveWorkflowStatus`.

### 5. Welche DB-Tabellen sind betroffen?

| Tabelle | Spalten |
|---------|---------|
| `assignments` | `status` (enum assignment_status), `actual_start_at`, `arrived_at` |
| `assist_visits` | `execution_status`, `canonical_status`, `arrived_at`, `actual_start_at` |
| `assist_visit_execution_state` | `current_step`, `assignment_status`, `service_started_at`, `travel_*` |
| `assist_time_events` | `event_type = 'service_start'`, `occurred_at`, `recorded_by` |

**Hinweis:** Es gibt **kein** `current_status` — korrekt ist `assignment_status` + `current_step` (0210/0212).

### 6. Kevin-Visit Prod-Stand (MCP 2026-06-29)?

| Quelle | Wert | Problem |
|--------|------|---------|
| `assignments.status` | `started` | Vor `service_start`-Event |
| `assignments.actual_start_at` | gesetzt (12:44 UTC) | Phantom-Start ohne Event |
| `assist_visits` | `arrived` | Teil-repariert |
| `execution_state` | `in_service` / `gestartet`, `service_started_at` NULL | Inkonsistent |
| `assist_time_events` | drive_start, arrive, drive_end — **kein service_start** | Timer-Wahrheit: angekommen |

### 7. Warum zeigt UI „Einsatz starten“ trotz DB `started`?

`deriveWorkflowStatus`: `gestartet` ohne `service_start` → `derivedStatus = angekommen` → `resolveAllowedActions` zeigt `start_service`.

### 8. Root Cause des Hangs (Code)?

1. **Unbegrenzte async-Rekursion** in STABILIZE.1 `startService`: `repairWorkflowState` → `resolveAssistExecutionContext` → erneut `startService` ohne Zustandsänderung
2. **`runWorkflow` ohne `try/finally`**: bei hängendem Promise bleibt `actionLoading === true`
3. **Kein Timeout** (10s) auf Workflow-Kette
4. **Backfill ohne Readback**: `void upsertAssistVisitExecutionState`, Erfolg ohne DB-Verifikation

RLS-Fehler würden schnell fehlschlagen — Hang = unaufgelöstes Promise/Rekursion, nicht stilles RLS.

### 9. Event-Typ korrekt?

Ja: **`service_start`** (nicht `service_started`) — siehe `saveVisitTimeEvent.ts`, Migration 0156 constraint.

### 10. Status-Konventionen?

Deutsch in App (`gestartet`, `angekommen`); DB-Enum Englisch (`started`, `arrived`) via `assignmentStatusBridge`.

### 11. RLS-Risiko Kevin (Dual-Role)?

Migration 0208: `is_employee_portal_rls_context` + `portal_employee_assigned_visit_ids`. Kein zusätzlicher 0214-Blocker identifiziert — Policies für `assist_time_events` INSERT/SELECT und `assist_visit_execution_state` ALL vorhanden.

### 12. RPC 0213 live?

Ja — `repair_assist_visit_workflow_status` mit `normalize_assist_workflow_repair_status` und enum cast.

### 13. Was ändert STABILIZE.2?

- Idempotentes `startService` mit Readback (`service_started_at`, `derivedStatus=gestartet`, `canEndService`, `start_pause`)
- Rekursionstiefe max 1
- `START_SERVICE_*` Fehlercodes
- 10s Timeout + `finally` im Hook
- Button-spezifisches `startServiceLoading` (kein Full-Page-Spinner)

### 14. Migration 0214 nötig?

**Nein** (Stand Audit) — additive RLS aus 0208/0209 ausreichend. Kein RLS-Disable.

### 15. Abnahme-Kriterium Production-ready?

**Nein bis Deploy + Kevin-Klick verifiziert.** Lokal: Tests + Audit grün. Prod: ausstehend (Nutzer: kein Deploy).

## Click-Path Diagram

```
PremiumButton "Einsatz starten"
  → runAllowedAction('start_service')
  → useEmployeePortalVisitExecution.runWorkflow (timeout 10s, finally)
  → startService(ctx)
       ├─ gestartet ohne service_start → backfill service_start + upsert + verifyReadback
       └─ angekommen → transitionAssistExecutionStatus('gestartet') + upsert + verifyReadback
  → syncAfterWorkflow(refreshed ctx)
  → UI: service timer active, end_service + pause sichtbar
```

## Kevin DB-Reparatur (empfohlen vor Prod-Test)

Visit erneut auf `arrived`/`angekommen` setzen, `actual_start_at` leeren — siehe `assist-stabilize-1-p0-repair-3a24ee90.md`. Prod-Stand weicht aktuell ab (assignment wieder `started`).
