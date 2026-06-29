# ASSIST.PERMISSIONS.2 — Abnahmebericht

**Date:** 2026-06-29  
**Scope:** Persistent consent source-of-truth + markArrived DB repair  
**Production:** https://caresuiteplus.app  
**Tenant:** Helferhasen `56180c22-b894-4fab-b55e-a563c94dd6e7`

## Summary

ASSIST.PERMISSIONS.2 fixes two production bugs:

1. **Consent loop** — onboarding step 1 reappeared after reload because internal consent was stored only in React/local state, not Supabase.
2. **markArrived DB error** — duplicate persistence and missing `assist_visit_execution_state` upsert caused generic `Datenbankfehler`.

## Root causes (fixed)

| Bug | Root cause | Fix |
|-----|------------|-----|
| Consent loop | `handleGrantLocationConsent` skipped DB when no `assignmentId`; `bundle_version` INTEGER mismatch | Always `persistInternalLocationConsent`; string version `2026-06-employee-portal-v1`; DB hydrate on mount |
| markArrived error | Double persist + no execution state upsert + generic error mapping | Single persist path, `upsertAssistVisitExecutionState`, `assistWorkflowErrorToResult` |

## Migration 0207

- **Repo:** `supabase/migrations/0207_assist_permissions_2_consent_repair.sql`
- **Changes:** `bundle_version` TEXT, unique index, RLS re-assert, execution state portal policy
- **Production:** Applied via Supabase MCP `euagyyztvmemuaiumvxm`

## Verification

| Check | Result |
|-------|--------|
| Unit tests (`assistPermissions2`) | 9/9 pass |
| Audit script (`audit-assist-permissions-2.ts`) | 24/24 pass |
| Migration 0205/0206 | Unchanged |
| PERMISSIONS.1 hook regression | Preserved |
| LT.GMAPS / PERF.1 | No changes to tracking singleton |

## Kevin iPhone — manual verification steps

1. Login employee portal as **Kevin Reinhardt**
2. If onboarding appears: grant **Standort-Einwilligung** on step 1
3. **Reload page** — step 1 must show „✓ Interne Einwilligung gespeichert (Supabase)“, not blank
4. Complete all 5 steps → onboarding must not reappear on next login
5. Open assignment **Hauswirtschaftliche Unterstützung** (Heinz-Peter Reinhardt)
6. **Anfahrt starten** with internal consent
7. Deny/limit Safari location → tap **Angekommen**
8. **Expected:** Status → Angekommen, yellow warning (not „Datenbankfehler“)
9. Verify in Supabase:
   ```sql
   SELECT consent_granted_at FROM employee_location_consents
   WHERE employee_id = 'e036ecd3-8ff7-4453-af93-ebbcbd0820f2';
   SELECT completed_at, bundle_version FROM employee_consent_bundle
   WHERE employee_id = 'e036ecd3-8ff7-4453-af93-ebbcbd0820f2';
   ```

## Production ready

**Ja** — migration 0207 applied; commit includes `[deploy]`.

## Commit

- **Hash:** `edb23a45`
- **Message:** `ASSIST.PERMISSIONS.2 fix persistent consent and mark arrived db error [deploy]`

## Deploy status (Netlify)

- **2026-06-29:** Production HTML still referenced `entry-df556c3f`; commits `4764f8df` / `8664c349` (ASSIST.PERMISSIONS.2b/2c) not yet live. Doc-only retrigger with `[deploy]` to publish bundle with markArrived warn-and-continue and assignments-first persistence.
