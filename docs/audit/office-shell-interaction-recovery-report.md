# Office Shell & Interaction Recovery Report

**Date:** 2026-06-18  
**Branch:** `recovery/hybrid-live-restore`  
**Scope:** Shell/overlay interaction wiring only — no data service changes, no cosmetic token overrides

---

## Executive Summary

The **PlatformShell + Aurora** desktop path was already active via `ShellLayout → CareAdaptiveShell → CareWebShell → CareDesktopShell (= PlatformShell)`. The regression was in the **content layer**: office screens wrapped themselves in `CareLightScreen` / `CareLightPageShell`, painting opaque white/light surfaces inside the dark shell. Detail modals (`ClientDetailModal`, `EmployeeDetailModal`) existed but were never wired.

Fixes reconnect recovery UI patterns while keeping main-branch live data services intact.

---

## 1. Investigation Findings

### 1.1 Which shell was active?

| Layer | Component | Status |
|-------|-----------|--------|
| `app/office/_layout.tsx` | `ShellLayout area="office"` | ✅ Correct entry |
| `ShellLayout` | `CareAdaptiveShell` | ✅ |
| Web dark (≥1024px) | `CareWebShell → CareDesktopShell (= PlatformShell)` | ✅ |
| Aurora | `PlatformShell` renders `AuroraBackground` when `isDark` | ✅ |
| Context panel | `RightContextPanel` at width ≥1280 | ✅ Present, not wired to screens |

**Wrong layer:** Content screens used `CareLightScreen` / `CareLightPageShell` — these inject `CareSuiteLightBackground` (white card) over the shell.

### 1.2 What rendered the white office card?

- `OfficeIndexScreen` → `CareLightScreen` + `CareLightModuleDashboard`
- `ClientsListScreen`, `EmployeesListScreen`, `OfficeMessengerScreen` → `CareLightPageShell`
- `CareLightPageShell` / `CareLightScreen` always paint light backgrounds regardless of shell theme

### 1.3 Recovery shell vs HEAD (fc3e823)

`git diff fc3e823 -- src/components/layout/platform/` showed only a ScrollView→View change in `platformshell.tsx` (non-functional for theme). Recovery shell files were intact; content screens had regressed to light wrappers during hybrid data restore from main.

### 1.4 Components that should be modal/overlay but were page-based

| Feature | Recovery component | Was wired? | Now |
|---------|-------------------|------------|-----|
| Dashboard hero | `OfficeDashboardView` + `DashboardHero` | ❌ Used `CareLightModuleDashboard` | ✅ `ModuleDashboardShell` |
| Client Akte | `ClientDetailModal` + `GradientModalHeader` | ❌ Route-only / inline panel | ✅ Modal on Aurora shell |
| Employee profile | `EmployeeDetailModal` + `GradientModalHeader` | ❌ Route-only / inline panel | ✅ Modal on Aurora shell |
| Broadcast | `OfficeBroadcastModal` | ✅ Already in `OfficeMessengerScreen` | ✅ Kept |
| Messenger workspace | `OfficeMessagesInbox` + `OfficeMessageThread` | ✅ Logic present | ✅ `ScreenShell` (transparent) |
| Context | `RightContextPanel` | ✅ In PlatformShell | ✅ Unchanged |

### 1.5 Navigation / routing

- `officenav.ts`, `officeNavigation.ts`, `shellConfig.ts` — recovery nav intact (prior commit)
- `/office/messages` → `OfficeMessengerScreen` via `app/office/messages/index.tsx` — single canonical route
- Broadcast via `?tab=broadcasts` + `OfficeBroadcastModal` on send action

---

## 2. Fixes Applied

### 2.1 Dashboard — gradient hero, not white card

**File:** `src/screens/office/OfficeIndexScreen.tsx`

- Replaced `CareLightScreen` + `CareLightModuleDashboard`
- Now uses `ModuleDashboardShell` + `ActionToolbar` + `OfficeDashboardView`
- Live data via `useOfficeDashboard` unchanged

### 2.2 Page shells — transparent in Aurora context

**File:** `src/components/layout/ScreenShell.tsx`

