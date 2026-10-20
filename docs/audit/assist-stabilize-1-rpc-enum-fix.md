# ASSIST.STABILIZE.1.0213 — Repair RPC Enum Cast Fix

**Date:** 2026-06-29  
**Project:** CareSuite+ (`euagyyztvmemuaiumvxm`)  
**Production:** https://caresuiteplus.app  
**Prior deploy:** `82393788` (STABILIZE.1 — not reverted)

## Root cause (exact)

| Item | Detail |
|------|--------|
| **RPC** | `public.repair_assist_visit_workflow_status` (migration 0212) |
| **Parameter** | `p_target_status TEXT` |
| **Failure** | `42804: column "status" is of type assignment_status but expression is of type text` |
| **Cause** | 0212 set `assignments.status = v_remote_status` where `v_remote_status` is plain TEXT |
| **Passed values** | App sends German `AssignmentStatus` (e.g. `angekommen`); manual retry used English `arrived` — both failed |
| **Target column** | `assignments.status` → PostgreSQL enum `public.assignment_status` |
| **Other columns** | `assist_visits.execution_status`, `canonical_status` → TEXT (English); `assist_visit_execution_state.assignment_status` → TEXT (German) |

## Enum / column types

### `public.assignment_status` (enum on `assignments.status`)

`planned`, `confirmed`, `on_the_way`, `arrived`, `started`, `paused`, `finished`, `documentation_open`, `signature_open`, `completed`, `cancelled`, `no_show`

### German app statuses (`AssignmentStatus` / execution_state.assignment_status)

`geplant`, `bestaetigt`, `unterwegs`, `angekommen`, `gestartet`, `pausiert`, `beendet`, `dokumentation_offen`, `unterschrift_offen`, `abgeschlossen`, `storniert`, `nicht_erschienen`

### Workflow step aliases (accepted as repair target)

`en_route` → `on_the_way` / `unterwegs`  
`in_service`, `in_progress` → `started` / `gestartet` (guarded)

## Fixed validation logic (migration 0213)

1. **`normalize_assist_workflow_repair_status(p_target_status)`** — central lookup table; rejects unknown values with clear `EXCEPTION` (no blind `::assignment_status` cast).
2. **`repair_assist_visit_workflow_status`** — uses normalized typed values:
   - `assignments.status = assignment_enum` (enum)
   - `assist_visits.execution_status / canonical_status = visit_status` (English TEXT)
   - `assist_visit_execution_state.assignment_status = german_status` (German TEXT)
3. **In-service guard** — repair to `gestartet`/`started`/`in_service`/`in_progress`/`pausiert`/post-service statuses requires `service_started_at` on execution state **OR** `p_allow_service_without_timestamp = TRUE` (admin time correction).
4. **No timestamp invention** — RPC does not touch `on_the_way_at`, `arrived_at`, `actual_start_at`, etc.
5. **Audit** — writes `assignment_audit_events` (`action = workflow_repair`) plus keeps `workflow_consistency_status`, `last_auto_repair_at`, `last_repair_reason`.
6. **SECURITY DEFINER** retained.

## Migration

- **File:** `supabase/migrations/0213_fix_repair_assist_visit_workflow_status_enum_cast.sql`
- **Production applied:** `20260629074020` / `fix_repair_assist_visit_workflow_status_enum_cast`
- **Fix marker:** `ASSIST.STABILIZE.1.0213`

## Test outputs

### Vitest

```
npx vitest run assistStabilize1 assistWorkflow2 assistWorkflow3
→ 3 files, 15 tests passed
```

### Audits

```
npx tsx scripts/audit-assist-stabilize-1.ts → 26/26
npx tsx scripts/audit-assist-repair-rpc-enum.ts → 16/16 (static; live skipped without env creds in CI shell)
```

### Production SQL smoke (NOT Kevin `3a24ee90`)

Temporary fixture `e2132132-1321-4213-8213-000000000001`:

| Step | Result |
|------|--------|
| Repair `angekommen` from `started` | OK — `assignments.status = arrived`, visit `arrived`, ES `angekommen` |
| Repair `en_route` | OK — `on_the_way` / `unterwegs` |
| Fixture cleanup | Deleted |

Kevin visit `3a24ee90` after smoke: `arrived` / `angekommen` / `consistent` — **unchanged**.

### normalize live checks

```sql
SELECT * FROM normalize_assist_workflow_repair_status('angekommen');
-- arrived / arrived / angekommen / false

SELECT * FROM normalize_assist_workflow_repair_status('en_route');
-- on_the_way / on_the_way / unterwegs / false
```

## Commit & deploy

- **Message:** `ASSIST.STABILIZE.1 fix repair rpc enum cast [deploy]`
- **Commit hash:** `a68ca676`
- **Deploy status:** Netlify production live — bundle `entry-ed4a3a8e5b8ec67113ab1439503d9232.js` (prior STABILIZE.1: `82393788`)
- **Bundle note:** SQL-only RPC fix; app bundle contains `repair_assist_visit_workflow_status` caller (unchanged `repairWorkflowState.ts`). New deploy hash confirms publish; DB fix is migration 0213.

## Repair-RPC production ready

**Ja** — migration 0213 live, smoke passed, Kevin visit intact, enum cast + validation in place.
