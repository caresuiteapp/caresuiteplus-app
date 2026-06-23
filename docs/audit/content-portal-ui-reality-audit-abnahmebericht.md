# Content Portal UI Reality Audit — Abnahmebericht (C.13R.6A)

**Datum:** 2026-06-23  
**Zielumgebung:** `production` — `https://caresuiteplus.app`  
**Gesamtstatus:** **NICHT BESTANDEN** als „komplett neu aufgebaut“ — **teilweise umgesetzt**, mit klaren Lücken bei Portal-Workflows und Datenpfaden

## Ausgangslage

C.13R.6 meldete TEILBESTANDEN: Logins grün, Business-Assist mit E2E-Einsätzen, Klient:innenportal mit Inhalten — aber Mitarbeiterportal ohne E2E-Einsätze, keine echte Nachrichten-/Nachweis-E2E.

Der Nutzer verlangt vor weiteren Fixes eine **Wahrheitsprüfung**: Wurde Office, Assist, Mitarbeiterportal und Klient:innenportal wirklich vollständig neu aufgebaut (Design, Navigation, Unterseiten, Workflows)?

## Methode

- Read-only Repo-Analyse (`docs/audit/*`, Navigation, Checklisten)
- Playwright Reality-Runner: `scripts/audit/contentPortalUiRealityAudit.mjs`
- 31 Routen, Screenshots unter `docs/audit/content-portal-ui-reality-audit-screenshots/`
- Keine produktiven Schreibaktionen, kein LiveBackfill Apply, kein Deploy

## Alte Anforderungen — Kurzfazit

Die dokumentierte Arbeit (C.1–C.10 **Content Portal Live Rebuild**) fokussierte:

- Live-Daten-Schutz, Demo-Leak-Guards, E2E-Testmandant
- Portal-Freigabe-UI, ModalStack, Sync-Chain, Auth/Seed
- **Punktuelle UI-Reality-Fixes** (Office/Assist/Client Dashboards, Tabellen)

Sie **forderte nicht explizit** in C.10 jeden Office-/Assist-/Portal-Unterseiten-Komplett-Rebuild. Die Nutzeranforderung „nur Dashboards OK, alles darunter komplett neu“ ist in den Berichten **nicht als erledigt** dokumentiert.

Referenzen: `content-portal-live-data-rebuild-abnahmebericht.md`, `assist-abnahme-checklist-status.md`, `portal-system-abnahme-checklist-status.md`, `client-ui-reality-fix-abnahmebericht.md`, `responsive-shell-r1-mobile-tablet-only-abnahmebericht.md`.

## Ergebnis je Bereich

### Office

| Kriterium | Bewertung |
|-----------|-----------|
| Navigation erreichbar | **ja** — Dashboard, Klient:innen, Mitarbeitende, Dokumente, Kataloge, Einstellungen |
| Vollständig neu aufgebaut | **nein / teilweise** — Listen & Dashboards nutzbar; nicht alle Unterseiten/Akten-Workflows auditiert |
| Automatischer Scan | 6/8 „funktional“, 2 „teilweise“ (Messages, Clients-Heuristik) |
| Design | LLGAN/Glass in Shell; **kein** durchgängiger Nachweis aller Unterseiten neu |

### Assist

| Kriterium | Bewertung |
|-----------|-----------|
| Navigation | **12/12 Routen funktional** im Scan (Einsätze, Durchführung, Nachweise, Fahrten, Touren getrennt, Live-Status, Qualität) |
| Vollständig neu aufgebaut | **nein / größtenteils funktional** — Checkliste: Modals gemischt, Kalender-Sync 🟡 |
| E2E-Daten | **ja** in `/assist/assignments` |
| Nachweis-Freigabe E2E | **nicht** im Browser abgeschlossen (C.13R.6) |

### Mitarbeiterportal

| Kriterium | Bewertung |
|-----------|-----------|
| Login & Navigation | **ja** — Heute, Einsätze, Nachrichten, Dokumente, Profil laden |
| Vollständig neu aufgebaut | **teilweise** — Shell/Tabs OK; **Durchführung schwach** |
| E2E-Einsätze | **nein** — `assignments`-Tabelle vs. Seed `assist_visits` |
| Execution-Service | Live-Modus blockiert Demo-Pfade (`blockDemoOnlyInLiveMode`) für Teile der Einsatzübersicht |

### Klient:innenportal

| Kriterium | Bewertung |
|-----------|-----------|
| Navigation | **5/5 funktional** im Scan |
| Vollständig neu aufgebaut | **teilweise** — Routen & Inhalte OK; Freigabe-/Nachrichten-E2E offen |
| Freigabebasiert | Termine/Inhalte sichtbar; Nachweis-Freigabe nicht E2E nachgewiesen |

## Design-Reality-Check

| Signal | Gefunden? |
|--------|-----------|
| Technische Texte (RLS, object Object, Repository erweitern) | **nein** im automatisierten Text-Scan |
| Platzhalter / Mock-only | **nein** im Scan |
| Dunkle Restdesigns | **nicht automatisch** nachgewiesen; Alt-Berichte: gemischte Modals/Assist |
| Weiße Vollflächen / alte Tabellen | **punktual behoben** (Client-Liste), nicht flächendeckend |
| Fremde Mandanten | **nein** |

## Datenfluss-Reality-Check

| Link | Status |
|------|--------|
| Office → Assist | **teilweise** — Stammdaten in Assist nutzbar; nicht jede Akten-Tiefe geprüft |
| Assist → Mitarbeiterportal | **rot** — `assist_visits` ≠ Portal `assignments` |
| Assist/Office → Klient:innenportal | **teilweise** — Kalender/Termine; Freigabe nicht E2E |
| Nachrichten | **rot** — nicht gesendet/nachgewiesen |
| Nachweis/Freigabe | **rot** — nicht abgeschlossen |

## Harte Nicht-Ziele

LiveBackfill Apply, K.6, Rechnungen, Deploy, Seed-Änderungen, produktive Löschungen: **nicht ausgeführt**.

## Tests

- `src/__tests__/contentPortal`: **14/14 grün**
- Typecheck: **921 Fehler** (Baseline, `.audit-typecheck-ui-reality-audit.log` truncated tail)

## Empfehlung

**Nicht** als „komplett neu aufgebaut“ freigeben.

1. **Kurzfristig (C.13R.7):** Datenpfad-Alignment (`assignments` ↔ `assist_visits`), Portal-Execution-Live-Pfad, Nachrichten- und Nachweis-E2E — wenn Scope klein bleiben soll.
2. **Mittelfristig (C.14):** Komplett-Rebuild der Unterseiten mit Seiteninventar, einheitlichem LLGAN/Glass, Workflow-Definition pro Route — entspricht der ursprünglichen Nutzererwartung.

Priorität P0: Mitarbeiterportal-Durchführung + Daten-Sync, dann Nachrichten/Nachweis-E2E, dann Office-Unterseiten-Tiefe (Akte, Anlegen, Portal-Freigaben UI).

## Artefakte

- Matrix: `docs/audit/content-portal-ui-reality-audit-matrix.md`
- Master: `docs/audit/content-portal-ui-reality-audit-master.md`
- JSON: `.audit-content-portal-ui-reality-audit.json` (nicht committed)
- Screenshots: `docs/audit/content-portal-ui-reality-audit-screenshots/`
