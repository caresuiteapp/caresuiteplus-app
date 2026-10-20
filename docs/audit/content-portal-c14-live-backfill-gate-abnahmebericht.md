# Content Portal C.14 — Live-Backfill Gate

**Datum:** 2026-06-23

## Dry-Run

```bash
node scripts/audit/contentPortalLiveBackfill.mjs --dry-run
```

| Feld | Ergebnis |
|------|----------|
| ok | **false** |
| reason | `missing_service_role_or_url` |
| deletes | **0** (kein Lauf) |
| betroffene Tenants | keine (Service Role fehlt) |

Datei: `.audit-content-portal-live-backfill-results.json`

## Geplantes Verhalten (bei Service Role)

| Mandant | Aktion |
|---------|--------|
| `56180c22-…` Helferhasen+ UG | UPSERT fehlende `client_portal_settings` für **aktive** Klient:innen |
| `a0805c4a-…` Musterpflege Digital | **nicht** in Whitelist → **keine** Änderung |
| `a4ba83bd-…` Test Pflege | **nicht** in LIVE_WHITELIST → **keine** Änderung |

Erwartung bei erfolgreichem Dry-Run:

- Inserts: fehlende Portal-Settings
- Updates: 0 (nur UPSERT merge)
- Deletes: **0**

## Apply

**Nicht durchgeführt** — Dry-Run nicht erfolgreich (kein `SUPABASE_SERVICE_ROLE_KEY`).

## Live-Datenschutz (unverändert)

| Prüfpunkt | Status |
|-----------|--------|
| Helferhasen+ production | unverändert (kein Apply) |
| Aktive Klient:innen (12) | nicht gelöscht |
| Aktive Mitarbeitende (9) | nicht gelöscht |
| Musterpflege Digital | unverändert / needs_confirmation |
| Demo-Daten in Live-UI | Guards aktiv (Unit-Tests) |

## Apply-Freigabe

Apply nur nach:

1. Service Role in `.env`
2. Dry-Run mit `wouldUpsert` dokumentiert, `deletes=0`
3. Verifikation Counts vor/nach
