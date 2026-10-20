# Content Portal C.13R.1 — Browser E2E Abnahmebericht

**Datum:** 2026-06-23  
**HEAD:** `f11c538`  
**Phase:** C.13R.1 — Browser-E2E (nur bei grünem AuthVerify)  
**Status:** **NICHT GESTARTET**

## Voraussetzung

Browser-E2E startet nur wenn `contentPortalAuthVerify.mjs` vollständig grün ist.

## Blocker

C.12R.1 Env-Gate und Auth-Bootstrap sind rot:

- Service-Role-Key ist noch Platzhalter (`DEIN_SUPABASE…`).
- Business Login: false.
- AuthVerify: nicht ausgeführt.

## Geplante Flows (nicht geprüft)

| Flow | Geprüft |
|------|---------|
| A) Business → Mitarbeiterportal (Assist, Durchführung, Live-Status) | nein |
| B) Business → Klient:innenportal (Freigabe / Entzug) | nein |
| C) Nachrichten (Business ↔ Portale, Lesestatus) | nein |
| D) Nachweis / Freigabe (Prüfung → Portal-Sichtbarkeit) | nein |

## Business-Hauptsoftware

Office, Klient:innen, Mitarbeitende, Benutzer & Portale, Nachrichten, Assist, Einsätze, Durchführung, Nachweise, Live-Status — **nicht geprüft**.

## Mitarbeiterportal

Login, Einsätze, Durchführung, Nachrichten, Dokumente/Freigaben, Logout — **nicht geprüft**.

## Klient:innenportal

Login, freigegebene Einsätze/Nachweise/Dokumente, Nachrichten, Logout — **nicht geprüft**.

## Tenant-Schutz

Keine Browser-Interaktion auf Produktionsmandanten; Helferhasen+ UG nicht verändert.

## Nächster Schritt

Nach grünem C.12R.1 AuthVerify: `node scripts/audit/contentPortalBrowserAcceptance.mjs` bzw. dokumentierter Browser-Runner.
