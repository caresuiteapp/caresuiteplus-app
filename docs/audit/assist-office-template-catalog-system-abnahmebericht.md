# Assist / Office Template & Catalog System — Abnahmebericht

**Task:** C.ASSIST-OFFICE-TEMPLATE.1  
**Datum:** 2026-06-25  
**Status:** Implementiert (Demo + migrationsbereit)

---

## 1. Executive Summary

CareSuite+ verfügt nun über ein mandantenfähiges Assist-Katalog- und Vorlagensystem mit Office-Steuerzentrale und Assist-Workflow-Anbindung. Systemkataloge werden aus [`src/data/seeds/assistCatalogSeeds.ts`](../src/data/seeds/assistCatalogSeeds.ts) bereitgestellt; Live-Persistenz erfolgt über Migrationen **0164–0166**. Assist „Neuer Einsatz“ nutzt tab-basierte Katalog-Auswahl; Einsatzdurchführung unterstützt Katalog-Gründe und Dokumentations-Quick-Chips.

---

## 2. Scope

- Office: Assist-Vorlagen & Kataloge Hub (15 Tabs)
- Assist: Neuer Einsatz (AssignmentCreateForm), Einsatzdurchführung (VisitTasksPanel, Dokumentation)
- Neuaufnahme: Leistungswunsch-Chips aus Office-Katalog
- DB: catalog_groups, catalog_definitions, catalog_items, template_bindings, catalog_audit_events
- Seeds: 30 Betreffe, 15 Aufgabenpakete, ~100+ Einzelaufgaben, Dokumentationsbausteine, Intake-Chips
- Tests + E2E-Skript

---

## 3. Geänderte / neue Dateien (Auswahl)

| Bereich | Dateien |
|---------|---------|
| Migrationen | `supabase/migrations/0164_assist_catalog_template_foundation.sql`, `0165_*`, `0166_*` |
| Types | `src/types/assistCatalog/index.ts` |
| Seeds | `src/data/seeds/assistCatalogSeeds.ts` |
| Services | `src/lib/assistCatalog/*` |
| Hooks | `src/hooks/assistCatalog/useAssistCatalog.ts` |
| Office UI | `src/screens/office/AssistCatalogHubScreen.tsx`, `src/components/office/assistCatalog/*` |
| Assist UI | `src/components/assist/AssignmentCreateForm.tsx`, `VisitTasksPanel.tsx` |
| Intake | `AssistCatalogMultiSelect` in `clientintakewizardform.tsx` |
| Permissions | `src/types/permissions/index.ts`, `staticRolePermissions.ts` |
| Tests | `src/__tests__/assistCatalog/assistCatalogSystem.test.ts` |
| E2E | `.audit-assist-office-template-browser.mjs` |

---

## 4. Datenmodell

- **catalog_groups** — Gruppen (Assist Einsatz, Neuaufnahme, …)
- **catalog_definitions** — Katalog-Metadaten (Spec: `catalogs`; Name wegen Akademie-`catalogs`-Tabelle)
- **catalog_items** — Einträge inkl. Paket→Task via `parent_item_id`
- **catalog_item_deactivations** — Mandant deaktiviert Systemeinträge
- **template_bindings** — UI-Feldbindungen
- **catalog_audit_events** — append-only Audit
- **assist_visits** erweitert um Katalog-Keys und `catalog_snapshot_json`
- **assist_visit_tasks** erweitert um `not_completed_reason_key`, `note`

---

## 5. Seed-Daten

Vollständige Systemkataloge in TS (Demo-Fallback + Test-SSoT). SQL-Migration 0166 seedet Gruppen, Definitionen und Bindings idempotent.

---

## 6. Office-Verwaltung

Route: `/business/office/settings/assist-catalogs`  
Link in Office-Einstellungen. 15 Tabs mit echten CRUD-Editoren für Katalogeinträge.

---

## 7. Assist-Integration

- `loadAssistAssignmentOptions` aggregiert alle Neuer-Einsatz-Kataloge
- AssignmentCreateForm: 9 Abschnitts-Tabs, Paket→Task-Auto-Load
- VisitTasksPanel: Status + Katalog-Gründe + Pflichtnotiz
- VisitExecutionScreen: Dokumentations-Quick-Chips

---

## 8–13. Neuer Einsatz / Durchführung / Neuaufnahme / Dokumentation / Nachweis

Implementiert gemäß Plan; Leistungsnachweis über `generateDocumentFromTemplate` (HTML-Interpolation, erweiterbar an document_templates).

---

## 14. Rechte / RLS / Mandantentrennung

- RLS auf allen neuen Tabellen (tenant + system read)
- Feingranulare Keys: `office.catalogs.create/update/...`, `assist.assignment.use_templates`, …
- Demo-Repository tenant-isoliert; Supabase RLS für Live

---

## 15. Tests

`src/__tests__/assistCatalog/assistCatalogSystem.test.ts` — Seeds, Tenant-Isolation, Paket-Tasks, Audit.

---

## 16. Browser-Abnahme

Skript: `.audit-assist-office-template-browser.mjs`  
Screenshots: `.audit-assist-office-template-screenshots/` (nach Ausführung mit laufendem Dev-Server + Credentials)

---

## 17. Screenshots

| Viewport | Datei |
|----------|-------|
| Desktop Office | `desktop-office-hub.png` |
| Desktop Assist Create | `desktop-assist-create.png` |
| Tablet Office | `tablet-office-hub.png` |
| Mobile Assist | `mobile-assist-list.png` |

---

## 18. Bekannte Einschränkungen

- Vollständige `catalog_items` SQL-Seeds: Items primär via TS/Demo-Fallback bis Bootstrap auf Live-DB
- `generated_documents` Types in `types.ts` noch nicht regeneriert
- AssignmentCreateWizard bleibt als Legacy; AssignmentCreateForm ist Standard
- Import/Export: JSON-Export implementiert; CSV/Import-Vorschau minimal

---

## 19. Nicht erledigte Punkte

- Vollständige HTML-Dokumentvorlagen-Editor-Integration für alle 19 Dokumentarten
- Alle Intake-Sections vollständig von `systemCatalogs` auf Assist-Kataloge umgestellt (nur Leistungswunsch ergänzt)
- Live-Migration 0164–0166 auf Remote-Supabase (manuell anwenden)

---

## 20. Abschlussbewertung

| Kriterium | Status |
|-----------|--------|
| Office Hub vorhanden | ✅ |
| Systemkataloge & Seeds | ✅ (TS vollständig, SQL Struktur) |
| Assist Neuer Einsatz Kataloge | ✅ |
| Paket→Tasks | ✅ |
| Execution Gründe + Doc-Chips | ✅ |
| Mandantentrennung / RLS | ✅ |
| Tests | ✅ |
| Browser-Skript | ✅ (Ausführung env-abhängig) |

**Gesamt:** Funktionsfähig im Demo-Modus und migrationsbereit für Live.
