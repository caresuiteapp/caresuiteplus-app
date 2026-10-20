# Content Portal C.12R.1 — Auth, Seed & Verify Abnahmebericht

**Datum:** 2026-06-23  
**HEAD:** `f11c538` (`test(portal): repair e2e auth bootstrap gates`)  
**Phase:** C.12R.1 — Env validieren, Auth mit Service Role reparieren, Testmandant seeden  
**Status:** **BLOCKIERT**

## Git-Precheck

| Prüfung | Ergebnis |
|---------|----------|
| Branch `main` | ja |
| Synchron mit `origin/main` | ja |
| HEAD ≥ `f11c538` | ja (`f11c538`) |
| Staged Dateien | keine |
| `.env` staged | nein |

## Env-Gate

**Script:** `node scripts/audit/contentPortalEnvGate.mjs`

| Feld | Ergebnis |
|------|----------|
| `ok` | **false** |
| `gatePassed` | **false** |
| `serviceRolePresent` | true (Zeile vorhanden) |
| `businessEmailValidFormat` | true |
| `businessLogin` | **false** |

**Blocker:**

1. `service_role_placeholder` — `SUPABASE_SERVICE_ROLE_KEY` enthält noch das Platzhaltermuster `DEIN_SUPABASE` (kein gültiger Supabase Service-Role-Key).
2. `business_login_failed` — Anmeldung mit `AUDIT_BUSINESS_EMAIL` schlägt fehl (HTTP 400 / invalid credentials); User konnte wegen ungültigem API-Key nicht angelegt werden.

**Hinweis:** Env-Gate wurde in diesem Lauf um explizite Blocker-Erkennung für Service-Role-Platzhalter (`DEIN_SUPABASE`) erweitert.

## Business Auth Repair

**Script:** `node scripts/audit/contentPortalAuthBootstrap.mjs`

| Prüfung | Ergebnis |
|---------|----------|
| Service Role in Env | vorhanden, aber Platzhalter |
| Repair versucht | ja |
| `create_user` | **fehlgeschlagen** — `Invalid API key` |
| User existiert | nein |
| Business Login nach Repair | **false** |

**Fehlerklasse:** `invalid_credentials` / Supabase Admin API lehnt API-Key ab.

## Testmandant Test Pflege GmbH

| Prüfung | Ergebnis |
|---------|----------|
| Tenant-ID `a4ba83bd-65db-46cf-8cf7-61492cc78315` eindeutig | **nicht verifiziert** (API-Zugriff blockiert) |
| Environment `internal_test` | **nicht verifiziert** |
| `testPflegeCount` (Bootstrap-Legacy) | 0 |

## E2E-Seed

**Script:** `contentPortalE2eSeed.mjs` — **nicht ausgeführt** (Env-Gate rot).

## Portal Auth Verify

**Script:** `contentPortalAuthVerify.mjs` — **nicht ausgeführt** (Env-Gate rot).

| Login | Ergebnis |
|-------|----------|
| Business | nicht geprüft |
| Mitarbeiterportal | nicht geprüft |
| Klient:innenportal | nicht geprüft |

## Tenant-Schutz

| Mandant | Verändert |
|---------|-----------|
| Helferhasen+ UG (`56180c22-…`) | nein |
| Musterpflege Digital | nein |
| Test Pflege GmbH | nein (Seed nicht gelaufen) |

## Nicht-Ziele eingehalten

- K.6: nicht gestartet
- Rechnungen / Rechnungsnummern: nicht erzeugt
- Deploy: nicht ausgeführt
- Live-Backfill Apply: nicht ausgeführt
- `.env` committen: nicht

## Nächster Schritt (lokal, nicht committen)

1. In Supabase Dashboard → Project Settings → API den echten **service_role** Key kopieren.
2. In `.env` Zeile `SUPABASE_SERVICE_ROLE_KEY=DEIN_SUPABASE_SERVICE_ROLE_KEY` durch den echten Key ersetzen (kein `DEIN_`, kein `CHANGE_ME`).
3. `AUDIT_BUSINESS_EMAIL` und `AUDIT_BUSINESS_PASSWORD` bleiben gültig formatiert (E-Mail mit `@`).
4. Env-Gate erneut: `node scripts/audit/contentPortalEnvGate.mjs` → erwartet `ok: true`.
5. Danach Bootstrap → Seed → AuthVerify → Browser-E2E.

**Keine Secrets in Commits, Logs oder Berichten.**
