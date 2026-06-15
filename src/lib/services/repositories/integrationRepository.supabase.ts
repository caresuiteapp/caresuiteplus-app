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

export type IntegrationRow = {
  id: string;
  tenant_id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
};

function mapIntegrationRow(row: Record<string, unknown>): IntegrationRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id ?? ''),
    title: String(row.name ?? row.title ?? ''),
    status: String(row.status ?? ''),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

/** WP490 — Live Supabase Repository (integrations) */
export const integrationSupabaseRepository = {
  wpNumber: 490 as const,
  table: 'integration_providers' as const,

  async list(tenantId: string): Promise<ServiceResult<IntegrationRow[]>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'integration_providers')
      .select('id, tenant_id, name, status, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data ?? []).map((row) => mapIntegrationRow(row as Record<string, unknown>)) };
  },

  async getById(tenantId: string, id: string): Promise<ServiceResult<IntegrationRow | null>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'integration_providers')
      .select('id, tenant_id, name, status, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: data ? mapIntegrationRow(data as Record<string, unknown>) : null };
  },

  async create(
    tenantId: string,
    input: { title: string; status?: string },
  ): Promise<ServiceResult<{ id: string }>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const slug = input.title.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 48);
    const { data, error } = await fromUnknownTable(supabase, 'integration_providers')
      .insert({
        tenant_id: tenantId,
        name: input.title.trim(),
        provider_key: slug || `provider_${Date.now()}`,
        provider_type: 'other',
        status: input.status ?? 'planned',
      } as Record<string, unknown>)
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: { id: (data as { id: string }).id } };
  },
};
