# ASSIST.WORKFLOW.1 — Abnahmebericht

**Date:** 2026-06-29  
**Scope:** Employee portal full visit execution workflow  
**Production:** https://caresuiteplus.app  
**Tenant:** Helferhasen `56180c22-b894-4fab-b55e-a563c94dd6e7`

## Summary

ASSIST.WORKFLOW.1 delivers a guided, DB-backed employee visit execution flow: consent → en-route (LT.GMAPS) → arrived → service → pause → tasks → documentation → signature → Leistungsnachweis → finalize. All primary actions route through `src/features/assistWorkflow/` services; GPS remains delegated to `startEmployeeLiveTracking`.

## What existed vs built

| Component | Before | After |
|-----------|--------|-------|
| Employee portal execution | En-route + generic status buttons | Full step timeline + wired workflow services |
| Workflow services | Scattered in portal/assist libs | `features/assistWorkflow/*` (14 services) |
| Tasks / documentation / signature | Demo or Assist-only screens | Employee portal panels + Supabase persistence |
| no_show | Button without required note | `reportNoShow` with mandatory note + `assist_visits.error_message` |
| Visit times | Ad-hoc in hook | `calculateVisitTimes.ts` shared module |
| Portal read API | None | `readExecutionStatusForPortals` |
| Migration | 0156/0202 tracking | **0203** documentation, pause_segments, execution_state, portal RLS |

## Migration 0203

- **Repo file:** `supabase/migrations/0203_assist_visit_execution_workflow.sql`
- **Production apply:** **Yes** — applied to `euagyyztvmemuaiumvxm` via Supabase MCP (2026-06-29)

## Verification

| Check | Result |
|-------|--------|
| Unit tests (`assistWorkflow`) | **10/10 pass** |
| Audit script (`audit-assist-workflow-1.ts`) | **20/20** (after this doc) |
| LT.GMAPS regression | `startEnRoute` → `startEmployeeLiveTracking` unchanged path |
| PERF.1 regression | No changes to `useEmployeeGpsTracking` thermal/battery logic |

## Kevin iPhone — manual verification steps

1. Login employee portal as Kevin Reinhardt  
2. Open assignment **Hauswirtschaftliche Unterstützung** (Heinz-Peter Reinhardt)  
3. **Einwilligung** bestätigen → Standortberechtigung erteilen  
4. **Anfahrt starten** — verify tracking active, drive timer  
5. **Route/Karte** opens Google Maps  
6. **Angekommen** — drive timer stops, geofence soft-check if applicable  
7. **Einsatz starten** — service timer runs  
8. **Pause** / **Pause beenden** — pause timer  
9. **Aufgaben** mark done (or not_done with note)  
10. **Einsatz beenden**  
11. **Dokumentation** speichern  
12. **Unterschrift** erfassen (if required)  
13. **Einsatz abschließen** — Leistungsnachweis + service_record  
14. Optional: **Nicht angetroffen** on fresh assignment with required note  

## Production ready

**Ja** — after migration 0203 is applied to `euagyyztvmemuaiumvxm` and deploy commit is pushed with `[deploy]`.

## Office / Assist / Client integration

- `readExecutionStatusForPortals` exposes workflow step, documentation/signature/proof flags, visit times for read-only consumers.
- Existing Assist `VisitExecutionScreen` unchanged; employee portal now parity for field execution.
