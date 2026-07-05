import type { ServiceResult } from '@/types';
import {
  ASSIST_EXECUTION_STORAGE_BUCKET,
  buildAssistVisitAttachmentStoragePath,
} from '@/lib/assist/assistStoragePaths';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toStorageUploadError } from '@/lib/storage/storagePaths';
import { isDemoMode } from '@/lib/supabase/config';

export type VisitAttachmentUploadInput = {
  tenantId: string;
  visitId: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
};

export async function uploadEmployeePortalVisitAttachment(
  input: VisitAttachmentUploadInput,
): Promise<ServiceResult<{ storagePath: string }>> {
  if (!input.visitId?.trim()) {
    return { ok: false, error: 'Einsatz konnte nicht zugeordnet werden.' };
  }

  if (isDemoMode()) {
    const demoPath = buildAssistVisitAttachmentStoragePath(
      input.tenantId,
      input.visitId,
      `demo-${Date.now()}`,
      input.fileName,
    );
    return { ok: true, data: { storagePath: demoPath } };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: 'Speicher ist derzeit nicht verfügbar.' };
  }

  const attachmentId = crypto.randomUUID?.() ?? `att-${Date.now()}`;
  const storagePath = buildAssistVisitAttachmentStoragePath(
    input.tenantId,
    input.visitId,
    attachmentId,
    input.fileName,
  );

  const { error } = await supabase.storage
    .from(ASSIST_EXECUTION_STORAGE_BUCKET)
    .upload(storagePath, input.bytes, {
      contentType: input.mimeType,
      upsert: false,
    });

  if (error) {
    return { ok: false, error: toStorageUploadError(error.message) };
  }

  return { ok: true, data: { storagePath } };
}
