# P0-B — Remaining Errors (326)

## Verteilung nach Fehlercode

| Code | Count | Beschreibung |
|------|-------|-------------|
| TS2322 | 109 | Type not assignable to type |
| TS2345 | 53 | Argument type not assignable |
| TS2339 | 49 | Property does not exist on type |
| TS2769 | 26 | No overload matches this call |
| TS2353 | 19 | Object literal unknown properties |
| TS2554 | 15 | Expected N arguments, got M |
| TS2352 | 11 | Conversion may be a mistake |
| TS2367 | 6 | No overlap between types |
| TS2741 | 5 | Missing properties |
| TS2305 | 5 | No exported member |
| TS2540 | 4 | Cannot assign to read-only |
| TS2739 | 4 | Missing properties from type |
| TS18049 | 3 | Possibly null/undefined |
| TS2559 | 3 | No common properties |
| TS2783 | 3 | Required property missing |
| Sonstige | 11 | (TS2590, TS7016, TS7053, TS2344, TS2820, TS2740, TS2303) |

## Top 20 Dateien mit verbleibenden Fehlern

| Datei | Fehler | Kategorie |
|-------|--------|-----------|
| `__tests__/supabase/clientRecordFix.test.ts` | 9 | Test: read-only env + PostgrestError typing |
| `__tests__/clients/clientIntakeFormMappers.test.ts` | 8 | Test: SensitivityLevel/DataVisibilityScope types |
| `lib/services/repositories/stationaerCalendarRepository.supabase.ts` | 5 | Supabase query typing |
| `design/components/GlassCard.tsx` | 5 | Component prop types |
| `lib/stationaer/residentListService.ts` | 5 | Service types |
| `lib/akademie/courseListService.ts` | 5 | Service types |
| `components/csv/CsvImportExportScreen.tsx` | 5 | Component types |
| `screens/assist/AssignmentExecutionScreen.tsx` | 5 | Screen types |
| `features/intakeDocuments/intakeDocumentRepository.ts` | 4 | Repository types |
| `features/communication/communication.service.ts` | 4 | Service types |
| `components/screensaver/ScreensaverOverlay.tsx` | 4 | Component types |
| `lib/portal/engine/fetchPortalWidgetData.ts` | 4 | Widget data types |
| `data/demo/clients/helga-schneider.ts` | 4 | Demo data types |
| `data/demo/clients/werner-mueller.ts` | 4 | Demo data types |
| `components/portal/assist/PortalGlassHero.tsx` | 4 | Component types |
| `lib/clients/clientIntakeCostBearerConfig.ts` | 4 | Config types |
| `__tests__/clients/clientIntakeDocuments.test.ts` | 4 | Test types |
| `lib/assist/managementTaskAutomationService.ts` | 4 | Service types |
| `app/_layout.tsx` | 4 | App layout types |
| `components/assist/StatusBadgesDropdown.tsx` | 3 | Component types |

## Empfehlung für P0-C

1. **TS2322 (109)**: Viele durch Interface-Erweiterungen in Datenmodellen fixbar — `ClientEditFormData`, `ClientRecord`, Demo-Daten
2. **TS2345 (53)**: Service-Funktionssignaturen anpassen oder Argument-Typen korrigieren
3. **TS2339 (49)**: Restliche Property-Erweiterungen in Typen (stationär, akademie, portal)
4. **TS2769 (26)**: Verbleibende React Native Web-Style-Kompatibilitätsprobleme
5. **Test-Dateien (~25 Fehler)**: Test-spezifische Typen und Mocks anpassen

## Phantom Tables (aus P0-A — weiterhin dokumentiert)

Diese Tabellen existieren im Code aber nicht in der Remote-Supabase-DB:

| Tabelle | Code | Realtime Presets | Status |
|---------|------|-----------------|--------|
| `employee_time_entries` | ✅ | ❌ | Phantom — nur Code |
| `assignment_executions` | ✅ | ✅ | Phantom — Code + Presets |
| `proofs` | ✅ | ❌ | Phantom — nur Code |
| `portal_releases` | ✅ | ❌ | Phantom — nur Code |
| `live_operation_events` | ✅ | ✅ | Phantom — Code + Presets |
| `employee_absences` | ✅ | ✅ | Phantom — Code + Presets |

Diese verwenden `fromUnknownTable()` oder string-basierte Subscriptions und verursachen keine Typecheck-Fehler. Eine Migration benötigt explizite Genehmigung und Schema-Design.
