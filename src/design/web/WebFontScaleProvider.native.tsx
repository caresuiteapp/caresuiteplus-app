import type { ReactNode } from 'react';

/** Native builds skip web font scaling — passthrough only. */
export function WebFontScaleProvider({ children }: { children: ReactNode }) {
  return children;
}

export function useWebFontScale(): never {
  throw new Error('useWebFontScale is web-only');
}
