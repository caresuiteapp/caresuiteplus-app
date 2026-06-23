# Content Portal UI Reality Audit — Seitenmatrix (C.13R.6A)

**Datum:** 2026-06-23 · **Umgebung:** `https://caresuiteplus.app` (production)

Legende Bewertung: `funktional` · `inhalt_ohne_workflow` · `teilweise` · `leer_datenpfad` · `kaputt` · `blockiert`

| Bereich | Route | Navigation | Erreichbar | Inhalt | Funktion | Daten | Design neu | Tech-Text | Platzhalter | Screenshot | Bewertung | Maßnahme |
|---------|-------|------------|------------|--------|----------|-------|------------|-----------|-------------|------------|-----------|----------|
| Office | `/office` | ja | ja | ja | ja | live/test | teilweise (Hero) | nein | nein | office-dashboard.png | funktional | Dashboard OK; Unterseiten-Tiefe prüfen |
| Office | `/business/office/clients` | ja | ja | ja* | ja* | live | teilweise | nein | nein | office-clients.png | teilweise/inhalt | Listen-Route; Akte/Anlegen separat |
| Office | `/business/office/employees` | ja | ja | ja | ja | live | teilweise | nein | nein | office-employees.png | funktional | Liste nutzbar |
| Office | `/business/messages` | ja | ja | schwach | schwach | unklar | teilweise | nein | nein | office-messages.png | teilweise | Sendflow nicht E2E nachgewiesen |
| Office | `/office/documents` | ja | ja | ja | ja | live | teilweise | nein | nein | office-documents.png | funktional | — |
| Office | `/business/office/settings/time-tracking` | ja | ja | ja | ja | live | teilweise | nein | nein | office-settings.png | funktional | Stichprobe Einstellungen |
| Office | `/office/catalogs` | ja | ja | ja | ja | live | teilweise | nein | nein | office-catalogs.png | funktional | Kataloge erreichbar |
| Assist | `/assist` | ja | ja | ja | ja | live | teilweise (Dashboard-Fix) | nein | nein | assist-dashboard.png | funktional | Dashboard neu aligniert, nicht alle Subflows |
| Assist | `/assist/assignments` | ja | ja | ja | ja | live (assist_visits) | teilweise | nein | nein | assist-assignments.png | funktional | E2E sichtbar |
| Assist | `/assist/durchfuehrung` | ja | ja | ja | ja | live | teilweise | nein | nein | assist-execution.png | funktional | Workflow vorhanden, Tiefe manuell |
| Assist | `/assist/nachweise` | ja | ja | ja | ja | live | teilweise | nein | nein | assist-proofs.png | funktional | Freigabe-UI nicht E2E abgeschlossen |
| Assist | `/assist/aufgaben` | ja | ja | ja | ja | live | teilweise | nein | nein | assist-tasks.png | funktional | — |
| Assist | `/assist/fahrten` | ja | ja | ja | ja | live | teilweise | nein | nein | assist-trips.png | funktional | ≠ Touren (getrennt) |
| Assist | `/assist/touren` | ja | ja | ja | ja | live | teilweise | nein | nein | assist-routes.png | funktional | Eigene Touren-Route |
| Assist | `/assist/calendar` | ja | ja | ja | ja | live | teilweise | nein | nein | assist-calendar.png | funktional | Kalender-Sync laut Alt-Bericht 🟡 |
| Assist | `/assist/live-status` | ja | ja | ja | ja | live | teilweise | nein | nein | assist-live-status.png | funktional | — |
| Assist | `/assist/qualitaet` | ja | ja | ja | ja | live | teilweise | nein | nein | assist-quality.png | funktional | Kein „Repository erweitern“ im Scan |
| Assist | `/assist/zugeordnete-klienten` | ja | ja | ja | ja | live | teilweise | nein | nein | assist-assigned-clients.png | funktional | — |
| Assist | `/assist/einstellungen` | ja | ja | ja | ja | live | teilweise | nein | nein | assist-settings.png | funktional | — |
| Mitarbeiterportal | `/portal/employee` | ja | ja | ja | ja | live/demo mix | teilweise (LLGAN) | nein | nein | employee-dashboard.png | funktional | Shell OK |
| Mitarbeiterportal | `/portal/employee/assignments` | ja | ja | ja | ja | **assignments** (leer E2E) | teilweise | nein | nein | employee-assignments.png | funktional* | *UI lädt, E2E-Einsatz fehlt |
| Mitarbeiterportal | `/portal/employee/execution` | ja | ja | schwach | schwach | live block | teilweise | nein | nein | employee-execution.png | teilweise | Durchführung ohne Einsatz/Workflow |
| Mitarbeiterportal | `/portal/employee/messages` | ja | ja | ja | ja | live | teilweise | nein | nein | employee-messages.png | funktional | Senden nicht E2E |
| Mitarbeiterportal | `/portal/employee/documents` | ja | ja | ja | ja | live | teilweise | nein | nein | employee-documents.png | funktional | — |
| Mitarbeiterportal | `/portal/employee/profile` | ja | ja | ja | ja | live | teilweise | nein | nein | employee-profile.png | funktional | — |
| Klient:innenportal | `/portal/client` | ja | ja | ja | ja | live | teilweise (seniorenfreundlich 🟡) | nein | nein | client-dashboard.png | funktional | — |
| Klient:innenportal | `/portal/client/appointments` | ja | ja | ja | ja | live/calendar | teilweise | nein | nein | client-appointments.png | funktional | Termine sichtbar |
| Klient:innenportal | `/portal/client/messages` | ja | ja | ja | ja | live | teilweise | nein | nein | client-messages.png | funktional | Senden nicht E2E |
| Klient:innenportal | `/portal/client/documents` | ja | ja | ja | ja | released only | teilweise | nein | nein | client-documents.png | funktional | Freigabe-Flow offen |
| Klient:innenportal | `/portal/client/profile` | ja | ja | ja | ja | live | teilweise | nein | nein | client-profile.png | funktional | — |

