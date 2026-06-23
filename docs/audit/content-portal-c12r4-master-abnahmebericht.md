# Content Portal C.12R.4 — Master Abnahmebericht

**Datum:** 2026-06-23  
**Gesamtstatus:** **TEILFREIGABE** — 0163 remote angewendet; Seed + Backfill-Dry-Run grün; Mitarbeiterportal-Login + Browser-E2E offen

## Executive Summary

Migration `0163_service_role_content_portal_grants` wurde kontrolliert remote angewendet (`20260623204001`). `permission_denied` auf `clients` ist behoben. E2E-Seed läuft nach kleinem Script-Fix (`portal_release_status: 'none'`) vollständig grün. Live-Backfill Dry-Run ist grün mit `deletes: 0`. Mitarbeiterportal-Login bleibt rot; Browser-E2E nicht gestartet.

## Berichte

| Bericht | Pfad |
|---------|------|
| 0163 Apply | `docs/audit/content-portal-c12r4-0163-apply-abnahmebericht.md` |
| Browser E2E | `docs/audit/content-portal-c13r4-browser-e2e-abnahmebericht.md` |
| Live-Backfill Dry-Run | `docs/audit/content-portal-c14r4-live-backfill-dryrun-abnahmebericht.md` |
| Master | `docs/audit/content-portal-c12r4-master-abnahmebericht.md` |

## Tests

- Content Portal Tests: **21/21 grün**
- Typecheck: **~921 Fehler** (Repo-Baseline, keine neuen C.12R.4-Portal-Blocker)

## Abschluss-Checkliste (32 Punkte)

| # | Frage | Antwort |
|---|-------|---------|
| 1 | Git-Precheck bestanden | **ja** |
| 2 | Migration 0163 lokal vorhanden | **ja** |
| 3 | Migration 0163 destruktionsfrei | **ja** |
| 4 | Migration 0163 remote vorher pending | **ja** |
| 5 | Migration 0163 remote angewendet | **ja** |
| 6 | Remote-Migrationsstatus nachher grün | **ja** |
| 7 | EnvGate grün | **ja** |
| 8 | AuthBootstrap grün | **ja** |
| 9 | E2ESeed erfolgreich | **ja** |
| 10 | AuthVerify erfolgreich | **ja** (MA-Login separat rot) |
| 11 | Mitarbeiterportal Login | **nein** |
| 12 | Klient:innenportal Login | **ja** |
| 13 | LiveBackfill Dry-Run erfolgreich | **ja** |
| 14 | LiveBackfill Apply | **nein** |
| 15 | Deletes im Dry-Run = 0 | **ja** |
| 16 | Browser-E2E durchgeführt | **nein** |
| 17 | Business → MA geprüft | **nein** |
| 18 | Business → Klient geprüft | **nein** |
| 19 | Nachrichten-E2E geprüft | **nein** |
| 20 | Nachweis-/Freigabe-E2E geprüft | **nein** |
| 21 | Helferhasen+ production geschützt | **ja** |
| 22 | Aktive Klient:innen erhalten | **ja** |
| 23 | Aktive Mitarbeitende erhalten | **ja** |
| 24 | Musterpflege Digital unverändert | **ja** |
| 25 | K.6 gestartet | **nein** |
| 26 | Rechnungen erzeugt | **nein** |
| 27 | Rechnungsnummern erzeugt | **nein** |
| 28 | Tests | **21/21** |
| 29 | Typecheck | **Baseline ~921** |
| 30 | Commits | siehe Git nach Push |
| 31 | Push erfolgreich | siehe Git nach Push |
| 32 | Berichtspfade | siehe Tabelle oben |
