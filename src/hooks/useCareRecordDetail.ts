import { useCallback, useState } from 'react';
import type { PdfExportResult } from '@/types/modules/assist';
import { exportCareRecordPdf, fetchCareRecordDetail, signCareRecord } from '@/lib/assist';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery, useMutation } from './core';

export function useCareRecordDetail(recordId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!recordId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Nachweis-ID angegeben.' });
      }
      return fetchCareRecordDetail(recordId, tenantId, roleKey);
    },
    [tenantId, recordId, roleKey],
    { enabled: Boolean(recordId) && !!tenantId },
  );

  const [pdfResult, setPdfResult] = useState<PdfExportResult | null>(null);

  const signMutation = useMutation(
    (_?: void) => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!recordId || !profile?.id) {
        return Promise.resolve({ ok: false as const, error: 'Unterschrift nicht möglich.' });
      }
      return signCareRecord(
        recordId,
        tenantId,
        profile.id,
        profile.displayName ?? 'Mitarbeitende:r',
        roleKey,
      );
    },
    {
      successMessage: 'Nachweis erfolgreich unterschrieben.',
      onSuccess: (data) => query.setData(data),
    },
  );

  const exportMutation = useMutation(
    (_?: void) => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!recordId) {
        return Promise.resolve({ ok: false as const, error: 'Export nicht möglich.' });
      }
      return exportCareRecordPdf(recordId, tenantId, roleKey);
    },
    {
      successMessage: 'PDF erfolgreich erzeugt.',
      onSuccess: (data) => {
        setPdfResult(data);
        query.refresh();
      },
    },
  );

  return {
    data: query.data,
    loading: query.loading,
    error: query.error ?? signMutation.error ?? exportMutation.error,
    actionLoading: signMutation.loading || exportMutation.loading,
    successMessage: signMutation.successMessage ?? exportMutation.successMessage,
    pdfResult,
    refresh: query.refresh,
    sign: useCallback(() => signMutation.mutate(undefined), [signMutation]),
    exportPdf: useCallback(() => exportMutation.mutate(undefined), [exportMutation]),
    notFound: !query.loading && !query.error && !query.data,
  };
}
