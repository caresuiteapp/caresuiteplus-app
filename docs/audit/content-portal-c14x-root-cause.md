# C.14X — Employee Execution Production Render Crash Fix

**Date**: 2026-06-24
**Phase**: C.14X (Content Portal — Employee Execution React #421 Fix)
**Severity**: P0 (production crash)

## Root Cause

The `useEmployeePortalVisitExecution` hook had two issues that combined to crash
the React render cycle on production:

1. **Side-effect during render**: The `consent` variable was computed directly
   during render via `getEmployeePortalLocationConsent(tenantId, assignmentId)`.
   Internally, this calls `getEntry()` which mutates an external Map store
   (`TRACKING_STORE.set(key, entry)`) when creating a new tracking entry. In
   React 18 production builds, side-effects during render cause reconciliation
   errors.

2. **Unconditional tick timer**: A 1-second `setInterval` ran regardless of
   whether execution data loaded. For production tenants where the guard blocks
   data loading, this caused continuous re-renders with each tick triggering the
   side-effectful `consent` computation — amplifying issue #1.

3. **Array param edge case**: `useLocalSearchParams<{ id: string }>()` can
   return `string[]` on production web builds due to expo-router's internal
   routing. Passing an array where a string is expected causes downstream type
   coercion issues.

## Why internal_test worked

For `internal_test` tenants, `guardLiveDemoFeature` returns `null` (bypass), so
`query.data` loads successfully. The tick timer and consent computation ran with
valid data, and the component followed the "success" render path. The Map
mutation still occurred but was idempotent (entry already existed from the
query), masking the issue.

## Fix Summary

| File | Change |
|------|--------|
| `src/hooks/useEmployeePortalVisitExecution.ts` | Wrapped `consent` in `useMemo`; gated tick timer behind `hasData`; added null guard for `assignmentId` in GPS permission effect |
| `src/screens/portal/EmployeePortalVisitExecutionScreen.tsx` | Added `Array.isArray` guard for `id` param |
| `src/screens/portal/PortalAssignmentDetailScreen.tsx` | Added `Array.isArray` guard for `id` param |

## Verification

- `internal_test` tenants still access execution route without crash
- Production tenants see graceful "Live-Modus" guard error (no crash)
- Tick timer only runs when data is available (no wasted re-renders)
- Consent lookup is memoized (no Map mutation during render)
- All 51 contentPortal tests pass
- Typecheck: 623 (baseline unchanged)
