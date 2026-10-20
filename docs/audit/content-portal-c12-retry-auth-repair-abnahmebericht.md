# Content Portal C.12R — Auth Repair Abnahme

**Datum:** 2026-06-23  
**HEAD:** `7e8d905`  
**Status:** **BLOCKIERT** — Env-Gate nicht grün

## Git-Precheck

| Prüfpunkt | Ergebnis |
|-----------|----------|
| Branch `main` | ja |
| sync mit `origin/main` | ja (`7e8d905`) |
| staged Dateien | keine |
| `.env` staged | nein |

## Env-Gate (`contentPortalEnvGate.mjs`)

| Check | Ergebnis |
|-------|----------|
| `EXPO_PUBLIC_SUPABASE_URL` | vorhanden |
| Anon/Publishable Key | vorhanden |
| `SUPABASE_SERVICE_ROLE_KEY` | **fehlt** |
| Business E-Mail/Passwort | vorhanden, aber **Placeholder / kein E-Mail-Format** |
| Employee Credentials | **Literal-Placeholder** (`...`) |
| Client Credentials | **Literal-Placeholder** (`...`) |
| Business-Login-Test | **fehlgeschlagen** (400) |

**Blocker:** `missing_service_role`, `business_credentials_placeholder`, `business_email_not_valid_format`, `employee_credentials_placeholder_literal`, `client_credentials_placeholder_literal`

Ergebnis: `.audit-content-portal-c12-env-gate.json`

## C.12R.2 Business Auth Repair

**Nicht ausgeführt** — kein Service Role, Business-Credentials nicht gültig.

## C.12R.3 E2E-Seed

**Nicht ausgeführt** — Env-Gate STOP.

## C.12R.4 / C.12R.5 Portal Auth Repair

**Nicht ausgeführt.**

## Auth-Verify

**Nicht ausgeführt** (vorheriger Stand: alle Logins false).

## Production-Schutz

- Helferhasen+ UG `56180c22-…` — **keine Änderungen**
- Musterpflege Digital — **keine Änderungen**

## Nutzeraktion (vor erneutem Retry)

In lokale `.env` (nicht committen):

1. `SUPABASE_SERVICE_ROLE_KEY=` aus Supabase Dashboard → Settings → API
2. `AUDIT_BUSINESS_EMAIL=` echte E-Mail (Format `...@...`)
3. `AUDIT_BUSINESS_PASSWORD=` gültiges Passwort (keine `DEIN_` / `echter-` Platzhalter)
4. Doppelte/veraltete Zeilen `DEIN_OFFICE_*` entfernen
5. `AUDIT_EMPLOYEE_USERNAME` / `AUDIT_EMPLOYEE_PASSWORD` — echte Werte statt `...`
6. `AUDIT_CLIENT_USERNAME` / `AUDIT_CLIENT_PORTAL_CODE` — echte Werte statt `...`

Dann: `node scripts/audit/contentPortalEnvGate.mjs` → muss `ok: true` liefern.
