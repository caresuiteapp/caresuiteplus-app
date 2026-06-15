import { useCallback } from 'react';
import type { WorkflowStatus } from '@/types';
import type { ClientDetail } from '@/types/detail';
import { archiveClient, fetchClientDetail, updateClientStatus } from '@/lib/office';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery, useMutation } from './core';

export function useClientDetail(clientId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => {
      if (!clientId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Klient:innen-ID angegeben.' });
      }
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchClientDetail(clientId, tenantId, roleKey);
    },
    [clientId, tenantId, roleKey],
    { enabled: Boolean(clientId) && !!tenantId },
  );

  const statusMutation = useMutation(
    (newStatus: WorkflowStatus) => {
      if (!clientId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Klient:innen-ID angegeben.' });
      }
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return updateClientStatus(
        clientId,
        tenantId,
        newStatus,
        roleKey,
        profile?.id,
        profile?.displayName,
      );
    },
    {
      successMessage: 'Status erfolgreich aktualisiert.',
      onSuccess: (updated) => query.setData(updated),
    },
  );

  const archiveMutation = useMutation<void, ClientDetail>(
    async () => {
      if (!clientId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Klient:innen-ID angegeben.' });
      }
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return archiveClient(clientId, tenantId, roleKey, profile?.id, profile?.displayName);
    },
    {
      successMessage: 'Klient:in archiviert.',
      onSuccess: (updated) => query.setData(updated),
    },
  );

  const changeStatus = useCallback(
    async (newStatus: WorkflowStatus) => {
      await statusMutation.mutate(newStatus);
    },
    [statusMutation],
  );

  const archive = useCallback(async () => {
    await archiveMutation.mutate(undefined as void);
  }, [archiveMutation]);

  return {
    data: query.data,
    loading: query.loading,
    error: query.error ?? statusMutation.error ?? archiveMutation.error,
    actionLoading: statusMutation.loading || archiveMutation.loading,
    successMessage: statusMutation.successMessage ?? archiveMutation.successMessage,
    refresh: query.refresh,
    changeStatus,
    archive,
    notFound: !query.loading && !query.error && !query.data,
  };
}
