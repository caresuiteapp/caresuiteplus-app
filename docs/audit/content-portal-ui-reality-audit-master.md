# Content Portal UI Reality Audit — Master (C.13R.6A)

**Datum:** 2026-06-23  
**Gesamtstatus:** **TEILBESTANDEN / NICHT FREIGEGEBEN** für „vollständiger UI-Neubau“

## War der ursprüngliche Komplett-Rebuild erfüllt?

**Nein — nur teilweise.**

Cursor hat **nicht** flächendeckend alle Office-, Assist- und Portal-Unterseiten komplett neu aufgebaut. Die dokumentierte Arbeit war ein **Content-Portal-Live-Data-Rebuild (C.1–C.10)** plus **punktuelle UI-Reality-Fixes** (Dashboards, Tabellen, Shell/LLGAN, Portal-Komponenten).

## Erfüllungsmatrix (Gesamt)

| Bereich | Vollständig neu | Realer Stand |
|---------|-----------------|--------------|
| **Office** | gefordert (Nutzer) | **teilweise** — Dashboard/Listen/Kataloge OK; Messages schwach; Akte/Anlegen nicht voll auditiert |
| **Assist** | gefordert | **größtenteils funktional** auf Nav-Routen; **nicht** komplett neu; Modals/Kalender lückenhaft |
| **Mitarbeiterportal** | gefordert | **teilweise** — Shell OK; **Durchführung + E2E-Sync fehlen** |
| **Klient:innenportal** | gefordert | **teilweise bis funktional** auf Routen; Freigabe/Nachrichten-E2E offen |

## Nur oberflächlich geändert?

**Ja, in Teilen:**

- Dashboards/Heroes und Shell (LLGAN/Glass) — sichtbar verbessert
- Listen-Lesbarkeit (z. B. Klient:innen-Tabelle)
- Portal-Freigabe-**Code** und Panels — nicht durchgängig im Browser-E2E nachgewiesen

**Nicht** nur oberflächlich:

- Assist-Navigation (12 Routen erreichbar mit Inhalt)
- Auth/Seed/Guards/Demo-Leak-Schutz (Backend-Ebene)

## Fehlende / kaputte Bereiche

| Lücke | Detail |
|-------|--------|
| Mitarbeiterportal Einsätze | `portalAppointmentsLiveService` → `assignments`; E2E-Seed → `assist_visits` |
| Mitarbeiterportal Durchführung | Route schwach/leer ohne Einsatz; Live Execution teils `blockDemoOnlyInLiveMode` |
| Nachrichten E2E | Business → Portale nicht gesendet/geprüft |
| Nachweis-Freigabe E2E | Freigeben/Zurückziehen nicht im Browser abgeschlossen |
| Office Tiefe | Klient:in anlegen/bearbeiten, Portal-Freigaben-Inbox, Benutzer & Portale — nicht vollständig in diesem Scan |

## Entscheidungsempfehlung

| Option | Wann |
|--------|------|
| **C.13R.7** (gezielt) | Wenn Ziel = Production-Gates grün + Daten-Sync + 4 E2E-Workflows (Einsatz, Nachricht, Nachweis) |
| **C.14** (Komplett-Rebuild) | Wenn Ziel = Nutzeranforderung „alle Unterseiten neu“ wirklich erfüllen |
| **P0 Typecheck** | Parallel sinnvoll (921 Baseline), blockiert aber nicht diesen Reality-Audit |

**Empfehlung:** **C.14 vorbereiten** mit Seiteninventar und Prioritätenliste; **parallel C.13R.7** für den nachgewiesenen Datenbruch Assist↔Mitarbeiterportal und die offenen E2E-Workflows.

## Checkliste (37 Punkte Spec §20)

| # | Frage | Antwort |
|---|-------|---------|
| 1 | Git-Precheck | **ja** — `main`, `c67a05e`, sync `origin/main`, `.env` nicht staged |
| 2 | Alte Prompts gefunden | **ja** |
| 3 | Quellen | `docs/audit/content-portal-*`, `assist-abnahme-checklist-status.md`, `portal-system-abnahme-checklist-status.md`, UI-reality-fix Berichte |
| 4 | Zielumgebung | **production** |
| 5 | Office vollständig geprüft | **ja** (8 Routen; nicht jede Akten-Unterroute) |
| 6 | Assist vollständig geprüft | **ja** (12 Nav-Routen) |
| 7 | Mitarbeiterportal vollständig geprüft | **ja** (6 Routen) |
| 8 | Klient:innenportal vollständig geprüft | **ja** (5 Routen) |
| 9 | Office vollständig neu | **teilweise** |
| 10 | Assist vollständig neu | **teilweise / funktional auf Nav** |
| 11 | Mitarbeiterportal vollständig neu | **teilweise** |
| 12 | Klient:innenportal vollständig neu | **teilweise** |
| 13 | Dunkle Restdesigns | **nicht im Scan**; historisch gemischt |
| 14 | Alte Layoutreste | **wahrscheinlich ja** (Modals/Checklisten) |
| 15 | Technische Texte | **nein** im Scan |
| 16 | Platzhalter/Mock | **nein** im Scan |
| 17 | Tote Buttons | **nicht automatisch** nachgewiesen |
| 18 | Fehlende Unterseiten | **ja** — Akte/Anlegen/Freigabe-E2E |
| 19 | Datenfluss Office→Assist | **teilweise geprüft** |
| 20 | Assist→Mitarbeiterportal | **ja — rot** |
| 21 | → Klient:innenportal | **teilweise** |
| 22 | Nachrichten-Datenfluss | **rot** |
| 23 | Nachweis-Datenfluss | **rot** |
| 24 | Keine fremden Daten | **ja** |
| 25 | Keine produktiven Änderungen | **ja** |
| 26 | LiveBackfill Apply | **nein** |
| 27 | K.6 | **nein** |
| 28 | Rechnungen | **nein** |
| 29 | Rechnungsnummern | **nein** |
| 30 | Tests | **14/14** contentPortal |
| 31 | Typecheck | **921 Baseline** |
| 32 | Screenshots | **ja** |
| 33 | Audit-Script | **ja** — `contentPortalUiRealityAudit.mjs` |
| 34 | Commit | nach Push |
| 35 | Push | nach Push |
| 36 | Berichte | siehe `docs/audit/content-portal-ui-reality-audit-*` |
| 37 | Empfehlung | **C.14 Rebuild vorbereiten** + **C.13R.7 für Sync/E2E** |
