# White Background Audit — Aurora Glass Migration

**Branch:** `recovery/hybrid-live-restore`  
**Date:** 2026-06-19  
**Scope:** `rg -n "backgroundColor.*#fff|backgroundColor.*white|CareLightPageShell|CareLightScreen|#F8FAFC|#F9FAFB|#F3F4F6|#F1F5F9|careLightColors\.(page|surface)" src app`

## Root Cause (pre-fix)

1. **`useShellHostsAurora` breakpoint mismatch** — used `adaptiveShell === 'desktop'|'web'` (≥1024px) while PlatformShell activates at **960px**, leaving 960–1023px web in light wrappers with white RN Web defaults.
2. **Light wrappers not gated** — `CareLightPageShell`, `CareLightScreen`, `ModuleDashboardShell`, `PremiumCard`/`Button`/`KpiCard`/`ListHeroFrame` checked `mode === 'light'` without aurora passthrough.
3. **`CareLightScreenHeader`** — hardcoded `careLightColors.surface` (#FFFFFF) header bar even when background was transparent.

## Central Fixes Applied

| File | Change |
|------|--------|
| `src/design/ThemeModeProvider.tsx` | `desktopThemeMode: 'aurora-glass'` at web ≥960px; force `mode: 'dark'` |
| `src/hooks/useshellhostsaurora.ts` | Aurora at `desktopThemeMode === 'aurora-glass'` or web ≥960 + dark |
| `src/design/tokens/glass.ts` | **NEW** — page/panel/card/elevated/modal/input/listItem tokens |
| `src/design/tokens/carelightadaptive.ts` | `useGlassPanelStyle`, `useGlassCardStyle`, `useGlassModalStyle`, `useGlassInputStyle`; palette treats aurora as dark |
| `src/design/tokens/themeBridge.ts` | `useLegacyTheme()` resolves aurora-glass as dark |
| `src/components/layout/CareLightPageShell.tsx` | Aurora: transparent root + `ScreenHeader`; skip `CareSuiteLightBackground` |
| `src/components/layout/CareLightScreen.tsx` | Aurora: transparent passthrough, no light gradient |
| `src/components/layout/platform/moduledashboardshell.tsx` | Aurora: never wrap in `CareLightScreen` |
| `src/components/layout/CareAdaptiveShell.tsx` | Light shell only when `!shellHostsAurora` |
| `src/components/ui/Premium{Card,Button,KpiCard,ListHeroFrame}.tsx` | Light variant gated by `!shellHostsAurora` |
| `src/components/ui/PremiumInput.tsx` | `useGlassInputStyle()` on aurora |
| `src/components/dashboard/OfficeDashboardView.tsx` | Area list uses glass when `shellHostsAurora` |
| `src/theme/designTokens.ts` | Glass values aligned with `glass.ts` |

---

## Findings by Category

### WRAPPER — CENTRAL FIX ✅

| Location | Issue | Fix |
|----------|-------|-----|
| `CareLightPageShell.tsx` | White page via `CareSuiteLightBackground` + white header | Aurora passthrough + `ScreenHeader` |
| `CareLightScreen.tsx` | Light gradient wrapper on dashboards | Aurora transparent root |
| `ModuleDashboardShell.tsx` | `CareLightScreen` on light mode | Gate: `mode === 'dark' \|\| shellHostsAurora` |
| `ScreenShell.tsx` | Already gated `!shellHostsAurora` | ✅ No change needed |
| `CareSuiteLightBackground.tsx` | `careLightColors.page` (#F8FAFC) | Already transparent when aurora; mobile-only path |
| `CareAdaptiveShell.tsx` | Light desktop/tablet/mobile shells | Gate `useLightShell` with aurora |
| `routeLayoutStyle.ts` | — | ✅ Already `transparent` |
| `platformshell.tsx` | Main work area | ✅ Already `transparent`; GlobalAnimatedBackground preserved |

### HERO — CENTRAL FIX ✅

| Location | Issue | Fix |
|----------|-------|-----|
| `CareLightListHeroFrame.tsx` | `careLightColors.surface` when light | `useCareLightPalette` now dark on aurora |
| `PremiumListHeroFrame.tsx` | Delegates to light hero | Gate `!shellHostsAurora` |
| `DashboardHero.tsx` | Light gradient path | `useLegacyTheme().isDark` true on aurora |

### CARD — CENTRAL FIX ✅

| Location | Issue | Fix |
|----------|-------|-----|
| `PremiumCard.tsx` | `CareLightCard` white surface | Gate `!shellHostsAurora`; CareLightCard uses glass when isDark |
| `CareLightKpiCard.tsx` | `careLightColors.surface` | isDark true on aurora → glass rgba |
| `PremiumKpiCard.tsx` | Light delegation | Gate `!shellHostsAurora` |
| `SectionPanel.tsx` | `colors.bgSurface` when light | isDark via themeBridge on aurora |
| `CareLightModuleTile.tsx` | `careLightColors.surface` | **Mobile only** — not rendered on PlatformShell desktop |

### MODAL — CENTRAL FIX ✅

| Location | Issue | Fix |
|----------|-------|-----|
| `platformmodal.tsx` | GlassSurface + isDark palette | isDark true on aurora via palette |
| `useGlassModalStyle()` | — | **NEW** hook exported |

### TABLE — CENTRAL FIX ✅

| Location | Issue | Fix |
|----------|-------|-----|
| `PremiumDataTable.tsx` | Already `designTokens.glass.*` | ✅ No change needed |

### FORM — CENTRAL FIX ✅

| Location | Issue | Fix |
|----------|-------|-----|
| `PremiumInput.tsx` | `colors.bgInput` only | `useGlassInputStyle()` overlay on aurora |

### OTHER — Intentional / Mobile / Document previews

| Location | Category | Fix type |
|----------|----------|----------|
| `CareLightScreenHeader.tsx` | WRAPPER | Bypassed on aurora (CareLightPageShell uses ScreenHeader) |
| `CareLightDesktopShell.tsx` | WRAPPER | Mobile/light path only — gated by CareAdaptiveShell |
| `CareLightTabletShell.tsx` | WRAPPER | Mobile/light path only |
| `CareLightMobileShell.tsx` | WRAPPER | Mobile/light path only |
| `CareLightBottomNav.tsx` | OTHER | Mobile tabs only |
| `CareLightButton.tsx` | OTHER | Mobile light buttons — PremiumButton used on desktop |
| `CareLightQuickActionsMenu.tsx` | OTHER | Component-specific; mobile context |
| `CareLightModuleTile.tsx` | CARD | Auth/landing mobile |
| `GuidedTourOverlay.tsx` | MODAL | Component-specific overlay — future: glass on desktop |
| `ClientRecordHero.tsx` | HERO | Office detail — component-specific |
| `ClientRecordOverviewPanel.tsx` | WRAPPER | Office detail panel — component-specific |
| `DocumentHtmlPreview.tsx` | OTHER | **Intentional** — HTML document iframe white canvas |
| `DocumentDeliveryActions.tsx` | OTHER | Component-specific |
| `messageattachmentlist.tsx` | OTHER | Attachment preview white canvas |
| `CareSignatureCanvas.tsx` | FORM | **Intentional** — signature pad white canvas |
| `CareIntakeDocumentsStepPanel.tsx` | OTHER | Warning badge `#fff3cd` — semantic, not surface |
| `lightTheme.ts` | TOKEN | Source definitions — mobile light only |
| `carelightadaptive.ts` `surfaceAlt: '#F1F5F9'` | TOKEN | Mobile light palette only |
| 150+ screens using `CareLightPageShell` | WRAPPER | **CENTRAL FIX** — shell now aurora-aware |

---

## Post-Fix Remaining Matches (intentional)

After central fixes, remaining `careLightColors.page|surface` hits are:

- **Mobile light shells** (CareLightMobile/Tablet/DesktopShell) — not mounted when `shellHostsAurora`
- **CareSuiteLightBackground** — mobile branch only
- **Document/signature iframes** — `#fff` canvas for rendered content
- **Semantic badge colors** — not page surfaces
- **Screen files importing CareLightPageShell** — shell itself now transparent on desktop

---

## 20-Point Acceptance Checklist (Section 14)

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Desktop web ≥960px uses `aurora-glass` only | ✅ PASS |
| 2 | `desktopThemeMode` exported from ThemeModeProvider | ✅ PASS |
| 3 | `useShellHostsAurora()` true on desktop web | ✅ PASS |
| 4 | CareLightPageShell never paints white on aurora | ✅ PASS |
| 5 | CareLightScreen never paints white on aurora | ✅ PASS |
| 6 | ScreenShell transparent root on aurora | ✅ PASS |
| 7 | ModuleDashboardShell no white fill on aurora | ✅ PASS |
| 8 | PlatformShell main work area transparent | ✅ PASS |
| 9 | routeLayoutStyle transparent in layouts | ✅ PASS |
| 10 | GlobalAnimatedBackground preserved | ✅ PASS |
| 11 | Glass tokens in `src/design/tokens/glass.ts` | ✅ PASS |
| 12 | useGlassPanel/Card/Modal/InputStyle exported | ✅ PASS |
| 13 | PremiumCard/KpiCard/Button glass on aurora | ✅ PASS |
| 14 | PremiumListHeroFrame dark glass on aurora | ✅ PASS |
| 15 | Office dashboard panels (KPI, areas, activity) glass | ✅ PASS |
| 16 | PremiumInput glass fill on aurora | ✅ PASS |
| 17 | PlatformModal glass body on aurora | ✅ PASS |
| 18 | Mobile light path unchanged (CareLight shells) | ✅ PASS |
| 19 | No auth/data/RLS changes | ✅ PASS |
| 20 | `npx expo export --platform web` succeeds | ✅ PASS |

---

## Before / After — Office Dashboard

**Before:** White/light-gray content column at 960–1023px; CareLightScreen wrapper on module dashboards; white header bars from CareLightScreenHeader; KPI/area cards using `#FFFFFF` / `#F8FAFC`.

**After:** Transparent page root → GlobalAnimatedBackground visible; SectionPanel/PremiumKpiCard/PremiumCard glass gradients; area list `designTokens.glass.background`; DashboardHero vivid gradient; all sections inherit dark theme via `useLegacyTheme()` aurora resolution.

---

## Broadcast RLS (0096)

Not addressed in this migration — document separately per user instruction.
