import { useCallback } from 'react';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  fetchPortalSignatureDocumentDetail,
  signPortalDocument,
} from '@/lib/portal/portalDocumentSignatureService';
import type { PortalSignatureSignerRole } from '@/types/portal/documentSignatures';

export function usePortalSignatureDetail(documentId: string) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const employeeId = profile?.employeeId ?? profile?.id ?? '';

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !employeeId || !documentId) {
        return Promise.resolve({ ok: false as const, error: 'Ungültige Anfrage.' });
      }
      return fetchPortalSignatureDocumentDetail(
        tenantId,
        employeeId,
        profile?.roleKey ?? null,
        documentId,
      );
    },
    [tenantId, employeeId, profile?.roleKey, documentId],
    { enabled: !!tenantId && !!employeeId && !!documentId },
  );

  const sign = useCallback(
    async (input: {
      signerRole: PortalSignatureSignerRole;
      signerName: string;
      signatureDataUrl: string;
    }) => {
      if (!tenantId || !employeeId) {
        return { ok: false as const, error: 'Kein Mitarbeiterprofil.' };
      }
      const result = await signPortalDocument(
        {
          tenantId,
          documentId,
          employeeId,
          signerRole: input.signerRole,
          signerName: input.signerName,
          signatureDataUrl: input.signatureDataUrl,
          deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          browser: typeof navigator !== 'undefined' ? navigator.userAgent.split(' ').pop() ?? null : null,
        },
        profile?.roleKey ?? null,
      );
      if (result.ok) await query.refresh();
      return result;
    },
    [tenantId, employeeId, documentId, profile?.roleKey, query],
  );

  return {
    detail: query.data ?? null,
    loading: query.loading,
    error: query.error,
    refresh: query.refresh,
    sign,
    signing: query.refreshing,
  };
}
