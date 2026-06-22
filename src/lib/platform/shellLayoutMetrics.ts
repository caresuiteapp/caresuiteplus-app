import { breakpoints } from '@/design/tokens/breakpoints';
import { spacing } from '@/theme';
import type { MainModuleKey } from '@/types/navigation/platform';

/** Compact app shell (top bar + bottom nav + drawer) — mobile and tablet only. Desktop ≥1024 unchanged. */
export const COMPACT_SHELL_MAX_WIDTH = breakpoints.desktop - 1;

export function isCompactShellWidth(width: number): boolean {
  return width <= COMPACT_SHELL_MAX_WIDTH;
}

/** Fixed top app bar height (excluding safe area). */
export const MOBILE_APP_BAR_HEIGHT = 56;

/** Bottom tab bar content height (excluding safe area). */
export const MOBILE_BOTTOM_NAV_HEIGHT = 56;

/** Module nav sidebar visible from tablet up (same IA as desktop web, scaled). */
export const PLATFORM_MODULE_NAV_MIN_WIDTH = breakpoints.tablet;

/** Top inset shared by module-rail logo, topbar controls, and right-panel header row. */
export const PLATFORM_SHELL_HEADER_TOP_INSET = spacing.lg;

/** Shared topbar chip height — profile menu, tenant chip. */
export const PLATFORM_TOPBAR_CONTROL_HEIGHT = 48;

/** Top of profile / tenant chip row — matches RightContextPanel scrollContent paddingTop. */
export const PLATFORM_TOPBAR_PROFILE_ROW_TOP = PLATFORM_SHELL_HEADER_TOP_INSET;

/** Width of the left MainModuleRail — keep in sync with mainmodulerail.tsx. */
export const PLATFORM_MODULE_RAIL_WIDTH = 96;
/** Logo — 2× module icon (56px) — keep in sync with mainmodulerail.tsx. */
export const PLATFORM_MODULE_RAIL_LOGO_SIZE = 112;
/** Web footer block (bell + font control + gaps) — mirrors mainmodulerail footer for vertical KPI alignment. */
export const PLATFORM_MODULE_RAIL_WEB_FOOTER_HEIGHT =
  PLATFORM_MODULE_RAIL_LOGO_SIZE +
  PLATFORM_SHELL_HEADER_TOP_INSET +
  100 +
  PLATFORM_SHELL_HEADER_TOP_INSET;
/** Width of the optional ModuleNavSidebar — keep in sync with modulenavsidebar.tsx. */
export const PLATFORM_MODULE_NAV_WIDTH = 248;
/** Width of the desktop RightContextPanel — keep in sync with rightcontextpanel.tsx. */
export const PLATFORM_RIGHT_CONTEXT_PANEL_WIDTH = 272;

export const PLATFORM_CONTEXT_PANEL_BREAKPOINT = 1280;
/** @deprecated Use PLATFORM_MODULE_NAV_MIN_WIDTH — module nav aligns with tablet shell parity. */
export const PLATFORM_MODULE_NAV_BREAKPOINT = PLATFORM_MODULE_NAV_MIN_WIDTH;

export type PlatformShellSideInsets = {
  left: number;
  right: number;
};

/** Horizontal insets of the main work column from the viewport edges. */
export function resolvePlatformShellSideInsets(
  width: number,
  mainModule: MainModuleKey,
): PlatformShellSideInsets {
  const isPhoneLayout = width < breakpoints.tablet;
  const showContext = width >= PLATFORM_CONTEXT_PANEL_BREAKPOINT;
  const showModuleNav = !isPhoneLayout && mainModule !== 'zentrale';

  return {
    left: PLATFORM_MODULE_RAIL_WIDTH + (showModuleNav ? PLATFORM_MODULE_NAV_WIDTH : 0),
    right: showContext ? PLATFORM_RIGHT_CONTEXT_PANEL_WIDTH : 0,
  };
}

/** Map shell insets into PlatformTopbar coordinates (topbar spans center column only, not the right panel). */
export function resolveTopbarCenterZoneInsets(
  _width: number,
  _mainModule: MainModuleKey,
  _topbarHorizontalPadding: number,
): PlatformShellSideInsets {
  // ModuleNavSidebar is a full-height sibling column — topbar already spans main work area only.
  return { left: 0, right: 0 };
}

/** Topbar no longer spans the right context panel column — no end-zone offset needed. */
export function resolveTopbarEndZoneInsets(
  _width: number,
  _mainModule: MainModuleKey,
  _topbarHorizontalPadding: number,
): { marginRight: number } {
  return { marginRight: 0 };
}

/** Content padding scale — tighter on tablet, standard on desktop/phone shell. */
export function resolvePlatformContentPadding(width: number): number {
  if (width < breakpoints.tablet) return spacing.lg;
  if (width < breakpoints.desktop) return spacing.md;
  return spacing.lg;
}
