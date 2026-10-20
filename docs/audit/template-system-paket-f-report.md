# CareSuite+ Paket F — Vorlagen-, Katalog- und Dropdown-System

**Datum:** 13.06.2026  
**Sprint:** Paket F — Zentrales Template Center  
**Quality Gates:** `typecheck` ✅ · `test` 199/199 ✅ · `smoke` ✅

---

## A. Executive Summary

Paket F liefert ein zentrales **Template Center** unter `/business/templates` mit System- und Mandantenvorlagen, Katalogen für Dropdowns, variablenfähigen Textbausteinen und Service-Mode-Routing (Demo vs. Live Supabase ohne stillen Fallback).

**Verdict:** Vorlagensystem **demo-fähig** und **P-READY**. Nicht **P-PROD**, solange Migration 0014 nicht auf Remote-Supabase angewendet und E2E nicht verifiziert ist.

---

## B. Erstellte Screens

| Route | Screen |
| ----- | ------ |
| `/business/templates` | `TemplateCenterScreen` — KPIs, Schnellaktionen |
| `/business/templates/system` | `SystemTemplatesScreen` |
| `/business/templates/tenant` | `TenantTemplatesScreen` |
| `/business/templates/catalogs` | `CatalogsScreen` |
| `/business/templates/text-blocks` | `TextBlocksScreen` |
| `/business/templates/document-templates` | `DocumentTemplatesScreen` |
| `/business/templates/message-templates` | `MessageTemplatesScreen` |
| `/business/templates/billing-templates` | `BillingTemplatesScreen` |
| `/business/templates/care-templates` | `CareTemplatesScreen` |
| `/business/templates/counseling-templates` | `CounselingTemplatesScreen` |
| `/business/templates/academy-templates` | `AcademyTemplatesScreen` |
| `/business/templates/consent-templates` | `ConsentTemplatesScreen` |
| `/business/templates/categories` | `TemplateCategoriesScreen` |
| `/business/templates/settings` | `TemplateSettingsScreen` |
| `/business/templates/create` | `TemplateCreateScreen` |
| `/business/templates/[id]` | `TemplateDetailScreen` |
| `/business/templates/[id]/edit` | `TemplateEditScreen` |

Alle Screens: Titel, Untertitel, Loading/Error/Empty, `PreparedTemplateBanner` (D-DEMO / P-READY / P-PROD).

---

## C. Erstellte Komponenten

`src/components/templates/`:

- `TemplateCard`, `TemplateListItem`, `TemplateEditor`, `TemplatePreview`
- `TemplateCategoryBadge`, `TemplateStatusBadge`, `TemplateModuleBadge`
- `TemplateVariablePicker`, `TemplateUsagePanel`
- `TemplateDropdownSelect`, `CatalogValueSelect`, `TextBlockPicker`
- `PreparedTemplateBanner`

---

## D. Datenmodelle und Migrationen

**Types:** `src/types/templates/index.ts` — `CareSuiteTemplate`, `CatalogEntry`, `CatalogType`, Filter-/Create-Inputs, Dashboard-Stats.

**Migration:** `supabase/migrations/0014_templates_catalogs_and_dropdowns.sql`

Tabellen: `templates`, `template_versions`, `template_categories`, `catalog_entries`, `template_usage_logs`, `tenant_template_settings`

- RLS: Mandant sieht `tenant_id IS NULL` (System) + eigene Zeilen
- Keine DROP/TRUNCATE/DELETE
- Mandant darf Systemvorlagen nicht überschreiben (UPDATE nur auf `tenant_id = current`)

---

## E. Services und Hooks

**Services** (`src/lib/templates/`):

- `templateService.ts` — list/get/create/update/archive/duplicate/search/dashboard/usage
- `catalogService.ts` — list/create/update/archive/getDropdownOptions
- `templateRepository.demo.ts` — In-Memory-Persistenz Demo
- `templateRepository.supabase.ts` — Live (wirft bei fehlendem Client)
- `templateVariables.ts`, `templatePermissions.ts`

**Hooks** (`src/hooks/templates/`): `useTemplates`, `useTemplateDetail`, `useTemplateEditor`, `useCatalogEntries`, `useDropdownOptions`, `useTextBlocks`, `useTemplateVariables` — alle mit `useServiceTenantId()`, kein `DEMO_TENANT_ID` in Live-Hooks.

---

## F. Demo-Vorlagen

Modulare Seeds unter `src/data/demo/templates/`:

- Module: Office, Assist, Pflege, Stationär, Beratung, Akademie, Communication, Billing, Documents, TI, Reporting, QM, Portal, Care Records
- **495 Systemvorlagen**, **201 Katalogeinträge** (modulare Seeds in `src/data/demo/templates/modules/` und `catalogs/`)

---

## G. Dropdown-Anbindungen

| Formular | Komponente | Katalog/Vorlage |
| -------- | ---------- | --------------- |
| `ClientCreateScreen` | Katalog-gestützte Task-Chips | `task_category` |
| `OfficeDocumentUploadScreen` | `CatalogValueSelect` | `document_category`, `upload_category` |
| `NewConversationScreen` | `CatalogValueSelect` + `TemplateDropdownSelect` | `message_category`, message templates |
| `ComposeMessageForm` | `TemplateDropdownSelect` (optional) | `communication` / `message` |

Regeln: Systemkatalog als Fallback; Mandantenwerte ergänzen; keine leeren Dropdowns wenn Systemdaten vorhanden.

---

## H. Was ist demo-fähig?

- Template Center Dashboard mit KPIs und Navigation
- Systemvorlagen-Listen nach Modul/Typ
- Mandantenvorlage anlegen, bearbeiten, archivieren (Demo-Repo)
- Systemvorlage als Mandant kopieren
- Katalog-Listen und Dropdown-Komponenten
- Variablen-Rendering `{{variable}}`
- Nutzungsprotokoll (Demo in-memory)

---

## I. Was ist P-READY?

- Supabase-Migration 0014 vorbereitet mit RLS
- `templateRepository.supabase.ts` implementiert
- Service-Mode: Live ohne Supabase → kontrollierter Fehler, **kein** Demo-Fallback bei `DEMO_MODE=false`
- `PreparedTemplateBanner` kennzeichnet D-DEMO / P-READY / P-PROD
- Tests in `src/__tests__/templates/templateSystem.test.ts`

---

## J. Was ist noch nicht P-PROD?

- Remote `supabase db push` für 0014 nicht ausgeführt
- Kein E2E gegen echte Supabase-Instanz für Templates/Kataloge
- Billing-/Service-Type-Dropdowns in Klient:innen-Wizard noch teilweise hardcoded (kein `CatalogType` dafür im Modell)
- Template-Versionierung (`template_versions`) nur Schema, kein UI
- QM/Portal-weite Vorlagen-Nutzung in allen Modul-Forms noch nicht vollständig durchgängig

---

## K. Quality Gates

| Gate | Ergebnis |
| ---- | -------- |
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ 199/199 |
| `npm run smoke` | ✅ |

---

## L. Nächste Schritte

1. Migration 0014 auf Pilot-Supabase anwenden und RLS testen
2. Systemvorlagen per SQL/Seed in Remote-DB laden
3. Billing-/Service-Type als `CatalogType` ergänzen oder Office-Wizard vollständig anbinden
4. Modul-Forms schrittweise auf `CatalogValueSelect` / `TextBlockPicker` umstellen
5. Template-Versionierung und Approval-Workflow (P2)

**Finale Aussage:** Vorlagensystem demo-fähig · Vorlagensystem P-READY · nicht produktiv vollständig, solange Remote-Supabase nicht geprüft ist.
