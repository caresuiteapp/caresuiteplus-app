import { Platform, type DimensionValue, type ViewStyle } from 'react-native';
import { PORTAL_MOBILE_NAV_HEIGHT } from '@/lib/navigation/portalMobileTabs';

/** iOS HIG minimum touch target (pt). */
export const MOBILE_MIN_TOUCH_TARGET = 44;

/** Minimum spacing from screen edges for tappable controls. */
export const MOBILE_EDGE_INSET = 8;

/** Extra padding below safe-area top for compact shell headers. */
export const MOBILE_SHELL_TOP_EXTRA = 12;

/** Extra scroll padding below bottom nav + safe area on portal mobile pages. */
export const MOBILE_CONTENT_BOTTOM_EXTRA = 24;

/** Safari bottom toolbar reserve on auth/login screens (nav + inset + buffer). */
export const MOBILE_AUTH_BOTTOM_RESERVE = 88;

/** Web Safari / iOS PWA — combine RN insets with env(safe-area-inset-*). */
export function webSafeAreaPadding(
  edge: 'top' | 'bottom' | 'left' | 'right',
  fallbackPx: number,
): DimensionValue {
  if (Platform.OS !== 'web') return fallbackPx;
  return `max(${fallbackPx}px, env(safe-area-inset-${edge}))` as DimensionValue;
}

/** calc(env(safe-area-inset-*) + extraPx) — for content padding below fixed chrome. */
export function webSafeAreaCalc(
  edge: 'top' | 'bottom' | 'left' | 'right',
  extraPx: number,
): DimensionValue {
  if (Platform.OS !== 'web') return extraPx;
  return `calc(env(safe-area-inset-${edge}, 0px) + ${extraPx}px)` as DimensionValue;
}

/** Top inset: safe-area + at least MOBILE_SHELL_TOP_EXTRA. */
export function webSafeAreaTopShell(fallbackPx: number): DimensionValue {
  const base = Math.max(fallbackPx, MOBILE_SHELL_TOP_EXTRA);
  if (Platform.OS !== 'web') return base;
  return `calc(env(safe-area-inset-top, 0px) + ${MOBILE_SHELL_TOP_EXTRA}px)` as DimensionValue;
}

/** Bottom content padding: bottom nav + safe area + scroll buffer. */
export function resolvePortalMobileContentPaddingBottom(insetsBottom: number): number {
  const bottomInset = Math.max(insetsBottom, MOBILE_EDGE_INSET);
  return PORTAL_MOBILE_NAV_HEIGHT + bottomInset + MOBILE_CONTENT_BOTTOM_EXTRA;
}

/** Web-only min-height using dynamic viewport units (Safari toolbar aware). */
export function webDynamicViewportMinHeightStyle(): ViewStyle {
  if (Platform.OS !== 'web') return { flex: 1 };
  return {
    flex: 1,
    minHeight: '100dvh' as DimensionValue,
  };
}

/**
 * Web compact shell — lock height to the dynamic viewport so the middle pane can
 * scroll. minHeight-only dvh lets the root grow with content and disables overflow.
 */
export function webShellViewportLockStyle(): ViewStyle {
  if (Platform.OS !== 'web') return { flex: 1, minHeight: 0 };
  return {
    flex: 1,
    height: '100dvh' as DimensionValue,
    maxHeight: '100dvh' as DimensionValue,
    minHeight: 0,
  };
}

/** Fixed full-viewport layer — dvh on web (svh fallback via WEB_SAFE_AREA_GLOBAL_CSS). */
export function webFixedViewportCoverStyle(): ViewStyle {
  if (Platform.OS !== 'web') return StyleSheetAbsoluteFill();
  return {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw' as DimensionValue,
    height: '100dvh' as DimensionValue,
    minHeight: '100dvh' as DimensionValue,
  };
}

function StyleSheetAbsoluteFill(): ViewStyle {
  return {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  };
}

/** Global CSS injected once in app/+html.tsx for iOS safe areas and dvh. */
export const WEB_SAFE_AREA_GLOBAL_CSS = `
:root {
  --safe-area-top: env(safe-area-inset-top, 0px);
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-left: env(safe-area-inset-left, 0px);
  --safe-area-right: env(safe-area-inset-right, 0px);
}
html, body, #root, #expo-root, [data-expo-root] {
  min-height: 100svh;
  min-height: 100dvh;
}
`;

export function webSafeAreaInsetsStyle(insets: {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}): ViewStyle {
  if (Platform.OS !== 'web') return {};
  const style: ViewStyle = {};
  if (insets.top != null) style.paddingTop = webSafeAreaPadding('top', insets.top) as number;
  if (insets.bottom != null) style.paddingBottom = webSafeAreaPadding('bottom', insets.bottom) as number;
  if (insets.left != null) style.paddingLeft = webSafeAreaPadding('left', insets.left) as number;
  if (insets.right != null) style.paddingRight = webSafeAreaPadding('right', insets.right) as number;
  return style;
}
