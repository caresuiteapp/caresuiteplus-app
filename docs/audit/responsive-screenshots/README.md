# Responsive Screenshots — CareSuite+ LLGAN

Captured with `node scripts/capture-responsive-screenshots-r1.mjs` (R.1) or legacy `capture-responsive-screenshots.mjs` against dev server port **8082**.

## Viewports

| Tag | Size | Device class |
|-----|------|--------------|
| `web-desktop-1440` | 1440×900 | desktop / wide |
| `tablet-834` | 834×1194 | tablet |
| `mobile-390` | 390×844 | phone |

## Routes (after 2026-06 fix)

| File prefix | Route | What it shows |
|-------------|-------|---------------|
| `business-shell-preview-*` | `/shell-preview` (__DEV__) | **PlatformShell** with rail + module sidebar (tablet+) + mobile scroll nav |
| `auth-business-login-*` | `/auth/business-login` | Auth page with **LLGAN light typography** and milchglas form card |
| `portal-shell-preview-*` | `/portal-shell-preview` (__DEV__) | **PortalShellLayout** client shell |
| `assist-shell-preview-*` | `/assist-shell-preview` (__DEV__) | **Assist** compact / desktop shell |
| `employee-portal-shell-preview-*` | `/employee-portal-shell-preview` (__DEV__) | **Employee portal** shell |

## R.1 compact shell (2026-06-22)

Below **1024px** width:

- Business/Office/Assist → `MobileAppShell` (hamburger app bar, bottom tabs, overlay drawer)
- Portal client/employee → hamburger + `PortalNavigationDrawer` + bottom nav; no left sidebar on tablet
- Desktop ≥1024 unchanged (rail + sidebar, no hamburger, no bottom nav)

Re-capture R.1:

```bash
node scripts/capture-responsive-screenshots-r1.mjs
```

## Fixes applied (this iteration)

1. **Auth typography** — `useAuthFlowTypography()` replaces hard-coded white `galaxyPalette` text on light LLGAN background (`InputField`, `GlassCard`, `AuthHero`).
2. **FullScreenLoader** — no longer paints dark `SpaceBackground` over the global LLGAN root; uses transparent + `LoadingState` glass chip.
3. **Login glass tokens** — `resolveLlganViewGlass('login')` for auth cards/inputs; explicit login card alpha.
4. **Portal mobile cards** — removed hard-coded dark `rgba(20,27,40,0.85)` from `MobilePortalSidebarCards`.
6. **Portal mobile chrome** — `PortalTopBar` and `PortalMobileNav` use `lightLiquidGlass` panel/border/chip tokens when aurora + light theme (replaces dark `auroraGlass.panel` on phone).
7. **Dev preview routes** — `/shell-preview` and `/portal-shell-preview` for authenticated shell screenshots without Supabase login.

## Previous issues (before fix)

- `/business` redirected to login or session check — **no PlatformShell visible** in old `business-*` PNGs.
- White headings/labels on light aurora (unreadable contrast).
- Session loader used dark space theme while app root uses light nebula.

## Known remaining gaps

- Live `/business` dashboard still requires Supabase auth when `EXPO_PUBLIC_DEMO_MODE=false` — use `/shell-preview` for shell QA.
- Right context panel hidden below 1280px (by design); tablet shows rail + topbar + main column only (no module sidebar on Zentrale preview).
- Mobile PlatformShell scroll nav (`MobilePlatformContextPanel`) sits below the fold on short viewports — scroll down on `business-shell-preview-mobile-390.png`.
- `shellLayoutMetrics.test.ts` Vitest import of `@/theme` still fails in CI (pre-existing RN bundler issue).
- Legacy `business-*.png` (if present) captured login redirect — superseded by `business-shell-preview-*`.

## Re-capture

```bash
# Terminal 1 — dev server
$env:EXPO_PUBLIC_DEMO_MODE="false"; npx expo start --web --port 8082

# Terminal 2
node scripts/capture-responsive-screenshots.mjs
```
