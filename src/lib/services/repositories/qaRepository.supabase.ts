import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '../errors';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

/** WP570 — Live Supabase Repository (qa) */
export const qaSupabaseRepository = {
  wpNumber: 570 as const,
  table: 'qa_items' as const,

  async list(tenantId: string): Promise<ServiceResult<{ id: string; tenant_id: string; title: string }[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'qa_items')
      .select('id, tenant_id, title')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data ?? []) as { id: string; tenant_id: string; title: string }[] };
  },

  async create(
    tenantId: string,
    payload: { title: string; kind?: string },
  ): Promise<ServiceResult<{ id: string }>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'qa_items')
      .insert({
        tenant_id: tenantId,
        title: payload.title,
        kind: payload.kind ?? 'bug',
        status: 'entwurf',
      } as Record<string, unknown>)
      .select('id')
      .single();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: { id: (data as { id: string }).id } };
  },
};
