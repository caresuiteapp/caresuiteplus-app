import { createContext, useContext } from 'react';

export type ListHeroSurface = 'gradient' | 'light';

/** Default `light` — avoids white hero text outside an explicit gradient provider. */
export const ListHeroSurfaceContext = createContext<ListHeroSurface>('light');

export function useListHeroSurface(): ListHeroSurface {
  return useContext(ListHeroSurfaceContext);
}