\* Automatischer Scan: `hasContent`/`hasFunction` heuristisch; manuelle C.13R.6-E2E ergänzt Lücken bei Nachrichten/Freigabe.

## Datenfluss-Matrix

| Pfad | Geprüft | Ergebnis |
|------|---------|----------|
| Office → Assist (Klient/Mitarbeiter/Einsatz) | ja | **teilweise** — Assist `assist_visits` zeigt E2E |
| Assist → Mitarbeiterportal | ja | **rot** — Portal liest `assignments`, Seed nur `assist_visits` |
| Office/Assist → Klient:innenportal | ja | **teilweise** — Termine sichtbar; Nachweis-Freigabe nicht E2E |
| Nachrichten Business → Portale | ja | **rot** — Routen laden, Senden nicht nachgewiesen |
| Nachweis/Freigabe → Klient:innenportal | ja | **rot** — nicht im Browser abgeschlossen |

## Anforderungsquellen (Auszug)

| Quelle | Kernanforderung | Erfüllt? |
|--------|-----------------|----------|
| `content-portal-live-data-rebuild-abnahmebericht.md` (C.10) | Live-Daten, Demo-Leak-Schutz, Portal-Freigabe-UI, ModalStack | **teilweise** — Daten/Guards, kein Voll-Rebuild aller Seiten |
| `assist-abnahme-checklist-status.md` | Assist-Navigation vollständig; Modals 🟡; Office-Integration 🟡 | **teilweise** |
| `portal-system-abnahme-checklist-status.md` | Portal Shell, Projection, HTTP-Smoke | **größtenteils** — Browser-E2E partial |
| `responsive-shell-r1-*` | LLGAN/Glass Login & Portal Mobile | **teilweise** — Shell, nicht alle Unterseiten |
| `client-ui-reality-fix-*` | Tabellen/Klientenliste Lesbarkeit | **punktual** — kein Komplett-Rebuild |
| Nutzer C.13R.6A | Alle Unterseiten komplett neu: Design, Inhalte, Workflows | **nein** |
