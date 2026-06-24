# C.14X — 31-Point Checklist

**Date**: 2026-06-24

## Pre-Commit Checks

- [x] Root cause identified (render-time side-effect + unconditional tick timer)
- [x] Fix is minimal scope (3 files, no UI rebuild)
- [x] internal_test tenant bypass preserved (guard unchanged)
- [x] Production tenants stay guarded (no bypass removal)
- [x] No conditional hooks introduced
- [x] Hook call order unchanged across all render paths
- [x] No secrets in committed files
- [x] TypeScript check: 623 errors (matches baseline)
- [x] contentPortal tests: 51/51 pass
- [x] C14X-specific tests: 8/8 pass

## Guard & Service Layer

- [x] `guardLiveDemoFeature` logic untouched
- [x] `liveServiceGuard.ts` not modified
- [x] `employeePortalExecutionService.ts` not modified
- [x] `blockDemoOnlyInLiveMode` behaviour preserved
- [x] `isInternalTest` check unmodified

## React / Hook Safety

- [x] `consent` wrapped in `useMemo` (no side-effect during render)
- [x] Tick timer gated behind data availability
- [x] `getEmployeePortalGpsPermissionStatus` guarded by `assignmentId` check
- [x] `useLocalSearchParams` result safely coerced (array-safe)
- [x] ErrorState / notFound / loading paths render correctly
- [x] No redirect during render added

## Deployment Safety

- [x] No K.6 / invoice changes
- [x] No LiveBackfill Apply
- [x] No integration changes
- [x] Fix commit message without [deploy]
- [x] Deploy commit separate with [deploy]

## Files Changed

- [x] `src/hooks/useEmployeePortalVisitExecution.ts`
- [x] `src/screens/portal/EmployeePortalVisitExecutionScreen.tsx`
- [x] `src/screens/portal/PortalAssignmentDetailScreen.tsx`
- [x] `src/__tests__/contentPortal/c14xEmployeeExecutionCrash.test.ts` (new)
- [x] `scripts/audit/contentPortalC14XEmployeeExecutionCrashE2e.mjs` (new)
- [x] `docs/audit/content-portal-c14x-*.md` (3 files, new)
