import type { PropsWithChildren } from 'react';

/** Web uses the cached font face in the document head. */
export function CareSuiteFontProvider({ children }: PropsWithChildren) {
  return <>{children}</>;
}
