# P0-A Schema Drift Matrix

Generated: 2026-06-24

## Table Status

| Table | Remote DB | Realtime Presets | Code Usage | Status |
|-------|-----------|-----------------|------------|--------|
| time_entries | ✅ | ✅ | ✅ | Aligned |
| employee_time_entries | ❌ | ❌ | ✅ | Phantom (code only, not in DB) |
| assignment_executions | ❌ | ✅ | ✅ | Phantom (code+presets, not in DB) |
| assignments | ✅ | ✅ | ✅ | Aligned |
| assist_visits | ✅ | ❌ | ✅ | Aligned (no realtime needed) |
| documents | ✅ | ❌ | ✅ | Aligned (no realtime needed) |
| client_documents | ✅ | ✅ | ✅ | Aligned |
| message_threads | ✅ | ✅ | ✅ | Aligned |
| messages | ✅ | ❌ | ✅ | Aligned (no realtime needed) |
| proofs | ❌ | ❌ | ✅ | Phantom (code only, not in DB) |
| portal_releases | ❌ | ❌ | ✅ | Phantom (code only, not in DB) |
| live_operation_events | ❌ | ✅ | ✅ | Phantom (code+presets, not in DB) |
| trips | ✅ | ✅ | ✅ | Aligned |
| trip_gps_events | ✅ | ✅ | ✅ | Aligned |
| employee_absences | ❌ | ✅ | ✅ | Phantom (code+presets, not in DB) |

## Phantom Tables (exist in code but not remote DB)

These tables are referenced in code/presets but do not exist in the remote Supabase schema:

1. **employee_time_entries** — Used in code, likely planned migration
2. **assignment_executions** — Used in realtime presets + code
3. **proofs** — Used in code (portal proof workflow)
4. **portal_releases** — Used in code (portal release management)
5. **live_operation_events** — Used in realtime presets + code
6. **employee_absences** — Used in realtime presets + code

## Impact Assessment

- Phantom tables use `fromUnknownTable()` or string-based realtime subscriptions → no typecheck errors
- Realtime presets use `table: string` type → phantom tables don't break typecheck
- Code using typed queries against these tables uses escape hatches (untypedTable utility)

## Recommendations

1. Apply pending migrations for `assignment_executions`, `live_operation_events`, `employee_absences` (most critical — used in realtime)
2. Verify `proofs` and `portal_releases` migration status
3. Consider removing `employee_time_entries` if superseded by `time_entries`
