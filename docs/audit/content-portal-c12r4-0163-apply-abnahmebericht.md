# Content Portal C.12R.4 — Migration 0163 Apply Abnahmebericht

**Datum:** 2026-06-23  
**HEAD (Start):** `395b1f3`  
**Phase:** C.12R.4 — Service-Role-Grants remote anwenden, Seed/Backfill erneut prüfen  
**Status:** **TEILFREIGABE** (Grants + Backfill-Dry-Run grün; Seed nach Fix grün; Mitarbeiterportal-Login offen)

## 1. Git-Precheck

| Prüfung | Ergebnis |
|---------|----------|
| Branch `main` | ja |
| HEAD = `origin/main` | ja (`395b1f3`) |
| Staged Dateien | keine |
| `.env` staged | nein |

## 2. Migrationsstatus vorher

| Feld | Wert |
|------|------|
| Letzte Remote-Migration | `content_rebuild_environment_modes_repair` |
| `0163_service_role_content_portal_grants` | **nicht angewendet** |

## 3. Migration 0163 Safety-Check

Datei: `supabase/migrations/0163_service_role_content_portal_grants.sql`

- Nur `GRANT`, `DO $$`, `to_regclass`, Sequence-Grants
- Keine `DELETE`, `TRUNCATE`, `DROP`, Daten-`UPDATE`/`INSERT`, kein RLS-Disable
- Treffer `UPDATE` nur in `GRANT SELECT, INSERT, UPDATE` (Privileg-Name)

**Destruktionsfrei:** ja

## 4. Migration 0163 remote angewendet

| Feld | Wert |
|------|------|
| Angewendet | **ja** (via `apply_migration`) |
| Remote-Version | `20260623204001` |
| Remote-Name | `service_role_content_portal_grants` |
| Fehler beim Apply | keine |

## 5. Migrationsstatus nachher

`service_role_content_portal_grants` erscheint in Remote-Migrationsliste.

## 6. Post-Migration Scripts

| Script | Ergebnis |
|--------|----------|
| `contentPortalEnvGate.mjs` | **ok** — `businessLogin: true`, `blockers: []` |
| `contentPortalAuthBootstrap.mjs` | **ok** — `exitCode: 0` |
| `contentPortalAuthVerify.mjs` | **ok** — `businessLogin: true`, `clientPortalLogin: true`, `tenantLinked: true` |
| `contentPortalE2eSeed.mjs` | **ok** (nach Seed-Fix) — alle Steps grün |
| `contentPortalLiveBackfill.mjs --dry-run` | **ok** — `deletes: 0`, `wouldUpsert: 12` (Helferhasen+), kein Apply |

### E2E-Seed Detail

- Erster Lauf nach 0163: `permission_denied` behoben
- `proof_pending` scheiterte an Check-Constraint (`portal_release_status: 'pending'` ungültig)
- Fix: Seed nutzt `portal_release_status: 'none'` (erlaubt: `none`, `released`, `revoked`)
- Zweiter Lauf: alle Steps grün für Test Pflege GmbH (`a4ba83bd-…`)

### AuthVerify Detail

- Business Login: true
- Klient:innenportal Login: true
- Mitarbeiterportal Login: **false** (offener Blocker für Portal-E2E)
- `ok: true` (Script-Gesamtflag, MA-Login separat rot)

## 7. Browser-E2E

Nicht als bestanden gemeldet — Mitarbeiterportal-Login rot; Browser-Runner ist Manual/Stub (`contentPortalBrowserAcceptance.mjs`).

## 8. Live-Datenschutz

| Mandant | Verändert |
|---------|-----------|
| Helferhasen+ UG (`56180c22-…`, production) | nur lesend im Dry-Run |
| Test Pflege GmbH (`a4ba83bd-…`, internal_test) | Seed idempotent |
| Musterpflege Digital | nicht verändert |

## 9. Nicht-Ziele

- Live-Backfill Apply: **nicht**
- K.6: **nicht**
- Rechnungen / Rechnungsnummern: **nicht**
- Deploy: **nicht**
- Secrets in Bericht: **keine**