- Wired `useShellHostsAurora()` → transparent background when PlatformShell hosts Aurora
- Light mode still delegates to `CareLightPageShell`

**Files:** `ClientsListScreen.tsx`, `EmployeesListScreen.tsx`, `OfficeMessengerScreen.tsx`

- Replaced direct `CareLightPageShell` usage with `ScreenShell` (theme-adaptive)

### 2.3 CareWebShell — no duplicate browser chrome in dark mode

**File:** `src/components/layout/CareWebShell.tsx`

- When `useLightShell=false` (dark PlatformShell): transparent root, skip duplicate browser topbar
- PlatformShell's own `PlatformTopbar` remains the single top chrome

### 2.4 Modal overlay reconnection

**Files:** `ClientsAdaptiveScreen.tsx`, `EmployeesAdaptiveScreen.tsx`

- When `useShellHostsAurora()` is true (web/desktop dark): list stays in shell, row tap opens `ClientDetailModal` / `EmployeeDetailModal`
- Tablet/phone paths unchanged: `AdaptiveListDetail` with summary panels

---

## 3. Acceptance Criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Aurora/Space background active | ✅ Yes — PlatformShell + transparent content |
| 2 | Dashboard not white embedded card | ✅ Yes — `DashboardHero` gradient via `OfficeDashboardView` |
| 3 | Messenger three-part workspace | ✅ Inbox + thread panes in shell; context via `RightContextPanel` at ≥1280px |
| 4 | Broadcast opens as modal | ✅ `OfficeBroadcastModal` with `PlatformModal`/`GradientModalHeader` |
| 5 | Context as panel/popup | ✅ `RightContextPanel` in PlatformShell (unchanged) |
| 6 | Popup/overlay interaction model restored | ✅ Client/employee detail modals wired on Aurora shell |
| 7 | Live user/tenant unchanged | ✅ No auth/tenant/config changes |
| 8 | Client/employee data services still wired | ✅ `clientListService`, `employeeListService`, mappers untouched |

---

## 4. Files Changed

| File | Change |
|------|--------|
| `src/screens/office/OfficeIndexScreen.tsx` | ModuleDashboardShell + OfficeDashboardView |
| `src/screens/office/ClientsListScreen.tsx` | CareLightPageShell → ScreenShell |
| `src/screens/office/EmployeesListScreen.tsx` | CareLightPageShell → ScreenShell |
| `src/screens/office/OfficeMessengerScreen.tsx` | CareLightPageShell → ScreenShell |
| `src/screens/office/ClientsAdaptiveScreen.tsx` | ClientDetailModal on Aurora shell |
| `src/screens/office/EmployeesAdaptiveScreen.tsx` | EmployeeDetailModal on Aurora shell |
| `src/components/layout/ScreenShell.tsx` | Transparent bg when shell hosts Aurora |
| `src/components/layout/CareWebShell.tsx` | Skip duplicate topbar in dark PlatformShell |

---

## 5. Verification

- `npx expo export --platform web` — **passed** (dist generated)
- Data services (`clientMapper`, `fetchClientList`, `fetchEmployeeList`, `useOfficeDashboard`) — **not modified**

---

## 6. Remaining Open Items

- Other office sub-screens (invoices, documents, access, QM) still use `CareLightPageShell` directly — follow-up if those routes show white cards on Aurora shell
- `MasterDetailLayout` uses opaque `colors.bgBase` — only affects non-Aurora tablet split-pane path
- Live DB smoke test with authenticated Kevin Reinhardt / Helferhasen+ UG session recommended post-deploy

---

## 7. Architecture Diagram (post-fix)

```
app/office/_layout.tsx
  └── ShellLayout (area=office)
        └── CareAdaptiveShell
              └── CareWebShell (transparent, dark)
                    └── PlatformShell + AuroraBackground
                          ├── MainModuleRail
                          ├── ModuleNavSidebar
                          ├── Main work area
                          │     ├── ModuleDashboardShell → OfficeDashboardView (dashboard)
                          │     ├── ScreenShell (transparent) → list/messenger content
                          │     └── ClientDetailModal / EmployeeDetailModal (overlay)
                          └── RightContextPanel (≥1280px)
```
