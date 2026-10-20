# HealthOS H5 — Employee Portal Overview Pages

**Date:** 2026-07-03  
**Status:** Implementation complete, vitest all-pass, browser smoke **grün**  
**Commit-ready:** YES (no deploy triggered)

---

## 1. Executive Summary

H5 adopts the Employee Portal dashboard ("Heute") screen into the HealthOS view layer, following the H3 (Office) and H4 (Assist) patterns. The implementation is minimal-scope: the dashboard `EmployeePortalDashboardScreen` now renders `HealthOSEmployeePortalTodayView` built from a new read-only model (`employeePortalTodayModel.ts`). All navigation, auth, and execute-workflow infrastructure is unchanged.

---

## 2. File and Route Analysis

### 2.1 Routes

| Route | File | Recommendation |
|-------|------|---------------|
| `/portal/employee` (tabs/index) | `app/portal/employee/(tabs)/index.tsx` | **ADOPTED** — renders `EmployeePortalDashboardScreen` (now HealthOS view) |
| `/portal/employee/assignments` | `app/portal/employee/(tabs)/assignments.tsx` | WRAP future H6 — currently `PortalAppointmentsTab` |
| `/portal/employee/schedule` | `app/portal/employee/(tabs)/schedule.tsx` | WRAP future H6 — weekly plan |
| `/portal/employee/messages` | `app/portal/employee/(tabs)/messages.tsx` | LINK only (Schnellzugriffe) |
| `/portal/employee/documents` | `app/portal/employee/(tabs)/documents.tsx` | LINK only (Schnellzugriffe) |
| `/portal/employee/profile` | `app/portal/employee/(tabs)/profile.tsx` | LINK only (Schnellzugriffe) |
| `/portal/employee/assignments/[id]/execute` | `app/portal/employee/assignments/[id]/execute.tsx` | **RED ZONE** — DO NOT TOUCH |
| `/portal/employee/arbeitszeit` | `app/portal/employee/arbeitszeit/index.tsx` | LINK only (Meine Zeiten) |
| `/portal/employee/arbeitszeit/urlaub` | `app/portal/employee/arbeitszeit/urlaub/index.tsx` | LINK only (H6) |
| `/portal/employee/messages/[threadId]` | Various | LINK only |

### 2.2 Screens Analyzed

| Screen | Path | H5 Action |
|--------|------|----------|
| `EmployeePortalDashboardScreen` | `src/screens/portal/EmployeePortalDashboardScreen.tsx` | **REPLACED** with HealthOS view |
| `EmployeePortalVisitExecutionScreen` | `src/screens/portal/EmployeePortalVisitExecutionScreen.tsx` | 🔴 RED ZONE — untouched |
| `EmployeeProfileScreen` | `src/screens/portal/EmployeeProfileScreen.tsx` | SKIP — linked via Schnellzugriffe |
| `EmployeePortalOverviewScreen` | `src/screens/portal/EmployeePortalOverviewScreen.tsx` | SKIP |
| `EmployeePortalAnnouncementsScreen` | `src/screens/portal/EmployeePortalAnnouncementsScreen.tsx` | SKIP |
| `EmployeeMobilitySettingsScreen` | `src/screens/portal/EmployeeMobilitySettingsScreen.tsx` | SKIP |

### 2.3 Hooks Used (Read-Only)

| Hook | Used by | Role |
|------|---------|------|
| `useEmployeePortalDashboard` | `EmployeePortalDashboardScreen` | Dashboard data fetch + live subscription |
| `usePortalActor` | `EmployeePortalDashboardScreen` | Employee identity/displayName |

### 2.4 Services Used (Read-Only)

| Service | Used by model | Role |
|---------|---------------|------|
| `employeePortalLiveOverviewService.ts` | `employeePortalTodayModel.ts` | `isActiveEmployeeAssignment`, `resolveDashboardCurrentAssignment` |
| `resolveHealthOSNavigation.ts` | `employeePortalTodayModel.ts` | `getVisibleNavItemsForRole('employee_portal')` |

---

## 3. Created Files

