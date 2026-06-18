# Live Restore — Navigation, Data & Shell Report

**Date:** 2026-06-18  
**Branch:** `recovery/hybrid-live-restore`  
**Scope:** Office navigation, routes, live data bindings, shell wiring (not UI polish)

---

## Executive Summary

Hybrid restore had **recovery shell/nav** wired correctly in `modulenav/officenav.ts` and `PlatformShell`, but **main data-layer regressions** and **route conflicts** caused empty Klient:innen/Mitarbeitende lists and invisible Nachrichten/Broadcast. Fixes applied selectively: restore main `clientMapper`, resolve `/office/messages` route duplicate, add Broadcast to office nav, surface tenant errors, correct employee routes.

---

## 1. Why Klient:innen were empty

| Layer | Finding |
|-------|---------|
| Service | `fetchClientList` → `clientService.list` → `supabaseClientRepository.list` on `clients` |
| Tenant | `useServiceTenantId()` from `profile.tenant_id`; missing tenant previously showed empty UI |
| Query | Live default `lifecycleFilter='active'` used `.in('status', …)` **without `lead`** |
| Mapping | Recovery stripped `remoteStatusToWorkflow` and `postal_code`/`cost_bearer` aliases from `clientMapper.ts` |

**Proof chain:** DB rows with `status='lead'` or `status='active'` were excluded or mis-mapped → `allItems.length === 0` with no error.

**Fixes:**
- Restored `src/lib/supabase/mappers/clientMapper.ts` from `main`
- Added `'lead'` to `ACTIVE_CLIENT_LIFECYCLE_STATUSES`
- `useClientList` query always runs (`enabled: true`) so missing tenant shows error

---

## 2. Why Mitarbeitende were empty

| Layer | Finding |
|-------|---------|
| Service | `fetchEmployeeList` → `employeeSupabaseRepository.list` on `employees` |
| Tenant | Same silent-empty bug when `tenantId` null |
| Routes | List screen pointed to `/business/office/employees/new` (non-existent) |

**Fixes:**
- `useEmployeeList` `enabled: true`
- Employee create/detail routes → `/office/employees/create`, prefix `/office/employees`

---

## 3. Why Nachrichten were missing

| Layer | Finding |
|-------|---------|
| Nav | Present in `OFFICE_NAV_AREAS`, `officenav.ts`, and `OFFICE_TABS` |
| Route | **Conflict:** `app/office/(tabs)/messages.tsx` AND `app/office/messages/index.tsx` both mapped to `/office/messages` |
| Screen | Recovery messenger (`OfficeMessengerScreen`) lives under `app/office/messages/` |

**Fix:** Removed duplicate `app/office/(tabs)/messages.tsx` — single canonical route via `app/office/messages/index.tsx`.

Messenger services (`messagethreadservice.ts`, `messageservice.ts`, `broadcastservice.ts`) kept from recovery.

---

## 4. Why Broadcast was missing

| Layer | Finding |
|-------|---------|
| Nav sidebar (PlatformShell) | Present in `modulenav/officenav.ts` → `/office/messages?tab=broadcasts` |
| Office tabs / Schnellzugriff | **Absent** from `OFFICE_NAV_AREAS` and dashboard shortcuts |
| Route | No separate `/office/broadcast` — intentional; tab inside messenger |

**Fix:** Added `broadcasts` entry to `OFFICE_NAV_AREAS` with href `/office/messages?tab=broadcasts`. Dashboard shortcuts re-derived from `OFFICE_NAV_AREAS` for parity.

---

## 5. Shell / theme — active vs expected

| Expected (recovery) | Was happening |
|---------------------|---------------|
| Dark Aurora `PlatformShell` on web desktop | `ThemeModeProvider` forces dark on web ≥1024px ✅ |
| Cyan/blue office accent | `officeNavigation` had `#FF9500` orange on clients/appointments |
| `ModuleNavSidebar` + `MainModuleRail` | Recovery `PlatformShell` (alias `CareDesktopShell`) ✅ |
| Light shell only when user picks light | `CareLightDesktopShell` uses orange default — only in light mode |

**Fix:** Replaced orange `#FF9500` accent with cyan `#62F3FF` in `officeNavigation.ts` for clients/appointments. No color/spacing redesign — wiring only.

**Active shell path (web dark):** `ShellLayout` → `CareAdaptiveShell` → `CareWebShell` → `CareDesktopShell` (= `PlatformShell`) with `AuroraBackground`.

---

## 6. Portals (partial / outdated)

Not fully re-audited in this pass. Portal routes remain under `/business/office/access` (modal) and `/portal/*`. `clientPortalDomainService` and recovery `portalofficemessageservice.ts` retained. Portal nav entries unchanged — follow-up if access screens still show stale demo counts.

---

## 7. Files changed

| File | Change |
|------|--------|
| `src/lib/supabase/mappers/clientMapper.ts` | Restored from main (status/field mapping) |
| `src/lib/services/clients/clientListQueryOptions.ts` | Include `lead` in active lifecycle |
| `src/hooks/useClientList.ts` | Surface tenant errors |
| `src/hooks/useEmployeeList.ts` | Surface tenant errors |
| `src/hooks/useofficemessagethreads.ts` | Surface tenant errors |
| `src/screens/office/EmployeesListScreen.tsx` | Fix create/list routes |
| `src/lib/navigation/officeNavigation.ts` | Add Broadcast; cyan accents |
| `src/lib/navigation/shellConfig.ts` | Tab key resolution strips query strings |
| `src/lib/navigation/modulenav/index.ts` | Longest-prefix nav matching |
| `src/data/demo/officeDashboard.ts` | Shortcuts derived from `OFFICE_NAV_AREAS` |
| `app/office/(tabs)/messages.tsx` | **Deleted** (route conflict) |

---

## 8. What works now

- Single `/office/messages` route → recovery messenger UI with inbox + broadcast tab
- Broadcast visible in Office sidebar tabs and dashboard Schnellzugriff
- Client list uses main-grade Supabase mapping and includes lead/intake clients in default filter
- Employee list surfaces tenant/permission errors instead of silent empty state
- Employee navigation uses live `/office/employees/*` routes
- Module nav sidebar matches `/office/messages/*` sub-routes (templates, settings, compose)
- Web desktop keeps dark PlatformShell/Aurora path

---

## 9. What remains open

- **Live DB verification:** Requires authenticated session with `EXPO_PUBLIC_DEMO_MODE=false` — confirm 10 clients / 7 employees render after deploy
- **Portal screens:** May still show outdated demo KPIs; access routes under `/business/office/access` unchanged
- **Vitest:** Pre-existing duplicate export in role matrix blocks full test run (unrelated to this fix)
- **Git identity:** Prior commits failed on missing `user.email` — commit in this pass assumes identity is configured

---

## Audit artifacts

- `.recovery-audit/client-employee-data-audit.txt` — service/table/tenant/filter proof template
