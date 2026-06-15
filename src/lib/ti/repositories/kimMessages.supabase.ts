import type { ServiceResult } from '@/types';
import type { KIMMessage, KIMMessageStatus } from '@/types/modules/ti';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';

const TABLE = 'kim_messages' as const;

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function mapRow(row: Record<string, unknown>): KIMMessage {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    mailboxId: String(row.mailbox_id),
    sender: String(row.sender ?? ''),
    senderName: (row.sender_name as string | null) ?? null,
    subject: String(row.subject ?? ''),
    preview: String(row.preview ?? ''),
    body: String(row.body ?? ''),
    status: (row.status as KIMMessageStatus) ?? 'unread',
    receivedAt: String(row.received_at ?? new Date().toISOString()),
    hasAttachments: Boolean(row.has_attachments),
    isMedical: Boolean(row.is_medical),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function castRows(rows: unknown[] | null | undefined): Record<string, unknown>[] {
  return (rows ?? []) as Record<string, unknown>[];
}

export const kimMessagesSupabaseRepository = {
  async list(tenantId: string, mailboxId?: string): Promise<ServiceResult<KIMMessage[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('received_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    let rows = castRows(data);
    if (mailboxId) {
      rows = rows.filter((row) => String(row.mailbox_id) === mailboxId);
    }
    return { ok: true, data: rows.map((row) => mapRow(row)) };
  },

  async getById(tenantId: string, messageId: string): Promise<ServiceResult<KIMMessage | null>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', messageId)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) return { ok: true, data: null };
    return { ok: true, data: mapRow(data as Record<string, unknown>) };
  },

  async updateStatus(
    tenantId: string,
    messageId: string,
    status: KIMMessageStatus,
  ): Promise<ServiceResult<KIMMessage>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await supabase
      .from(TABLE)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', messageId)
      .select('*')
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapRow(data as Record<string, unknown>) };
  },
};
