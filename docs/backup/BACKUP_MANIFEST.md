# CareSuite+ Backup Manifest

**Created:** 2026-06-19  
**Branch:** `recovery/hybrid-live-restore`  
**Git remote:** https://github.com/caresuiteapp/caresuiteplus-app.git (private)

## Git snapshot

| Field | Value |
|-------|--------|
| Anchor commit (at manifest creation) | `7283409` — fix: upsert client portal module assignments on save |
| Tag | `backup-2026-06-19` (see git tags) |
| Working tree | clean |

Restore code:

```bash
git fetch origin
git checkout recovery/hybrid-live-restore
git checkout backup-2026-06-19   # optional tagged restore point
```

## Supabase project

| Field | Value |
|-------|--------|
| Project ref | `euagyyztvmemuaiumvxm` |
| URL | `https://euagyyztvmemuaiumvxm.supabase.co` |
| Applied migrations (live) | **58** (see list below) |
| Migration SQL in repo | `supabase/migrations/*.sql` (**129 files** — source of truth for schema) |

### Live-applied migrations (2026-06-19)

1. create_profile_on_signup_trigger  
2. fix_handle_new_user_trigger  
3. fix_handle_new_user_fullname_generated  
4. rn_pilot_has_permission  
5. communication_center_rn / rls / storage_buckets  
6. ti_module_rn_tables  
7. auth_access_portals_and_user_management / rls / hardening / remote_e2e_fixes  
8. security_advisor_remediation  
9. storage_tenant_isolation_and_warn_remediation  
10. profiles_select_own_auth_user  
11. cost_carrier_rls_grants  
12. client_intake_documents / templates_v2 / completion_rls  
13. client_record_extended_tables / portal_username_access  
14. german_spelling_intake_templates  
15. client_record_documents_intake / office_documents_schema  
16. appointments_table_rls_grants / office_module_assignments_live_v2  
17. qm_module_live / office_audit_log_live  
18. assist_task_catalog / assignments_production_live  
19. client_scheduling_wishes / employee_catalogs / avatars  
20. employees_department / create_rls_live  
21. inventory_prepared / tenant_branding / tenant_settings_rls  
22. office_soft_delete enums+rls  
23. client_care_contexts / contacts_edit / owner_clients_permissions  
24. intake_template_merge_context / tenant_billing_settings  
25. client_intake_extended / contact_care_service  
26. client_documents_upload_rls_live  
27. user_profile_avatars  
28. office_messaging live + phase2a/2b/3 + final  
29. broadcast_notifications / notifications_table / broadcast_rls  
30. message_attachments_voice  
31. **portal_client_name_rls**  
32. **adaptive_portal_engine**

### Edge functions (live, 2026-06-19)

| Function | Version | verify_jwt |
|----------|---------|------------|
| register-business-tenant | 7 | false |
| employee-portal-login | 3 | false |
| portal-code-login | 3 | false |
| client-portal-login | 4 | false |

Source in repo: `supabase/functions/<name>/index.ts`

Additional function sources in repo (deploy separately if needed):

- connect-provider-proxy, ti-provider-proxy  
- payment-webhook, send-document-email, send-document-fax  
- notify-data-subject-request-admin  

## Environment variables (names only — never commit values)

- `EXPO_PUBLIC_DEMO_MODE` — must be `false` for live  
- `EXPO_PUBLIC_SUPABASE_URL`  
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`  
- `SUPABASE_SERVICE_ROLE_KEY` (server/CI only)  
- Netlify: see `netlify.toml` for build-time public vars  

Store secrets in password manager / Supabase dashboard / Netlify env — not in git.

## Database data backup (manual)

Schema is fully recoverable from `supabase/migrations/` + applied migration history.

**Row data (tenants, clients, profiles):** use one of:

1. Supabase Dashboard → Project Settings → Database → Backups (Pro plan)  
2. `pg_dump` with connection string from dashboard (includes PII — encrypt at rest)  
3. Supabase CLI after `supabase login` + link: `supabase db dump --linked -f backup.sql`

This manifest does **not** include a data dump (PII / size).

## Other important paths in git

- `app/` — Expo Router routes  
- `src/` — application code  
- `assets/` — images, robot logo  
- `docs/architecture/` — adaptive portal engine, redesign roadmap  
- `docs/audit/` — recovery audits  
- `netlify.toml` — deploy config (no auto-deploy without `[deploy]`)  

## Recovery checklist

1. Clone private repo, checkout branch or tag  
2. Copy `.env` from secure store (demo off, Supabase URL/key)  
3. `npm install`  
4. Apply any repo migrations not yet on target Supabase: compare `supabase/migrations/` vs dashboard  
5. Deploy edge functions from `supabase/functions/` if code changed  
6. `npm run web` or Netlify deploy with `[deploy]` when ready  
