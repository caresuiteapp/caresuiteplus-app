import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { communicationFrom } from './supabaseTable';

const TABLE = 'communication_attachments';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

export type AttachmentRow = {
  id: string;
  tenantId: string;
  threadId: string;
  messageId: string;
  filename: string;
  mimeType: string;
  storagePath: string;
};

function mapRow(row: Record<string, unknown>): AttachmentRow {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    threadId: String(row.thread_id),
    messageId: String(row.message_id),
    filename: String(row.filename),
    mimeType: String(row.mime_type),
    storagePath: String(row.storage_path),
  };
}

export const attachmentsSupabaseRepository = {
  async listByThread(tenantId: string, threadId: string): Promise<ServiceResult<AttachmentRow[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await communicationFrom(supabase, TABLE)
      .select('id, tenant_id, thread_id, message_id, filename, mime_type, storage_path')
      .eq('tenant_id', tenantId)
      .eq('thread_id', threadId);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    const rows = (data ?? []) as Record<string, unknown>[];
    return { ok: true, data: rows.map((r) => mapRow(r)) };
  },

  async insert(
    tenantId: string,
    input: {
      threadId: string;
      messageId: string;
      filename: string;
      mimeType: string;
      storagePath: string;
      sizeBytes: number;
      attachmentType: string;
    },
  ): Promise<ServiceResult<AttachmentRow>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await communicationFrom(supabase, TABLE)
      .insert({
        tenant_id: tenantId,
        thread_id: input.threadId,
        message_id: input.messageId,
        filename: input.filename,
        mime_type: input.mimeType,
        storage_path: input.storagePath,
        size_bytes: input.sizeBytes,
        attachment_type: input.attachmentType,
      })
      .select('id, tenant_id, thread_id, message_id, filename, mime_type, storage_path')
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapRow(data as Record<string, unknown>) };
  },
};
