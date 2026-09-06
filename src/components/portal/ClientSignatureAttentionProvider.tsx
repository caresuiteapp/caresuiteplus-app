import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { subscribeToClientPortalDocumentRequestChanges } from '@/lib/realtime';
import { fetchClientPendingDocuments, fetchClientPendingProofs, type ClientSignatureItem } from '@/lib/portal/clientSignatureAttention';

const AttentionContext = createContext({ items: [] as ClientSignatureItem[], loading: false, error: null as string | null, refresh: async () => {} });
export const useClientSignatureAttention = () => useContext(AttentionContext);
export function ClientSignatureAttentionProvider({ children }: { children: ReactNode }) {
  const { tenantId, clientId, actorId, roleKey, isLinkedReady } = usePortalActor();
  const key = JSON.stringify([tenantId, clientId, actorId, roleKey]);
  const enabled = isLinkedReady && !!tenantId && !!clientId && (roleKey === 'client_portal' || roleKey === 'family_portal');
  const live = useMemo(() => ({ tenantId, subscribe: (tid: string, handler: () => void) => subscribeToClientPortalDocumentRequestChanges(tid, clientId ?? '', handler), pollMs: 30_000 }), [tenantId, clientId]);
  const proofs = useAsyncQuery(() => fetchClientPendingProofs(tenantId ?? '', clientId ?? '', roleKey), [key], { enabled, queryKey: key, live });
  const documents = useAsyncQuery(() => fetchClientPendingDocuments(tenantId ?? '', clientId ?? '', roleKey), [key], { enabled, queryKey: key, live });
  const refreshProofs = proofs.refresh;
  const refreshDocuments = documents.refresh;
  const value = useMemo(() => ({
    items: [...(proofs.data ?? []), ...(documents.data ?? [])],
    loading: proofs.loading || documents.loading,
    error: proofs.error || documents.error || proofs.refreshError || documents.refreshError,
    refresh: async () => { await Promise.all([refreshProofs(), refreshDocuments()]); },
  }), [proofs.data, proofs.loading, proofs.error, proofs.refreshError, refreshProofs, documents.data, documents.loading, documents.error, documents.refreshError, refreshDocuments]);
  return <AttentionContext.Provider value={value}>{children}</AttentionContext.Provider>;
}
