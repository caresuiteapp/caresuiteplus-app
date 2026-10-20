import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  createOfficeSignatureDocument,
  composeOfficeSignatureDocumentForPortal,
  fetchOfficeSignatureDocuments,
  withdrawOfficeSignatureDocument,
} from '@/lib/portal/portalDocumentSignatureService';
import type { ComposeOfficeSignatureDocumentInput } from '@/lib/portal/officeSignatureDocumentComposerService';
import type { OfficeCreateSignatureDocumentInput } from '@/types/portal/documentSignatures';

export function useOfficeDocumentSignatures() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchOfficeSignatureDocuments(tenantId, profile?.roleKey ?? null);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const create = async (input: Omit<OfficeCreateSignatureDocumentInput, 'tenantId' | 'creatorName'>) => {
    if (!tenantId) return { ok: false as const, error: 'Kein Mandant.' };
    const result = await createOfficeSignatureDocument(
      {
        ...input,
        tenantId,
        creatorName: profile?.displayName ?? 'Office',
        creatorProfileId: profile?.id ?? null,
      },
      profile?.roleKey ?? null,
    );
    if (result.ok) await query.refresh();
    return result;
  };

  const withdraw = async (documentId: string) => {
    if (!tenantId) return { ok: false as const, error: 'Kein Mandant.' };
    const result = await withdrawOfficeSignatureDocument(
      tenantId,
      documentId,
      profile?.roleKey ?? null,
      profile?.displayName ?? 'Office',
    );
    if (result.ok) await query.refresh();
    return result;
  };

  const compose = async (
    input: Omit<ComposeOfficeSignatureDocumentInput, 'tenantId' | 'creatorName' | 'creatorProfileId'>,
  ) => {
    if (!tenantId) return { ok: false as const, error: 'Kein Mandant.' };
    const result = await composeOfficeSignatureDocumentForPortal(
      {
        ...input,
        tenantId,
        creatorName: profile?.displayName ?? 'Office',
        creatorProfileId: profile?.id ?? null,
      },
      profile?.roleKey ?? null,
    );
    if (result.ok) await query.refresh();
    return result;
  };

  return {
    items: query.data ?? [],
    loading: query.loading,
    error: query.error,
    refresh: query.refresh,
    create,
    compose,
    withdraw,
  };
}
