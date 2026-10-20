# P0-D — Remaining Errors

**Date**: 2026-06-25
**Estimated remaining**: ~70–115 errors (shell unavailable for exact count)

## Known Remaining Categories

### 1. Complex Union / Overload Inference (~15–25)
- `usePostLoginNavigation.ts` — TS2590 "union type too complex" (router.replace)
- `redirects.ts` — TS2590 same pattern
- Various `TS2769` overload failures in StyleSheet-heavy components

### 2. Supabase / Database Typing (~10–15)
- `messagethreadservice.ts` — `RejectExcessProperties` deep type mismatch
- Various `fromUnknownTable` return type inference gaps
- RPC function name/param casts (already addressed where found)

### 3. Portal / Appointment Complex Types (~5–10)
- `appointmentService.ts` — `liveVisit` projection types (partially addressed)
- `portalAppointmentsLiveService.ts` — same pattern (partially addressed)
- `ClientPortalAssistLiveVisitProjection` nested type

### 4. Third-Party / External (~5–8)
- `html2canvas` / `jspdf` module resolution (addressed via @ts-expect-error)
- `expo-router` `Href` type complexity
- React Navigation typing gaps

### 5. Pre-existing / Low-Priority (~10–20)
- Demo data shape drift (ongoing as types expand)
- Test helper argument mismatches (artifact of fast iteration)
- Minor style typing edge cases in web-only code paths

## Out of Scope
- Phantom tables (employee_time_entries, assignment_executions, proofs, etc.)
- tsconfig loosening
- Runtime test failures not caused by P0-D changes
- K.6, invoice, LiveBackfill features

## Next Steps (P0-E candidates)
1. Address TS2590 "union too complex" via explicit type annotations
2. Create `jspdf.d.ts` declaration file to eliminate @ts-expect-error
3. Systematic Supabase `fromUnknownTable` return type cleanup
4. Portal appointment detail type unification
