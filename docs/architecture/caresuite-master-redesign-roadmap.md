# CareSuite+ Master Redesign Roadmap

Branch: `recovery/hybrid-live-restore`  
Status: Phase 1 (Package 1) — shell background + typography foundation  
Last updated: 2026-06-18

---

## 1. Executive summary

CareSuite+ is evolving from a tab-based module shell into a **modular SaaS platform** with:

- **5-zone desktop/web shell**: Topbar → MainModuleRail → ModuleNavSidebar → Work area → RightContextPanel
- **Single global animated background** (dark web; light mobile/tablet default)
- **Office messaging hub** (3-column: inbox / thread / context)
- **Broadcast system** (tenant-wide employee notifications)
- **Admin module** (settings, access, integrations)
- **Typography/theme bridge** (`useCareLightPalette` + `useLegacyTheme`)

This document maps **current state → target**, inventories key files, phases work into **packages**, and lists **risks** and **recovery-branch wins**.

---

## 2. Current shell architecture

```
app/*/\_layout.tsx
  └── ShellLayout
        └── CareAdaptiveShell
              ├── web     → CareWebShell → CareLightDesktopShell (light) | PlatformShell (dark)
              ├── desktop → CareLightDesktopShell (light) | PlatformShell (dark)
              ├── tablet  → CareLightTabletShell | CareTabletShell
              └── mobile  → CareLightMobileShell | CareMobileShell
```

| Component | Role | File |
|-----------|------|------|
| `ShellLayout` | App entry | `src/components/layout/ShellLayout.tsx` |
| `CareAdaptiveShell` | Device/platform picker | `src/components/layout/CareAdaptiveShell.tsx` |
| `CareWebShell` | Web top bar + body | `src/components/layout/CareWebShell.tsx` |
| `CareDesktopShell` | Alias → `PlatformShell` | `src/components/layout/CareDesktopShell.tsx` |
| `PlatformShell` | 5-zone dark desktop shell | `src/components/layout/platform/platformshell.tsx` |
| `MainModuleRail` | Icon rail (8 modules) | `src/components/layout/platform/mainmodulerail.tsx` |
| `ModuleNavSidebar` | Module detail nav | `src/components/layout/platform/modulenavsidebar.tsx` |
| `PlatformTopbar` | Search, tenant, actions | `src/components/layout/platform/platformtopbar.tsx` |
| `RightContextPanel` | Context (not navigation) | `src/components/layout/platform/rightcontextpanel.tsx` |
| `ScreenShell` | Page chrome (dark) | `src/components/layout/ScreenShell.tsx` |
| `CareLightPageShell` | Page chrome (light) | `src/components/layout/CareLightPageShell.tsx` |
| `useShellHostsAurora` | Page transparency hook | `src/hooks/useshellhostsaurora.ts` |

### Navigation config

| Layer | File |
|-------|------|
| Main module rail items | `src/lib/navigation/mainmodulerail.ts` |
| Per-module sidebar | `src/lib/navigation/modulenav/*.ts` (e.g. `officenav.ts`) |
| Legacy tab shell | `src/lib/navigation/shellConfig.ts`, `officeNavigation.ts` |
| Module resolution | `src/lib/navigation/resolvemainmodule.ts` |

### Current vs target navigation

| Aspect | Current (recovery) | Target (master spec) |
|--------|-------------------|----------------------|
| Dark web | `PlatformShell` 5-zone ✅ | Same |
| Light web | `CareLightDesktopShell` tab sidebar | Migrate to 5-zone light glass |
| Mobile | Bottom tab (`AppTabBar` / `CareLightBottomNav`) | Premium bottom nav rebuild |
| Module switch | `ModuleSwitcher` sheet + rail | Rail primary; switcher secondary |
| Right panel | `RightContextPanel` (module status) | + entity context in detail views |
| Messaging | 2-column in `OfficeMessengerScreen` | 3-column (+ context panel) |

---

## 3. Background / Aurora audit

### Single source of truth (after Package 1)

| Location | Instance | Notes |
|----------|----------|-------|
| `platformshell.tsx:57-58` | `GlobalAnimatedBackground` | **Canonical** dark shell root |
| `globalanimatedbackground.tsx` | Wrapper | Dark → `AuroraBackground`; light → gradient |
| `aurorabackground.tsx` | Effect | Drift animation + `prefers-reduced-motion` |
| `CareSuiteBackground.tsx` | Delegates to `GlobalAnimatedBackground` | Legacy/auth screens only |
| `CareSuiteLightBackground.tsx` | Light page gradient | `CareLightPageShell`, `AppStartScreen` |
| `useshellhostsaurora.ts` | Hook | Pages stay `transparent` when shell paints background |

### Duplicate / layered backgrounds (pre-fix)

