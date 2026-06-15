import { useCallback } from 'react';
import type { WorkflowStatus } from '@/types';
import { fetchInvoiceDetail, updateInvoiceStatus } from '@/lib/office';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery, useMutation } from './core';

export function useInvoiceDetail(invoiceId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;
  const actorName = profile?.displayName ?? 'Büro Demo';

  const query = useAsyncQuery(
    () => {
      if (!invoiceId) {
        return Promise.resolve({
          ok: false as const,
          error: 'Keine Rechnungs-ID angegeben.',
        });
      }
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchInvoiceDetail(invoiceId, tenantId, roleKey);
    },
    [invoiceId, tenantId, roleKey],
    { enabled: Boolean(invoiceId) && !!tenantId },
  );

  const statusMutation = useMutation(
    (newStatus: WorkflowStatus) => {
      if (!invoiceId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Rechnungs-ID angegeben.' });
      }
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return updateInvoiceStatus(invoiceId, tenantId, newStatus, roleKey, actorName);
    },
    {
      successMessage: 'Rechnungsstatus erfolgreich aktualisiert.',
      onSuccess: (updated) => query.setData(updated),
    },
  );

  const changeStatus = useCallback(
    async (newStatus: WorkflowStatus) => {
      await statusMutation.mutate(newStatus);
    },
    [statusMutation],
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  return {
    data: query.data,
    loading: query.loading,
    error: query.error ?? statusMutation.error,
    actionLoading: statusMutation.loading,
    successMessage: statusMutation.successMessage,
    refresh,
    changeStatus,
    notFound: !query.loading && !query.error && !query.data,
  };
}
