/**
 * True when a shared shell root already paints GlobalAnimatedBackground — page
 * shells must stay transparent so glass surfaces and typography remain readable
 * (RN Web defaults Views to white). The background is always the canonical
 * light CareSuite paper surface.
 *
 * Aurora is mounted in `app/_layout.tsx` for office routes and in
 * `app/portal/_layout.tsx` for all portal routes (web + native).
 */
export function useShellHostsAurora(embedded?: boolean): boolean {
  if (embedded !== undefined) return embedded;
  return true;
}

/** Shorthand — shell hosts the canonical light background. */
export function useAuroraGlassActive(): boolean {
  return useShellHostsAurora();
}
