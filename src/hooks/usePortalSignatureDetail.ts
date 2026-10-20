import { useCallback, useRef, useState } from 'react';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  fetchPortalSignatureDocumentDetail,
  signPortalDocument,
} from '@/lib/portal/portalDocumentSignatureService';
import type { PortalSignatureSignerRole } from '@/types/portal/documentSignatures';
import { usePortalActor } from '@/hooks/usePortalActor';

export function usePortalSignatureDetail(documentId: string) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const actor = usePortalActor();
  const employeeId = actor.employeeId ?? '';
  const [signing, setSigning] = useState(false);
  const lock = useRef(false);

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !employeeId || !documentId) {
        return Promise.resolve({ ok: false as const, error: 'Ungültige Anfrage.' });
      }
      return fetchPortalSignatureDocumentDetail(
        tenantId,
        employeeId,
        actor.roleKey,
        documentId,
      );
    },
    [tenantId, employeeId, actor.roleKey, documentId],
    { enabled: actor.isLinkedReady && !!tenantId && !!employeeId && !!documentId,
      queryKey: JSON.stringify([tenantId, employeeId, actor.roleKey, documentId]) },
  );

  const sign = useCallback(
    async (input: {
      signerRole: PortalSignatureSignerRole;
      signerName: string;
      signatureDataUrl: string;
      expectedVersionNumber?: number;
    }) => {
      if (!tenantId || !employeeId || !actor.isLinkedReady) {
        return { ok: false as const, error: 'Kein Mitarbeiterprofil.' };
      }
      if (lock.current) return { ok: false as const, error: 'Die Speicherung läuft bereits. Bitte warten.' };
      lock.current = true; setSigning(true);
      try {
      const result = await signPortalDocument(
        {
          tenantId,
          documentId,
          employeeId,
          signerRole: input.signerRole,
          signerName: input.signerName,
          signatureDataUrl: input.signatureDataUrl,
          expectedVersionNumber: input.expectedVersionNumber,
          deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          browser: typeof navigator !== 'undefined' ? navigator.userAgent.split(' ').pop() ?? null : null,
        },
        actor.roleKey,
        profile?.id ?? null,
      );
      await query.refresh();
      return result;
      } catch { return { ok: false as const, error: 'Die Speicherung konnte noch nicht bestätigt werden. Bitte den Dokumentstatus erneut laden.' }; }
      finally { lock.current = false; setSigning(false); }
    },
    [tenantId, employeeId, documentId, actor.roleKey, actor.isLinkedReady, profile?.id, query],
  );

  return {
    detail: query.data ?? null,
    loading: actor.isResolvingEmployeeLink || query.loading,
    error: !actor.isResolvingEmployeeLink && !employeeId ? 'Ihr Mitarbeitendenprofil konnte nicht verknüpft werden. Bitte melden Sie sich erneut an.' : query.error ?? query.refreshError,
    refresh: query.refresh,
    sign,
    signing,
  };
}
