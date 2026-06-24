# C.14X — Employee Execution React #421 Fix

**Date**: 2026-06-24
**Phase**: C.14X (Content Portal — Employee Execution Production Render Crash)
**Severity**: P0 — production crash on non-internal_test tenants
**Commit**: `b893b22` — `fix(portal): prevent employee execution production render crash`

## Root Cause

The `useEmployeePortalVisitExecution` hook violated React's render purity contract
through two compounding issues:

1. **Side-effect during render** — `getEmployeePortalLocationConsent(tenantId, assignmentId)`
   was called directly during render. Internally this invokes `getEntry()` which mutates
   an external Map (`TRACKING_STORE.set(key, entry)`) when the entry does not yet exist.
   In React 18 production builds, side-effects during render trigger reconciliation errors
   (React #421 / "Rendered fewer hooks than expected").

2. **Unconditional tick timer** — A 1-second `setInterval` ran immediately, regardless
   of whether execution data had loaded. For production tenants where the live guard
   blocks data loading (`guardLiveDemoFeature` returns `{ ok: false }`), this caused
   continuous re-renders. Each tick re-triggered the side-effectful consent computation,
   amplifying issue 1.

3. **Array param coercion** — `useLocalSearchParams<{ id: string }>()` can return
   `string[]` on production web builds (expo-router internal). Passing an array where
   a string is expected causes downstream type coercion failures.

## Why internal_test Worked

For `internal_test` tenants, `guardLiveDemoFeature` returns `null` (bypass), so
`query.data` loads successfully. The tick timer and consent computation ran with
valid data — the Map mutation was idempotent (entry already existed), masking the
render purity violation.

## Fix Applied

| File | Change |
|------|--------|
| `src/hooks/useEmployeePortalVisitExecution.ts` | Wrapped `consent` in `useMemo` (lines 180-186); gated tick timer behind `hasData` (lines 63-68); added null guard for `assignmentId` in GPS permission effect (lines 45-48) |
| `src/screens/portal/EmployeePortalVisitExecutionScreen.tsx` | Added `Array.isArray` guard for `id` param (line 51) |
| `src/screens/portal/PortalAssignmentDetailScreen.tsx` | Added `Array.isArray` guard for `id` param (lines 31-32) |

## Fix Rules Compliance

- Defensive null handling: YES — all nullable params guarded
- useMemo for consent: YES — no Map mutation during render
- No state updates during render: YES — tick timer gated
- Redirects in useEffect only: YES — no render-time redirects
- Guards preserved: YES — `guardLiveDemoFeature` / `liveServiceGuard` untouched
- No route disable: YES — all routes remain accessible
- No broad UI rebuild: YES — 3 files changed, minimal scope

## Verification

| Gate | Result |
|------|--------|
| contentPortalEnvGate | PASS |
| contentPortalAuthBootstrap | PASS |
| contentPortalE2eSeed | PASS (13/13 steps) |
| contentPortalAuthVerify | PASS |
| contentPortalLiveBackfill --dry-run | PASS |
| contentPortal tests | 51/51 PASS |
| C.14X unit tests | 8/8 PASS |
| TypeScript check | 623 errors (baseline unchanged) |
| Browser E2E | 12/12 PASS |
