/**
 * True when a shared shell root already paints GlobalAnimatedBackground — page
 * shells must stay transparent so dark glass surfaces and typography remain
 * readable (RN Web defaults Views to white).
 *
 * Aurora is mounted once in `app/_layout.tsx` for all routes (web + native).
 */
export function useShellHostsAurora(embedded?: boolean): boolean {
  if (embedded !== undefined) return embedded;
  return true;
}

/** Shorthand — desktop web is always aurora-glass, never light premium wrappers. */
export function useAuroraGlassActive(): boolean {
  return useShellHostsAurora();
}
