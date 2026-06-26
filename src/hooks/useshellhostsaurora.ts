/**
 * True when a shared shell root already paints GlobalAnimatedBackground — page
 * shells must stay transparent so glass surfaces and typography remain readable
 * (RN Web defaults Views to white). Background may be light space nebula or dark aurora.
 *
 * Aurora is mounted in `app/_layout.tsx` for office routes and in
 * `app/portal/_layout.tsx` for all portal routes (web + native).
 */
export function useShellHostsAurora(embedded?: boolean): boolean {
  if (embedded !== undefined) return embedded;
  return true;
}

/** Shorthand — shell hosts animated background (light or dark glass). */
export function useAuroraGlassActive(): boolean {
  return useShellHostsAurora();
}
