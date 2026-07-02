# HealthOS H4 — Assist Operations Dashboard Audit Report

**Date:** 2026-07-02  
**Sprint:** H4  
**Status:** Implemented, commit-ready (deploy: no)

---

## 1. Overview

H4 implements the **Assist Operations Dashboard** for CareSuite+, following the H3 Office Command Center pattern. The `AssistIndexScreen` is migrated from `ModuleDashboardShell` to `HealthOSModuleShell`, and the legacy `AssistDashboardView` is kept untouched as a preserved component (same treatment as `OfficeDashboardView`).

---

## 2. Changed / Created Files

| File | Action | Description |
|---|---|---|
| `src/lib/assist/assistOperationsModel.ts` | Created | Model builder with sections A–F, exported types, `pickAssistOperationsReadMetrics` |
| `src/components/healthos/assist/HealthOSAssistOperationsView.tsx` | Created | HealthOS view component mirroring H3 Office pattern |
| `src/components/healthos/assist/index.ts` | Created | Barrel export for assist HealthOS components |
| `src/components/healthos/index.ts` | Updated | Added `export * from './assist'` |
| `src/screens/assist/AssistIndexScreen.tsx` | Updated | Migrated to `HealthOSModuleShell` + `HealthOSAssistOperationsView` |
| `src/__tests__/healthos/healthosAssistOperations.test.ts` | Created | Full H4 test suite mirroring H3 office test |
| `src/__tests__/assist/assistDashboardHero.test.ts` | Updated | Updated AssistIndexScreen expectation to HealthOSModuleShell |
| `src/__tests__/assist/assistDashboardFamilyAlignment.test.ts` | Updated | Updated AssistIndexScreen expectation to HealthOSModuleShell |
| `docs/audit/healthos-h4-assist-operations-report.md` | Created | This report |

---

## 3. Data Sources

All data is **read-only** via existing hooks:

| Data | Hook / Source | Used In |
|---|---|---|
| `stats: AssistDashboardStats` | `useAssistDashboard()` | Sections A, C, D (placeholder), E |
| `todayAssignments: AssignmentListItem[]` | `useAssistDashboard()` | Passed to view (optional display) |
| `activeExecutions: ActiveExecutionItem[]` | `useActiveExecutions()` | Section B (Live Operations) |
| Navigation items | `getVisibleNavItemsForRole('assist')` | Section F (Schnellzugriffe) |
| Phase labels | `EXECUTION_PHASE_LABELS` | Section B (mapped from `ExecutionPhase`) |
| Status mapping | `resolveAssignmentStatusDisplay` via `HealthOSStatusBadge` | Section B (badge display) |

---

## 4. Model Sections

### Section A — Einsatzbetrieb heute
8 metrics from `AssistDashboardStats`:
- Einsätze heute (todayCount)
- Läuft gerade (activeCount + inProgressCount)
- Abgeschlossen heute (completedTodayCount)
- Problemfälle (atRiskCount)
- Dokumentation offen (incompleteCount)
- Signatur ausstehend (openSignatureCount)
- Nachweise offen (openProofCount)
- Nachweise zu prüfen (openProofReviewCount)

### Section B — Live Operations
Rows from `activeExecutions`:
- Phase label from `EXECUTION_PHASE_LABELS` (no raw enum)
- Status displayed via `HealthOSStatusBadge` with `domain="assignment"`

### Section C — Nachweise & Qualität
4 metrics: openProofCount, openProofReviewCount, openPortalReleaseCount, openSignatureCount

### Section D — Budget Assist Summary
3 placeholder metrics with `value = "—"` and explanatory `subValue`.  
**Reason:** `AssistDashboardStats` does not include budget data. Budget is a P0 zone accessible only via the client record (Klient:innenakte). The Budgets nav item is `visibility: 'hidden'` in `HEALTHOS_ASSIST_NAV`.

### Section E — Blocker / Qualitätszentrale
Derived from stats counts (incompleteCount, openSignatureCount, openProofCount, atRiskCount). German labels used throughout. No `fetchAssistExecutionProblems` call.

### Section F — Schnellzugriffe
From `getVisibleNavItemsForRole('assist')` — only items with `href` and `visibility !== 'hidden'`.

---

## 5. Red Zones — Untouched

The following files were **not modified**:

