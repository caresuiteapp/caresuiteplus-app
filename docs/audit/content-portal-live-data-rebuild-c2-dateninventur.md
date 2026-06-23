# Content Portal Live Rebuild — C.2 Dateninventur

**Datum:** 2026-06-23  
**Supabase:** `euagyyztvmemuaiumvxm`

## Nutzer-LIVE-Whitelist (bestätigt)

| Mandant | Tenant-ID | `env_mode` | Klient:innen aktiv | MA |
|---------|-----------|------------|-------------------|-----|
| Helferhasen+ UG (haftungsbeschränkt) | `56180c22-b894-4fab-b55e-a563c94dd6e7` | `production` | 12 / 19 | 9 |

**Hinweis:** Weitere echte Mandanten müssen vom Nutzer explizit ergänzt werden, bevor C.4-Schreibzugriff erweitert wird.

## Inventur-Matrix (Mandanten)

| Mandant | ID | Klasse | Klient:innen (aktiv/gesamt) | MA | Löschung | Ergänzung | Mapping | Risiko |
|---------|-----|--------|----------------------------|-----|----------|-----------|---------|--------|
| Helferhasen+ UG | `56180c22-…` | **LIVE** | 12 / 19 | 9 | **Nein** | Ja (Portal-Settings) | Ja | Hoch — echte Daten |
| Musterpflege Digital GmbH | `a0805c4a-…` | **Unbestätigt** | 4 / 4 | 4 | Nein | Nur nach Freigabe | Ja | Mittel — Name „Muster“ |
| Test Pflege GmbH | `a4ba83bd-…` | E2E `internal_test` | 2 / 2 | 1 | Nur E2E | Ja | Ja | Niedrig (isolierter Test) |
| Test Pflege Live GmbH | `6e8a5c3b-…` | E2E `internal_test` | 0 / 0 | 0 | Nur E2E | Ja | — | Niedrig |
| Pilot-Verify | `3d6220dd-…` | `internal_test` | 0 / 0 | 0 | Nur E2E | Ja | — | Niedrig |
| SonnenPflege Köln | `11111111-…101` | `pilot` | 0 / 0 | 0 | Nein | Ja | — | Niedrig |
| Herzlich Zuhause Düsseldorf | `11111111-…102` | `pilot` | 0 / 0 | 0 | Nein | Ja | — | Niedrig |
| PflegeEngel Bonn | `11111111-…103` | `pilot` | 0 / 0 | 0 | Nein | Ja | — | Niedrig |

## Tabellen-Scope (tenant-scoped)

| Tabelle | LIVE Helferhasen | E2E Test Pflege | Maßnahme |
|---------|------------------|-----------------|----------|
| `clients` | 19 (12 active) | 2 (2 active) | READ/MAP only auf LIVE |
| `employees` | 9 | 1 | READ/MAP only auf LIVE |
| `client_portal_settings` | Backfill wenn leer | Seed in E2E | UPSERT idempotent |
| `tenant_environment_settings` | `production` | `internal_test` | Migration 0162 |
| `assist_visits` / proofs | vorhanden | Seed E2E | Kein DELETE auf LIVE |
| `messages` / `documents` | vorhanden | Seed E2E | Kein DELETE auf LIVE |

## Migration 0056 / 0162 Gate

| Schritt | Status |
|---------|--------|
| Dry-Run / Diff dokumentiert | Tabellen fehlten trotz 0056-Historie |
| Inventur → Freigabe | Whitelist + E2E-Klassifikation |
| Apply | `0162_content_portal_environment_repair.sql` + Remote-Repair |
| Verifikation | Helferhasen `production`; Test Pflege `internal_test` |

## Gate C.4 / C.5

- **C.4 Schreibzugriff:** nur Whitelist `56180c22-…`
- **C.5 Cleanup/DELETE:** nur `a4ba83bd-…` und `6e8a5c3b-…`
