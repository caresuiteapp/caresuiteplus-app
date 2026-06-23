# Content Portal Live Rebuild — Auth Testdatenbericht (C.6)

**Datum:** 2026-06-23  
**Runner:** `scripts/audit/contentPortalAuthBootstrap.mjs` (delegiert an `.audit-assist-live-e2e-a42-auth-bootstrap.mjs`)

## Env-Variablen (ohne Werte)

| Variable | Zweck |
|----------|--------|
| `EXPO_PUBLIC_SUPABASE_URL` | Projekt-URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` / Publishable | Client-Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | User confirm / Linkage (optional lokal) |
| `AUDIT_BUSINESS_EMAIL` / `TEST_BUSINESS_EMAIL` | Business Login |
| `AUDIT_BUSINESS_PASSWORD` / `TEST_BUSINESS_PASSWORD` | Business Login |
| `AUDIT_EMPLOYEE_USERNAME` / `TEST_EMPLOYEE_*` | Employee Portal |
| `AUDIT_CLIENT_USERNAME` / `TEST_CLIENT_*` | Client Portal |
| `AUDIT_CLIENT_PORTAL_CODE` / `TEST_CLIENT_PORTAL_CODE` | Client Portal Code |

## Ergebnis

| Prüfpunkt | Status |
|-----------|--------|
| Bootstrap-Skript vorhanden | Ja |
| Secrets in Logs | **Nein** (by design) |
| E2E-Mandant `a4ba83bd-…` | Zielmandant für Portal-Auth |
| LIVE Whitelist Auth-Repair | **Nicht** — nur Testmandant |

## Blocker (falls Auth fehlschlägt)

1. Ungültige Credentials in `.env` → Credentials im Supabase-Dashboard prüfen / User bestätigen
2. Fehlende `SUPABASE_SERVICE_ROLE_KEY` → Admin-Repair nicht möglich
3. Portal-Linkage (`employee_portal_accounts`, `client_portal_access`) → A.4.2 Bootstrap Steps

**Ergebnisdatei:** `.audit-content-portal-auth-bootstrap-results.json`