| File | Verification |
|---|---|
| `src/features/assistWorkflow/*` | Not imported anywhere in H4 files |
| `src/screens/portal/EmployeePortalVisitExecutionScreen.tsx` | Not touched |
| `src/components/dashboard/AssistDashboardView.tsx` | Preserved as legacy |
| All assignment detail workflows | Not modified |
| StartService / EndService / finalize / proof / budget / WFM write services | Not imported |
| Route redirects | No new redirects introduced |

---

## 6. UI Improvements

- **Responsive layout:** `AdaptiveKpiGrid` + `resolveHealthOSShellBreakpoint` for phone/tablet/desktop
- **HealthOSStatusBadge:** Live Operations shows phase + assignment status without raw enum values
- **Loading / Error / Empty states:** Dedicated HealthOS states for each scenario
- **Breadcrumbs + TopBar:** `HealthOSBreadcrumbs` and `HealthOSTopBar` integrated
- **Badges:** `PremiumBadge` for "Mandantenbezogen" and "Live-Sync aktiv" retained from original

---

## 7. Mobile / Desktop Behavior

| Breakpoint | KPI columns | Sidebar |
|---|---|---|
| Mobile (`< 768px`) | 2 | Hidden (bottom nav) |
| Tablet (`768–1199px`) | 2–3 | Compact |
| Desktop (`≥ 1200px`) | 4 | Visible + collapsible |

---

## 8. Tests

### New Test Suite
`src/__tests__/healthos/healthosAssistOperations.test.ts` — 14 test cases:
- AssistIndexScreen uses HealthOSModuleShell + HealthOSAssistOperationsView
- View has correct testID, German section titles, HealthOS components
- Model builder: all sections, live row phase labels, blocker derivation
- Clean stats → no blockers
- Budget placeholder "—" values
- Labels avoid raw snake_case
- Quick access routes valid
- `pickAssistOperationsReadMetrics` passthrough
- File existence checks
- P0 import forbidden checks
- Red zone file checks
- Legacy `AssistDashboardView` unchanged

### Updated Tests
- `assistDashboardHero.test.ts` — updated to expect `HealthOSModuleShell` (was `ModuleDashboardShell`)
- `assistDashboardFamilyAlignment.test.ts` — updated to expect `HealthOSModuleShell` + `HealthOSAssistOperationsView`

---

## 9. Data Gaps

| Gap | Impact | Recommendation |
|---|---|---|
| No budget data in `AssistDashboardStats` | Section D shows "—" placeholders | H5: Add read-only budget summary to assist stats or pull from separate read endpoint |
| `openTripsCount` not shown in operations section | Trips status not surfaced in H4 | H5: Add "Fahrten offen" metric to Section A |
| No client name in Einsatzbetrieb | todayAssignments passed but not rendered in Section A | H5: Add optional assignment list below Section A metrics |

---

## 10. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Budget placeholder may confuse users expecting real data | Low | Info alert explains the gap in Section D |
| `useAuth()` added for displayName; profile may be null | Low | Fallback to `'Assist & Alltagsbegleitung'` string |
| Live Operations empty state may flicker during initial load | Low | `activeLoading` prop shows HealthOSLoadingState during fetch |

---

## 11. Constraints Met

- [x] No commit, push, deploy, migrations, RLS changes
- [x] No modification to `assistWorkflow/*`, `EmployeePortalVisitExecutionScreen`, assignment detail workflows, StartService/EndService, finalize/proof/budget/WFM write services, route redirects
- [x] Read-only display only — uses existing data hooks/services
- [x] `AssistDashboardView.tsx` legacy file unchanged
- [x] Only `AssistIndexScreen` adopted to `HealthOSModuleShell`

---

## 12. H5 Recommendation

H5 should:
1. Add a read-only budget summary field to `AssistDashboardStats` (aggregate from client records)
2. Surface trip count prominently in Section A
3. Consider an optional `AssignmentListCard` in Section A for today's assignments
4. Add `openTripsCount` to Blocker / Qualitätszentrale
5. Evaluate merging `AssistDashboardView` (legacy) cleanup into H5 scope

---

## 13. Commit-Readiness

**Commit-ready:** Yes  
**Deploy-ready:** No (requires explicit `[deploy]` and user approval per workspace rule)
