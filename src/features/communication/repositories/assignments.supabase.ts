import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { communicationFrom } from './supabaseTable';

const TABLE = 'communication_assignments';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

export const assignmentsSupabaseRepository = {
  async listOpen(tenantId: string): Promise<ServiceResult<Record<string, unknown>[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await communicationFrom(supabase, TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data ?? []) as Record<string, unknown>[] };
  },

  async insert(
    tenantId: string,
    input: Record<string, unknown>,
  ): Promise<ServiceResult<{ id: string }>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await communicationFrom(supabase, TABLE)
      .insert({ tenant_id: tenantId, ...input })
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: { id: String((data as { id: string }).id) } };
  },

  async updateStatus(
    tenantId: string,
    assignmentId: string,
    status: string,
  ): Promise<ServiceResult<{ updated: true }>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { error } = await communicationFrom(supabase, TABLE)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', assignmentId);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: { updated: true } };
  },
};
