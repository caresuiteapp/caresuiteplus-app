# ASSIST.WORKFLOW.1 — Preflight Audit

**Date:** 2026-06-29  
**Tenant:** Helferhasen (`56180c22-b894-4fab-b55e-a563c94dd6e7`)  
**Production:** https://caresuiteplus.app

## Existing infrastructure (reused)

| Area | Existing | Notes |
|------|----------|-------|
| Assignments | `assignments`, `assignment_tasks` | Status RPC `set_assignment_status`, documentation_notes |
| Assist visits | `assist_visits`, `assist_visit_tasks` | Multi-status execution/documentation/proof |
| Time events | `assist_time_events` (0156) | drive_start/end, arrive, service_start/end, pause_start/end |
| GPS / tracking | `assist_tracking_sessions`, `assist_location_points` | LT.GMAPS.2–4 via `startEmployeeLiveTracking` |
| Signatures | `assist_visit_signatures` (0156) | Storage + hashes |
| Proofs | `assist_visit_proofs` (0156) | JSON snapshot + optional PDF |
| Service records | `service_records` | `prepareServiceRecord` on assignment completion |
| Employee portal UI | `useEmployeePortalVisitExecution`, `EmployeePortalVisitExecutionScreen` | Only en-route wired before AWF.1 |
| Assist back-office | `VisitExecutionScreen`, `visitExecutionService` | Full A–H workflow (reference) |
| State machines | `assignmentStatusMachine`, `visitWorkflow`, `assistVisitStateMachine` (lib) | AWF.1 adds `features/assistWorkflow/assistVisitStateMachine` for portal steps |

## Gaps before ASSIST.WORKFLOW.1

- No guided step timeline in employee portal
- Tasks read-only in portal screen
- Documentation / signature / finalize not wired to Supabase in portal
- No `reportNoShow` with required note persistence
- No unified workflow service layer (`features/assistWorkflow/`)

## Migration 0203 (additive)

- `assist_visit_documentation` — structured portal documentation
- `assist_pause_segments` — pause interval materialization
- `assist_visit_execution_state` — workflow step snapshot for portals
- `service_records.assist_visit_id` — visit link
- Portal employee RLS on signatures, proofs, documentation

## LT.GMAPS / PERF regression scope

- `startEnRoute` delegates to `startEmployeeLiveTracking` (no GPS duplication)
- Hook retains `useEmployeeGpsTracking`, consent banner, timers panel
- PERF.1 thermal/battery paths untouched

## Test context

- Employee: Kevin Reinhardt  
- Client: Heinz-Peter Reinhardt  
- Service: Hauswirtschaftliche Unterstützung
