# Content Portal C.12R.5 — Employee Login Repair Abnahmebericht

**Datum:** 2026-06-23  
**HEAD (Start):** `b69c456`  
**Status:** **TEILFREIGABE** — Mitarbeiterportal-Login repariert; AuthVerify vollständig grün; Browser-E2E nicht automatisiert

## 1. Ausgangslage

Nach C.12R.4: EnvGate, Seed, Klient:innenportal und LiveBackfill-Dry-Run grün. Blocker: `employeePortalLogin: false`.

## 2. Employee Login Fehlerklasse

**Ursache:** `tenant_mismatch` / **Username-Mismatch** (nicht Passwort)

| Feld | Wert |
|------|------|
| Env-Username | gesetzt (gültig, kein Placeholder) |
| DB-Account-Username | `test.admin.p51` (veraltet) |
| Env-Username | `audit-employee@caresuiteplus.test` |
| Passwort-Hash | war gesetzt, Login scheiterte an falschem Username |

AuthBootstrap setzte Passwort-Hash, aber **nicht** den Username aus Env.

## 3. Geprüfte Tabellen/Services

- `employee_portal_accounts` (Username, Status, Hash, Ablauf)
- `employees` (Test-Mitarbeiter aktiv)
- `assist_visits` (Einsätze für Assignments)
- Edge Function `employee-portal-login` (Username/Password gegen `temporary_password_hash`)
- `contentPortalAuthVerify.mjs`

## 4. Repair-Maßnahme

Neue Module:

- `scripts/audit/lib/portalAccountCrypto.mjs` — Hashing wie Edge `crypto.ts`
- `scripts/audit/lib/repairEmployeePortalAccount.mjs` — idempotente Reparatur nur E2E-Mandant

Reparatur setzt:

- `username` aus `AUDIT_EMPLOYEE_USERNAME`
- `temporary_password_hash` aus Env-Passwort
- `status: pending_first_login`, Ablauf +30 Tage
- Sperre-Felder zurückgesetzt

## 5. Script-Anpassungen

| Script | Anpassung |
|--------|-----------|
| `contentPortalE2eSeed.mjs` | ja — ruft `repairEmployeePortalAccount` |
| `contentPortalAuthBootstrap.mjs` | ja — Employee-Repair nach Legacy-Bootstrap |
| `contentPortalAuthVerify.mjs` | ja — erweiterte Diagnose + `ok` nur wenn alle Logins grün |
| `auditSupabaseClient.mjs` | ja — `restPatch` |

## 6. AuthVerify Ergebnis (nach Repair)

| Check | Ergebnis |
|-------|----------|
| businessLogin | **true** |
| employeePortalLogin | **true** |
| clientPortalLogin | **true** |
| tenantLinked | **true** |
| noForeignDataVisible | **true** |
| employeeTenantLinked | **true** |
| employeeAccountActive | **true** |
| employeeHasAssignments | **true** |
| employeeDataVisible | **true** |
| ok | **true** |

## 7. LiveBackfill Dry-Run

Grün, `deletes: 0`, kein Apply.

## 8. Browser-E2E

Nicht als bestanden — `contentPortalBrowserAcceptance.mjs` ist Manual-Stub; kein Playwright-Gate ausgeführt.

## 9. Live-Datenschutz

Helferhasen+ UG nicht verändert. Nur Test Pflege GmbH (`a4ba83bd-…`) für Portal-Repair/Seed.

## 10. Nicht-Ziele

- LiveBackfill Apply: **nicht**
- K.6: **nicht**
- Rechnungen / Rechnungsnummern: **nicht**
- Secrets in Bericht: **keine**
