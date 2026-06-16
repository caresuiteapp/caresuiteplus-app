import type { ServiceResult } from '@/types';
import type { Database } from '@/lib/supabase/database.types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import type { CostCarrierDbType, CostCarrierSystemTemplate, CostCarrierSystemTemplateRow } from './costCarrierTypes';
import { isCostCarrierDbType } from './costCarrierTypes';

function getClient() {
  return getSupabaseClient();
}

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function mapSearchRow(row: CostCarrierSystemTemplateRow): CostCarrierSystemTemplate | null {
  if (!isCostCarrierDbType(row.carrier_type)) return null;
  return {
    id: row.id,
    templateKey: row.template_key,
    carrierType: row.carrier_type,
    uiLabel: row.ui_label,
    name: row.name,
    legalName: row.legal_name,
    shortName: row.short_name,
    ikNumber: row.ik_number ?? '',
    street: row.street ?? '',
    zip: row.postal_code ?? '',
    city: row.city ?? '',
    federalState: row.federal_state,
    country: row.country ?? 'DE',
    phone: row.phone,
    fax: row.fax,
    email: row.email,
    website: row.website,
    dataStatus: row.data_status,
    notes: row.notes,
  };
}

export async function searchCostCarrierSystemTemplatesRemote(
  carrierType: CostCarrierDbType,
  query: string,
  limit = 8,
): Promise<ServiceResult<CostCarrierSystemTemplate[]>> {
  const supabase = getClient();
  if (!supabase) return unavailable();

  const { data, error } = await supabase.rpc('search_cost_carrier_system_templates', {
    p_carrier_type: carrierType,
    p_query: query.trim() || undefined,
    p_limit: limit,
  });

  if (error) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  const templates = (data ?? [])
    .map((row) => mapSearchRow(row as CostCarrierSystemTemplateRow))
    .filter((entry): entry is CostCarrierSystemTemplate => entry !== null);

  return { ok: true, data: templates };
}

export async function insertTenantCostCarrierOverride(
  input: Database['public']['Tables']['tenant_cost_carrier_overrides']['Insert'],
): Promise<ServiceResult<{ id: string }>> {
  const supabase = getClient();
  if (!supabase) return unavailable();

  const { data, error } = await supabase
    .from('tenant_cost_carrier_overrides')
    .insert(input)
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: { id: data.id } };
}

export async function insertClientCostCarrierAssignment(
  input: Database['public']['Tables']['client_cost_carrier_assignments']['Insert'],
): Promise<ServiceResult<{ id: string }>> {
  const supabase = getClient();
  if (!supabase) return unavailable();

  const { data, error } = await supabase
    .from('client_cost_carrier_assignments')
    .insert(input)
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: { id: data.id } };
}

export async function countCostCarrierSystemTemplatesByType(): Promise<
  ServiceResult<Record<CostCarrierDbType, number>>
> {
  const supabase = getClient();
  if (!supabase) return unavailable();

  const counts = {} as Record<CostCarrierDbType, number>;
  for (const carrierType of [
    'accident_insurance',
    'care_insurance',
    'employers_liability_insurance',
    'health_insurance',
    'private_insurance',
    'social_welfare_office',
  ] as const) {
    const { count, error } = await supabase
      .from('cost_carrier_system_templates')
      .select('id', { count: 'exact', head: true })
      .eq('carrier_type', carrierType)
      .eq('validity_status', 'active');

    if (error) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }
    counts[carrierType] = count ?? 0;
  }

  return { ok: true, data: counts };
}
