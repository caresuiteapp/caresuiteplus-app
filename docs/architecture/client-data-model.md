# Klient:innen-Datenmodell (CareSuite+)

Erweitertes digitales Aktenmodell für Office-Klient:innen.  
Typen: `src/types/modules/client/` · Migration: `supabase/migrations/0010_client_extended.sql`

## Übersicht

| Bereich | TypeScript | DB-Tabelle | Portal-sichtbar |
|---------|------------|------------|-----------------|
| Stammdaten | `clientCore.ts` | `clients` (+ lifecycle_status, insurance_number, …) | Teilweise |
| Kontakt & Adresse | `clientContact.ts`, `clientAddress.ts` | `client_contacts`, `client_addresses` | Kontakte mit Freigabe |
| Pflegegrad & Kassen | `clientCareLevel.ts` | `client_care_levels` | Nein |
| Budget §45b/§45a | `clientBudget.ts` | `client_budgets`, `budget_transactions` | Nein |
| Vertrag & Abrechnung | `clientBilling.ts` | `client_billing_profiles`, `client_contracts` | Nein |
| Einsatz & Aufgaben | `clientPreferences.ts`, `clientTasks.ts` | `client_preferences`, `client_tasks` | Nein |
| Risiken & Notfall | `clientRisks.ts` | `client_risks` | Nein |
| Dokumente | `clientDocuments.ts` | `client_documents` | Mit Einwilligung |
| Einwilligungen | `clientConsents.ts` | `client_consents` | Status nur |
| Portal | `clientPortal.ts` | `client_portal_access` | Ja |
| Verlauf | `clientTimeline.ts` | `client_timeline_events` | Ohne interne Einträge |
| Interne Notizen | `clientTimeline.ts` | `client_notes` | **Niemals** |

## Sensible Felder

| Feld | Typ | Markierung | Portal |
|------|-----|------------|--------|
| Versichertennummer | `insuranceNumber` | `SENSITIVE_CLIENT_CORE_FIELDS` | Nein |
| Schlüsseltresor-Code | `keySafeCode` | sensibel | Nein |
| Diagnosen | `diagnoses[]` | sensibel | Nein |
| Interne Notizen | `internalNotes` | `isInternal: true` | **Niemals** |

Erzwingung: `src/lib/clients/portalFilter.ts`, `clientNotesService.fetchClientNotesForPortal()` liefert immer `[]`.

## v1-Mindestfelder (Wizard)

| Schritt | Felder |
|---------|--------|
| 1 Stammdaten | Vorname, Nachname, Geburtsdatum |
| 2 Adresse & Kontakt | Straße, PLZ, Ort, Telefon |
| 3 Pflegegrad & Abrechnung | Pflegegrad, Pflegekasse, Abrechnungsart, Vertragsbeginn, Leistungsart, Stundensatz |
| 4 Notfall & Aufgaben | Notfallkontakt, Aufgabenkategorien |
| 5 Einwilligungen | Datenschutz, Vertrag |

## Berechtigungen

| Permission | Zweck |
|------------|-------|
| `office.clients.view` | Lesen aller Bereiche |
| `office.clients.view_sensitive` | Sensible Gesundheitsdaten |
| `office.clients.manage_consents` | Einwilligungen |
| `office.clients.manage_contacts` | Kontakte & Angehörige |
| `office.clients.edit` | Schreiben (RLS) |
| `office.clients.create` | Anlegen |

## Demo-Daten

| ID | Name | Vollständig |
|----|------|-------------|
| client-001 | Helga Schneider | Ja |
| client-002 | Werner Müller | Ja |
| client-003+ | Übrige Demo-Clients | Fallback-Minimal |

Aufgabenkatalog: `src/data/demo/clients/taskCatalog.ts` (17 vordefinierte Aufgaben)

## Deferred (vollständige Spezifikation)

- Pflege-Stubs (`care_plans`, `vital_signs`, …) nur DB-Schema, keine UI
- `service_records` / `budget_transactions` Verknüpfung zu Rechnungen
- Supabase-Repository für Extended Services (aktuell Demo-Modus)
- CRUD-UI für Kontakte, Budgets, Risiken inline
- Workflow-Status vs. `lifecycleStatus` Harmonisierung

## Referenz

Siehe auch [data-model.md](./data-model.md) für Plattform-Kernentitäten.
