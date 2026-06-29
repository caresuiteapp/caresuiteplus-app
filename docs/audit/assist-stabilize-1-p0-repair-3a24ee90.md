# ASSIST.STABILIZE.1 — P0 Repair Audit: Visit 3a24ee90

**Date:** 2026-06-29  
**Tenant:** Helferhasen (`56180c22-b894-4fab-b55e-a563c94dd6e7`)  
**Assignment / Visit ID:** `3a24ee90-5dd3-4ab5-9f02-ae74060e0a8a`  
**Employee (Kevin):** `e036ecd3-8ff7-4453-af93-ebbcbd0820f2`  
**Profile (updated_by):** `2b621444-18ff-474e-b60e-3affcab9fb27`

## Symptom

Visit stuck after Ankunft: DB status advanced to in-service (`started` / `gestartet`) without `service_start` time event. Employee portal showed inconsistent state — Einsatz timer not started, workflow blocked.

## Before repair — `assignments`

| Column | Value |
|--------|-------|
| `status` | `started` (English enum → UI `gestartet`) |
| `on_the_way_at` | **NULL** |
| `arrived_at` | **NULL** |
| `actual_start_at` | `2026-06-29 06:37:23.844979+00` (set without service_start) |
| `actual_end_at` | NULL |
| `updated_at` | `2026-06-29 06:37:23.844979+00` |

## Before repair — `assist_visits`

| Column | Value |
|--------|-------|
| `execution_status` | `pending` |
| `canonical_status` | `planned` |
| `on_the_way_at` | **NULL** |
| `arrived_at` | **NULL** |
| `actual_start_at` | **NULL** |

## Before repair — `assist_visit_execution_state`

| Column | Value |
|--------|-------|
| `current_step` | `in_service` |
| `assignment_status` | `gestartet` |
| `travel_started_at` | `2026-06-29 06:35:32.852+00` ✓ |
| `travel_ended_at` | `2026-06-29 06:37:15.578+00` ✓ |
| `service_started_at` | **NULL** |
| `service_ended_at` | **NULL** |
| `workflow_consistency_status` | **NULL** |

## Before repair — `assist_time_events`

| event_type | occurred_at |
|------------|-------------|
| `drive_start` | `2026-06-29 06:35:32.852+00` |
| `drive_end` | `2026-06-29 06:37:15.578+00` |
| `arrive` | `2026-06-29 06:37:15.578+00` |
| `service_start` | **missing** |

## Inconsistency analysis

| Source | Status / step | Issue |
|--------|---------------|-------|
| `assignments.status` | `started` | Ahead of timestamps — no service_start |
| `assist_visits` | `pending` / `planned` | Out of sync with assignment + events |
| `execution_state` | `in_service` / `gestartet` | Ahead — no `service_started_at` |
| `assist_time_events` | arrive ✓, no service_start | Timer truth: **angekommen** |

**Derived target status:** `angekommen` (DB enum: `arrived`)  
**Rule applied:** arrive event present + service_started_at missing → reset to angekommen  
**Repairable:** yes — timestamps unambiguous, no invented times

## Repair decision

1. Attempt `repair_assist_visit_workflow_status` RPC with `angekommen` → **FAILED** (`42804`: `assignments.status` is enum `assignment_status`, RPC assigns TEXT without cast)
2. Attempt RPC with `arrived` → **FAILED** (same enum cast bug in migration 0212)
3. **Manual equivalent SQL** (audited, same intent as RPC + step correction):

```sql
BEGIN;

UPDATE public.assignments SET
  status = 'arrived'::public.assignment_status,
  on_the_way_at = '2026-06-29 06:35:32.852+00'::timestamptz,  -- from drive_start event
  arrived_at = '2026-06-29 06:37:15.578+00'::timestamptz,      -- from arrive event
  actual_start_at = NULL,                                        -- cleared: no service_start
  updated_at = NOW(),
  updated_by = '2b621444-18ff-474e-b60e-3affcab9fb27'::uuid
WHERE tenant_id = '56180c22-b894-4fab-b55e-a563c94dd6e7'
  AND id = '3a24ee90-5dd3-4ab5-9f02-ae74060e0a8a';

UPDATE public.assist_visits SET
  execution_status = 'arrived',
  canonical_status = 'arrived',
  on_the_way_at = '2026-06-29 06:35:32.852+00'::timestamptz,
  arrived_at = '2026-06-29 06:37:15.578+00'::timestamptz,
  actual_start_at = NULL,
  updated_at = NOW(),
  updated_by = '2b621444-18ff-474e-b60e-3affcab9fb27'::uuid
WHERE tenant_id = '56180c22-b894-4fab-b55e-a563c94dd6e7'
  AND legacy_assignment_id = '3a24ee90-5dd3-4ab5-9f02-ae74060e0a8a';

UPDATE public.assist_visit_execution_state SET
  current_step = 'arrived',
  assignment_status = 'angekommen',
  workflow_consistency_status = 'consistent',
  last_auto_repair_at = NOW(),
  last_repair_reason = 'ASSIST.STABILIZE.1 P0 manual repair visit 3a24ee90 — RPC failed (enum cast); reset gestartet→angekommen per arrive event, no service_start',
  updated_at = NOW()
WHERE tenant_id = '56180c22-b894-4fab-b55e-a563c94dd6e7'
  AND visit_id = '3a24ee90-5dd3-4ab5-9f02-ae74060e0a8a';

COMMIT;
```

**Note:** `on_the_way_at` / `arrived_at` backfilled from existing `assist_time_events` only — no invented timestamps. `service_started_at` left NULL.

## After repair — verification

| Table | Key fields | After value |
|-------|------------|-------------|
| `assignments` | status | `arrived` |
| `assignments` | on_the_way_at / arrived_at | `06:35:32` / `06:37:15` ✓ |
| `assignments` | actual_start_at | **NULL** ✓ |
| `assist_visits` | execution_status / canonical_status | `arrived` / `arrived` |
| `assist_visits` | arrived_at | `06:37:15` ✓ |
| `execution_state` | current_step / assignment_status | `arrived` / `angekommen` |
| `execution_state` | service_started_at | **NULL** ✓ |
| `execution_state` | workflow_consistency_status | `consistent` |
| `assist_time_events` | unchanged | drive_start, drive_end, arrive (no service_start) |

**Consistency check:** PASS — status aligns with time events; visit ready for **Einsatz starten** via STABILIZE.1 app flow.

## Remaining RPC risk

Migration 0212 `repair_assist_visit_workflow_status` cannot run until enum cast added (`status = v_remote_status::public.assignment_status`). App auto-repair falls back to `assignmentSupabaseRepository.updateStatus` when RPC fails.

## Next step (Kevin, production)

After STABILIZE.1 deploy: open visit `3a24ee90`, confirm info hint + **Einsatz starten**, complete workflow through finalize.
