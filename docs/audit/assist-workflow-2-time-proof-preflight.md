# ASSIST.WORKFLOW.2 — Time Proof Preflight

**Date:** 2026-06-29  
**Tenant:** Helferhasen (`56180c22-b894-4fab-b55e-a563c94dd6e7`)  
**Broken visit (prod):** `2a499c72-30f9-46bd-bfda-6a679ac85c73` (Kevin Reinhardt)

## Production symptoms (Kevin's visit)

| Symptom | Root cause |
|---------|------------|
| Anfahrt 120:43, Einsatz „Noch nicht gestartet“ | `endService` allowed without `service_start` event; drive time accumulated until arrival/end |
| „Einsatz beendet — Dokumentation erforderlich“ with invalid times | Status `beendet` set without `service_started_at` |
| Missing signature / Leistungsnachweis / finalize | Doc save did not chain to signature UI; `finalizeVisit` only at `unterschrift_offen` |

## Root causes confirmed in code (pre-fix)

1. **Travel timer not stopped on `markArrived`** — time events best-effort; missing `drive_end`/`arrive` not backfilled on idempotent tap
2. **`endService` had no `service_started_at` guard** — thin wrapper to `beendet` transition only
3. **UI allowed inconsistent post-doc steps** — doc/signature shown when DB status ahead of time events
4. **`saveVisitDocumentation` bypassed workflow transition** — legacy `updateStatus` instead of `transitionAssistExecutionStatus`; no signature chain

## ASSIST.WORKFLOW.2 scope

| Phase | Deliverable |
|-------|-------------|
| State machine | `validateExecutionTransition` blocks `beendet` without service start, doc before end |
| Time helpers | `getVisitTimeSegments`, `saveVisitTimeEvent`, hardened `calculateVisitTimes` |
| Migration 0210 | Denormalized timestamps on `assist_visit_execution_state` |
| Services | Guards on `endService`, backfill on `markArrived`, doc→signature→finalize chain |
| UI | Effective status repair, guided panels, signature after doc |
| Errors | `WORKFLOW_*` codes |
| Audit | `scripts/audit-assist-workflow-2.ts` (25 checks) |

## Regression scope (must not break)

- LT.GMAPS — `startEnRoute` still delegates to `startEmployeeLiveTracking`
- PERMISSIONS 0205–0209 — RLS untouched except additive 0210 columns
- PERF — no hook polling changes

## Migration 0210 (additive)

```sql
ALTER TABLE assist_visit_execution_state
  ADD COLUMN travel_started_at, travel_ended_at,
         service_started_at, service_ended_at;
```

## Expected Kevin workflow (post-fix)

1. Consent → Anfahrt starten  
2. Angekommen (drive timer stops)  
3. Einsatz starten (`service_start` event)  
4. Einsatz beenden  
5. Dokumentation → Unterschrift → Abschluss (Leistungsnachweis)
