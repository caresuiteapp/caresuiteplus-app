# C.14P.1 Fix 2 — Proof Revoke Portal Cache Refresh

## Problem

After revoking a proof's portal release via `revokeAssistProofPortalRelease`, the DB is correctly updated (`portal_visible=false`, `portal_release_status='revoked'`), but the client portal UI continues to show the stale released proof. This is because:

1. The admin-side `VisitProofReviewPanel` calls `onUpdated()` → refreshes admin proof list
2. The client portal `PortalServiceProofsModal` maintains its own React state
3. No cross-component invalidation signal exists between admin and client views

## Fix

Created a lightweight event bus for portal proof cache invalidation:

### New file: `src/lib/portal/portalProofCacheSignal.ts`
- `invalidatePortalProofCache()` — bumps version, notifies subscribers
- `subscribePortalProofCache(listener)` — returns unsubscribe function
- `getPortalProofCacheVersion()` — for testing
- `resetPortalProofCacheSignal()` — test cleanup

### Modified: `src/lib/assist/assistProofApprovalService.ts`
- After `releaseAssistProofToPortal` succeeds → `invalidatePortalProofCache()`
- After `revokeAssistProofPortalRelease` succeeds → `invalidatePortalProofCache()`

### Modified: `src/components/portal/assist/PortalServiceProofsModal.tsx`
- Added `useEffect` that subscribes to `portalProofCacheSignal`
- When signal fires and modal is visible → calls `loadProofs()` to refetch

## Scope

- 1 new file (signal bus), 2 modified files
- No breaking changes
- Listener errors are silently caught so caller is never broken

## Verification

- Unit tests: `c14p1ExecutionGuardAndProofCache.test.ts` — signal version, subscription, source checks
- Browser E2E: `contentPortalC14P1BrowserE2e.mjs` — release visible, revoke hides proof
