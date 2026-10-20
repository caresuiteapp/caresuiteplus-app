import { useEffect, useState } from 'react';
import { getSession } from '@/lib/supabase';
import type { AuthMode } from '@/lib/supabase/config';

const SESSION_PROBE_MAX_MS = 10_000;

/** True when Supabase client already has a session but React auth context has not caught up yet. */
export function useSupabaseSessionProbe(
  authMode: AuthMode,
  authReady: boolean,
  isAuthenticated: boolean,
): boolean {
  const [hasLiveSession, setHasLiveSession] = useState(false);
  const [probeExpired, setProbeExpired] = useState(false);

  useEffect(() => {
    if (authMode !== 'supabase') {
      setHasLiveSession(false);
      setProbeExpired(false);
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
      setProbeExpired(false);
      return () => {
        cancelled = true;
      };
    }

    setProbeExpired(false);
    const timer = setTimeout(() => {
      if (!cancelled) setProbeExpired(true);
    }, SESSION_PROBE_MAX_MS);

    void probe();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [authMode, authReady, isAuthenticated]);

  return (
    authMode === 'supabase' &&
    authReady &&
    !isAuthenticated &&
    hasLiveSession &&
    !probeExpired
  );
}
