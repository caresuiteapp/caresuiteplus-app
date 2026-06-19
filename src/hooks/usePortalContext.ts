import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PortalContext } from '@/lib/portal/types';
import { resolvePortalContext } from '@/lib/portal/engine/resolvePortalContext';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAuth } from '@/lib/auth/context';

export type PortalContextState = {
  context: PortalContext | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isReady: boolean;
};

export function usePortalContext(): PortalContextState {
  const { tenantId, clientId, roleKey, displayName, isReady: actorReady } = usePortalActor();
  const { portalSession } = useAuth();
  const [context, setContext] = useState<PortalContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tenantId || !clientId || !roleKey) {
      setContext(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const resolved = await resolvePortalContext({
        tenantId,
        clientId,
        roleKey,
        displayName,
        tenantNameHint: portalSession?.tenantName ?? null,
      });
      setContext(resolved);
    } catch {
      setContext(null);
      setError('Portal-Kontext konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, clientId, roleKey, displayName, portalSession?.tenantName]);

  useEffect(() => {
    if (!actorReady) {
      setLoading(true);
      return;
    }
    void refresh();
  }, [actorReady, refresh]);

  return useMemo(
    () => ({
      context,
      loading,
      error,
      refresh,
      isReady: actorReady && !loading && context !== null,
    }),
    [context, loading, error, refresh, actorReady],
  );
}
