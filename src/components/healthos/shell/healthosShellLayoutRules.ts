import { breakpoints } from '@/design/tokens/breakpoints';
import { healthosZIndex } from '../tokens';

/**
 * Responsive shell layout rules for HealthOS (H2).
 * Prepared for H3+ adoption — no existing shells replaced.
 */
export const healthosShellLayoutRules = {
  desktop: {
    minWidth: breakpoints.desktop,
    sidebar: { visible: true, collapsible: true, minTouchTarget: 44 },
    topBar: { visible: true, breadcrumbs: true },
    main: { flex: 1, detailPanelOptional: true },
    bottomNav: { visible: false },
  },
  tablet: {
    minWidth: breakpoints.tablet,
    maxWidth: breakpoints.desktop - 1,
    sidebar: { visible: true, compact: true, minTouchTarget: 48 },
    topBar: { visible: true, breadcrumbs: true },
    main: { flex: 1 },
    bottomNav: { visible: false },
  },
  mobile: {
    maxWidth: breakpoints.tablet - 1,
    sidebar: { visible: false },
    topBar: { visible: true, compact: true },
    main: { flex: 1, taskFocused: true },
    bottomNav: { visible: true, primaryMax: 5 },
  },
  portalMobileFirst: {
    /** Employee portal target — H5 implements workflow; H2 prepares shell only. */
    employee: { bottomNavPrimary: 5, sidebarNeverForced: true },
    client: { bottomNavPrimary: 5, sidebarNeverForced: true },
  },
  zIndex: {
    sidebar: healthosZIndex.sticky,
    topBar: healthosZIndex.sticky + 1,
    bottomNav: healthosZIndex.sticky + 2,
    notification: healthosZIndex.dropdown,
  },
} as const;

export type HealthOSShellBreakpoint = 'mobile' | 'tablet' | 'desktop';

export function resolveHealthOSShellBreakpoint(width: number): HealthOSShellBreakpoint {
  if (width >= breakpoints.desktop) return 'desktop';
  if (width >= breakpoints.tablet) return 'tablet';
  return 'mobile';
}
