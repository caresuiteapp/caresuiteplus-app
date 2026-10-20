# Visible UI Screenshot Defect Checklist (U.1 → U.1.2)

**Binding checklist** — update before commit.  
**Run:** Visible UI Reality Fix U.1 → U.1.1 browser gate → **U.1.2 hotfix**  
**HEAD baseline:** `422a2d6` (U.1.1) → U.1.2 hotfix

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

## U.1.2 screenshot-proven defects (2026-06-21)

| ID | Area | Defect | Fix target | Status |
|----|------|--------|------------|--------|
| U12-A | Modals | Stammdaten bearbeiten not scrollable; footer unreachable | `PlatformModal` flex scroll shell (92vh), `AppGlassModal`, section edit modals | ✅ |
| U12-B | Assist dashboard | CTA „Mehr erfahren →“ outside/misaligned cards | `AssistSetupHintsBanner` + `InfoBanner.actionLabel` inside card | ✅ |
| U12-C | Visible UI | Test/tech texts (Supabase, Map-Provider, guardServiceTenant) | Assist hero, live-status, data source probe, portal/access badges | ✅ |
| U12-D | Section edit | Client/employee modals save/cancel unreachable | `ClientSectionEditModal`, `EmployeeSectionEditModal` + `modalShell` | ✅ |
| U12-E | Modal system | Background scroll not locked | `PlatformModal.lockBodyScroll` + body overflow | ✅ |

## R.1 responsive shell defects (2026-06-22)

| ID | Area | Defect | Fix target | Status |
|----|------|--------|------------|--------|
| R1-A | Login mobile/tablet | Unreadable text, transparent form | `resolveLlganViewGlass('login')` alpha 0.90, auth typography | ✅ |
| R1-B | Business mobile | Desktop rail visible, clipped content | `MobileAppShell` + `CareAdaptiveShell` compact routing | ✅ |
| R1-C | Business tablet | Topbar overlap tenant/search/user | Compact shell replaces PlatformTopbar below 1024px | ✅ |
| R1-D | Business preview | Tech preview strings on mobile | `PlatformShellPreviewContent` gated by `isDesktopOrWide` | ✅ |
| R1-E | Portal tablet | Gray sidebar not liquid glass | `PortalLeftNav` / `PortalTabLeftNav` LLGAN sidebar | ✅ |
| R1-F | Portal mobile | Simple bottom nav, no hamburger app bar | `PortalTopBar` hamburger + `PortalNavigationDrawer` | ✅ |
| R1-G | General mobile/tablet | No app behavior (drawer, bottom nav) | `ShellAppBar`, `ShellNavigationDrawer`, `MobileAppShell` | ✅ |

## Forbidden terms (mandant/user views)

Repository, Backend, Migration, Supabase, RPC, Edge Auth, Table, Column, schema, source_snapshot, display_name, 42703, 0156-0160, Core K., WP, Stub, Fake, Mock, Debug, Audit, Seed, budgetCents, invoiceDraft, proof_not_approved, missing_budget, Map-Provider, guardServiceTenant, Live Supabase

## Intake wizard

- **Create:** `ClientIntakeModal` + wizard — **keep**
- **Edit:** section modals only — **no wizard**

## Acceptance

- [ ] Browser/screenshot verification — U.1.2 code-level + tests (browser MCP blocked, see abnahmebericht)
- [x] Typecheck precommit log (`.audit-typecheck-visible-ui-u12-precommit.log`)
- [x] Test precommit log (`.audit-test-visible-ui-u12-precommit.log`)
- [x] U.1.2 targeted tests (`visibleUiRealityFix` 13/13)
