/** How strongly a screen prefers or requires landscape on mobile. */
export type LandscapeRequirement = 'required' | 'preferred' | 'supported' | 'portrait';

export type LandscapeScreenKey =
  | 'signature'
  | 'serviceRecordPreview'
  | 'calendar'
  | 'roster';

/**
 * Central registry for route/screen landscape policy.
 * Keep app.json orientation at "default" — enforce per-screen instead of globally.
 * visitExecution is intentionally excluded — portrait workflow must stay usable.
 */
export const LANDSCAPE_REQUIRED_SCREENS: Record<LandscapeScreenKey, LandscapeRequirement> = {
  signature: 'required',
  serviceRecordPreview: 'preferred',
  calendar: 'supported',
  roster: 'supported',
};

export function resolveLandscapeRequirement(
  screenKey: LandscapeScreenKey,
): LandscapeRequirement {
  return LANDSCAPE_REQUIRED_SCREENS[screenKey] ?? 'portrait';
}

/** Required screens that allow portrait via explicit user opt-out (bottom sheet). */
export function hasLandscapeSoftFallback(screenKey: LandscapeScreenKey): boolean {
  return screenKey === 'signature';
}

/** Whether the overlay should block interaction until landscape is active. */
export function shouldBlockUntilLandscape(
  requirement: LandscapeRequirement,
  isMobile: boolean,
  bypass: boolean,
  softFallback = false,
): boolean {
  if (!isMobile || bypass || softFallback) return false;
  return requirement === 'required';
}

/** Whether to show the rotate-hint prompt (required/preferred/supported on mobile portrait). */
export function shouldShowLandscapeOverlay(
  requirement: LandscapeRequirement,
  isLandscape: boolean,
  isMobile: boolean,
  dismissed: boolean,
): boolean {
  if (!isMobile || isLandscape || dismissed) return false;
  return (
    requirement === 'required' ||
    requirement === 'preferred' ||
    requirement === 'supported'
  );
}

export type LandscapeOverlayVariant = 'sheet' | 'hint';

/** Resolve which prompt presentation to use for the current state. */
export function resolveLandscapeOverlayVariant(
  requirement: LandscapeRequirement,
  lockFailed: boolean,
  portraitBypass: boolean,
): LandscapeOverlayVariant {
  if (lockFailed || portraitBypass || requirement !== 'required') return 'hint';
  return 'sheet';
}
