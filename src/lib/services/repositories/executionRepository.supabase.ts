import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '../errors';

export type ExecutionRow = {
  id: string;
  tenant_id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
};

function getClient() {
  return getSupabaseClient();
}

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

const SELECT = 'id, tenant_id, title, status, created_at, updated_at';

/** WP270 — Live Supabase Repository (Assist Execution / assignments) */
export const executionSupabaseRepository = {
  wpNumber: 270 as const,
  table: 'assignments' as const,

  async list(tenantId: string): Promise<ServiceResult<ExecutionRow[]>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'assignments')
      .select(SELECT)
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data ?? []) as ExecutionRow[] };
  },

  async getById(tenantId: string, id: string): Promise<ServiceResult<ExecutionRow | null>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'assignments')
      .select(SELECT)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data as ExecutionRow | null) ?? null };
  },

  async create(
    tenantId: string,
    input: { title: string; status?: string },
  ): Promise<ServiceResult<{ id: string }>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'assignments')
      .insert({
        tenant_id: tenantId,
        title: input.title.trim(),
        status: input.status ?? 'entwurf',
      } as Record<string, unknown>)
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: { id: (data as { id: string }).id } };
  },

  async updateStatus(
    tenantId: string,
    assignmentId: string,
    status: string,
  ): Promise<ServiceResult<ExecutionRow>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const now = new Date().toISOString();
    const { data, error } = await fromUnknownTable(supabase, 'assignments')
      .update({ status, updated_at: now } as Record<string, unknown>)
      .eq('tenant_id', tenantId)
      .eq('id', assignmentId)
      .select(SELECT)
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: data as ExecutionRow };
  },
};
