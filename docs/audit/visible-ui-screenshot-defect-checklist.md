# Visible UI Screenshot Defect Checklist (U.1)

**Binding checklist** — update before commit.  
**Run:** Visible UI Reality Fix U.1 → U.1.1 browser gate  
**HEAD baseline:** `91450ce` (U.1.1)

## Defects (must fix)

| ID | Area | Defect | Fix target | Status |
|----|------|--------|------------|--------|
| A | Client Verlauf | Raw DB error `42703 display_name` | Fix profiles join + German error mapping | ✅ |
| B | Client edit | 10-step wizard on edit | `ClientSectionEditModal` per section | ✅ |
| C | Employee record | Preview-only, wizard edit | Tabs + section modals + danger menu | ✅ |
| D | Employee edit | Wizard on edit | `EmployeeSectionEditModal` | ✅ |
| E | Portal tab | Internal keys visible | `EmployeePortalImpactPanel` friendly labels | ✅ |
| F | Assist dashboard/live | 0156, Supabase, table names | `assistSetupHints`, `gpsTrackingConfig`, live-status | ✅ |
| G | New assignment | WP 246, Supabase Live breadcrumb/hero | `AssignmentCreateScreen`, `FormScreenHero` | ✅ |
| H | Tenant center | Core K., Teilweise, Offen | `tenantCenterSections`, `TenantCenterSectionCard` | ✅ |
| I | Modals | Inconsistent sizes/headers | `AppGlassModal` + `PlatformModal` | ✅ |
| J | General layout | Cards/tabs/empty/error states | Record screens unified patterns | ✅ |

## Forbidden terms (mandant/user views)

Repository, Backend, Migration, Supabase, RPC, Edge Auth, Table, Column, schema, source_snapshot, display_name, 42703, 0156-0160, Core K., WP, Stub, Fake, Mock, Debug, Audit, Seed, budgetCents, invoiceDraft, proof_not_approved, missing_budget

## Intake wizard

- **Create:** `ClientIntakeModal` + wizard — **keep**
- **Edit:** section modals only — **no wizard**

## Acceptance

- [ ] Browser/screenshot verification — **U.1.1 BLOCKED** (2026-06-21, see `visible-ui-u11-manual-browser-abnahmebericht.md`)
- [x] Typecheck precommit log (repo-wide pre-existing failures)
- [x] Test precommit log — U.1.1: 14/14 targeted (`visibleUiRealityFix` + `clientRecordUi`)
