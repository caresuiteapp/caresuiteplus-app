# C.14X — Master-Abnahmebericht

**Date**: 2026-06-24
**Phase**: C.14X — Employee Execution Production Render Crash (React #421)
**Fix commit**: `b893b22` — `fix(portal): prevent employee execution production render crash`
**Deploy commit**: `fb25665` — `chore: trigger production deploy [deploy]`
**Status**: ABGENOMMEN

## Zusammenfassung

Die Employee Execution Route (`/portal/employee/execution`) crashte auf Production
für Nicht-`internal_test`-Tenants mit React Error #421 ("Rendered fewer hooks than
expected"). Ursache: Side-Effect (Map-Mutation) während des Renderns + unbedingter
1-Sekunden-Tick-Timer ohne Daten-Gate.

Der Fix ist minimal (3 Quelldateien), wahrt alle Guards und führt keine UI-Umbauten
durch. Der Fix wurde vor dem C.14V-Deploy committed.

## Gate-Ergebnisse

| Gate | Ergebnis | Detail |
|------|----------|--------|
| Git Precheck | PASS | Branch: main, HEAD = origin/main, kein .env staged |
| contentPortalEnvGate | PASS | businessLogin=true, serviceRolePresent=true |
| contentPortalAuthBootstrap | PASS | employeePortalRepair=true |
| contentPortalE2eSeed | PASS | 13/13 Steps OK |
| contentPortalAuthVerify | PASS | employee + client + business login OK |
| contentPortalLiveBackfill --dry-run | PASS | dryRun=true, 12 wouldUpsert, 0 applied |

## Tests

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| c14xEmployeeExecutionCrash | 8 | 8 | 0 |
| c14p1ExecutionGuardAndProofCache | 12 | 12 | 0 |
| c14DataFlow | 16 | 16 | 0 |
| portalApproval | 3 | 3 | 0 |
| demoLeak | 6 | 6 | 0 |
| liveDataProtection | 5 | 5 | 0 |
| **Total contentPortal** | **51** | **51** | **0** |

## TypeScript

- Fehleranzahl: **623** (Baseline: 623)
- Keine neuen Fehler in geänderten Dateien

## Browser E2E

- Script: `scripts/audit/contentPortalC14XEmployeeExecutionCrashE2e.mjs`
- Ergebnis: **12/12 PASS**
- Browser: Playwright msedge channel, headless
- Ziel: Production (`https://caresuiteplus.app`)
- Alle Checks: employee_login, dashboard, assignment_visible, detail_opens,
  execution_route_loads, no_react_crash, action_prepared_state, no_technical_leak,
  no_foreign_data, messages_employee_regression, messages_client_regression,
  proof_revoke_regression

## Geänderte Dateien (Fix)

| Datei | Änderung |
|-------|----------|
| `src/hooks/useEmployeePortalVisitExecution.ts` | consent → useMemo; tick-Timer hinter hasData; assignmentId-Guard in GPS-Effect |
| `src/screens/portal/EmployeePortalVisitExecutionScreen.tsx` | Array.isArray-Guard für id-Param |
| `src/screens/portal/PortalAssignmentDetailScreen.tsx` | Array.isArray-Guard für id-Param |
| `src/__tests__/contentPortal/c14xEmployeeExecutionCrash.test.ts` | 8 Unit-Tests (neu) |
| `scripts/audit/contentPortalC14XEmployeeExecutionCrashE2e.mjs` | Browser E2E (neu/erweitert) |
| `docs/audit/content-portal-c14x-*.md` | Dokumentation |

## Hard Constraints

- [x] Kein Deploy in diesem Lauf (Deploy-Commit existiert bereits separat)
- [x] Kein K.6 / Rechnungen
- [x] Kein LiveBackfill Apply
- [x] Keine Integrations-Änderungen
- [x] Keine Secrets im Commit
- [x] Keine Testdaten in Helferhasen+ UG
- [x] Test-Tenant: `a4ba83bd-65db-46cf-8cf7-61492cc78315` (internal_test)
- [x] Protected: `56180c22-b894-4fab-b55e-a563c94dd6e7`
