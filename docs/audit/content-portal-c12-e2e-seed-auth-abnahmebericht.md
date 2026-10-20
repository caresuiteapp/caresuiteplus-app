# Content Portal C.12 — E2E Seed & Auth Abnahme

**Datum:** 2026-06-23  
**HEAD:** `45992de` (nach C.11-Bericht-Push)

## Env-Gate (ohne Werte)

| Variable | vorhanden | leer | Placeholder |
|----------|-----------|------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | ja | nein | nein |
| Anon/Publishable Key | ja | nein | nein |
| `SUPABASE_SERVICE_ROLE_KEY` | **nein** | ja | — |
| Business E-Mail/Passwort | ja | nein | nein |
| Employee Username/Passwort | ja | nein | nein |
| Client Username/Code | ja | nein | nein |

**Business-Login-Test:** fehlgeschlagen (`httpStatus: 400`, invalid credentials gegen Live-Supabase)

**Blocker:** `missing_service_role`, `business_login_failed`

Ergebnisdatei: `.audit-content-portal-c12-env-gate.json`

## Testmandant

| Feld | Wert |
|------|------|
| Name | Test Pflege GmbH |
| Tenant-ID | `a4ba83bd-65db-46cf-8cf7-61492cc78315` |
| Environment (Ziel) | `internal_test` |

## E2E-Seed

**Status:** **nicht erfolgreich abgeschlossen**

- `contentPortalE2eSeed.mjs` nach Env-Gate-Fehler nicht zuverlässig (Node-Assertion nach fehlgeschlagenem Auth-Kontext)
- Ohne gültigen Business-Login und ohne Service Role kein vollständiger Seed

## Auth-Bootstrap

**Status:** **blockiert**

- `contentPortalAuthBootstrap.mjs` → `invalid_credentials`
- Ergebnis: `.audit-content-portal-auth-bootstrap-results.json` (via A.4.2-Delegat)

## Auth-Verifikation

| Check | Ergebnis |
|-------|----------|
| businessLogin | **false** |
| employeePortalLogin | **false** |
| clientPortalLogin | **false** |
| tenantLinked | **false** |
| noSecretLeak | **true** |

Datei: `.audit-content-portal-c12-auth-verify.json`

## Production-Schutz

- Kein Script-Lauf auf `56180c22-…` (Helferhasen+)
- Keine produktiven Datenänderungen in diesem Lauf

## Freigabe für C.13

**Browser-E2E blockiert** — Auth-Gate nicht grün. HTTP-Smoke dokumentiert in C.13-Bericht.

## Nächste Schritte (Nutzer)

1. `SUPABASE_SERVICE_ROLE_KEY` in lokale `.env` (nicht committen)
2. Gültige `AUDIT_BUSINESS_*` / `TEST_BUSINESS_*` gegen Projekt `euagyyztvmemuaiumvxm`
3. Erneut: `node scripts/audit/contentPortalEnvGate.mjs` → Seed → Auth-Bootstrap → Auth-Verify
