import type { PropsWithChildren } from 'react';
import { useHydrated } from '@/hooks/useHydrated';

/**
 * Authenticated routes cannot be prerendered for a particular user. A shared
 * HTML fallback may also be served for a deep link. Keep the first tree
 * identical for every URL and mount the requested route after hydration.
 * The document's light boot screen remains visible during this one-time step.
 */
export function WebNavigationMount({ children }: PropsWithChildren) {
  const hydrated = useHydrated();
  return hydrated ? <>{children}</> : null;
}
