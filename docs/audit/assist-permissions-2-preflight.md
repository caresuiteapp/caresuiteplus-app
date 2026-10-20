# ASSIST.PERMISSIONS.2 — Preflight Audit

**Date:** 2026-06-29  
**Tenant:** Helferhasen (`56180c22-b894-4fab-b55e-a563c94dd6e7`)  
**Production:** https://caresuiteplus.app  
**Employee:** Kevin Reinhardt (`e036ecd3-8ff7-4453-af93-ebbcbd0820f2`)

## Production migrations verified (Supabase MCP `euagyyztvmemuaiumvxm`)

| Migration | Name | Status |
|-----------|------|--------|
| 0205 | `0205_employee_location_consent_persist` | Applied `20260629042159` |
| 0206 | `0206_employee_permission_onboarding` | Applied `20260629042526` |
| 0207 | `0207_assist_permissions_2_consent_repair` | Applied via MCP (this release) |

```sql
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE name LIKE '%0205%' OR name LIKE '%0206%' OR name LIKE '%0207%'
ORDER BY version;
```

## Bug 1 — Consent onboarding loop (Schritt 1 von 5 after reload)

### Symptom

Permission onboarding step 1 reappears after page reload even though internal location consent was granted in the UI.

### Production evidence (Kevin)

```sql
SELECT e.id, elc.consent_granted_at, ecb.completed_at, ecb.bundle_version
FROM employees e
LEFT JOIN employee_location_consents elc ON elc.employee_id = e.id AND elc.tenant_id = e.tenant_id
LEFT JOIN employee_consent_bundle ecb ON ecb.employee_id = e.id AND ecb.tenant_id = e.tenant_id
WHERE e.id = 'e036ecd3-8ff7-4453-af93-ebbcbd0820f2';
```

**Result:** `consent_granted_at = NULL`, `completed_at = NULL` — no Supabase rows despite UI showing consent.

### Root cause chain

| Step | File | Issue |
|------|------|-------|
| 1 | `EmployeePermissionOnboarding.tsx` | Without `assignmentId`, `handleGrantLocationConsent` only set local state — **no DB write** |
| 2 | `employeePermissionPersistence.ts` | Queried `bundle_version = 1` (INTEGER) while onboarding gate expected string version |
| 3 | `needsPermissionOnboarding` | Returned `true` on any fetch error → re-opened modal |
| 4 | Component state | `locationConsentGranted` was React-only — lost on reload |

**Root cause:** Supabase was not the source of truth for internal consent; localStorage/React state drove UI while `employee_location_consents` and `employee_consent_bundle` stayed empty.

### Fix (ASSIST.PERMISSIONS.2)

- `persistInternalLocationConsent` → always upsert `employee_location_consents`
- `getEmployeeConsentBundle` / `saveEmployeeConsentBundle` with version `2026-06-employee-portal-v1` + read-back
- Onboarding hydrates from DB on mount via `getEmployeeConsentBundle`
- Migration 0207: `bundle_version` TEXT + unique `(tenant_id, employee_id, bundle_version)`
- Browser permission denied does **not** affect `needsPermissionOnboarding` (bundle-only gate)

## Bug 2 — markArrived generic „Datenbankfehler“

### Symptom

Tap **Anfahrt läuft — Angekommen** shows generic `Datenbankfehler` instead of saving arrived status.

### Root cause chain

| Step | File | Issue |
|------|------|-------|
| 1 | `markArrived.ts` | Called `persistEmployeePortalStatusTransition` **and** `transitionLiveEmployeePortalAssignment` persisted again (duplicate, conflicting) |
| 2 | `markArrived.ts` | No `assist_visit_execution_state` upsert — RLS write failures surfaced as generic DB errors |
| 3 | `toGermanSupabaseError` | Returned `Datenbankfehler: Bitte erneut versuchen.` (code `42703` / RLS) without workflow context |
| 4 | `assist_visit_execution_state` | Portal employee policy existed but arrival path never upserted state |

**Root cause:** Arrival persistence was split/duplicated without execution-state upsert; failures mapped to generic `Datenbankfehler`.

### Fix (ASSIST.PERMISSIONS.2)

- `markArrived`: transition first with `skipStatusPersistence`, then single persist with arrival audit options
- `upsertAssistVisitExecutionState` — idempotent upsert on `assist_visit_execution_state`
- Idempotent early return when already `angekommen`
- `assistWorkflowErrorToResult` instead of generic `Datenbankfehler`
- Migration 0207: re-assert portal RLS on `assist_visit_execution_state`

## assist_time_events constraint (verified production)

```sql
SELECT pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'public.assist_time_events'::regclass AND conname = 'assist_time_events_type_check';
```

Includes `arrived_without_gps`, `arrived_manual` (from 0206).

## Regression scope

- LT.GMAPS.4/5 permanent consent path preserved
- PERF.1 GPS singleton unchanged
- ASSIST.PERMISSIONS.1 hook fix (`handleMarkArrived` no GPS block) preserved
