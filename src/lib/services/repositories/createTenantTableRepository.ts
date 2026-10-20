import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '../errors';

export type TenantTableRow = {
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

type CreateTenantTableRepositoryOptions = {
  wpNumber: number;
  table: string;
  entityLabel: string;
  selectColumns?: string;
};

/** Factory fÃ¼r domain-spezifische Supabase-Repositories (WP Ã—10). */
export function createTenantTableRepository({
  wpNumber,
  table,
  entityLabel,
  selectColumns = 'id, tenant_id, title, status, created_at, updated_at',
}: CreateTenantTableRepositoryOptions) {
  return {
    wpNumber: wpNumber as number,
    table,
    entityLabel,

    async list(tenantId: string): Promise<ServiceResult<TenantTableRow[]>> {
      const supabase = getClient();
      if (!supabase) return unavailable();
      const { data, error } = await fromUnknownTable(supabase, table)
        .select(selectColumns)
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false });
      if (error) {
        if (isSupabaseMissingTableError(error)) {
          return { ok: true, data: [], tableMissing: true };
        }
        return { ok: false, error: toGermanSupabaseError(error) };
      }
      return { ok: true, data: (data ?? []) as unknown as TenantTableRow[] };
    },

    async getById(tenantId: string, id: string): Promise<ServiceResult<TenantTableRow | null>> {
      const supabase = getClient();
      if (!supabase) return unavailable();
      const { data, error } = await fromUnknownTable(supabase, table)
        .select(selectColumns)
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .maybeSingle();
      if (error) {
        if (isSupabaseMissingTableError(error)) {
          return { ok: true, data: null, tableMissing: true };
        }
        return { ok: false, error: toGermanSupabaseError(error) };
      }
      return { ok: true, data: (data as TenantTableRow | null) ?? null };
    },

    async create(
      tenantId: string,
      input: { title: string; status?: string },
    ): Promise<ServiceResult<{ id: string }>> {
      const supabase = getClient();
      if (!supabase) return unavailable();
      const { data, error } = await fromUnknownTable(supabase, table)
        .insert({
          tenant_id: tenantId,
          title: input.title.trim(),
          status: input.status ?? 'entwurf',
        } as Record<string, unknown>)
        .select('id')
        .single();
      if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
      return { ok: true, data: { id: String((data as { id: string }).id) } };
    },
  };
}
