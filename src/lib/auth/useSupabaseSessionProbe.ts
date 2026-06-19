import { useEffect, useState } from 'react';
import { getSession } from '@/lib/supabase';
import type { AuthMode } from '@/lib/supabase/config';

/** True when Supabase client already has a session but React auth context has not caught up yet. */
export function useSupabaseSessionProbe(
  authMode: AuthMode,
  authReady: boolean,
  isAuthenticated: boolean,
): boolean {
  const [hasLiveSession, setHasLiveSession] = useState(false);

  useEffect(() => {
    if (authMode !== 'supabase') {
      setHasLiveSession(false);
      return;
    }

    let cancelled = false;

    async function probe() {
      const sessionResult = await getSession();
      if (cancelled) return;
      setHasLiveSession(Boolean(sessionResult.ok && sessionResult.data));
    }

    if (!authReady || isAuthenticated) {
      setHasLiveSession(false);
      return () => {
        cancelled = true;
      };
    }

    void probe();

    return () => {
      cancelled = true;
    };
  }, [authMode, authReady, isAuthenticated]);

  return authMode === 'supabase' && authReady && !isAuthenticated && hasLiveSession;
}
