# ASSIST.WORKFLOW.2 — Abnahmebericht

**Date:** 2026-06-29  
**Project:** CareSuite+ (`euagyyztvmemuaiumvxm`)  
**Commit:** _(see git log after push)_  
**Migration:** `0210_assist_workflow_2_time_proof.sql`

## Root causes (Kevin visit `2a499c72-30f9-46bd-bfda-6a679ac85c73`)

| # | Root cause | Fix |
|---|------------|-----|
| 1 | Travel timer not guaranteed to stop at `markArrived` — missing `drive_end`/`arrive` events tolerated | `backfillTravelEndEvents`, fail on persist failure |
| 2 | `endService` had no `service_started_at` guard | `WORKFLOW_SERVICE_NOT_STARTED` blocks transition |
| 3 | UI showed doc/signature on inconsistent DB status | `resolveEffectiveWorkflowStatus` repair + warning banner |
| 4 | Documentation did not chain to signature / finalize | `saveVisitDocumentation` → `dokumentation_offen`; screen `awaitingSignature` |

## Deliverables

- [x] Preflight: `docs/audit/assist-workflow-2-time-proof-preflight.md`
- [x] State machine guards in `assignmentStatusMachine` / `assistVisitStateMachine`
- [x] `getVisitTimeSegments`, `saveVisitTimeEvent`, hardened `calculateVisitTimes`
- [x] Migration 0210 — denormalized timestamps on `assist_visit_execution_state`
- [x] Service layer guards and execution-state flag updates
- [x] Portal UI guided flow + inconsistent-state repair
- [x] `WORKFLOW_*` error codes
- [x] Unit tests (18 passing in assistWorkflow suite)
- [x] Audit script `scripts/audit-assist-workflow-2.ts`

## Test results

```
vitest run src/__tests__/assistWorkflow/
  assistVisitStateMachine.test.ts  8 passed
  calculateVisitTimes.test.ts        5 passed
  assistWorkflow2.test.ts            5 passed
  assistWorkflowServices.test.ts     1 passed (baseline)
```

## Audit

```
npx tsx scripts/audit-assist-workflow-2.ts
Ergebnis: 25/25 bestanden
```

## Kevin full workflow (post-fix)

1. **Einwilligung** — Standort-Einwilligung bestätigen  
2. **Anfahrt starten** — `drive_start` event, LT.GMAPS tracking  
3. **Angekommen** — `arrive` + `drive_end`; Anfahrt-Timer stoppt  
4. **Einsatz starten** — `service_start` event (Pflicht vor Beenden)  
5. **Einsatz beenden** — blockiert ohne Schritt 4  
6. **Dokumentation** — speichern → Status `dokumentation_offen`  
7. **Unterschrift** — speichern → Status `unterschrift_offen`  
8. **Einsatz abschließen** — Leistungsnachweis + `abgeschlossen`

## Regression checklist

- [x] LT.GMAPS — `startEnRoute` unchanged delegation  
- [x] PERMISSIONS 0205–0209 — no RLS changes  
- [x] PERF — hook polling unchanged  
- [x] AWF1 audit script still present (AWF2-25)

## Manual verification (production)

- [ ] Kevin re-opens visit — repair banner if inconsistent state  
- [ ] Full flow on fresh assignment  
- [ ] Leistungsnachweis shows Anfahrt / Einsatz / Pause with real timestamps
