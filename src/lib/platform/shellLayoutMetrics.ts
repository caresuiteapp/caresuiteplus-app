import { breakpoints } from '@/design/tokens/breakpoints';
import type { MainModuleKey } from '@/types/navigation/platform';

/** Width of the left MainModuleRail — keep in sync with mainmodulerail.tsx. */
export const PLATFORM_MODULE_RAIL_WIDTH = 88;
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

/** Map shell insets into PlatformTopbar coordinates (topbar spans content column only). */
export function resolveTopbarCenterZoneInsets(
  width: number,
  mainModule: MainModuleKey,
  topbarHorizontalPadding: number,
): PlatformShellSideInsets {
  const shell = resolvePlatformShellSideInsets(width, mainModule);
  return {
    left: shell.left - PLATFORM_MODULE_RAIL_WIDTH - topbarHorizontalPadding,
    right: shell.right - topbarHorizontalPadding,
  };
}

/** Keep bell/profile out of the right context panel column. */
export function resolveTopbarEndZoneInsets(
  width: number,
  mainModule: MainModuleKey,
  topbarHorizontalPadding: number,
): { marginRight: number } {
  const { right } = resolveTopbarCenterZoneInsets(width, mainModule, topbarHorizontalPadding);
  return { marginRight: Math.max(0, right) };
}
