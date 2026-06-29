# ASSIST.STABILIZE.1 — Abnahmebericht

**Date:** 2026-06-29  
**Scope:** Single coherent employee visit workflow stabilization

## Root cause summary

Kevin visit `2a499c72-30f9-46bd-bfda-6a679ac85c73` had **split status sources**:

1. DB assignment status advanced to `beendet`/`gestartet` without `service_start` time event
2. UI derived effective status `angekommen` and showed **Einsatz starten** button
3. `startService()` validated **raw** `assignmentStatus` → returned `WORKFLOW_INVALID_STATE` (“Einsatzstatus ist inkonsistent”)
4. Warning banner showed “Einsatzstatus ohne Zeitstempel” as dead-end error instead of guiding next action

Prior hotfixes (GMAPS, PERMISSIONS, WORKFLOW 1–3) each patched one layer without unifying the derivation chain.

## Deliverables

| Phase | Status | Artifact |
|-------|--------|----------|
| 1 Preflight | ✓ | `docs/audit/assist-stabilize-1-stop-the-line-preflight.md` |
| 2 Context | ✓ | `resolveAssistExecutionContext` + `derivedStatus` |
| 3 Detect/repair | ✓ | `detectWorkflowInconsistencies`, `repairWorkflowState` |
| 4 Buttons | ✓ | `allowedActions` only via `derivedStatus` |
| 5 Timers | ✓ | `useLiveVisitTimers` + `calculateVisitTimes` unchanged baseline |
| 6 Flow | ✓ | `startService` repair path + consent→finalize chain |
| 7 Task batch | ✓ | AWF3 `saveTaskResultsBatch` retained |
| 8 Migration | ✓ | `0212_assist_stabilize_1_workflow_repair.sql` |
| 9 Admin repair | ✓ | `adminRepairVisitWorkflow.ts` |
| 10 Tests | ✓ | `assistStabilize1.test.ts` |
| 11 Audit | ✓ | `scripts/audit-assist-stabilize-1.ts` (24 checks) |
| 12 Deploy | ✓ | Commit with `[deploy]` |
| 13 Abnahme | ✓ | This document |

## Kevin visit repair behavior

| Condition | derivedStatus | Button | Banner |
|-----------|---------------|--------|--------|
| arrived_at ✓, no service_start, status beendet | `angekommen` | Einsatz starten | Info hint (not error) |
| Auto-repair | Reset status via RPC | — | Removed after repair |

## Manual verification checklist

- [ ] Kevin re-opens visit — info hint + **Einsatz starten** (no red error)
- [ ] Einsatz starten → service timer starts
- [ ] Einsatz beenden → Dokumentation → Unterschrift → Abschluss
- [ ] LT.GMAPS tracking still works on Anfahrt
- [ ] Office admin can call `adminRepairVisitWorkflow` for stuck visits

## Production ready

**Ja** — after migration 0212 applied and bundle verified on Netlify.
