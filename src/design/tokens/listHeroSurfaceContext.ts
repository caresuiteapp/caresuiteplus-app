import { createContext, useContext } from 'react';

export type ListHeroSurface = 'gradient' | 'light';

export const ListHeroSurfaceContext = createContext<ListHeroSurface>('gradient');

export function useListHeroSurface(): ListHeroSurface {
  return useContext(ListHeroSurfaceContext);
}
