import type { ServiceResult } from '@/types';
import type {
  DocumentExecutionContext,
  DocumentOcrJob,
  OcrProviderKey,
} from '@/types/documents/connect';
import { assertOcrAllowed, validateOcrProviderReady } from '@/lib/documents/connectDocumentGuard';
import { appendDocumentAuditEvent } from '@/lib/documents/connectDocumentVersionService';
import { getConnectDocumentDemoStore } from '@/lib/documents/connectDocumentGenerationService';
import { runService } from '@/lib/services/serviceRunner';

let ocrCounter = 0;

export type PrepareOcrInput = {
  tenantId: string;
  documentId: string;
  providerKey: OcrProviderKey;
  context: DocumentExecutionContext;
};

/** OCR vorbereiten — blockiert ohne Anbieter/Freigabe. */
export async function prepareOcrJob(
  input: PrepareOcrInput,
): Promise<ServiceResult<DocumentOcrJob>> {
  return runService(async () => {
    const store = getConnectDocumentDemoStore();
    const doc = store.documents.get(input.documentId);
    if (!doc || doc.tenantId !== input.tenantId) {
      return { ok: false, error: 'Dokument nicht gefunden.' };
    }

    const guard = assertOcrAllowed({
      ...input.context,
      documentTenantId: doc.tenantId,
      containsHealthData: doc.containsHealthData,
    });

    if (!guard.allowed) {
      appendDocumentAuditEvent(store, {
        tenantId: input.tenantId,
        documentId: input.documentId,
        eventType: guard.code === 'health_data_ocr_denied' ? 'ocr_blocked' : 'ocr_blocked',
        summary: guard.message,
      });
      return { ok: false, error: guard.message };
    }

    return { ok: false, error: 'Unerwarteter Guard-Status.' };
  }, { delayMs: 200 });
}

/** OCR-Job als vorbereitet registrieren (intern/Demo, kein externer Transfer). */
export async function registerPreparedOcrJob(
  input: PrepareOcrInput,
): Promise<ServiceResult<DocumentOcrJob>> {
  return runService(async () => {
    const store = getConnectDocumentDemoStore();
    const doc = store.documents.get(input.documentId);
    if (!doc || doc.tenantId !== input.tenantId) {
      return { ok: false, error: 'Dokument nicht gefunden.' };
    }

    const guard = validateOcrProviderReady({
      ...input.context,
      documentTenantId: doc.tenantId,
      containsHealthData: doc.containsHealthData,
    });

    if (!guard.allowed) {
      appendDocumentAuditEvent(store, {
        tenantId: input.tenantId,
        documentId: input.documentId,
        eventType: 'ocr_blocked',
        summary: guard.message,
      });
      return { ok: false, error: guard.message };
    }

    ocrCounter += 1;
    const job: DocumentOcrJob = {
      id: `ocr-job-${ocrCounter}`,
      tenantId: input.tenantId,
      documentId: input.documentId,
      providerKey: input.providerKey,
      status: 'prepared',
      containsHealthData: doc.containsHealthData,
      externalTransfer: false,
      approvalRequired: input.providerKey !== 'internal',
      classification: {},
      errorSummary: null,
      createdAt: new Date().toISOString(),
    };

    appendDocumentAuditEvent(store, {
      tenantId: input.tenantId,
      documentId: input.documentId,
      eventType: 'ocr_prepared',
      summary: `OCR vorbereitet (${input.providerKey}) — kein externer Transfer.`,
      oldStatus: doc.status,
      newStatus: 'ocr_pending',
    });

    return { ok: true, data: job };
  }, { delayMs: 250 });
}

/** Externen OCR-Transfer auslösen — immer blockiert. */
export async function triggerExternalOcrTransfer(
  _tenantId: string,
  _jobId: string,
  context: DocumentExecutionContext,
): Promise<ServiceResult<never>> {
  const guard = assertOcrAllowed(context);
  return {
    ok: false,
    error: guard.allowed
      ? 'Externer OCR-Transfer ist noch nicht freigegeben.'
      : guard.message,
  };
}