| File:line | Issue |
|-----------|-------|
| `platformshell.tsx:58` | `AuroraBackground` (now `GlobalAnimatedBackground`) — correct single mount |
| `CareSuiteBackground.tsx:24` | Second `AuroraBackground` when used outside shell (legacy) |
| `mainmodulerail.tsx:145` | `rgba(11,16,32,0.55)` column fill — **reduced to 0.32** (glass) |
| `modulenavsidebar.tsx:195` | `rgba(18,22,43,0.55)` — **reduced to 0.32** |
| `rightcontextpanel.tsx:178` | `rgba(18,22,43,0.5)` — **reduced to 0.28** |
| `platformshell.tsx:65` | `gradientRoot` `#0B1020` base under aurora (intentional fallback) |
| `DashboardHero.tsx:76-93` | Hero-local orbs (scoped, not shell duplicate) |

**No** `AuroraBackground` inside MainModuleRail, work area, or RightContextPanel columns.

---

## 4. Typography / theme audit

### Patterns

| Hook | Provides | Use for |
|------|----------|---------|
| `useCareLightPalette()` | `c` colors only | Messenger cards, CareLight surfaces |
| `useLegacyTheme()` | `colors`, `typography`, `gradients`, `isDark` | Premium/dark heroes, platform chrome |
| `useCareAdaptiveTokens()` | `c` + `typography` + `colors` | **New** — safe combined access |
| `@/theme` `typography` | Static light scale | Module-level `StyleSheet.create` |
| `@/theme` `darkTypography` | Static dark scale | Explicit dark StyleSheets |

### Known runtime bug (fixed on recovery)

- **Error**: `Cannot read properties of undefined (reading 'h3')`
- **Cause**: `c.typography` — `CareLightResolved` has no `typography`
- **Fixed in**: `officemessagethread.tsx`, `officemessagesinbox.tsx` (commit `949d350`)
- **Pattern**: `useCareLightPalette()` + `useLegacyTheme()` for typography

### Remaining typography risk

Any file using `useCareLightPalette` only and referencing `typography` without `useLegacyTheme` will crash. Grep shows **no** remaining `c.typography` usages.

---

## 5. Office messaging vs 3-column spec

### Current (`OfficeMessengerScreen`)

| Column | Component | Width |
|--------|-----------|-------|
| 1 | `OfficeMessagesInbox` | 340px |
| 2 | `OfficeMessageThread` | flex |
| 3 | — | **Missing** |

`OfficeMessageContextPanel` exists (`officemessagecontextpanel.tsx`) but is **not wired** into `OfficeMessengerScreen`.

### Target (master spec §13)

| Column | Content |
|--------|---------|
| Inbox | Filters, search, thread list |
| Thread | Messages, composer, attachments |
| Context | Status, priority, category, assignee, client link |

### Broadcast (current)

| Piece | Status |
|-------|--------|
| `OfficeBroadcastsList` / `OfficeBroadcastDetail` | ✅ Live UI |
| `broadcastservice.ts` | ✅ Supabase live |
| `broadcastpermissions.ts` | ✅ Role + permission gate |
| Migration `0096_broadcast_rls_live_roles.sql` | ✅ RLS fix |
| Tab in messenger | ✅ `?tab=broadcasts` |

### Broadcast RLS error (user-reported)

**Symptom**: Broadcast create/list fails for live tenant admins.  
**Root cause** (migration 0096): `has_permission` profile lookup missed legacy `profiles` where `auth_user_id` was null; `messages.broadcast.create` not seeded for canonical roles.  
**Fix**: Migration backfills `auth_user_id`, extends `has_permission` OR-clause, seeds permission for owner/admin/management/office/planning/dispatch.  
**Verify**: Apply `0096_broadcast_rls_live_roles.sql` on live Supabase; test with `business_admin` role.

---

## 6. Recovery branch — already done

| Commit / area | Deliverable |
|---------------|-------------|
| `7a229e7` | Shell fix — `PlatformShell` wiring, transparent page surfaces |
| `949d350` | Messenger typography fix (`useLegacyTheme`) |
| `fc3e823` / messenger recovery | Live `messageservice`, thread detail, inbox filters |
| `mainmodulerail.ts` + `modulenav/*` | 8-module rail + per-module sidebar config |
| `officenav.ts` | Messages + broadcast nav entries |
| `OfficeMessengerScreen` | 2-column live messenger (no mock) |
| `0096_broadcast_rls` | Broadcast RLS + permission seed |

---

## 7. Master spec sections 1–22 (condensed target)

1. Modular SaaS positioning  
2. 8 main modules (Zentrale, Office, Assist, Pflege, Stationär, Beratung, Akademie, Admin)  
3. Role-based access (unchanged RLS)  
4. Dark premium web / light mobile  
5. Global animated aurora (single instance)  
6. Glass panels over background  
7. MainModuleRail + module sidebar split  
8. Platform topbar (tenant, search, notifications)  
9. Right context panel (module + entity)  
10. Office dashboard hero + KPIs  
11. List/detail/create patterns  
12. CareLight mobile shells  
13. Office messaging 3-column hub  
14. Broadcast to all employees  
15. Portal messaging parity  
16. Admin module (`/settings`)  
17. Typography scale unification  
18. Notification center  
19. Responsive breakpoints (960 sidebar, 1280 context)  
20. Package-by-package delivery (§20 steps)  
21. No demo/mock in live paths  
22. Preserve Supabase auth, routes, services  

