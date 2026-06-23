# Content Portal C.12R.3 — Audit Client Factory & Service Role Grants

**Datum:** 2026-06-23  
**HEAD (vor Commit):** `0523dfb`  
**Status:** **TEILWEISE GRÜN** — Invalid-API-Key behoben; Permission-Denied bis Migration 0163 manuell angewendet

## Git-Precheck

| Prüfpunkt | Ergebnis |
|-----------|----------|
| Branch `main` | ja |
| sync mit `origin/main` | ja (`0523dfb`) |
| staged Dateien | keine |
| `.env` staged | nein |

## Root Cause E2E-Seed

`contentPortalE2eSeed.mjs` nutzte das Business-JWT sowohl als `apikey` als auch als `Authorization`-Bearer für PostgREST-Upserts. Supabase erwartet als `apikey` den Anon-/Publishable- oder Service-Role-Key — nicht das User-JWT. Ergebnis: `Invalid API key`.

**Fix:** Zentrale Factory `scripts/audit/lib/auditSupabaseClient.mjs` — Public-Client nur für Login, Admin-Client (Service Role) für DB-Operationen.

## Env-Gate

| Lauf | Ergebnis |
|------|----------|
| vorher (C.12R.2) | grün — `businessLogin: true`, `serviceRolePresent: true` |
| nach Factory-Update | grün — identisch |

Datei: `.audit-content-portal-c12-env-gate.json`

## Auth-Bootstrap

| Check | Ergebnis |
|-------|----------|
| `contentPortalAuthBootstrap.mjs` | grün (`exitCode: 0`) |

## E2E-Seed

| Check | Ergebnis |
|-------|----------|
| Invalid API key | **behoben** — Fehlerklasse jetzt `permission_denied` statt `invalid_api_key` |
| Seed gesamt | **rot** — `42501` auf `tenant_environment_settings`, `assist_visits`, `assist_visit_proofs`, `client_portal_settings` |

Fehlerformat (ohne Secrets):

```json
{
  "clientType": "admin",
  "envKeyName": "SUPABASE_SERVICE_ROLE_KEY",
  "errorClass": "permission_denied"
}
```

Datei: `.audit-content-portal-e2e-seed-results.json`

## Auth-Verify

| Check | Ergebnis |
|-------|----------|
| Business-Login | ja |
| Tenant verknüpft | ja |
| Employee-Portal | nein (bekannt aus Bootstrap) |
| Client-Portal | ja |
| Script `ok` | ja |

Datei: `.audit-content-portal-c12-auth-verify.json`

## Live-Backfill Dry-Run

| Check | Ergebnis |
|-------|----------|
| `--dry-run` | **rot** |
| Fehler | `permission denied for table clients` |
| Helferhasen+ UG `56180c22-…` | nur SELECT-Versuch, **kein Apply** |

Datei: `.audit-content-portal-live-backfill-results.json`

## Migration 0163

**Datei:** `supabase/migrations/0163_service_role_content_portal_grants.sql`

| Check | Ergebnis |
|-------|----------|
| Erstellt | ja |
| Remote angewendet | **nein** — manuell erforderlich |
| Destruktionsfrei | ja (nur `GRANT USAGE`, `GRANT SELECT/INSERT/UPDATE`, `DO $$` + `to_regclass`) |
| Kein DELETE/UPDATE/INSERT/TRUNCATE/DROP/RLS-disable | ja |

Betroffene Tabellen (IF EXISTS): `clients`, `employees`, `tenants`, `profiles`, `tenant_users`, `roles`, `products`, `tenant_products`, `tenant_environment_settings`, `assist_visits`, `assist_visit_proofs`, `client_portal_settings`, `client_portal_access`, `employee_portal_accounts` + Sequences.

### Manuelle Anwendung (wenn freigegeben)

```bash
supabase db push
# oder gezielt:
supabase migration up --include-all
```

Danach erneut:

```bash
node scripts/audit/contentPortalE2eSeed.mjs
node scripts/audit/contentPortalLiveBackfill.mjs --dry-run
```

## Production-Schutz

| Mandant | Schutz |
|---------|--------|
| Helferhasen+ UG `56180c22-…` | ja — nur Dry-Run SELECT, kein Upsert |
| Test Pflege GmbH `a4ba83bd-…` | E2E-Seed-Ziel (internal_test) |
| Musterpflege Digital | unverändert |

Kein Live-Backfill-Apply, keine K.6, keine Rechnungen.

## Tests & Typecheck

| Gate | Ergebnis |
|------|----------|
| Content Portal + portalSyncFlow | **21/21 grün** (`.audit-test-content-portal-c12r3-client-grants.log`) |
| Typecheck | **FAIL** — vorbestehende Repo-Fehler, nicht durch C.12R.3 verursacht (`.audit-typecheck-content-portal-c12r3-client-grants.log`) |

## Geänderte Dateien

- `scripts/audit/lib/auditSupabaseClient.mjs` (neu)
- `scripts/audit/contentPortalEnvGate.mjs`
- `scripts/audit/contentPortalAuthBootstrap.mjs`
- `scripts/audit/contentPortalE2eSeed.mjs`
- `scripts/audit/contentPortalAuthVerify.mjs`
- `scripts/audit/contentPortalLiveBackfill.mjs`
- `supabase/migrations/0163_service_role_content_portal_grants.sql` (neu)

## Fazit

Die Audit-Skripte nutzen jetzt eine einheitliche Supabase-Client-Factory mit konsistenten Env-Key-Fallbacks. Der E2E-Seed-Fehler `Invalid API key` ist behoben. Verbleibende Blocker sind fehlende `service_role`-GRANTs auf Remote — behoben durch Migration 0163, die lokal erstellt und verifiziert, aber **nicht** auf Remote angewendet wurde.
