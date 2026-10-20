import type { ServiceResult } from '@/types';
import type { CommunicationThread } from '../communication.types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { mapCommunicationThreadRow, threadToInsertRow } from './communicationMappers';
import { communicationFrom } from './supabaseTable';

const TABLE = 'communication_threads';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

export const threadsSupabaseRepository = {
  async list(tenantId: string): Promise<ServiceResult<CommunicationThread[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await communicationFrom(supabase, TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('last_message_at', { ascending: false, nullsFirst: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    const rows = (data ?? []) as Record<string, unknown>[];
    return { ok: true, data: rows.map((row) => mapCommunicationThreadRow(row)) };
  },

  async getById(tenantId: string, threadId: string): Promise<ServiceResult<CommunicationThread | null>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await communicationFrom(supabase, TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', threadId)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) return { ok: true, data: null };
    return { ok: true, data: mapCommunicationThreadRow(data as Record<string, unknown>) };
  },

  async create(
    tenantId: string,
    input: Parameters<typeof threadToInsertRow>[1],
  ): Promise<ServiceResult<CommunicationThread>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await communicationFrom(supabase, TABLE)
      .insert(threadToInsertRow(tenantId, input))
      .select('*')
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapCommunicationThreadRow(data as Record<string, unknown>) };
  },

  async update(
    tenantId: string,
    threadId: string,
    patch: Partial<Record<string, unknown>>,
  ): Promise<ServiceResult<CommunicationThread>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await communicationFrom(supabase, TABLE)
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', threadId)
      .select('*')
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapCommunicationThreadRow(data as Record<string, unknown>) };
  },
};
