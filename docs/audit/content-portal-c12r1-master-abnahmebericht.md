# Content Portal C.12R.1 — Master Abnahmebericht

**Datum:** 2026-06-23  
**HEAD:** `f11c538`  
**Gesamtstatus:** **BLOCKIERT — Service-Role-Platzhalter in `.env`**

## Executive Summary

C.12R.1 wurde korrekt an der Env-Gate-Schranke gestoppt. Die lokale `.env` enthält zwar eine `SUPABASE_SERVICE_ROLE_KEY`-Zeile und gültig formatierte `AUDIT_BUSINESS_EMAIL`, aber der Service-Role-Wert ist weiterhin der Platzhalter `DEIN_SUPABASE_SERVICE_ROLE_KEY`. Supabase Admin API antwortet mit `Invalid API key`. Business Login, Auth-Repair, E2E-Seed, AuthVerify und Browser-E2E wurden nicht fortgesetzt.

## Gate-Matrix

| Gate | Status |
|------|--------|
| Git-Precheck | **GRÜN** |
| Env-Gate | **ROT** |
| Business Auth Repair | **ROT** |
| E2E-Seed | **nicht gestartet** |
| AuthVerify | **nicht gestartet** |
| Browser-E2E | **nicht gestartet** |
| Live-Backfill Dry-Run | **gelb** (ausgeführt, API blockiert, deletes=0) |
| Live-Backfill Apply | **nicht ausgeführt** |
| Tests (Content Portal) | **GRÜN** (21/21) |
| Typecheck | Baseline (~921 Fehler), keine neuen Portal-Blocker |

## Root Cause

1. `SUPABASE_SERVICE_ROLE_KEY` = Platzhaltertext, kein JWT/service_role Key aus Supabase.
2. Auth Bootstrap `create_user` → `Invalid API key`.
3. Business User existiert nicht; Login `invalid_credentials`.

## Code-Änderung in diesem Lauf

- `scripts/audit/contentPortalEnvGate.mjs`: Blocker `service_role_placeholder` wenn Key `DEIN_SUPABASE` enthält; erweiterte PLACEHOLDER-Regex.

## Berichte

| Bericht | Pfad |
|---------|------|
| Auth / Seed / Verify | `docs/audit/content-portal-c12r1-auth-seed-verify-abnahmebericht.md` |
| Browser E2E | `docs/audit/content-portal-c13r1-browser-e2e-abnahmebericht.md` |
| Live-Backfill Dry-Run | `docs/audit/content-portal-c14r1-live-backfill-dryrun-abnahmebericht.md` |
| Master | `docs/audit/content-portal-c12r1-master-abnahmebericht.md` |

## Tenant-Schutz

Helferhasen+ UG, Musterpflege Digital und Test Pflege GmbH wurden durch diesen Lauf nicht verändert (kein erfolgreicher Remote-Schreibzugriff).

## Abschluss-Checkliste (33 Punkte)

| # | Frage | Antwort |
|---|-------|---------|
| 1 | Git-Precheck bestanden | **ja** |
| 2 | Env-Gate bestanden | **nein** |
| 3 | SUPABASE_SERVICE_ROLE_KEY vorhanden | **ja** (Platzhalter, nicht gültig) |
| 4 | Business Auth User repariert/erstellt | **nein** |
| 5 | Business Login funktioniert | **nein** |
| 6 | Test Pflege GmbH eindeutig | **nein** |
| 7 | Testmandant internal_test | **nein** |
| 8 | E2E-Seed erfolgreich | **nein** |
| 9 | E2E-Testdaten neu aufgebaut | **nein** |
| 10 | Mitarbeiterportal Login | **nein** |
| 11 | Klient:innenportal Login | **nein** |
| 12 | AuthVerify komplett grün | **nein** |
| 13 | Business → MA E2E geprüft | **nein** |
| 14 | Business → Klient E2E geprüft | **nein** |
| 15 | Nachrichten-E2E geprüft | **nein** |
| 16 | Nachweis-/Freigabe-E2E geprüft | **nein** |
| 17 | Live-Backfill Dry-Run durchgeführt | **ja** |
| 18 | Live-Backfill Apply durchgeführt | **nein** |
| 19 | Deletes im Dry-Run = 0 | **ja** |
| 20 | Helferhasen+ production geschützt | **ja** |
| 21 | Aktive Klient:innen erhalten | **ja** |
| 22 | Aktive Mitarbeitende erhalten | **ja** |
| 23 | Musterpflege Digital unverändert | **ja** |
| 24 | Keine Demo-Daten in Live-Ansichten | **nicht verifiziert** (API blockiert) |
| 25 | K.6 gestartet | **nein** |
| 26 | Rechnungen erzeugt | **nein** |
| 27 | Rechnungsnummern erzeugt | **nein** |
| 28 | Tests | **21/21 bestanden** |
| 29 | Typecheck | **Baseline ~921 Fehler** (keine neuen C.12R.1-Portal-Blocker) |
| 30 | Browser-Abnahme durchgeführt | **nein** |
| 31 | Commits | siehe Git-Log nach Push |
| 32 | Push erfolgreich | siehe Git-Log |
| 33 | Berichtspfade | siehe Tabelle oben |

## Freigabe

**Keine Freigabe** für E2E/Browser/Apply bis gültiger Service-Role-Key lokal gesetzt und Env-Gate grün.
