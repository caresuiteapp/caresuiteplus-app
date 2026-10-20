import type { ServiceResult } from '@/types';
import type { KIMAttachment } from '@/types/modules/ti';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';

const TABLE = 'kim_attachments';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function mapRow(row: Record<string, unknown>): KIMAttachment {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    messageId: String(row.message_id),
    fileName: String(row.file_name ?? ''),
    mimeType: String(row.mime_type ?? 'application/pdf'),
    sizeBytes: Number(row.size_bytes ?? 0),
    importStatus: (row.import_status as KIMAttachment['importStatus']) ?? 'pending',
    suggestedAssignment: (row.suggested_assignment as string | null) ?? null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

export const kimAttachmentsSupabaseRepository = {
  async listForMessage(tenantId: string, messageId: string): Promise<ServiceResult<KIMAttachment[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await supabase
      .from(TABLE as 'integration_providers')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    const rows = (data ?? []) as Record<string, unknown>[];
    const attachments = rows.filter((row) => String(row.message_id) === messageId);
    return { ok: true, data: attachments.map((row) => mapRow(row)) };
  },

  async updateImportStatus(
    tenantId: string,
    attachmentId: string,
    importStatus: KIMAttachment['importStatus'],
  ): Promise<ServiceResult<KIMAttachment>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await supabase
      .from(TABLE as 'integration_providers')
      .update({ import_status: importStatus, updated_at: new Date().toISOString() } as never)
      .eq('tenant_id', tenantId)
      .eq('id', attachmentId)
      .select('*')
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapRow(data as Record<string, unknown>) };
  },
};
