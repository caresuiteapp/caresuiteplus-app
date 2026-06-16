import type { ServiceResult } from '@/types';
import type {
  DocumentExecutionContext,
  DocumentSigningRequest,
  SignatureProviderKey,
} from '@/types/documents/connect';
import { assertSigningAllowed, validateSigningProviderReady } from '@/lib/documents/connectDocumentGuard';
import { appendDocumentAuditEvent } from '@/lib/documents/connectDocumentVersionService';
import { getConnectDocumentDemoStore } from '@/lib/documents/connectDocumentGenerationService';
import { runService } from '@/lib/services/serviceRunner';

let signingCounter = 0;

export type PrepareSigningInput = {
  tenantId: string;
  documentId: string;
  documentVersionId: string;
  providerKey: SignatureProviderKey;
  signers: Array<{ name: string; email: string }>;
  context: DocumentExecutionContext;
};

/** Signatur vorbereiten — blockiert ohne Anbieter und ohne Live-Freigabe. */
export async function prepareSigningRequest(
  input: PrepareSigningInput,
): Promise<ServiceResult<DocumentSigningRequest>> {
  return runService(async () => {
    const guard = assertSigningAllowed(input.context);
    if (!guard.allowed) {
      const store = getConnectDocumentDemoStore();
      appendDocumentAuditEvent(store, {
        tenantId: input.tenantId,
        documentId: input.documentId,
        eventType: 'signing_blocked',
        summary: guard.message,
      });
      return { ok: false, error: guard.message };
    }
    return { ok: false, error: 'Unerwarteter Guard-Status.' };
  }, { delayMs: 200 });
}

/** Signatur-Anfrage als vorbereitet registrieren (Demo/intern, kein externer Transfer). */
export async function registerPreparedSigningRequest(
  input: Omit<PrepareSigningInput, 'context'> & {
    context: DocumentExecutionContext;
    allowPreparedOnly?: boolean;
  },
): Promise<ServiceResult<DocumentSigningRequest>> {
  return runService(async () => {
    const store = getConnectDocumentDemoStore();
    const doc = store.documents.get(input.documentId);
    if (!doc || doc.tenantId !== input.tenantId) {
      return { ok: false, error: 'Dokument nicht gefunden.' };
    }

    const guard = validateSigningProviderReady({
      ...input.context,
      documentTenantId: doc.tenantId,
      isArchived: doc.isArchived,
    });

    if (!guard.allowed) {
      appendDocumentAuditEvent(store, {
        tenantId: input.tenantId,
        documentId: input.documentId,
        eventType: 'signing_blocked',
        summary: guard.message,
      });
      return { ok: false, error: guard.message };
    }

    signingCounter += 1;
    const request: DocumentSigningRequest = {
      id: `sign-req-${signingCounter}`,
      tenantId: input.tenantId,
      documentId: input.documentId,
      documentVersionId: input.documentVersionId,
      providerKey: input.providerKey,
      status: 'prepared',
      externalTransfer: false,
      signersCount: input.signers.length,
      initiatedAt: new Date().toISOString(),
      errorSummary: null,
    };

    appendDocumentAuditEvent(store, {
      tenantId: input.tenantId,
      documentId: input.documentId,
      eventType: 'signing_prepared',
      summary: `Signatur vorbereitet (${input.providerKey}) — kein externer Versand.`,
      oldStatus: doc.status,
      newStatus: 'sent',
    });

    return { ok: true, data: request };
  }, { delayMs: 250 });
}

/** Live-Signatur-Versand — immer blockiert in Vorbereitungsphase. */
export async function sendSigningRequestToProvider(
  _tenantId: string,
  _requestId: string,
  context: DocumentExecutionContext,
): Promise<ServiceResult<never>> {
  const guard = assertSigningAllowed(context);
  return {
    ok: false,
    error: guard.allowed
      ? 'Externer Signatur-Versand ist noch nicht freigegeben.'
      : guard.message,
  };
}
