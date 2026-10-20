import type { ServiceResult } from '@/types';
import type { CommunicationMessage } from '../communication.types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { mapCommunicationMessageRow, messageToInsertRow } from './communicationMappers';
import { communicationFrom } from './supabaseTable';

const TABLE = 'communication_messages';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

export const messagesSupabaseRepository = {
  async listByThread(tenantId: string, threadId: string): Promise<ServiceResult<CommunicationMessage[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await communicationFrom(supabase, TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    const rows = (data ?? []) as Record<string, unknown>[];
    return { ok: true, data: rows.map((row) => mapCommunicationMessageRow(row)) };
  },

  async create(
    tenantId: string,
    message: Omit<CommunicationMessage, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ServiceResult<CommunicationMessage>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await communicationFrom(supabase, TABLE)
      .insert(messageToInsertRow(tenantId, message))
      .select('*')
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapCommunicationMessageRow(data as Record<string, unknown>) };
  },

  async update(
    tenantId: string,
    messageId: string,
    patch: Partial<Record<string, unknown>>,
  ): Promise<ServiceResult<CommunicationMessage>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await communicationFrom(supabase, TABLE)
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', messageId)
      .select('*')
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapCommunicationMessageRow(data as Record<string, unknown>) };
  },
};
