# ASSIST.STABILIZE.2 — P0 Repair Audit: Visit 3a24ee90

**Date:** 2026-06-29  
**Tenant:** Helferhasen (`56180c22-b894-4fab-b55e-a563c94dd6e7`)  
**Assignment / Visit ID:** `3a24ee90-5dd3-4ab5-9f02-ae74060e0a8a`  
**Employee (Kevin):** `e036ecd3-8ff7-4453-af93-ebbcbd0820f2`  
**Profile (updated_by):** `2b621444-18ff-474e-b60e-3affcab9fb27`

## Symptom

Visit re-broken after STABILIZE.1 repair: production `startService` hung (pre-STABILIZE.2 bundle). Partial write left `assignments.status = started` and `actual_start_at` set without `service_start` time event or `service_started_at`.

## Before repair — `assignments`

| Column | Value |
|--------|-------|
| `status` | `started` |
| `on_the_way_at` | `2026-06-29 06:35:32.852+00` |
| `arrived_at` | `2026-06-29 06:37:15.578+00` |
| `actual_start_at` | `2026-06-29 12:44:42.802971+00` (no service_start event) |
| `actual_end_at` | NULL |

## Before repair — `assist_visits`

| Column | Value |
|--------|-------|
| `execution_status` | `arrived` |
| `canonical_status` | `arrived` |
| `on_the_way_at` | `2026-06-29 06:35:32.852+00` |
| `arrived_at` | `2026-06-29 06:37:15.578+00` |
| `actual_start_at` | NULL |

## Before repair — `assist_visit_execution_state`

| Column | Value |
|--------|-------|
| `current_step` | `in_service` |
| `assignment_status` | `gestartet` |
| `travel_started_at` | `2026-06-29 06:35:32.852+00` |
| `travel_ended_at` | `2026-06-29 06:37:15.578+00` |
| `service_started_at` | **NULL** |
| `service_ended_at` | **NULL** |
| `workflow_consistency_status` | `consistent` (stale) |

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
| `assignments.status` | `started` | Ahead — `actual_start_at` without service_start |
| `assist_visits` | `arrived` | Correct relative to events |
| `execution_state` | `in_service` / `gestartet` | Ahead — no `service_started_at` |
| `assist_time_events` | arrive present, no service_start | Timer truth: **angekommen** |

**Derived target status:** `angekommen` (DB enum: `arrived`)  
**Rule applied:** arrive event present + `service_started_at` missing → reset to angekommen, clear invented `actual_start_at`  
**Repairable:** yes — timestamps from events only, no invented service times

## Repair decision

1. **`repair_assist_visit_workflow_status`** (migration 0213) with `angekommen` → **OK** (profile id `2b621444…` required for `updated_by`; employee id fails FK)
2. **Supplement SQL** (RPC does not reset `actual_start_at`, `current_step`, or timestamp columns):

```sql
UPDATE public.assignments SET actual_start_at = NULL, updated_at = NOW(), updated_by = '2b621444-18ff-474e-b60e-3affcab9fb27'::uuid
WHERE tenant_id = '56180c22-b894-4fab-b55e-a563c94dd6e7' AND id = '3a24ee90-5dd3-4ab5-9f02-ae74060e0a8a';

UPDATE public.assist_visits SET actual_start_at = NULL, updated_at = NOW(), updated_by = '2b621444-18ff-474e-b60e-3affcab9fb27'::uuid
WHERE tenant_id = '56180c22-b894-4fab-b55e-a563c94dd6e7' AND legacy_assignment_id = '3a24ee90-5dd3-4ab5-9f02-ae74060e0a8a';

UPDATE public.assist_visit_execution_state SET
  current_step = 'arrived', service_started_at = NULL, service_ended_at = NULL,
  last_repair_reason = 'ASSIST.STABILIZE.2 P0 supplement — clear actual_start_at, current_step arrived',
  last_auto_repair_at = NOW(), updated_at = NOW()
WHERE tenant_id = '56180c22-b894-4fab-b55e-a563c94dd6e7' AND visit_id = '3a24ee90-5dd3-4ab5-9f02-ae74060e0a8a';
```

**Note:** `on_the_way_at` / `arrived_at` unchanged — sourced from existing events only.

## After repair — verification

| Table | Key fields | After value |
|-------|------------|-------------|
| `assignments` | status | `arrived` |
| `assignments` | on_the_way_at / arrived_at | `06:35:32` / `06:37:15` |
| `assignments` | actual_start_at | **NULL** |
| `assist_visits` | execution_status / canonical_status | `arrived` / `arrived` |
| `assist_visits` | actual_start_at | **NULL** |
| `execution_state` | current_step / assignment_status | `arrived` / `angekommen` |
| `execution_state` | service_started_at | **NULL** |
| `execution_state` | workflow_consistency_status | `consistent` |
| `assist_time_events` | unchanged | drive_start, drive_end, arrive (no service_start) |

**Consistency check:** PASS — visit ready for **Einsatz starten** via STABILIZE.2 app flow.

## RPC gap (follow-up, not STABILIZE.2 scope)

Migration 0213 RPC resets status columns and audit log but does not clear `actual_start_at` or `current_step` when rolling back from in-service without timestamp. Supplement SQL required until RPC extended.

## Next step

After STABILIZE.2 deploy: Kevin opens visit `3a24ee90`, clicks **Einsatz starten**, confirm no hang and full in-service state.
