# Content Portal C.12–C.14 Master Abnahmebericht

**Datum:** 2026-06-23  
**HEAD:** `45992de`

## Gesamtfazit

| Phase | Status |
|-------|--------|
| C.12.1 C.11-Bericht commit/push | **erledigt** |
| C.12 Env-Gate | **rot** (Business-Login + Service Role) |
| C.12 E2E-Seed | **blockiert** |
| C.12 Auth-Bootstrap | **blockiert** (`invalid_credentials`) |
| C.13 Browser-E2E | **nicht durchgeführt** |
| C.14 Live-Backfill Dry-Run | **blockiert** (Service Role) |
| C.14 Live-Backfill Apply | **nicht durchgeführt** |
| Tests Content Portal | **21/21 grün** |
| Typecheck | Baseline rot (921 Fehler, bekannt) |
| K.6 | **gesperrt** |
| Deploy | **nicht** |

## Freigegeben / erledigt

- C.11 Audit-Bericht auf `origin/main`
- Neue Gate-Skripte: `contentPortalEnvGate.mjs`, `contentPortalAuthVerify.mjs`
- Keine Secrets committed
- Keine produktiven Löschungen
- Keine Live-Datenänderungen

## Blockiert (Nutzeraktion)

1. **`SUPABASE_SERVICE_ROLE_KEY`** in lokale `.env`
2. **Gültige Business-Credentials** für Live-Supabase (`AUDIT_BUSINESS_*` oder `TEST_BUSINESS_*`)
3. Danach erneut: Env-Gate → Seed → Auth-Bootstrap → Verify → Backfill Dry-Run → optional Apply → Browser-E2E

## Tenant-Schutz

| Mandant | Status |
|---------|--------|
| Helferhasen+ UG `56180c22-…` | production, unverändert |
| Test Pflege GmbH `a4ba83bd-…` | internal_test (Ziel), Seed ausstehend |
| Musterpflege Digital | needs_confirmation, unverändert |

## Berichte

1. `docs/audit/content-portal-c12-e2e-seed-auth-abnahmebericht.md`
2. `docs/audit/content-portal-c13-browser-e2e-abnahmebericht.md`
3. `docs/audit/content-portal-c14-live-backfill-gate-abnahmebericht.md`
4. `docs/audit/content-portal-c12-c14-master-abnahmebericht.md`

## Commits (dieser Lauf)

- `docs(audit): record content portal c11 push gate` — bereits gepusht
- Audit C.12–C.14 Berichte + Gate-Skripte — folgen selektiv
