import { createContext, type ReactNode, useContext } from 'react';

export type SurfaceContrastTone = 'adaptive' | 'light' | 'dark';

const SurfaceContrastContext = createContext<SurfaceContrastTone>('adaptive');

export function SurfaceContrastProvider({
  children,
  tone,
}: {
  children: ReactNode;
  tone: Exclude<SurfaceContrastTone, 'adaptive'>;
}) {
  return <SurfaceContrastContext.Provider value={tone}>{children}</SurfaceContrastContext.Provider>;
}

export function useSurfaceContrastTone(): SurfaceContrastTone {
  return useContext(SurfaceContrastContext);
}
