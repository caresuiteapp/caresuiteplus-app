import type { ServiceResult } from '@/types';
import type { ClientDocumentRecord } from '@/types/modules/client';
import { getDemoClientFullDetail, upsertDemoClientFullDetail } from '@/data/demo/clients';
import { getSupabaseClient } from '@/lib/supabase/client';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import { assertDemoTenant, getClientExtendedRepository, isDemoClientBackend } from './clientBackend';
import { fetchClientDocuments } from './clientDocumentService';
import {
  buildStorageObjectFileName,
  buildTenantStoragePath,
  toStorageUploadError,
} from '@/lib/storage/storagePaths';

const STORAGE_BUCKET = 'office-documents';

export type DocumentUploadInput = {
  category: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
  source?: string;
  contentBase64?: string;
  uploadedBy?: string | null;
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
  const storageFileName = buildStorageObjectFileName(documentId, fileName);
  return buildTenantStoragePath(tenantId, 'clients', clientId, 'documents', documentId, storageFileName);
}

export async function uploadClientDocument(
  tenantId: string,
  clientId: string,
  input: DocumentUploadInput,
): Promise<ServiceResult<ClientDocumentRecord>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      if (!input.contentBase64) {
        return { ok: false, error: 'Dateiinhalt fehlt — bitte Dokument erneut auswählen.' };
      }

      const supabase = getSupabaseClient();
      if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

      const docId = crypto.randomUUID?.() ?? `doc-${Date.now()}`;
      const storagePath = buildClientDocumentStoragePath(tenantId, clientId, docId, input.fileName);
      const payload = Uint8Array.from(atob(input.contentBase64), (c) => c.charCodeAt(0));

      const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, payload, {
        contentType: input.mimeType,
        upsert: false,
      });
      if (uploadError) {
        return { ok: false, error: toStorageUploadError(uploadError.message) };
      }

      return getClientExtendedRepository().insertDocument(tenantId, clientId, {
        title: input.title.trim(),
        fileName: input.fileName.trim(),
        mimeType: input.mimeType,
        category: input.category as ClientDocumentRecord['category'],
        storagePath,
        sizeBytes: input.sizeBytes ?? payload.length,
        uploadedBy: input.uploadedBy ?? null,
      });
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
      uploadedBy: input.uploadedBy ?? null,
      validUntil: null,
      createdAt: now,
      updatedAt: now,
      documentSource: 'upload',
    };

    upsertDemoClientFullDetail({
      ...full,
      documents: [doc, ...full.documents],
      contextCounts: {
        ...full.contextCounts,
        documents: (full.documents?.length ?? 0) + 1,
      },
      updatedAt: now,
    });

    return { ok: true, data: doc };
  }, { delayMs: 350 });
}
