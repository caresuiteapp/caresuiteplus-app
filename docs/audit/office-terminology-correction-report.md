# Office-Terminologie-Korrektur

**Datum:** 2026-06-14  
**Scope:** CareSuite+ zentrale Verwaltung — einheitliche Benennung **CareSuite+ Office** / **Office**

## Regel

| Verboten | Erlaubt |
|----------|---------|
| OfficeCore, CareSuite+ OfficeCore | CareSuite+ Office |
| Core Office, Office-Core | Office (Kurzform) |
| zentrale Core-Verwaltung | zentrale Verwaltung, Verwaltungsbereich, Office-Modul |

## Umgesetzt

- **UI-Strings:** Screens, Heroes, Badges, Navigation (`shellConfig`), Modul-Tokens, Demo-Dashboard, Modulzuordnungs-Hub
- **Tests:** Assertions auf `CareSuite+ Office` / `Office` angepasst
- **Audit-Skript:** `scripts/office-terminology-audit.mjs` + npm `office:terminology:audit`
- **Content-Audit:** Log-Ausgabe auf Office-Terminologie aktualisiert
- **Docs:** Audit-Berichte in `docs/audit/` bereinigt

## Bewusst unverändert (intern)

- Ordner `src/lib/officeCore/` — Service-/Repository-Pfade
- Typen/Funktionen: `OfficeCoreStats`, `fetchOfficeCoreStats`, `officeCoreDemoRepository`
- Datei `officeCoreAssignments.ts` — Demo-Datenquelle
- Migration `0037_office_module_assignments.sql` — SQL-Schema

## npm

```bash
npm run office:terminology:audit
```

Schlägt fehl, wenn verbotene Begriffe in nutzer-sichtbaren Pfaden (`src/screens`, `src/components`, `app`, `docs`, Tests, …) vorkommen.

## Status

**Audit:** `npm run office:terminology:audit` — grün (1757 Dateien, 0 Verstöße in UI-Pfaden).

**Verbleibend (intern, bewusst):** `src/lib/officeCore/` — Code-Identifikatoren unverändert.

Kein Store-/Produktions-Release. Terminologie-Korrektur für konsistente Produktbezeichnung im Demo-Prototyp.
