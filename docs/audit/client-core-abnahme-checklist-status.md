# Client Core Abnahme-Checklist — Status

**Stand:** 2026-06-20 · **Scope:** K.0–K.3 Foundation

| # | Kriterium | Status | Nachweis |
|---|-----------|--------|----------|
| K.0.1 | 6 Leistungsarten als Mandanten-Templates | ✅ | Migration 0159 seed |
| K.0.2 | Multi-Select client_service_profiles | ✅ | clientServiceTypeService |
| K.0.3 | Mapping service_type ↔ care_context | ✅ | clientCore.ts |
| K.0.4 | Intake sections pro Leistungsart (DB) | ✅ | tenant_service_intake_sections |
| K.1.1 | Budget years/types/defaults Tabellen | ✅ | Migration 0159 |
| K.1.2 | 2026 Vorlage editierbar in DB | ✅ | tenant_budget_defaults seed |
| K.1.3 | Kein Budget-Hardcode in React | ✅ | ClientBudgetCorePanel liest DB |
| K.1.4 | client_budget_settings + movements | ✅ | Migration 0159 |
| K.2.1 | Portal defaults konservativ | ✅ | messages only default visible |
| K.2.2 | Kein GPS im Klientenportal | ✅ | show_visit_tracking false |
| K.2.3 | client_portal_settings Override | ✅ | clientPortalSettingsService |
| K.2.4 | Portal access requests Tabelle | ✅ | client_portal_access_requests |
| K.3.1 | Record mapping / completeness | ✅ | clientRecordMappingService |
| K.3.2 | Akte-Tabs Leistungsbereiche/Budget/Portal | ✅ | clientIntakeFieldRules + Panels |
| K.3.3 | Modal-Stack Klient:in edit prep | ✅ | ClientRecordModalPrepScreen |
| K.3.4 | Mandanten-Stubs Leistungsarten/Budget | ✅ | Tenant Center + routes |
| K.3.5 | Tests + Regression green | ✅ | .audit-test-client-core-k03-precommit.log |
| — | 0154–0158 unverändert | ✅ | Abort-Gate |
| — | staticRolePermissions unverändert | ✅ | Abort-Gate |
| — | 0159 remote applied | ⏳ | Nach Commit Phase 18 |

**Gesamt:** 18/19 ✅ · 1 pending (remote apply 0159)
