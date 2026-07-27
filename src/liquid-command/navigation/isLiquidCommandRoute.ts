const LIQUID_ROUTE_ROOTS = [
  '/liquid-command',
  '/auth',
  '/office',
  '/assist',
  '/pflege',
  '/stationaer',
  '/beratung',
  '/akademie',
  '/robotics',
  '/platform',
  '/settings',
  '/portal',
] as const;

/**
 * Central cut-over boundary for the Greenfield UI.
 *
 * Routes listed here must never receive the legacy animated background,
 * welcome overlays or legacy application shell. Productive services remain
 * available behind the new Liquid Command screens.
 */
export function isLiquidCommandRoutePath(pathname: string): boolean {
  if (pathname === '/') return true;
  return LIQUID_ROUTE_ROOTS.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
}
