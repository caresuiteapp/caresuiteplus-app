# ASSIST.STABILIZE.3 — Pause / End Service Preflight

**Date:** 2026-06-29  
**Tenant:** Helferhasen (`56180c22-b894-4fab-b55e-a563c94dd6e7`)  
**Kevin visit:** `3a24ee90-5dd3-4ab5-9f02-ae74060e0a8a`  
**Employee:** `e036ecd3-8ff7-4453-af93-ebbcbd0820f2`  
**Baseline:** STABILIZE.2 commit `8043374b`, bundle `entry-9716fc34…`  
**Production:** https://caresuiteplus.app

## Flow Trace

### Pause start (`start_pause`)

1. UI: `EmployeePortalVisitExecutionScreen` → `handleStartPause` → `runWorkflow(startPause)`
2. **Before STABILIZE.3:** `startPause.ts` only called `transitionAssistExecutionStatus(ctx, 'pausiert')`
3. Persistence chain: `transitionLiveEmployeePortalAssignment` → `persistEmployeePortalStatusTransition` → `recordTimeEvent(pause_start)`
4. Context reload: `resolveAssistExecutionContext` → `fetchTimeEventsForVisit` → `calculateVisitTimes`

### Pause end (`end_pause`)

Same thin wrapper → `transitionAssistExecutionStatus(ctx, 'gestartet')` → `pause_end` event via persistence.

### End service (`end_service`)

1. `endService` → transition `beendet` → `service_end` + `depart`
2. **Before STABILIZE.3:** `void upsertAssistVisitExecutionState(..., ctx.visitTimes)` with **stale pre-transition times** (no `serviceEndedAt`)
3. No readback verification of `service_end` or `serviceSeconds`

## Root Causes

| # | Symptom | Root cause |
|---|---------|------------|
| RC-1 | Service timer keeps running during pause | Status → `pausiert` but `pause_start` event missing or not verified; `calculateVisitTimes` extended service to `now` without open pause segment |
| RC-2 | Pause badge but service still ticks | `activeTimer=pause` from status, but `serviceSeconds` used `now` when no `pause_start` in `assist_time_events` |
| RC-3 | Service time disappears after end | `service_end` write best-effort only (warnings swallowed); no readback; stale upsert without `serviceEndedAt` |
| RC-4 | Duplicate `service_start` on resume | `statusToTimeEventType`: `gestartet` always emitted `service_start`, including `pausiert → gestartet` |
| RC-5 | End from pause incomplete | `beendet` from `pausiert` did not auto-close open pause (`pause_end` missing before `service_end`) |
| RC-6 | Timer status mismatch | `calculateVisitTimes` used recorded DB status before derive; phantom `gestartet` without events showed service timer |

## Event Type Convention (0210 / 0156)

| Correct | Wrong |
|---------|-------|
| `pause_start` | `pause_started`, `PauseStart` |
| `pause_end` | `pause_ended` |
| `service_end` | `service_ended` |

Table name: **`assist_pause_segments`** (0203), not `assist_visit_pause_segments`. Source of truth for UI timers: **`assist_time_events`**.

## STABILIZE.3 Fix Summary

- `startPause` / `endPause` / `endService`: STABILIZE.2-style readback + awaited upsert
- `ensureOpenPauseStartEvent` / `ensureOpenPauseEndEvent` for idempotent pause segments
- `calculateVisitTimes`: freeze service at open `pause_start`; only subtract completed pauses during active pause
- `statusToTimeEventType`: no duplicate `service_start` on resume; close pause before `service_end`
- `resolveAllowedActions`: `end_service` while paused
- `resolveAssistExecutionContext`: timers use `derivedStatus`

## Migration 0215

**Not required** — schema and RLS for `assist_time_events` / `assist_pause_segments` sufficient; fixes are application-layer.

## Kevin Visit Repair (Phase 9)

If visit has `pausiert`/`gestartet`/`beendet` without matching events, use backfill via workflow functions or `repair_assist_visit_workflow_status` RPC (0213) for status-only repair; time events via `ensureVisitTimeEvent` in app layer.