| File | Purpose |
|------|---------|
| `src/lib/portal/employee/employeePortalTodayModel.ts` | Read-only model builder — sections A–D + Schnellzugriffe |
| `src/components/healthos/employee/HealthOSEmployeePortalTodayView.tsx` | HealthOS view — Heute/Einsätze/Zeiten/Aufgaben/Schnellzugriffe |
| `src/components/healthos/employee/index.ts` | Barrel export |
| `src/__tests__/healthos/healthosEmployeePortal.test.ts` | 18 vitest tests mirroring H4 pattern |
| `scripts/audit/h5EmployeePortalSmoke.mjs` | Browser smoke script (Playwright) |
| `docs/audit/h5-employee-portal-browser-smoke-results.json` | Smoke result (grün, see §7) |

### 3.1 Modified Files

| File | Change |
|------|--------|
| `src/screens/portal/EmployeePortalDashboardScreen.tsx` | Replaced GlassCard/Aurora UI with `HealthOSEmployeePortalTodayView` |
| `src/components/healthos/index.ts` | Added `export * from './employee'` |

---

## 4. Architecture — H5 Model Layer

### Model Types (`employeePortalTodayModel.ts`)

```
EmployeePortalTodayInput → buildEmployeePortalTodayModel → EmployeePortalTodayModel
  ├─ greetingLine: string
  ├─ tagesübersicht: EmployeePortalTodayMetric[]   (4 KPIs)
  ├─ currentAssignment: EmployeePortalTodayAssignment | null
  ├─ meineEinsaetze: EmployeePortalTodayAssignment[]  (today + upcoming, max 5)
  ├─ offeneAufgaben: EmployeePortalTodayTask[]         (doc/signature tasks)
  └─ schnellzugriffe: EmployeePortalTodayLink[]        (HEALTHOS_EMPLOYEE_PORTAL_NAV)
```

### View Sections

| Section | Title | Content |
|---------|-------|---------|
| A | **Heute** | 4 KPI metrics: Einsätze heute, Geplante Stunden, Offene Dokumentation, Nachrichten |
| B | **Meine Einsätze** | Assignment list (today + upcoming), status badge, execute/detail routing |
| C | **Meine Zeiten** | Read-only info alert + link to `/portal/employee/arbeitszeit` |
| D | **Offene Aufgaben** | Warning alert + task list when docs/signatures pending; empty state otherwise |
| E | **Schnellzugriffe** | Links from `HEALTHOS_EMPLOYEE_PORTAL_NAV` visible items |

---

## 5. Constraints Respected

- ✅ No commit/push/deploy triggered
- ✅ `EmployeePortalVisitExecutionScreen` untouched (RED ZONE)
- ✅ `StartService`/`EndService`/`finalizeVisit`/`wfmAssistAdapter` not imported in H5 files
- ✅ No new RPCs or tables
- ✅ Portal auth/login flow unchanged (`app/portal/employee/_layout.tsx` untouched)
- ✅ `app/portal/employee/(tabs)/index.tsx` route file unchanged
- ✅ `EmployeePortalShell` layout unchanged
- ✅ Execute screen route (`assignments/[id]/execute.tsx`) untouched

### Forbidden Imports Guard (verified by test)

The following are absent from all H5 files:
`@/features/assistWorkflow`, `finalizeVisit`, `startService`, `endService`,
`saveVisitDocumentation`, `wfmClockService`, `wfmAssistAdapter`, `clientBudgetTransactionService`

---

## 6. Test Results

### Vitest (all 125 tests pass)

```
✓ healthosFoundation.test.ts        (18 tests)
✓ healthosAssistOperations.test.ts  (18 tests)
✓ healthosShellNavigation.test.ts   (32 tests)
✓ healthosStatusMapping.test.ts     (9 tests)
✓ healthosOfficeCommandCenter.test.ts (12 tests)
✓ healthosEmployeePortal.test.ts    (18 tests)   ← NEW
✓ officeDashboard.test.ts           (8 tests)
✓ wfmAssistAdapterRpc.test.ts       (5 tests)
✓ finalizeVisitProof.test.ts        (5 tests)
────────────────────────────────────
TOTAL: 125 passed, 0 failed
```

### H5-specific test coverage (18 tests)

- ✅ Dashboard screen uses `HealthOSEmployeePortalTodayView` + `useEmployeePortalDashboard`
- ✅ Legacy GlassCard/Aurora not in screen
- ✅ View has correct testID and 5 German section titles
- ✅ View uses HealthOS components (MetricCard, Loading, Error, Empty, StatusBadge)
- ✅ View references `executeRoute` and `detailRoute` for assignment navigation
- ✅ `buildEmployeePortalTodayModel` exposes all 4 sections
- ✅ Current assignment resolved from today list
- ✅ Open tasks derived from counts; zero counts → no tasks
- ✅ Labels are German, no raw snake_case technical strings
- ✅ `schnellzugriffe` uses only `/portal/employee/…` routes
- ✅ `pickEmployeePortalTodayReadMetrics` is read-only passthrough
- ✅ H5 files exist (model, view, screen)
- ✅ No P0 write service imports in H5 files
- ✅ RED ZONE execute screen unchanged
- ✅ All assignments have execute + detail routes

