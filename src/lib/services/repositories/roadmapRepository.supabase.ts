import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '../errors';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

/** WP590 — Live Supabase Repository (roadmap) */
export const roadmapSupabaseRepository = {
  wpNumber: 590 as const,
  table: 'roadmap_milestones' as const,

  async list(tenantId: string): Promise<ServiceResult<{ id: string; tenant_id: string; title: string }[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'roadmap_milestones')
      .select('id, tenant_id, title')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data ?? []) as { id: string; tenant_id: string; title: string }[] };
  },

  async create(
    tenantId: string,
    payload: { title: string; phase?: string; quarter?: string },
  ): Promise<ServiceResult<{ id: string }>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'roadmap_milestones')
      .insert({
        tenant_id: tenantId,
        title: payload.title,
        phase: payload.phase ?? 'pilot',
        quarter: payload.quarter ?? 'Q2 2026',
        status: 'entwurf',
      } as Record<string, unknown>)
      .select('id')
      .single();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: { id: (data as { id: string }).id } };
  },
};
