# Homeoffice-Arbeitszeit & Tätigkeitsnachweis — Abnahmebericht

**Datum:** 2026-06-23  
**Migration:** `0161_homeoffice_time_tracking.sql`  
**Modul:** CareSuite+ Homeoffice-Arbeitszeit & Tätigkeitsnachweis

## Was wurde gebaut

- **Datenbank (Migration 0161):** 12 Tabellen mit RLS, GRANTs und Permission-Seeds
  - `tenant_time_tracking_settings`, Kataloge (Organisation, Kostenstelle, Projekt, Tätigkeit)
  - `time_workdays`, `time_entries` (mehrere Blöcke/Tag, kein Mischzeit-Feld)
  - `time_activity_events` (nur Metadaten), Inaktivität, Hinweise, Korrekturen, Audit-Log (append-only, Hash-Kette)
- **Services:** `src/lib/timeTracking/` — Workday-Lifecycle, Inaktivität, Korrekturen, Ampel, Activity-Bridge, Multi-Tab, Export-Stubs
- **Permissions:** `time.tracking.own.*`, `time.tracking.team.view`, `time.tracking.admin.*`, `time.audit.view`, `time.settings.manage`
- **UI (LLGAN/Glass):** Mitarbeiter-Arbeitszeit, Einstellungen, Admin-Audit (8 Ansichten)
- **Navigation:** Office-Nav, Office-Einstellungen, Datenschutz-Hub → Arbeitszeit-Audit
- **Demo-Seed:** Neutrale Kataloge nur für Demo-Mandant (`DEMO_TENANT_ID`)

## Routen

| Route | Beschreibung |
|-------|--------------|
| `/business/office/time-tracking` | Mitarbeiter-Arbeitszeit (Start/Pause/Wechsel/Abschluss) |
| `/portal/employee/arbeitszeit` | Portal-Alias (gleiche Employee-Screen) |
| `/business/office/settings/time-tracking` | Einstellungen → Personal → Homeoffice & Arbeitszeit |
| `/business/office/time-tracking/audit` | Sicherheit & Compliance → Arbeitszeit-Audit |

## Tests

```
npx vitest run src/__tests__/timeTracking/timeTracking.test.ts
```

**Ergebnis:** 32/32 bestanden (`.audit-test-time-tracking.log`)

Abgedeckt: Start/Pause/Resume/Switch, Inaktivität, Warnung ab 3, Tag-Abschluss, Korrekturen, Audit append-only, Mandantenisolation, Multi-Tab, Integration-Stubs, Ampel, Export.

## Typecheck

`npm run typecheck` — projektweit weiterhin vorbestehende Fehler in anderen Modulen; neue Time-Tracking-Komponenten angepasst (async queries, SegmentControl-API). Log: `.audit-typecheck-time-tracking.log`

## Browser-Abnahme

**Status: BLOCKED** — localhost:8082 nicht automatisch geprüft (Auth/Dev-Server nicht verifiziert). Screenshots unter `docs/audit/screenshots/time-tracking/` ausstehend bei manueller Session.

## §39 Acceptance Checklist

| Kriterium | Status |
|-----------|--------|
| Keine Surveillance (nur Metadaten) | ✅ |
| Mehrere Zeitblöcke, Tätigkeitswechsel | ✅ |
| Mandantenisolation + RLS | ✅ (Migration lokal) |
| Append-only Audit, Gegenbuchung | ✅ |
| Inaktivität 5 min / Antwort 2 min / Hinweis ab 3 | ✅ |
| Datenschutz-Einwilligung first use | ✅ (Modal) |
| Permissions nach Rolle | ✅ |
| Employee + Settings + Audit UI | ✅ |
| Unit-Tests ≥30 | ✅ (32) |
| Demo-Seed neutral | ✅ |
| Microsoft/Google OAuth live | ⏳ Phase 2 (Stubs only) |
| Supabase Live-Persistence | ⏳ Phase 2 (In-Memory Store + Migration bereit) |
| Browser-Screenshots | ⏳ BLOCKED |

## Known Gaps / Phase 2

- Supabase Repository-Layer (derzeit In-Memory Store wie employeeTime prepared)
- Echte Microsoft/Google OAuth und Telefon-Metadaten-Webhooks
- Globaler Navigation-Hook für `timeTrackingActivityBridge` bei Route-Wechsel
- Realtime-Sync (`presets.ts` subscription stub existiert)
- Migration auf Remote-DB (`db push`) — bewusst nicht ausgeführt

## Prinzipien eingehalten

- Kein Keylogging, Screenshots, Webcam, Maus-Tracking
- Keine feste „Mischzeit“-Option
- Keine Bestrafungs-/Betrugs-Sprache in UI oder Hinweisen
- Keine hardcodierten Firmennamen (Demo: Musterpflege-Stil)