---

## 8. File inventory by layer

### Shell / layout

- `src/components/layout/platform/*` — 5-zone shell
- `src/components/layout/CareAdaptiveShell.tsx`
- `src/components/layout/CareWebShell.tsx`
- `src/components/layout/CareLight*Shell.tsx`
- `src/components/layout/ScreenShell.tsx`

### Effects / background

- `src/components/ui/effects/globalanimatedbackground.tsx` ⭐ Package 1
- `src/components/ui/effects/aurorabackground.tsx`
- `src/components/brand/CareSuiteBackground.tsx`
- `src/components/brand/CareSuiteLightBackground.tsx`

### Theme

- `src/design/tokens/themeBridge.ts` — `useLegacyTheme`
- `src/design/tokens/carelightadaptive.ts` — `useCareLightPalette`, `useCareAdaptiveTokens`
- `src/theme/typography.ts`, `src/design/tokens/typography.ts`

### Office messaging

- `src/screens/office/OfficeMessengerScreen.tsx`
- `src/components/office/officemessagesinbox.tsx`
- `src/components/office/officemessagethread.tsx`
- `src/components/office/officemessagecontextpanel.tsx` (unwired)
- `src/lib/office/messageservice.ts`, `messagethreadservice.ts`
- `src/lib/office/broadcastservice.ts`

---

## 9. Phased implementation (packages)

### Package 1 — Shell background + typography foundation ✅ (this session)

- [x] `GlobalAnimatedBackground` at `PlatformShell` root
- [x] `AuroraBackground` animation + `prefers-reduced-motion`
- [x] Glass column opacity reduction (rail, sidebar, context)
- [x] `useCareAdaptiveTokens()` + `darkTypography` export
- [x] Roadmap document

### Package 2 — MainModuleRail + module sidebar (light mode parity)

- Wire `PlatformShell` for **light** web/desktop (replace `CareLightDesktopShell` tab sidebar)
- Rail active states, module accent colors per spec
- Breakpoint tests (960 / 1280)
- `CareWebShell` transparent root in dark mode always

### Package 3 — Platform topbar completion

- Notification bell → `notificationcenter.tsx`
- Global search scope per module
- User menu, tenant settings link
- Breadcrumb integration with `modulenav`

### Package 4 — Right context panel (entity-aware)

- Module status chips (live data hooks)
- Office quick actions (existing `OFFICE_QUICK_ACTIONS`)
- Entity context injection via route params
- Collapse on `<1280px`

### Package 5 — Office messaging 3-column

- Wire `OfficeMessageContextPanel` as third column
- Column widths: 280 / flex / 280
- Responsive: stack context below thread on tablet
- Remove duplicate panel backgrounds

### Package 6 — Broadcast UX polish

- Ensure migration 0096 applied on all environments
- Acknowledgement UI, recipient stats
- Employee portal surfacing
- Audit log entries

### Package 7 — Admin module shell

- `adminnav.ts` routes under `/settings`
- Access, integrations, developer hub
- Separate from Office org nav

### Package 8 — Mobile bottom nav rebuild

- `CareLightBottomNav` premium spec
- Module-aware tabs per area
- Safe area + haptics

### Package 9 — Module dashboard heroes (dark)

- Re-enable dark `AdaptiveModuleDashboard` on web when theme dark
- Per-module hero gradients (no full-page background)

### Package 10 — Typography sweep

- Migrate module-level `typography` from `@/theme` to `useLegacyTheme` where theme-aware
- ESLint rule or test: ban `c.typography`

### Packages 11–15 — Per-module content passes

- Office lists (clients, employees, invoices) glass tables
- Assist execution UX
- Pflege care plans
- Stationär residents
- Beratung cases
- Akademie courses

### Package 16 — Portal messaging parity

- `portalofficemessenger.tsx` 3-column
- Client/employee portal thread UX

### Package 17 — QA + visual regression

- `visualReality.test.ts` updates for dark shell
- `npx expo export --platform web` CI gate
- Screenshot baselines

---

## 10. Risk areas (do not break)

| Area | Risk | Mitigation |
|------|------|------------|
| Supabase auth | Session cookies, portal login | No auth layout changes in UI packages |
| RLS policies | Broadcast, messages | Migrations only when explicitly scoped |
| Live services | `guardServiceTenant`, `enforcePermission` | No mock fallbacks |
| Routes | `app/office/*`, `app/business/*` | Additive nav only |
| `ThemeModeProvider` | Default light | Dark shell only when `mode === 'dark'` |
| Recovery merge | Blind main merge | Package-by-package cherry-pick |

---

## 11. Verification checklist (per package)

```bash
npx expo export --platform web
npm test -- --run src/__tests__/design/
npm test -- --run src/__tests__/office/
```

---

## 12. Recommended next session

**Package 2**: MainModuleRail + module sidebar for **light mode** web/desktop — unify on `PlatformShell` so both themes use the 5-zone layout; retire duplicate `CareLightDesktopShell` sidebar for web wide breakpoints.
