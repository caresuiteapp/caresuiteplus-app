import { useEffect, useState } from 'react';
import { runAppTransition } from '@/lib/react/runAppTransition';

/**
 * True only after the component has mounted on the client.
 * Use to defer browser-only values until hydration completes.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    runAppTransition(() => {
      setHydrated(true);
    });
  }, []);

  return hydrated;
}
