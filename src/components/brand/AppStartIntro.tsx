import type { ReactNode } from 'react';

/** Native builds resolve AppStartIntro.native.tsx; the website opens normally. */
export function AppStartIntro({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
