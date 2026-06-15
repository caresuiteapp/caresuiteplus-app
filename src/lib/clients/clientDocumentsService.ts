import type { ServiceResult } from '@/types';
import type { ClientDocumentRecord } from '@/types/modules/client';
import { getDemoClientFullDetail, upsertDemoClientFullDetail } from '@/data/demo/clients';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import { assertDemoTenant, isDemoClientBackend } from './clientBackend';
import { fetchClientDocuments } from './clientDocumentService';

export type DocumentUploadInput = {
  category: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
  source?: string;
};

export async function listClientDocuments(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientDocumentRecord[]>> {
  return fetchClientDocuments(tenantId, clientId);
}

export function buildClientDocumentStoragePath(
  tenantId: string,
  clientId: string,
  documentId: string,
  fileName: string,
): string {
  return `tenant/${tenantId}/clients/${clientId}/documents/${documentId}/${fileName}`;
}

export async function uploadClientDocument(
  tenantId: string,
  clientId: string,
  input: DocumentUploadInput,
): Promise<ServiceResult<ClientDocumentRecord>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return { ok: false, error: 'Live-Upload: Storage anbinden.' };
    }
    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };

    const now = new Date().toISOString();
    const docId = `doc-${clientId}-${Date.now()}`;
    const doc: ClientDocumentRecord = {
      id: docId,
      tenantId,
      clientId,
      title: input.title,
      fileName: input.fileName,
      mimeType: input.mimeType,
      category: input.category as ClientDocumentRecord['category'],
      storagePath: buildClientDocumentStoragePath(tenantId, clientId, docId, input.fileName),
      status: 'aktiv',
      sensitivity: 'care',
      uploadedBy: null,
      validUntil: null,
      createdAt: now,
      updatedAt: now,
    };

    upsertDemoClientFullDetail({
      ...full,
      documents: [doc, ...full.documents],
      updatedAt: now,
    });

    return { ok: true, data: doc };
  }, { delayMs: 350 });
}
