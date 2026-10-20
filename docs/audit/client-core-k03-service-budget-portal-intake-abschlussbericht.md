# Client Core K.0–K.3 — Service Types, Budget, Portal, Intake Abschlussbericht

**Datum:** 2026-06-20  
**Supabase Project:** `euagyyztvmemuaiumvxm` (caresuiteplus-production)  
**Basis-HEAD:** `f25c24a` · **Branch:** `main`  
**Scope:** Klient:innen Core Foundation K.0–K.3 — **kein** Mitarbeiter:innen Core, **kein** B.2/B.3, **kein** Billing-Final, **kein** staticRolePermissions

---

## 1. Executive Summary

Client Core K.0–K.3 legt die Mandanten-/Klient:innen-Grundlage für Leistungsarten (Multi-Select-Steuerdimension), Budget-Vorlagen, Portal-Defaults und Aufnahme-/Akte-Mapping. Migration **0159** (18 Tabellen + Seed-Funktion), TypeScript-Services, UI-Grundgerüst mit Empty States, Tests und Mandanten-Stubs sind implementiert.

**Ergebnis:** ✅ **SUCCESS** (Code bereit; 0159 Apply folgt nach Commit)

---

## 2. Git / Abort-Gates (Phase 1)

| Prüfung | Ergebnis |
|---------|----------|
| Branch `main` | ✅ |
| HEAD ≥ `f25c24a` | ✅ (`f25c24a`) |
| Staged at start | ✅ leer |
| 0154–0158 / staticRolePermissions | ✅ nicht geändert |
| Destructive SQL | ✅ kein DROP/TRUNCATE/DELETE |
| Budget hardcoded in TS | ✅ Werte nur in DB-Seed (13100/353900 Cent) |

Log: `.audit-migration-list-client-core-k03-precheck.log`

Remote 0154–0158: ✅ alle applied auf `euagyyztvmemuaiumvxm`

---

## 3. Inventory-Matrix (Phase 2)

### Bestehend vs. neu

| Bereich | Vor K.0–K.3 | Neu (0159 + Services) |
|---------|-------------|------------------------|
| Leistungsart UI | `client_care_contexts`, Katalog `leistungsart` | `tenant_client_service_types`, `client_service_profiles` |
| Budget | `clientBudgetService` (legacy extended) | `tenant_budget_*`, `client_budget_settings`, `client_budget_movements` |
| Portal | `clientPortalAccessService`, adaptive engine | `tenant_client_portal_defaults`, `client_portal_settings`, access requests |
| Intake | `clientIntakeFieldRules` (regelbasiert) | `tenant_service_intake_sections` + `clientRecordMappingService` |
| Akte-Tabs | dynamisch je care_context | + `leistungsbereiche`, `budget`, `portal` (Core-Panels) |

### Routing / Modal

| Bereich | Route / Hook | Modal-Stack |
|---------|--------------|-------------|
| Office Klient:innen | `/business/office/clients/[id]` | `useOpenClientRecordModal` → `prep.client.record` |
| Akte Tabs | SegmentedTabs | Leistungsbereiche / Budget / Portal Empty States |
| Mandanten-Stubs | `/settings/tenant/client-service-types`, `client-budget` | Tenant Center Stub-Karten |

---

## 4. Migration 0159 (Phase 4–9)

**Datei:** `supabase/migrations/0159_client_core_service_budget_portal_settings.sql`

