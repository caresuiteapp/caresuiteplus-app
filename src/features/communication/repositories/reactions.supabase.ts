import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { communicationFrom } from './supabaseTable';

const TABLE = 'communication_reactions';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

export const reactionsSupabaseRepository = {
  async listByMessage(
    tenantId: string,
    messageId: string,
  ): Promise<ServiceResult<Record<string, unknown>[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await communicationFrom(supabase, TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('message_id', messageId);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data ?? []) as Record<string, unknown>[] };
  },

  async insert(
    tenantId: string,
    input: {
      threadId: string;
      messageId: string;
      emoji: string;
      reactedByType: string;
      reactedById: string | null;
      reactedByDisplayName: string;
    },
  ): Promise<ServiceResult<{ id: string }>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await communicationFrom(supabase, TABLE)
      .insert({
        tenant_id: tenantId,
        thread_id: input.threadId,
        message_id: input.messageId,
        emoji: input.emoji,
        reacted_by_type: input.reactedByType,
        reacted_by_id: input.reactedById,
        reacted_by_display_name: input.reactedByDisplayName,
      })
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: { id: String((data as { id: string }).id) } };
  },

  async remove(tenantId: string, reactionId: string): Promise<ServiceResult<{ removed: true }>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { error } = await communicationFrom(supabase, TABLE)
      .update({ updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', reactionId);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: { removed: true } };
  },
};
