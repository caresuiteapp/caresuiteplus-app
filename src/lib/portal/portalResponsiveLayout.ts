export const PORTAL_DESKTOP_CHROME_MIN_WIDTH = 1024;

export const EMPLOYEE_PORTAL_VISUAL_VIEWPORTS = [
  { id: 'mobile-small', width: 320, height: 700 },
  { id: 'mobile-standard', width: 390, height: 844 },
  { id: 'tablet-portrait', width: 768, height: 1024 },
  { id: 'tablet-landscape', width: 1024, height: 768 },
  { id: 'desktop', width: 1440, height: 900 },
] as const;

export const EMPLOYEE_VISIT_VISUAL_STATES = [
  'preview',
  'en_route',
  'arrived',
  'live',
  'paused',
  'post_service',
  'documentation',
  'signature',
  'completed',
  'no_show',
  'locked',
] as const;

export function resolvePortalDesktopChrome(width: number): boolean {
  return width >= PORTAL_DESKTOP_CHROME_MIN_WIDTH;
}

/**
 * The live visit workspace owns its own task bar. Rendering the regular portal
 * navigation on top of it leaves only a narrow strip of usable content on
 * phones and tablets.
 */
export function isEmployeeVisitExecutionRoute(pathname: string): boolean {
  return /^\/portal\/employee\/assignments\/[^/]+\/execute\/?$/.test(pathname);
}

/** Keep the wordmark clear of text-size, messages and profile controls. */
export function resolveCompactPortalLogoWidth(width: number): number {
  if (width >= 600) return 224;
  return Math.max(124, Math.min(190, width - 190));
}

/** Access pages reserve one compact back action next to the brand. */
export function resolveAccessHeaderLogoWidth(width: number): number {
  if (width >= 600) return 320;
  return Math.max(156, Math.min(224, width - 140));
}
