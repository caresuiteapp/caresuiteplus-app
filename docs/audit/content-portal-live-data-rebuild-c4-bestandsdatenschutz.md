# Content Portal Live Rebuild — C.4 Bestandsdatenschutz

**Datum:** 2026-06-23  
**LIVE Whitelist:** Helferhasen+ UG (`56180c22-b894-4fab-b55e-a563c94dd6e7`)

## Maßnahmen

| Aktion | LIVE | E2E |
|--------|------|-----|
| DELETE Klient:innen/MA | **0** | nur E2E-Mandant (nicht ausgeführt in C.4) |
| Portal-Settings UPSERT | idempotent für aktiv | separater Seed C.5 |
| Stammdaten anonymisieren | **Nein** | — |
| Demo-Daten einspielen | **Nein** | Ja (C.5) |

## Helferhasen+ UG — Counts

| Metrik | Vor Backfill | Nach Backfill (Ziel) | Gelöscht |
|--------|--------------|----------------------|----------|
| Klient:innen gesamt | 19 | 19 | 0 |
| Klient:innen aktiv | 12 | 12 | 0 |
| Mitarbeitende | 9 | 9 | 0 |
| `client_portal_settings` | siehe Dry-Run | +fehlende aktiv | 0 |

Dry-Run: `node scripts/audit/contentPortalLiveBackfill.mjs --dry-run`  
Apply: `node scripts/audit/contentPortalLiveBackfill.mjs` (Service Role erforderlich)

## Verifikation

- `tenant_environment_settings.mode = production` für Whitelist-Mandant
- `guardServiceTenant` blockiert Demo-UUID `a0000000-…` in Production
- Dashboard-Services rufen `guardServiceTenant` vor Live-Fetch auf