---

## 7. Browser Smoke

**Verdict: grün**

Playwright smoke (`scripts/audit/h5EmployeePortalSmoke.mjs`) against local Expo web on `http://localhost:8084` (fresh bundle, Metro `--clear`).

| Check | Result |
|-------|--------|
| Dev server started | **yes** (Expo web, port 8084) |
| Test account provisioned/used | **yes** (`p0PortalAuthBootstrap.mjs` → test tenant `a4ba83bd-…`, `audit-employee@caresuiteplus.test`) |
| Browser smoke | **grün** |
| Login successful | **yes** (employee-portal-login + portal session inject) |
| Mobile green | **yes** |
| Desktop green | **yes** |
| Execute reachable | **yes** (`/portal/employee/assignments`) |
| Technical texts visible | **no** |
| Runtime errors | **no** |
| P0 red zones untouched | **yes** |
| Commit readiness | **yes** |

**Setup performed (no commit/push/deploy):**
1. Started `npx expo start --web --port 8084 --clear` (8083 occupied by stale process).
2. Ran `node scripts/audit/p0PortalAuthBootstrap.mjs` to repair/provision `employee_portal_accounts` in the P0 test tenant only.
3. Updated smoke script login to use `employee-portal-login` edge function (not Supabase password grant — employee portal uses dedicated portal auth).
4. Removed false-positive German UI patterns (`geplant`/`bestaetigt`) from technical-text checks; mobile navigates to Übersicht before inspection.

**Desktop sections found:** Heute, Meine Einsätze, Meine Zeiten, Offene Aufgaben, Schnellzugriffe (5/5).

**Mobile sections found:** same 5/5 after Übersicht tab focus.

**Screenshots:** `docs/audit/h5-employee-portal-smoke-screenshots/employee-portal-desktop.png`, `…-mobile.png`

**Re-run:**
```bash
AUDIT_WEB_URL=http://localhost:8084 node scripts/audit/h5EmployeePortalSmoke.mjs
```

Full JSON: `docs/audit/h5-employee-portal-browser-smoke-results.json`

---

## 8. Data Gaps

| Section | Gap | Acceptable? |
|---------|-----|------------|
| Meine Zeiten | No time summary data in dashboard projection — link-only | ✅ Read-only as spec'd |
| Urlaub/Abwesenheit | No absence count in `EmployeePortalDashboardProjection` — not shown | ✅ Link-only in nav config |
| Nachrichten | `messageCount` from projection (no unread breakdown) | ✅ Acceptable for H5 |
| Dokumente/Schulungen | Not in projection — linked via Schnellzugriffe only | ✅ H6 scope |

---

## 9. Red Zones

| File | Status |
|------|--------|
| `src/screens/portal/EmployeePortalVisitExecutionScreen.tsx` | 🔴 **UNTOUCHED** — 735 lines, not read beyond first 10 |
| `app/portal/employee/assignments/[id]/execute.tsx` | 🔴 **UNTOUCHED** — deep-links to execute screen |
| `src/features/assistWorkflow/finalizeVisit.ts` | 🔴 **UNTOUCHED** |

---

## 10. H6 Recommendation

H6 should adopt:
1. `app/portal/employee/(tabs)/assignments.tsx` → `HealthOSEmployeePortalAssignmentsView` (detail list, status filters)
2. `app/portal/employee/(tabs)/schedule.tsx` → `HealthOSEmployeePortalScheduleView` (week calendar)
3. `app/portal/employee/(tabs)/documents.tsx` → `HealthOSEmployeePortalDocumentsView`
4. Replace `EmployeePortalShell` with `HealthOSPortalShell(kind='employee')` in `_layout.tsx` (per shell comment "H5/H6")
5. Add `upcomingAssignments` pagination to `employeePortalTodayModel`

**Not in H6 scope (RED ZONE):** `EmployeePortalVisitExecutionScreen` and its supporting execute workflow.
