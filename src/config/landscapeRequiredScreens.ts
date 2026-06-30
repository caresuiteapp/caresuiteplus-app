/** How strongly a screen prefers or requires landscape on mobile. */
export type LandscapeRequirement = 'required' | 'preferred' | 'supported' | 'portrait';

export type LandscapeScreenKey =
  | 'signature'
  | 'visitExecution'
  | 'calendar'
  | 'tables';

/**
 * Central registry for route/screen landscape policy.
 * Keep app.json orientation at "default" — enforce per-screen instead of globally.
 */
export const LANDSCAPE_REQUIRED_SCREENS: Record<LandscapeScreenKey, LandscapeRequirement> = {
  signature: 'required',
  visitExecution: 'preferred',
  calendar: 'supported',
  tables: 'supported',
};

export function resolveLandscapeRequirement(
  screenKey: LandscapeScreenKey,
): LandscapeRequirement {
  return LANDSCAPE_REQUIRED_SCREENS[screenKey] ?? 'portrait';
}

/** Whether the overlay should block interaction until landscape is active. */
export function shouldBlockUntilLandscape(
  requirement: LandscapeRequirement,
  isMobile: boolean,
): boolean {
  if (!isMobile) return false;
  return requirement === 'required';
}

/** Whether to show the rotate-hint overlay (required always; preferred when portrait). */
export function shouldShowLandscapeOverlay(
  requirement: LandscapeRequirement,
  isLandscape: boolean,
  isMobile: boolean,
): boolean {
  if (!isMobile || isLandscape) return false;
  return requirement === 'required' || requirement === 'preferred';
}
