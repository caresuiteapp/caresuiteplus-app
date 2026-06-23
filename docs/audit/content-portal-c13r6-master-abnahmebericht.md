# Content Portal C.13R.6 — Master Abnahmebericht

**Datum:** 2026-06-23  
**Gesamtstatus:** **TEILBESTANDEN** — Production-Browser-E2E durchgeführt; Business↔Klient:innenportal grün; Mitarbeiterportal-Einsatz-Sync und Nachrichten/Nachweis-Flows blockiert

## Berichte

| Bericht | Pfad |
|---------|------|
| Browser E2E | `docs/audit/content-portal-c13r6-browser-e2e-abnahmebericht.md` |
| Screenshots | `docs/audit/content-portal-c13r6-browser-e2e-screenshots/` |
| Browser-Runner | `scripts/audit/contentPortalProductionBrowserE2e.mjs` |
| Master | `docs/audit/content-portal-c13r6-master-abnahmebericht.md` |

## Checkliste (41 Punkte)

| # | Frage | Antwort |
|---|-------|---------|
| 1 | Git-Precheck bestanden | **ja** — `main`, `e62f9c3`, sync mit `origin/main` |
| 2 | Zielumgebung | **production** |
| 3 | Production enthält aktuellen Commit | **funktional ja** (kein Hash in UI; Auth + Assist-E2E nachweisbar) |
| 4 | Production funktional aktuell nachgewiesen | **ja** |
| 5 | EnvGate grün | **ja** |
| 6 | AuthBootstrap grün | **ja** |
| 7 | E2ESeed grün | **ja** |
| 8 | AuthVerify vollständig grün | **ja** |
| 9 | Business Login im Browser erfolgreich | **ja** |
| 10 | Testmandant im Browser aktiv | **ja** |
| 11 | Office sichtbar geprüft | **ja** |
| 12 | Assist sichtbar geprüft | **ja** |
| 13 | Mitarbeiterportal Login im Browser erfolgreich | **ja** |
| 14 | Mitarbeiterportal Einsatz sichtbar | **nein** |
| 15 | Mitarbeiterportal Durchführung geprüft | **nein** |
| 16 | Klient:innenportal Login im Browser erfolgreich | **ja** |
| 17 | Klient:innenportal freigegebene Inhalte sichtbar | **ja** |
| 18 | Freigabe erteilen geprüft | **nein** |
| 19 | Freigabe entziehen geprüft | **nein** |
| 20 | Nachrichten Business → Mitarbeiterportal geprüft | **nein** |
| 21 | Nachrichten Business → Klient:innenportal geprüft | **nein** |
| 22 | Nachweisfreigabe geprüft | **nein** |
| 23 | Keine fremden Daten sichtbar | **ja** |
| 24 | Keine technischen Texte sichtbar | **ja** |
| 25 | Keine chaotischen Seiteninhalte sichtbar | **ja** |
| 26 | LiveBackfill Dry-Run grün | **ja** |
| 27 | LiveBackfill Apply durchgeführt | **nein** |
| 28 | Deletes im Dry-Run = 0 | **ja** |
| 29 | Helferhasen+ UG production geschützt | **ja** |
| 30 | aktive Klient:innen erhalten | **ja** |
| 31 | aktive Mitarbeitende erhalten | **ja** |
| 32 | Musterpflege Digital unverändert | **ja** |
| 33 | K.6 gestartet | **nein** |
| 34 | Rechnungen erzeugt | **nein** |
| 35 | Rechnungsnummern erzeugt | **nein** |
| 36 | Tests Ergebnis | **contentPortal 14/14 grün**; volle Suite nicht grün |
| 37 | Typecheck Ergebnis | **921 Fehler Baseline** |
| 38 | Screenshots erstellt | **ja** |
| 39 | Commits | nach Push |
| 40 | Push erfolgreich | nach Push |
| 41 | Berichtspfade | siehe Tabelle oben |

## Summary

Erste vollständige sichtbare Production-Browser-Abnahme gegen `https://caresuiteplus.app` nach Deploy (`e62f9c3`). API-Gates und drei-Portal-Logins sind grün. Business-Assist zeigt Test-Einsätze. Klient:innenportal zeigt freigegebene Inhalte. Mitarbeiterportal-Login funktioniert, aber E2E-Einsätze fehlen in der Portal-UI wegen `assignments`/`assist_visits`-Pfad-Divergenz. Nachrichten-Senden und Nachweisfreigabe wurden im Browser nicht end-to-end nachgewiesen.

LiveBackfill Apply, K.6 und Rechnungen bleiben gesperrt.
