import type { ServiceResult } from '@/types';
import type { KIMMessage, KIMMessageStatus } from '@/types/modules/ti';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import {
  assertKIMMessageEvidenceContext,
  mapKIMMessageEvidenceRow,
} from '@/lib/ti/kimMessageEvidence';

const TABLE = 'kim_messages' as const;

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

const INVALID_EVIDENCE = 'KIM-Nachrichtenbestand ist widersprüchlich.';

function evidenceError<T>(): ServiceResult<T> {
  return { ok: false, error: INVALID_EVIDENCE };
}

export const kimMessagesSupabaseRepository = {
  async list(tenantId: string, mailboxId?: string): Promise<ServiceResult<KIMMessage[]>> {
    try {
      assertKIMMessageEvidenceContext({ tenantId, mailboxId });
    } catch {
      return evidenceError();
    }
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    let query = supabase
      .from(TABLE)
      .select('*')
      .eq('tenant_id', tenantId);
    if (mailboxId !== undefined) query = query.eq('mailbox_id', mailboxId);
    const { data, error } = await query.order('received_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!Array.isArray(data)) return evidenceError();
    try {
      return {
        ok: true,
        data: data.map((row) => mapKIMMessageEvidenceRow(row, { tenantId, mailboxId })) as KIMMessage[],
      };
    } catch {
      return evidenceError();
    }
  },

  async getById(tenantId: string, messageId: string): Promise<ServiceResult<KIMMessage | null>> {
    try {
      assertKIMMessageEvidenceContext({ tenantId });
    } catch {
      return evidenceError();
    }
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
    try {
      const mapped = mapKIMMessageEvidenceRow(data, { tenantId });
      if (mapped.id !== messageId) return evidenceError();
      return { ok: true, data: mapped as KIMMessage };
    } catch {
      return evidenceError();
    }
  },

  async updateStatus(
    tenantId: string,
    messageId: string,
    status: KIMMessageStatus,
  ): Promise<ServiceResult<KIMMessage>> {
    try {
      assertKIMMessageEvidenceContext({ tenantId });
    } catch {
      return evidenceError();
    }
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
    try {
      const mapped = mapKIMMessageEvidenceRow(data, { tenantId });
      if (mapped.id !== messageId || mapped.status !== status) return evidenceError();
      return { ok: true, data: mapped as KIMMessage };
    } catch {
      return evidenceError();
    }
  },
};
