/** Stable viewport used for SSR and the first client render (hydration). */
export const SSR_LAYOUT_WIDTH = 1280;
export const SSR_LAYOUT_HEIGHT = 800;

export function resolveHydrationSafeWidth(measuredWidth: number, hydrated: boolean): number {
  return hydrated ? measuredWidth : SSR_LAYOUT_WIDTH;
}

export function resolveHydrationSafeHeight(measuredHeight: number, hydrated: boolean): number {
  return hydrated ? measuredHeight : SSR_LAYOUT_HEIGHT;
}
