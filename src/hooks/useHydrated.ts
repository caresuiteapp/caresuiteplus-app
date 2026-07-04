import { useEffect, useState } from 'react';

/**
 * True only after the component has mounted on the client.
 * Use to defer browser-only values until hydration completes.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}
