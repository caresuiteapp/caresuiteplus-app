import { useEffect, useState } from 'react';
import { getOfflineDbHealth, openOfflineDb } from '@/lib/offline/idb';
import type { OfflineDbHealth } from '@/lib/offline/types';
import { useHydrated } from './useHydrated';

/**
 * OFFLINE.2 — eagerly open IndexedDB after client mount (HYDRATION.1 safe).
 */
export function useOfflineDbInit(): { ready: boolean; health: OfflineDbHealth | null } {
  const hydrated = useHydrated();
  const [ready, setReady] = useState(false);
  const [health, setHealth] = useState<OfflineDbHealth | null>(null);

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;
    void (async () => {
      await openOfflineDb();
      const nextHealth = await getOfflineDbHealth();
      if (!cancelled) {
        setHealth(nextHealth);
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  return { ready, health };
}
