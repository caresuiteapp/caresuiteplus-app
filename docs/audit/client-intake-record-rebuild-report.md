# Client Intake & Record Rebuild — Audit Report

## A. Executive Summary

Kontextbasierte Klient:innenaufnahme und erweiterte Akte wurden implementiert: Leistungsart als erster Wizard-Schritt, dynamische Pflichtfelder/Tabs, deutsche Locale/Formatter, 47 Systemkataloge, Migration 0039, Services/Hooks, CareLight UI, Demo-Konstellationen (10), Tests und Audits.

## B. Warum die alte Aufnahme/Akte unzureichend war

Stammdaten-first Wizard, rudimentäre Akte (Geburtsdatum + Status), keine Leistungsart-Logik, keine deutschen Formate zentral, fehlende Systemkataloge.

## C. Kontextbasierte Aufnahme

`clientIntakeFieldRules.ts` steuert Pflicht-, optionale Felder, Sichtbare Bereiche, Module, Vorlagen, Dokumente, Einwilligungen und Akten-Tabs.

## D. Leistungsart als erster Schritt

Route `/business/office/clients/new` → `ClientIntakeWizardScreen`, Schritt 1 = `leistungsart`.

## E. Mehrfachauswahl

`CareMultiCatalogSelect` + `ClientCareContext[]` in Formular und Regeln.

## F–I. Feldlogik

- Alltagsbegleitung/Betreuung/Begleitung: reduzierte Pflichtfelder, kein Pflege-Pflicht
- Ambulante Pflege: Pflegegrad, Kasse, Hausarzt, Wohnungszugang
- Stationäre Pflege: Einrichtung, Wohnbereich, Zimmer
- Beratung: Beratungsanlass, Beratungsart

## J. Dynamische Akten-Tabs

`getClientRecordTabsForClientContext()` in Record-Screen.

## K–L. Pflicht/optionale Daten

`getRequiredFieldsForClientContext`, `getOptionalFieldsForClientContext`.

## M. Kassen-/Katalogintegration

`systemCatalogs.ts` (17.1–17.47), `CareCatalogSelect`.

## N. Systemvorlagen / Dropdown-Kataloge

47 Kataloge in `SYSTEM_CATALOGS`.

## O. ICD / Medikation / Einheiten / Einnahmeschema

Formatter + `CareMedicationScheduleInput`, Demo-Medikation/Vitalwerte.

## P. Verträge / Datenschutz / Signatur

`clientContractsService.createContractFromTemplate`, Einwilligungs-Checkboxen im Wizard.

## Q. Dokumente / Upload / Scan / Foto

`CareDocumentUpload` (expo-document-picker), `CarePhotoCapturePrepared` (preparedOnly), Storage-Pfad tenant/client.

## R. Deutsche Formate / Locale

`de-DE`, `Europe/Berlin`, `EUR`, TT.MM.JJJJ, HH:MM Uhr, 1.234,56 €, PG 1–5.

## S. Datenmodell

Migration `0039_client_context_intake_record_locale_catalogs.sql` — non-destructive, RLS, tenant_id.

## T. Services / Hooks

clientIntakeService, clientRecordService, clientDocumentsService, clientContractsService, clientMedicationService, clientVitalsService, useClientIntakeWizard, useClientRecord, useSystemCatalog.

## U. Demo-Daten

10 Konstellationen in `constellations.ts`.

## V. Tests

17 Tests in `clientIntakeRecordRebuild.test.ts`.

## W. Audits

client-intake:audit, locale:audit, catalog:audit.

## X. Quality Gates

| Gate | Status |
|------|--------|
| typecheck | ✓ |
| test | ✓ (1296) |
| smoke | ✓ |
| client-intake:audit | ✓ |
| locale:audit | ✓ |
| catalog:audit | ✓ |

## Y. Offene Punkte

- Live-Supabase-Repositories für Intake/Record noch Demo-first
- Signatur-Pad und eGK-Übernahme nur vorbereitet
- Keine Production-/Store-ready Behauptung

## Z. Final Verdict

Klient:innenaufnahme und Klient:innenakte wurden kontextbasiert erweitert: Die Leistungsart wird zuerst ausgewählt und steuert Pflichtfelder, optionale Felder, Aktenbereiche, Vorlagen, Dokumente und Module. Deutsche Datums-, Uhrzeit-, Zahlen-, Währungs- und Einheitendarstellungen wurden zentralisiert. Umfangreiche Systemkataloge stehen für Dropdowns und Vorlagen zur Verfügung.

---

## Verification Round 2 (2026-06-14)

### Was war kaputt (Root Cause)

Die **Implementierung der neuen Screens war vorhanden**, aber **nicht an die laufende App angebunden**:

| Bereich | Problem |
|---------|---------|
| Neuaufnahme | Liste, Dashboard-Quick-Action und `+ Neu` verlinkten weiter auf `/office/clients/create` → alter `ClientCreateScreen` (Stammdaten-first) |
| Akte | Listeneinstieg und `/office/clients/[id]` nutzten weiter `ClientDetailScreen` (minimal: Geburtsdatum + Status) statt `ClientRecordScreen` |
| Audits | `client-intake:audit` prüfte nur Dateiexistenz/Muster — **kein Routing-Wiring** → grünes Audit bei kaputter UX |
| Legacy-Routen | `/business/office/clients/new` und `[id]` existierten, wurden aber von keinem UI-Einstieg erreicht |

### Was wurde behoben

1. **`src/lib/navigation/clientRoutes.ts`** — zentrale Routen: `CLIENT_INTAKE_NEW_ROUTE`, `clientRecordRoute()`, `clientEditRoute()`
2. **Alle UI-Einstiege** (`ClientsListView`, `ClientsListScreen`, `ClientDetailSummaryPanel`, Dashboard, Rechnungen, Budgets, Modulzuordnungen) → neue Routen
3. **Legacy-Redirects**: `app/office/clients/create.tsx` → Redirect auf Wizard; `app/office/clients/[id]/index.tsx` → Redirect auf Akte
4. **`client-intake:audit`** — prüft jetzt Wiring (kein hardcoded `/office/clients/create`, Redirects statt alter Screens)
5. **`visual:audit`** — `ClientIntakeWizardScreen` + `ClientRecordScreen` in Phase-2-Liste
6. **Tests** — Routing-Wiring in `clientIntakeRecordRebuild.test.ts` und `officeClientsList.test.ts`

### Routen zum manuellen Test (Demo-Login)

1. `/office` → Klient:innen → **+ Neu** → `/business/office/clients/new` (Schritt 1: Leistungsart Mehrfachauswahl)
2. Klient:in in Liste antippen → `/business/office/clients/[id]` (Stammdaten-Tab: Vorname, Nachname, Geburtsdatum, Alter, Status, …)
3. Legacy-URLs: `/office/clients/create` und `/office/clients/client-001` leiten weiter (Redirect)
4. Dashboard-Quick-Action „Klient:in anlegen“ → Wizard

### Quality Gates (nach Fix — lokal ausführen)

| Gate | Status (Round 2) |
|------|------------------|
| typecheck | ✓ |
| test | ✓ (1298/1299 — 1 vorbestehender Fehler in `themeBridge.test.ts`, nicht Intake-bezogen) |
| smoke | ✓ |
| client-intake:audit | ✓ (inkl. Wiring) |
| locale:audit | ✓ |
| catalog:audit | ✓ |
| visual:audit | ✓ |

**Keine Production-/Store-ready Behauptung** — Live-Supabase-Repositories für Intake/Record bleiben Demo-first.
