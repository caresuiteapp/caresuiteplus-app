import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '../errors';

function getClient() {
  return getSupabaseClient();
}

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

export type ReleaseRow = {
  id: string;
  tenant_id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
};

/** WP530 — Live Supabase Repository (release) */
export const releaseSupabaseRepository = {
  wpNumber: 530 as const,
  table: 'release_packages' as const,

  async list(tenantId: string): Promise<ServiceResult<ReleaseRow[]>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'release_packages')
      .select('id, tenant_id, title, status, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data ?? []) as ReleaseRow[] };
  },
};
