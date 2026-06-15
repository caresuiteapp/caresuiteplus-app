import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '../errors';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

export type SecurityRow = {
  id: string;
  tenant_id: string;
  title: string;
  status: string;
  created_at: string;
};

/** WP550 — Live Supabase Repository (security) */
export const securitySupabaseRepository = {
  wpNumber: 550 as const,
  table: 'security_findings' as const,

  async list(tenantId: string): Promise<ServiceResult<SecurityRow[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'security_findings')
      .select('id, tenant_id, title, status, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data ?? []) as SecurityRow[] };
  },

  async create(
    tenantId: string,
    payload: { title: string; category?: string },
  ): Promise<ServiceResult<{ id: string }>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'security_findings')
      .insert({
        tenant_id: tenantId,
        title: payload.title,
        category: payload.category ?? 'dsgvo',
        status: 'entwurf',
      } as Record<string, unknown>)
      .select('id')
      .single();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: { id: (data as { id: string }).id } };
  },
};
