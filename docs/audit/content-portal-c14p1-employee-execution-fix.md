# C.14P.1 Fix 1 — Employee Portal Execution Detail Guard Bypass

## Problem

`guardLiveDemoFeature` in `employeePortalExecutionService.ts` blocks ALL tenants in Supabase (live) mode via `blockDemoOnlyInLiveMode`. This prevents the internal_test tenant (Test Pflege GmbH, `a4ba83bd-65db-46cf-8cf7-61492cc78315`) from using execution detail, even though listing works via `portalAppointmentsLiveService` / assignments.

**Impact**: Employee portal execution detail page shows "im Live-Modus noch nicht vollständig angebunden" for internal_test tenants that should have full access for E2E/QA testing.

## Root Cause

`blockDemoOnlyInLiveMode` checks only the global service mode (`getServiceMode() === 'supabase'`) and blocks unconditionally — it does not consult tenant environment settings.

## Fix

Modified `guardLiveDemoFeature` in `src/lib/services/liveServiceGuard.ts`:

1. Added import for `isInternalTest` from `@/lib/environment`
2. After `guardServiceTenant` passes, check `isInternalTest(tenantId)` — if true, return `null` (allow through)
3. Production tenants (e.g. Helferhasen+ UG) still hit `blockDemoOnlyInLiveMode` and remain guarded

```typescript
if (isInternalTest(tenantId)) return null;
```

## Scope

- `src/lib/services/liveServiceGuard.ts` — single line addition + import
- No other services are modified
- Production tenant Helferhasen+ UG (`56180c22-...`) remains fully guarded
- The guard bypass relies on `tenant_environment_settings` mode being `internal_test`

## Verification

- Unit test: `c14p1ExecutionGuardAndProofCache.test.ts` — internal_test passes, production blocked
- Browser E2E: `contentPortalC14P1BrowserE2e.mjs` — execution route loads without guard message
