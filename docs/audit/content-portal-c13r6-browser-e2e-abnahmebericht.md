# Content Portal C.13R.6 — Production Browser E2E Abnahmebericht

**Datum:** 2026-06-23  
**Zielumgebung:** `production` — `https://caresuiteplus.app`  
**Gesamtstatus:** **TEILBESTANDEN** — Logins und Hauptsoftware-Assist grün; Mitarbeiterportal-Einsätze, Nachrichten-Sendflow und Nachweisfreigabe im Browser offen

## 1. Build-/Commit-Prüfung

| Prüfpunkt | Ergebnis |
|-----------|----------|
| Sichtbare Version auf Landing | **ja** — „Version 1.0.0“ |
| Commit-Hash in UI | **nein** |
| Lokal `HEAD` / `origin/main` | `e62f9c3` (≥ `0262065`, inkl. Employee-Portal-Login-Fix und Galaxy-Build-Fix) |
| Funktionaler Nachweis Production aktuell | **ja** — AuthVerify + API-Portal-Logins grün; Business Assist zeigt E2E-Einsätze nach Session-Bootstrap |

Kein erneuter Deploy in diesem Lauf.

## 2. Auth- und Seed-Gate (vor Browser)

| Gate | Status |
|------|--------|
| EnvGate | **grün** |
| AuthBootstrap | **grün** |
| E2ESeed | **grün** |
| AuthVerify | **vollständig grün** (Business, Mitarbeiterportal, Klient:innenportal) |

## 3. Browser-E2E — Business / Hauptsoftware

| Bereich | Route | Sichtbar geprüft | Ergebnis |
|---------|-------|------------------|----------|
| Landing / Build | `/` | ja | Version sichtbar |
| Business Session | Session-Inject + Reload | ja | Dashboard/Office erreichbar |
| Testmandant-Kontext | — | ja | Kein Helferhasen+ Leak im sichtbaren Text |
| Office Klient:innen | `/business/office/clients` | ja | lädt |
| Office Mitarbeitende | `/business/office/employees` | ja | lädt |
| Office Nachrichten | `/business/messages` | ja | lädt |
| Assist Einsätze | `/assist/assignments` | ja | **E2E Einsatz heute / Alltagsbegleitung sichtbar** |
| Assist Nachweise | `/assist/nachweise` | ja | lädt |
| Assist Live-Status | `/assist/live-status` | ja | lädt |
| Assist Durchführung | `/assist/durchfuehrung` | ja | lädt |

## 4. Browser-E2E — Mitarbeiterportal

| Prüfpunkt | Ergebnis |
|-----------|----------|
| API-Login (Edge) | **grün** |
| Browser-Dashboard nach Session-Inject | **grün** |
| E2E-Einsatz in UI sichtbar | **rot** — Liste leer / ohne „E2E“ |
| Assignments-Route | **rot** — keine sichtbaren Einsätze |
| Durchführung | **rot** — nicht bedienbar ohne Einsatz |
| Nachrichten-Route | lädt |
| Logout | nicht separat automatisiert |

**Ursache (sichtbar + Code):** Portal-Terminliste liest Live-Daten aus Tabelle `assignments` (`portalAppointmentsLiveService`). E2E-Seed legt nur `assist_visits` an. Business-Assist nutzt `assist_visits` → Einsatz dort sichtbar; Mitarbeiterportal bleibt ohne passende `assignments`-Zeilen leer.

## 5. Browser-E2E — Klient:innenportal

| Prüfpunkt | Ergebnis |
|-----------|----------|
| API-Login | **grün** |
| Browser-Dashboard | **grün** |
| Termine/Inhalte | **grün** — freigegebene Kalender-/Termin-Inhalte sichtbar |
| Nachrichten-Route | lädt |
| Fremde Daten | nicht sichtbar |
| Technische Texte | nicht sichtbar |

## 6. Nachrichten-E2E

| Flow | Ergebnis |
|------|----------|
| Business → Mitarbeiterportal (Senden + Sichtbarkeit) | **nicht bestanden** — Business-/Portal-Nachrichten-Routen laden, aber kein automatisierter Sende-Nachweis |
| Business → Klient:innenportal | **nicht bestanden** — gleiche Einschränkung |

## 7. Nachweis-/Freigabe-E2E

| Schritt | Ergebnis |
|---------|----------|
| Pending-Nachweis in Assist | Seed vorhanden (API) |
| Freigabe-Modal / Freigeben im Browser | **nicht automatisiert abgeschlossen** |
| Sichtbarkeit im Klient:innenportal nach Freigabe | **nicht nachgewiesen** |
| Freigabe entziehen | **nicht nachgewiesen** |

## 8. LiveBackfill Dry-Run

| Prüfpunkt | Ergebnis |
|-----------|----------|
| Dry-Run | **grün** |
| Deletes | **0** |
| Helferhasen+ UG `production` | geschützt |
| LiveBackfill Apply | **nicht ausgeführt** |

## 9. Screenshots

**ja** — unter `docs/audit/content-portal-c13r6-browser-e2e-screenshots/` (Testmandant, keine Passwörter/Codes in Commits).

## 10. Tests & Typecheck

| Prüfung | Ergebnis |
|---------|----------|
| `src/__tests__/contentPortal` | **14/14 grün** |
| Volle Suite `npm test -- --run` | viele Failures (bestehende Baseline außerhalb Content-Portal) |
| Typecheck | **921 Fehler** — bekannte Baseline, keine neuen C.13R.6-spezifischen Blocker |

## 11. Harte Nicht-Ziele

| Verbot | eingehalten |
|--------|-------------|
| LiveBackfill Apply | ja |
| K.6 | ja |
| Rechnungen / Rechnungsnummern | ja |
| Deploy / `[deploy]` | ja |
| Secrets in Logs/Berichten | ja |
| Produktive Löschungen | ja |

## 12. Offene Blocker

1. **Mitarbeiterportal:** E2E-Einsätze nicht in Portal-UI — `assignments` vs. `assist_visits` Datenpfad.
2. **Nachrichten-E2E:** Sende-Flow im Browser nicht nachgewiesen.
3. **Nachweisfreigabe-E2E:** Freigeben/Zurückziehen im Browser nicht nachgewiesen.
4. **Mitarbeiterportal Durchführung:** ohne sichtbaren Einsatz nicht prüfbar.

**Empfehlung:** Seed um idempotente `assignments`-Zeilen für Test-Einsätze ergänzen (nur Test Pflege GmbH) oder Portal-Live-Service auf `assist_visits` alignen — separater Fix-Lauf, nicht in C.13R.6 Apply.
