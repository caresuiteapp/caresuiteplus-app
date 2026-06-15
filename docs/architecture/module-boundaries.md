# CareSuite+ — Modulgrenzen

## Business-Kernmodule

| Modul | Key | Zuständigkeit | Typen-Pfad |
|-------|-----|---------------|------------|
| Office | `office` | Klient:innen, Mitarbeitende, Termine, Dokumente, Rechnungen | `src/types/modules/office.ts` |
| Assist | `assist` | Alltagsbegleitung, Einsätze, Betreuungsnachweise | `src/types/modules/assist.ts` |
| Pflege | `pflege` | Pflegeplanung, Vitalwerte, Wunddokumentation | `src/types/modules/pflege.ts` |
| Stationär | `stationaer` | Bewohner:innen, Zimmer, Übergaben | `src/types/modules/stationaer.ts` |
| Beratung | `beratung` | Beratungsfälle, Protokolle | `src/types/modules/beratung.ts` |
| Akademie | `akademie` | Kurse, Lektionen, Zertifikate | `src/types/modules/akademie.ts` |

## Querschnittsmodule

| Bereich | Key | Zuständigkeit | Typen-Pfad |
|---------|-----|---------------|------------|
| AI | `ai` | KI-Aufgaben, Vorschläge | `src/types/modules/platform.ts` |
| OCR | `ocr` | Dokumentenerkennung | `src/types/modules/platform.ts` |
| Telemedizin | `telemedicine` | Videosprechstunden | `src/types/modules/platform.ts` |
| Integrationen | `integrations` | Externe Anbieter, Outbox | `src/types/modules/integrations.ts` |
| Reporting | `reporting` | Auswertungen, KPIs | (ab späteren WPs) |
| Operations | `operations` | Betrieb, Incidents, Backups | `src/types/modules/integrations.ts` |

## Dateigrenzen pro Modul (Zielstruktur)

```
app/[modul]/           → Routen & Screens
src/lib/[modul]/       → Services, Mapper
src/types/modules/     → Interfaces
src/data/demo/[modul]/ → Demo-Fixtures (ab WP 011)
```

## Abhängigkeitsregeln

- `app/` darf `src/components`, `src/hooks`, `src/lib` importieren — nie umgekehrt.
- `src/types/` ist schichtenübergreifend und importiert nichts aus `app/` oder `lib/`.
- `src/data/demo/` importiert nur aus `src/types/`.
- Services in `src/lib/` mappen Supabase-Zeilen auf `src/types/`-Interfaces.
