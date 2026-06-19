import { breakpoints } from '@/design/tokens/breakpoints';
import type { MainModuleKey } from '@/types/navigation/platform';

/** Width of the left MainModuleRail — keep in sync with mainmodulerail.tsx. */
export const PLATFORM_MODULE_RAIL_WIDTH = 72;
/** Width of the optional ModuleNavSidebar — keep in sync with modulenavsidebar.tsx. */
export const PLATFORM_MODULE_NAV_WIDTH = 248;
/** Width of the desktop RightContextPanel — keep in sync with rightcontextpanel.tsx. */
export const PLATFORM_RIGHT_CONTEXT_PANEL_WIDTH = 272;

export const PLATFORM_CONTEXT_PANEL_BREAKPOINT = 1280;
export const PLATFORM_MODULE_NAV_BREAKPOINT = 960;

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
  const showModuleNav =
    width >= PLATFORM_MODULE_NAV_BREAKPOINT && !isPhoneLayout && mainModule !== 'zentrale';

  return {
    left: PLATFORM_MODULE_RAIL_WIDTH + (showModuleNav ? PLATFORM_MODULE_NAV_WIDTH : 0),
    right: showContext ? PLATFORM_RIGHT_CONTEXT_PANEL_WIDTH : 0,
  };
}

/** Map shell insets into PlatformTopbar coordinates (topbar spans center column only, not the right panel). */
export function resolveTopbarCenterZoneInsets(
  width: number,
  mainModule: MainModuleKey,
  _topbarHorizontalPadding: number,
): PlatformShellSideInsets {
  const isPhoneLayout = width < breakpoints.tablet;
  const showModuleNav =
    width >= PLATFORM_MODULE_NAV_BREAKPOINT && !isPhoneLayout && mainModule !== 'zentrale';

  return {
    left: showModuleNav ? PLATFORM_MODULE_NAV_WIDTH : 0,
    right: 0,
  };
}

/** Topbar no longer spans the right context panel column — no end-zone offset needed. */
export function resolveTopbarEndZoneInsets(
  _width: number,
  _mainModule: MainModuleKey,
  _topbarHorizontalPadding: number,
): { marginRight: number } {
  return { marginRight: 0 };
}
