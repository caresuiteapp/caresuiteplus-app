# No-White-Background Audit — Aurora Glass Desktop Web

**Branch:** `recovery/hybrid-live-restore`  
**Date:** 2026-06-19  
**Scope:** Desktop web ≥960px (`aurora-glass` / `useShellHostsAurora`) — Klient:innen list and shared UI surfaces

---

## Root Cause (Phase 1)

Static `colors` from `@/theme/colors.ts` is **always the light palette** (`legacyColorsFromPalette('light')`). Components that call `StyleSheet.create()` at **module load** with `colors.bgSurface`, `colors.bgInput`, etc. render **#FFFFFF / #F8FAFC** on RN Web even when `ThemeModeProvider` forces `mode: 'dark'` and `desktopThemeMode: 'aurora-glass'`.

Prior wrapper fixes (CareLightPageShell passthrough, ThemeModeProvider 960px gate) were necessary but **insufficient** — toolbar controls on Klient:innen still used static light fills.

---

## Klient:innen Page — Screenshot Areas

| UI area | Component | Pre-fix file:line | Pattern | Entscheidung | Status |
|---------|-----------|-------------------|---------|--------------|--------|
| Main wrapper | `ScreenShell.tsx` | 68 | `shellHostsAurora ? 'transparent'` | behalten | ✅ already transparent |
| Route stack | `routeLayoutStyle.ts` | 5–7 | `backgroundColor: 'transparent'` | behalten | ✅ |
| Hero panel | `CareLightListHeroFrame.tsx` | 33 | `isDark ? glass : careLightColors.surface` | behalten (isDark true on aurora) | ✅ |
| View toggle (Karten/Tabelle) | `SegmentedTabs.tsx` | 51 | `colors.bgSurface` (#FFF) | **ersetzen** → `useAuroraGlassChipStyles` | ✅ fixed |
| Search field | `PremiumInput.tsx` | 38 | `colors.bgInput` + glass overlay | **ersetzen** → `useAuroraGlass().tokens.input` | ✅ fixed |
| Status chips | `FilterChip.tsx` | 70 | `colors.bgSurface` (#FFF) | **ersetzen** → `auroraGlass.chip` | ✅ fixed |
| Pflegegrad chips | `FilterChipGroup` → `FilterChip` | 70 | same | **ersetzen** | ✅ fixed |
| Sortierung chips | `FilterChipGroup` | 70 | same | **ersetzen** | ✅ fixed |
| Table container | `PremiumDataTable.tsx` | 149 | `designTokens.glass.background` | **ersetzen** → `useAuroraGlassTableStyles` (dynamic) | ✅ fixed |
| Table header | `PremiumDataTable.tsx` | 157 | `rgba(255,255,255,0.04)` | behalten (glass header token) | ✅ |
| Table rows | `PremiumDataTable.tsx` | 184–187 | rgba alt/selected | behalten (glass row tokens) | ✅ |
| Scroll/list wrapper | `ClientsListView.tsx` | 332–337 | no explicit bg (RN Web white default) | **ersetzen** → `transparent` | ✅ fixed |
| **List content shell (shared)** | **`ScreenShell.tsx`** | **75–82** | **`content` / `a11yRoot` / `scroll` — no `backgroundColor`; RN Web paints opaque `#F8FAFC`/white below hero | **ersetzen** → `transparent` when `shellHostsAurora` | ✅ fixed |
| Footer Aktualisieren | `PremiumButton.tsx` | 149–156 | static `colors.bgPanel` / light ghost on aurora | **ersetzen** → `useAuroraGlassButtonStyles()` | ✅ fixed |
| Loading/empty/error | `StateViews.tsx` | 77–92 | transparent only — parent still light; empty reads as gray sheet | **ersetzen** → `auroraGlass.panel` when active | ✅ fixed |

---

## Central Component Audit Table

| Datei | Zeile | Muster | Komponente | Zweck | Entscheidung | Begründung | Status |
|-------|-------|--------|------------|-------|--------------|------------|--------|
| `src/theme/colors.ts` | 8 | `legacyColorsFromPalette('light')` | Static `@/theme` export | Mobile light default | behalten | Mobile screens; aurora paths must use hooks | ⚠️ documented |
| `src/components/ui/FilterChip.tsx` | 70 | `colors.bgSurface` | Filter chips | Chip fill | **ersetzen** | Static light on aurora desktop | ✅ |
| `src/components/ui/SegmentedTabs.tsx` | 51 | `colors.bgSurface` | Karten/Tabelle toggle | Segment fill | **ersetzen** | Same root cause | ✅ |
| `src/components/ui/ListFilterSelect.tsx` | 118,153,191 | `colors.bgInput/bgElevated/bgPremium` | Employee filters | Select trigger/dropdown | **ersetzen** | Static light surfaces | ✅ |
| `src/components/ui/PremiumInput.tsx` | 38 | `colors.bgInput` | Search inputs | Input fill | **ersetzen** | Klient:innen search bar | ✅ |
| `src/components/ui/PremiumDataTable.tsx` | 149 | `designTokens.glass.background` | Data tables | Table shell | **ersetzen** | Dynamic aurora + light fallback | ✅ |
| `src/components/ui/StateViews.tsx` | 77+ | static `colors` typography | Empty/loading/error | State views | **ersetzen** | Readable on glass | ✅ |
| `src/components/ui/FormStepper.tsx` | 56 | `colors.bgSurface` | Wizard steps | Step dots | **ersetzen** | Shared form UI | ✅ |
| `src/components/layout/CareLightPageShell.tsx` | 115–119 | `CareSuiteLightBackground` | Page shell | Light wrapper | behalten | Gated: skipped when `shellHostsAurora` | ✅ |
| `src/components/layout/CareLightScreen.tsx` | 37–42 | `CareSuiteLightBackground` | Screen wrapper | Light gradient | behalten | Gated: aurora passthrough | ✅ |
| `src/components/layout/ScreenShell.tsx` | 41–55 | `CareLightPageShell` | Route shell | Light branch | behalten | Only when `light && !shellHostsAurora` | ✅ |
| `src/components/layout/platform/moduledashboardshell.tsx` | 53–57 | `CareLightScreen` | Module dashboard | Light wrap | behalten | Gated: `dark \|\| shellHostsAurora` | ✅ |
| `src/design/ThemeModeProvider.tsx` | 29–31,57–59 | `aurora-glass` @960px | Theme gate | Force dark on desktop web | behalten | Already correct | ✅ |
| `src/components/layout/ScreenShell.tsx` | 75–82 | implicit RN Web default surface | Route shell content below header | **ersetzen** | Shared wrapper for Clients/Employees/Appointments list screens | ✅ |
| `src/components/ui/PremiumButton.tsx` | 149–156 | static `colors.bgPanel` | Footer/outline buttons | **ersetzen** | Ghost Aktualisieren showed white chip | ✅ |
| `src/components/ui/StateViews.tsx` | 52–57 | `transparent` on light parent | Empty/loading/error | **ersetzen** | Termine empty state gray sheet | ✅ |
| `src/components/office/AppointmentsListView.tsx` | 306–311 | no explicit scroll bg | Termine list scroll | **ersetzen** | Align with Clients/Employees transparent | ✅ |
| `src/design/tokens/auroraGlass.ts` | — | **NEW** `useAuroraGlassButtonStyles` | Button glass tokens | **ersetzen** | Central ghost/secondary on aurora | ✅ |
| `src/design/routeLayoutStyle.ts` | 5–7 | `transparent` | Expo stack content | Route bg | behalten | Correct | ✅ |
| `src/components/layout/platform/platformtopbar.tsx` | 62,272,330 | `#FFFFFF` / light dropdown | Topbar | Light dropdown surfaces | behalten | Do not break topbar (e675ad0) | ⚠️ allowed |
| `src/components/layout/ListDetailLayout.tsx` | 26,34,39 | `colors.bgBase` | Master-detail | Pane backgrounds | behalten | Not used by Klient:innen index route | ⚠️ deferred |
| `DocumentHtmlPreview.tsx` | 59 | `#fff` iframe | Document preview | HTML canvas | behalten | Intentional document white | ⚠️ allowed |

**Findings replaced in central/shared paths:** 9 components + 1 new token module  
**Priority-path violations after patch:** 0

---

## Phase 2 — Central Tokens (`src/design/tokens/auroraGlass.ts`)

| Token | Value | Hook |
|-------|-------|------|
| `page` | `transparent` | `useAuroraGlass()` |
| `panel` | `rgba(23,27,34,0.65)` | `useAuroraGlassPanelStyle()` |
| `card` | `rgba(23,27,34,0.72)` | `useAuroraGlassCardStyle()` |
| `elevated` | `rgba(30,35,48,0.82)` | `useAuroraGlassSelectStyles()` dropdown |
| `modal` | `rgba(16,24,39,0.88)` | `useAuroraGlassModalStyle()` |
| `input` | `rgba(26,32,42,0.75)` | `useAuroraGlassInputStyle()` |
| `chip` | `rgba(255,255,255,0.06)` | `useAuroraGlassChipStyles()` / `useAuroraGlassButtonStyles()` |
| `chipActive` | `rgba(255,149,0,0.14)` | `useAuroraGlassChipStyles()` |
| `table` | `rgba(23,27,34,0.65)` | `useAuroraGlassTableStyles()` |
| `row` | `transparent` | table data rows |
| `rowHover` | `rgba(255,255,255,0.04)` | reserved |
| `rowAlt` | `rgba(255,255,255,0.02)` | zebra rows |
| `rowSelected` | `rgba(255,149,0,0.10)` | selected row |

Gated on `useShellHostsAurora()` / `desktopThemeMode === 'aurora-glass'`.

---

## Phase 4 — Audit Script Results

### Before patch (manual rg + code review)

```
FilterChip.tsx:70:static-bg-surface
SegmentedTabs.tsx:51:static-bg-surface
ListFilterSelect.tsx:118:static-bg-input
ListFilterSelect.tsx:153:static-bg-elevated
PremiumInput.tsx:38:static-bg-input
Priority path violations: 5 (Klient:innen toolbar controls)
```

### After patch (`npm run audit:no-white`)

```
=== audit:no-white ===
Files scanned: 3558
Total pattern matches: 73
Priority path violations: 0
Other (non-allowlisted) hits: 11
Allowlisted / non-priority: 73
Exit code: 0
```

---

## Nach-Patch-Prüfung (rg)

Post-fix rg on priority UI components shows **no** `colors.bgSurface` / `colors.bgInput` in:
- `FilterChip.tsx`, `SegmentedTabs.tsx`, `ListFilterSelect.tsx`, `PremiumInput.tsx`, `ClientsListView.tsx`

Remaining `colors.bgSurface` elsewhere: connect panels, mobile shells, marketplace — **not rendered on PlatformShell desktop aurora**.

---

## Remaining Allowed Exceptions

| Area | Justification |
|------|---------------|
| `platformtopbar.tsx` `#FFFFFF` | Preserved per e675ad0 — light dropdown/search popover on mixed shell |
| `CareLight*` mobile components | Not mounted when `useShellHostsAurora()` |
| Connect billing/accounting panels | Prepared-mode mobile workflows |
| Document/signature previews | White canvas required for PDF/HTML fidelity |
| `ListDetailLayout` / `MasterDetailLayout` | Legacy master-detail; Klient:innen uses `ScreenShell` + transparent stack |
| Static `@/theme` `colors` export | Mobile light default; aurora must use `useLegacyTheme` / `useAuroraGlass*` |

---

## Files Changed (Phase 3 + list-shell follow-up)

1. `src/design/tokens/auroraGlass.ts` — **NEW** + `useAuroraGlassButtonStyles`
2. `src/design/tokens/glass.ts` — re-export shim
3. `src/design/tokens/carelightadaptive.ts` — delegate to aurora hooks
4. `src/theme/designTokens.ts` — import auroraGlass
5. `src/components/ui/FilterChip.tsx`
6. `src/components/ui/SegmentedTabs.tsx`
7. `src/components/ui/ListFilterSelect.tsx`
8. `src/components/ui/PremiumDataTable.tsx`
9. `src/components/ui/PremiumInput.tsx`
10. `src/components/ui/StateViews.tsx`
11. `src/components/ui/FormStepper.tsx`
12. `src/components/office/ClientsListView.tsx`
13. `src/components/office/EmployeesListView.tsx`
14. `scripts/audit-no-white-backgrounds.js` — **NEW**
15. `package.json` — `audit:no-white` script
16. `src/components/layout/ScreenShell.tsx` — transparent `content` / `a11yRoot` / scroll on aurora
17. `src/components/ui/PremiumButton.tsx` — aurora glass ghost/secondary
18. `src/components/office/AppointmentsListView.tsx` — transparent scroll wrappers
