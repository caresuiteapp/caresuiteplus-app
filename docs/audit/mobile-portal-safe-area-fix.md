# Mobile Portal Safe Area Fix — Audit

**Date:** 2026-06-25  
**Scope:** Klient:innenportal mobile (iPhone/Safari): shell, Termine, Login, nav drawer, background

## Root cause summary

1. **Safe area not applied on web Safari** — `PortalShellLayout` used raw `useSafeAreaInsets().top` without `env(safe-area-inset-*)`, so the compact header sat under the iOS status bar on PWA/mobile Safari.
2. **Bottom nav in document flow** — `PortalMobileNav` was not absolutely positioned; scroll content lacked `padding-bottom` for nav + home indicator + Safari toolbar, clipping CTAs.
3. **Abmelden duplicated in page chrome** — `PortalTabScreen` injected a ghost logout button into `ScreenHeader.rightSlot`; compact `PortalTopBar` also exposed logout in the profile dropdown, overlapping titles on narrow viewports.
4. **Background circles stretched oval** — `GlobalPersistentSpaceMotionBackground` scaled the scene with independent `scaleX`/`scaleY`, distorting discs on tall phone aspect ratios. Static layers used `100vh` instead of `100dvh`, causing resize jumps when Safari toolbar shows/hides.

## Files changed

| File | Change |
|------|--------|
| `src/lib/platform/webSafeArea.ts` | Reusable safe-area helpers, dvh viewport, portal padding math, global CSS constant |
| `app/+html.tsx` | Inject `WEB_SAFE_AREA_GLOBAL_CSS` (env insets + 100svh/100dvh) |
| `src/components/layout/portal/PortalShellLayout.tsx` | Top safe-area padding, dvh min-height, absolute bottom nav host, scroll padding |
| `src/components/layout/portal/PortalTopBar.tsx` | Compact: no Abmelden in profile menu; 44pt targets; title ellipsis |
| `src/components/layout/portal/PortalNavigationDrawer.tsx` | Abmelden as separated last item; safe-area panel padding |
| `src/components/layout/PortalMobileNav.tsx` | 44pt tab targets; existing bottom safe-area padding retained |
| `src/screens/portal/PortalTabScreen.tsx` | Remove page-header logout; portal bottom padding; bare mode without duplicate SafeAreaView |
| `src/components/layout/ScreenShell.tsx` | `hideMobileLogout`, configurable scroll bottom padding |
| `src/components/layout/ScreenHeader.tsx` | Phone: hide breadcrumbs, wrap title, 44pt back target |
| `src/design/components/AppScreen.tsx` | Login scroll bottom reserve (88px + inset), web top safe area |
| `src/design/components/AuthHero.tsx` | 44pt back button |
| `src/components/backgrounds/StaticLightPaperBackground.tsx` | `100dvh` fixed cover layer |
| `src/components/backgrounds/GlobalPersistentSpaceMotionBackground.tsx` | Uniform cover scale; `100dvh` |
| `app/portal/client/(tabs)/appointments.tsx` | `hideHeaderOnPhone` on Termine |
| `src/__tests__/portal/mobilePortalSafeArea.test.ts` | Regression source tests |

## Verification

### Automated

- `npm run typecheck`
- `npm run lint`
- `npm test -- src/__tests__/portal/mobilePortalSafeArea.test.ts`
- `npm test -- src/__tests__/portal/assistPortalMobileLayout.test.ts`

### Manual viewports (Safari iOS / responsive mode)

| Viewport | Pages to check |
|----------|----------------|
| 375×812 | Overview, Termine, Login, drawer |
| 390×844 | Overview, Termine, Login, drawer |
| 393×852 | Overview, Termine, Login, drawer |
| 430×932 | Overview, Termine, Login, drawer |

**Checks:** header below status bar; bottom content above nav + Safari bar; Abmelden only in drawer footer; background discs round (not oval); no horizontal overflow on title/breadcrumb.

### Screenshot evidence

Run local web export and capture (when browser MCP available):

```bash
npm run web
# Navigate: /auth/portal-code-login, /portal/client, /portal/client/appointments
# Viewports: 390×844, 375×812
```

Store captures under `.audit-mobile-portal-safe-area/` (gitignored audit artifacts).

## Remaining risks

- **Native iOS app** — SafeAreaView paths unchanged; web-specific `env()` helpers only apply on web.
- **Employee portal profile href** — Compact top bar still links to `/portal/client/profile` (pre-existing).
- **Tablet 768–1023** — Uses compact shell; desktop ≥1024 unchanged but not re-audited in this pass.
- **Safari toolbar dynamic height** — `100dvh` + bottom padding reduces clipping; extreme toolbar states may still need manual QA on real devices.
