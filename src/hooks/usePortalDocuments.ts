import { useCallback, useState } from 'react';
import type { PortalDocumentListItem } from '@/types/portal/documents';
import { fetchPortalDocuments } from '@/lib/portal';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from './core';

export function usePortalDocuments() {
  const { tenantId, clientId, actorId, roleKey, isReady } = usePortalActor();
  const profileId = actorId ?? '';
  const [showSuccess, setShowSuccess] = useState(false);

  const query = useAsyncQuery(
    () =>
      fetchPortalDocuments(profileId, roleKey, {
        tenantId,
        clientId,
      }),
    [profileId, roleKey, tenantId, clientId],
    { enabled: isReady },
  );

  const items = query.data ?? [];

  const refresh = useCallback(async () => {
    await query.refresh();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [query]);

  return {
    items,
    loading: query.loading,
    error: query.error,
    refreshing: query.refreshing,
    showSuccess,
    refresh,
    isEmpty: !query.loading && !query.error && items.length === 0,
  };
}

export type { PortalDocumentListItem };
