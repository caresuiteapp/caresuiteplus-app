# Content Portal C.14R — Live-Backfill Dry-Run

**Datum:** 2026-06-23

## Dry-Run

```bash
node scripts/audit/contentPortalLiveBackfill.mjs --dry-run
```

| Feld | Ergebnis |
|------|----------|
| Ausgeführt | ja |
| ok | **false** |
| reason | `missing_service_role_or_url` |
| deletes | **0** |
| betroffene Tenants | keine (kein Lauf) |

## Apply

**Gesperrt** — Dry-Run nicht erfolgreich; Apply in diesem Lauf explizit nicht freigegeben.

## Live-Datenschutz

| Prüfpunkt | Status |
|-----------|--------|
| Helferhasen+ production | unverändert |
| Aktive Klient:innen (12) | nicht gelöscht |
| Aktive Mitarbeitende (9) | nicht gelöscht |
| Musterpflege Digital | unverändert |

## Nächster Schritt

Nach `SUPABASE_SERVICE_ROLE_KEY` in `.env`: Dry-Run erneut — erwartet `wouldUpsert` für fehlende Portal-Settings, `deletes: 0`.