| Tabelle | Zweck |
|---------|-------|
| `tenant_client_service_types` | 6 Leistungsarten je Mandant |
| `client_service_profiles` | Multi-Select je Klient:in |
| `tenant_service_type_rules` | Regeln pro Leistungsart |
| `tenant_service_task_catalog` | Aufgabenkatalog |
| `tenant_service_visit_types` | Besuchstypen |
| `tenant_service_proof_templates` | Nachweisvorlagen |
| `tenant_service_intake_sections` | Aufnahme-Abschnitte |
| `tenant_budget_years/types/defaults` | Budget 2026 Vorlagen |
| `tenant_service_type_budget_rules` | Leistungsart ↔ Budget |
| `client_budget_settings/movements` | Klient:innen-Budget |
| `tenant_client_portal_defaults` | Konservative Portal-Defaults |
| `tenant_service_type_portal_rules` | Portal je Leistungsart |
| `client_portal_settings` | Klient:innen-Override |
| `client_service_portal_settings` | Portal je Leistungsart/Klient:in |
| `client_portal_access_requests` | Zugangsanfragen |

**Seed:** `seed_tenant_client_core_templates(tenant_id)` — idempotent, ON CONFLICT DO NOTHING  
**RLS:** `current_tenant_id()` + `has_permission('office.clients.view/edit')`  
**Budget 2026 Seed:** 131 EUR/Monat (13100 ct), 40% Umrechnung, 3539 EUR/Jahr (353900 ct)

---

## 5. Types & Services (Phase 11)

| Datei | Funktion |
|-------|----------|
| `src/types/clientCore.ts` | Domain-Typen, Mappings service_type ↔ care_context |
| `src/lib/client/clientServiceTypeService.ts` | list/sync profiles, intake sections, seed |
| `src/lib/client/clientBudgetSettingsService.ts` | defaults, client settings, initialize from template |
| `src/lib/client/clientPortalSettingsService.ts` | resolved settings, visible features, access requests |
| `src/lib/client/clientRecordMappingService.ts` | intake merge, record completeness |

---

## 6. UI Foundation (Phase 12)

| Komponente | Inhalt |
|------------|--------|
| `ClientServiceProfilesPanel` | Leistungsbereiche Empty State + Profile-Liste |
| `ClientBudgetCorePanel` | Budget 2026 aus DB, „Aus Vorlage übernehmen“ |
| `ClientPortalCorePanel` | Sichtbarkeit, kein GPS, Zugang + Anfragen |
| `ClientRecordModalPrepScreen` | Embedded `ClientRecordScreen` ab Tab Leistungsbereiche |
| Tenant Center Stubs | Leistungsarten + Budget-Vorlagen Karten |

---

## 7. Tests (Phase 13)

| Suite | Ergebnis | Log |
|-------|----------|-----|
| `clientCoreK03.test.ts` | ✅ 9/9 | `.audit-test-client-core-k03-precommit.log` |
| `modalStack.test.ts` | ✅ 5/5 | (Regression) |
| `assistNavigation.test.ts` | ✅ 5/5 | (Regression) |
| `assistProofToPortalFlow.test.ts` | ✅ 10/10 | (Regression) |

Typecheck Client-Core-Dateien: ✅ keine neuen Fehler — `.audit-typecheck-client-core-k03-precommit.log`

---

## 8. Harte Grenzen

| Grenze | eingehalten |
|--------|-------------|
| Kein Mitarbeiter:innen Core | ✅ |
| Kein B.2/B.3 / assignmentWorkflowService | ✅ |
| Kein staticRolePermissions | ✅ |
| Portal nicht alles sichtbar | ✅ (nur messages default true) |
| Kein GPS im Klientenportal | ✅ show_visit_tracking false |
| Leistungsart-Felder erhalten | ✅ care_contexts unverändert |
| Kein git add . | ✅ selektiver Commit |

---

## 9. Apply 0159 (Phase 18 — nach Commit)

Dry-run / Apply-Logs: `.audit-supabase-client-core-k03-0159-*.log` (nach Push)

---

## 10. Offene Punkte (bewusst K.4+)

- Vollständige CRUD-UI Mandanten-Leistungsarten
- Budget-Bewegungen UI / Abrechnungskopplung
- Portal-Feature-Toggles pro Leistungsart im UI
- Live-Sync service_profiles ↔ client_care_contexts bei Intake persist
