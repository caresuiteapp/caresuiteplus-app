import type { ServiceResult } from '@/types';
import type { Database } from '@/lib/supabase/database.types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
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
    if (isMissingTableError(error)) {
      return { ok: true, data: [] };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  const templates = (data ?? [])
    .map((row) => mapSearchRow(row as CostCarrierSystemTemplateRow))
    .filter((entry): entry is CostCarrierSystemTemplate => entry !== null);

  return { ok: true, data: templates };
}

type TenantOverrideRow = Database['public']['Tables']['tenant_cost_carrier_overrides']['Row'];

function mapTenantOverrideRow(row: TenantOverrideRow): CostCarrierSystemTemplate | null {
  if (!isCostCarrierDbType(row.carrier_type)) return null;
  return {
    id: row.system_template_id ?? row.id,
    templateKey: row.id,
    carrierType: row.carrier_type,
    uiLabel: row.custom_name ?? '',
    name: row.custom_name ?? '',
    legalName: null,
    shortName: null,
    ikNumber: row.custom_ik_number ?? '',
    street: row.custom_address_line_1 ?? '',
    zip: row.custom_postal_code ?? '',
    city: row.custom_city ?? '',
    federalState: null,
    country: 'DE',
    phone: row.custom_phone,
    fax: null,
    email: row.custom_email,
    website: null,
    dataStatus: 'tenant_override',
    notes: row.notes,
  };
}

export async function searchTenantCostCarrierOverrides(
  tenantId: string,
  carrierType: CostCarrierDbType,
  query: string,
  limit = 8,
): Promise<ServiceResult<CostCarrierSystemTemplate[]>> {
  const supabase = getClient();
  if (!supabase) return unavailable();

  let request = supabase
    .from('tenant_cost_carrier_overrides')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('carrier_type', carrierType)
    .eq('is_active', true);

  const trimmed = query.trim();
  if (trimmed) {
    request = request.ilike('custom_name', `%${trimmed}%`);
  }

  const { data, error } = await request.limit(limit);

  if (error) {
    if (isMissingTableError(error)) {
      return { ok: true, data: [] };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  const templates = (data ?? [])
    .map((row) => mapTenantOverrideRow(row as TenantOverrideRow))
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

/** Updates the active primary assignment or inserts when none exists (edit-safe). */
export async function upsertClientCostCarrierAssignment(
  input: Database['public']['Tables']['client_cost_carrier_assignments']['Insert'],
): Promise<ServiceResult<{ id: string }>> {
  const supabase = getClient();
  if (!supabase) return unavailable();

  const { data: existing, error: lookupError } = await supabase
    .from('client_cost_carrier_assignments')
    .select('id')
    .eq('tenant_id', input.tenant_id)
    .eq('client_id', input.client_id)
    .eq('carrier_type', input.carrier_type)
    .eq('is_primary', true)
    .is('archived_at', null)
    .maybeSingle();

  if (lookupError) {
    return { ok: false, error: toGermanSupabaseError(lookupError) };
  }

  if (existing?.id) {
    const updatePayload: Database['public']['Tables']['client_cost_carrier_assignments']['Update'] = {
      system_template_id: input.system_template_id ?? null,
      tenant_override_id: input.tenant_override_id ?? null,
      name_snapshot: input.name_snapshot,
      ik_number_snapshot: input.ik_number_snapshot ?? null,
      address_snapshot: input.address_snapshot ?? null,
      insurance_number: input.insurance_number ?? null,
      care_level_relevant: input.care_level_relevant ?? false,
      billing_relevant: input.billing_relevant ?? true,
      is_primary: input.is_primary ?? true,
      updated_by: input.updated_by ?? null,
    };

    const { data, error } = await supabase
      .from('client_cost_carrier_assignments')
      .update(updatePayload)
      .eq('id', existing.id)
      .eq('tenant_id', input.tenant_id)
      .select('id')
      .single();

    if (error || !data) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    return { ok: true, data: { id: data.id } };
  }

  return insertClientCostCarrierAssignment(input);
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
