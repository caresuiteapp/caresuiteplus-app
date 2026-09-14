import type { PropsWithChildren } from 'react';

/** Native navigation retains its existing immediate mount. */
export function WebNavigationMount({ children }: PropsWithChildren) {
  return <>{children}</>;
}
