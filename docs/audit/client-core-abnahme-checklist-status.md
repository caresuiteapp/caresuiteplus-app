# Client Core Abnahme-Checklist — Status

**Stand:** 2026-06-21 · **Scope:** K.0–K.5

| # | Kriterium | Status | Nachweis |
|---|-----------|--------|----------|
| K.0.1 | 6 Leistungsarten als Mandanten-Templates | ✅ | Migration 0159 seed |
| K.0.2 | Multi-Select client_service_profiles | ✅ | clientServiceTypeService |
| K.0.3 | Mapping service_type ↔ care_context | ✅ | clientCore.ts |
| K.0.4 | Intake sections pro Leistungsart (DB) | ✅ | tenant_service_intake_sections |
| K.1.1 | Budget years/types/defaults Tabellen | ✅ | Migration 0159 |
| K.1.2 | 2026 Vorlage editierbar in DB | ✅ | tenant_budget_defaults seed |
| K.1.3 | Kein Budget-Hardcode in React | ✅ | ClientBudgetCorePanel liest DB |
| K.1.4 | client_budget_settings + movements | ✅ | Migration 0159 + Panel |
| K.2.1 | Portal defaults konservativ | ✅ | messages only default visible |
| K.2.2 | Kein GPS im Klientenportal | ✅ | show_visit_tracking false |
| K.2.3 | client_portal_settings Override | ✅ | clientPortalSettingsService |
| K.2.4 | Portal access requests Tabelle | ✅ | approve/reject UI |
| K.3.1 | Record mapping / completeness | ✅ | clientRecordMappingService |
| K.3.2 | Akte-Tabs Leistungsbereiche/Budget/Portal | ✅ | ClientRecordTabPanels |
| K.3.3 | Modal-Stack Klient:in edit prep | ✅ | ClientEditModal + prep.client.edit |
| K.3.4 | Mandanten-Stubs Leistungsarten/Budget | ✅ | tenant routes K.4 enhanced |
| K.3.5 | Tests + Regression green | ✅ | .audit-test-client-core-k4-precommit.log |
| K.4.1 | ClientEditModal unified (not edit page) | ✅ | ClientEditModal + redirect |
| K.4.2 | Intake sync profiles/portal/budget on save | ✅ | clientCoreIntakeSyncService |
| K.4.3 | Service profiles end not delete | ✅ | endClientServiceProfile |
| K.4.4 | ModalStack in-page actions | ✅ | serviceProfile.add, prep.client.edit |
| K.4.5 | Portal guards canClientPortalSeeFeature | ✅ | clientPortalSettingsService |
| K.4.6 | K.4 tests green | ✅ | clientRecordUi, clientEditModal, clientCoreK4Intake |
| K.5.1 | Proof → billing candidate (idempotent) | ✅ | clientBillingCandidateService |
| K.5.2 | Budget consumption ledger movements | ✅ | clientBudgetConsumptionService |
| K.5.3 | Billing preview + blocking reasons | ✅ | ClientBillingPrepPanel |
| K.5.4 | No final invoice / no invoice numbers | ✅ | neverFinalizeInvoice guard |
| K.5.5 | Portal billing non-disclosure | ✅ | portalVisibilityService + tests |
| K.5.6 | Migration 0160 additive | ✅ | 0160_client_billing_handoff_foundation.sql |
| K.5.7 | K.5 tests green | ✅ | clientCoreK5BillingHandoff.test.ts |
| K.5.1-M | **Manuelle sichtbare Abnahme (Master)** | ⛔ | client-core-k51-billing-manual-acceptance-abnahmebericht.md — BLOCKED: keine Demo-Proofs, Browser/Credentials |
| K.5.2-M | **Demo-Billing-Walkthrough (Master)** | ⛔ | client-core-k52-demo-billing-walkthrough-abnahmebericht.md — BLOCKED: ENV-Gate (AUDIT_BUSINESS_* fehlt), 0 Demo-Proofs |
| — | 0154–0159 unverändert | ✅ | Abort-Gate |
| — | staticRolePermissions unverändert | ✅ | Abort-Gate |
| — | 0159 remote applied | ✅ | k5 precheck log |

**Gesamt:** 33/35 — K.5.1-M + K.5.2-M sichtbar **offen**

---

## Portal System Core P.0–P.3 (nach K.4)

| # | Kriterium | Status | Nachweis |
|---|-----------|--------|----------|
| P.1 | Unified portal shells + projections | ✅ | portal-system-core-abschlussbericht |
| P.2 | Office portal control + sync chain | ✅ | ClientPortalCorePanel erweitert |
| P.3 | Portal sync flow tests | ✅ | portalSyncFlow.test.ts |
| P.4 | Keine 0160 / keine Permission-Änderung | ✅ | Abort-Gate |

Siehe auch: `docs/audit/portal-system-abnahme-checklist-status.md`
