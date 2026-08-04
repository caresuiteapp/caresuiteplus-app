import type { ServiceResult } from '@/types';
import type { ClientFundingSourceKey } from '@/types/clients/clientFundingSource';
import {
  normalizeClientFundingSources,
} from '@/types/clients/clientFundingSource';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';

export type ClientFundingSelection = {
  id: string;
  tenantId: string;
  clientId: string;
  sources: ClientFundingSourceKey[];
  effectiveFrom: string;
  replacedAt: string | null;
  createdAt: string;
};

function mapSelectionRow(row: Record<string, unknown>): ClientFundingSelection {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    clientId: String(row.client_id),
    sources: normalizeClientFundingSources(Array.isArray(row.sources) ? row.sources : []),
    effectiveFrom: String(row.effective_from),
    replacedAt: row.replaced_at ? String(row.replaced_at) : null,
    createdAt: String(row.created_at),
  };
}

async function inferLegacyFundingSources(
  tenantId: string,
  clientId: string,
): Promise<ClientFundingSourceKey[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const [insuranceResult, entitlementResult, servicesResult] = await Promise.all([
    fromUnknownTable(client, 'client_insurance_profiles')
      .select('self_pay, care_level')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('is_primary', true)
      .maybeSingle(),
    fromUnknownTable(client, 'client_care_entitlement')
      .select('conversion_enabled')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .is('valid_until', null)
      .order('valid_from', { ascending: false })
      .limit(1),
    fromUnknownTable(client, 'client_service_entitlements')
      .select('service_type_key, billing_mode')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('is_active', true),
  ]);

  const sources: ClientFundingSourceKey[] = [];
  const entitlement = Array.isArray(entitlementResult.data)
    ? entitlementResult.data[0] as Record<string, unknown> | undefined
    : undefined;
  const insurance = insuranceResult.data as Record<string, unknown> | null;
  if (entitlement || (typeof insurance?.care_level === 'string' && insurance.care_level.trim())) {
    sources.push('entlastungsleistung');
  }
  if (entitlement?.conversion_enabled === true) sources.push('umwandlung');
  const serviceRows = Array.isArray(servicesResult.data)
    ? servicesResult.data as Record<string, unknown>[]
    : [];
  if (serviceRows.some((row) => String(row.service_type_key ?? '').includes('verhinderung'))) {
    sources.push('verhinderungspflege');
  }
  if (
    insurance?.self_pay === true
    || serviceRows.some((row) => row.billing_mode === 'self_payer' || row.billing_mode === 'mixed')
  ) sources.push('selbstzahler');
  return normalizeClientFundingSources(sources);
}

export async function getClientFundingSelection(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientFundingSelection | null>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(client, 'client_funding_selections')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .is('replaced_at', null)
      .maybeSingle();

    if (error) {
      if (isSupabaseMissingTableError(error)) {
        const sources = await inferLegacyFundingSources(tenantId, clientId);
        return {
          ok: true,
          data: sources.length > 0
            ? {
                id: `legacy-${clientId}`,
                tenantId,
                clientId,
                sources,
                effectiveFrom: new Date().toISOString().slice(0, 10),
                replacedAt: null,
                createdAt: new Date().toISOString(),
              }
            : null,
        };
      }
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    if (data) return { ok: true, data: mapSelectionRow(data as Record<string, unknown>) };

    const sources = await inferLegacyFundingSources(tenantId, clientId);
    return {
      ok: true,
      data: sources.length > 0
        ? {
            id: `legacy-${clientId}`,
            tenantId,
            clientId,
            sources,
            effectiveFrom: new Date().toISOString().slice(0, 10),
            replacedAt: null,
            createdAt: new Date().toISOString(),
          }
        : null,
    };
  });
}

export async function setClientFundingSources(
  tenantId: string,
  clientId: string,
  sources: readonly ClientFundingSourceKey[],
  effectiveFrom: string,
): Promise<ServiceResult<ClientFundingSelection>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;
    const normalized = normalizeClientFundingSources(sources);
    if (normalized.length === 0) {
      return { ok: false, error: 'Mindestens eine Finanzierungsart muss ausgewählt werden.' };
    }
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await (client as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: Parameters<typeof toGermanSupabaseError>[0] }>;
    }).rpc('set_client_funding_sources', {
      p_client_id: clientId,
      p_sources: normalized,
      p_effective_from: effectiveFrom || new Date().toISOString().slice(0, 10),
    });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { ok: false, error: 'Finanzierungsarten konnten nicht gespeichert werden.' };
    return { ok: true, data: mapSelectionRow(row as Record<string, unknown>) };
  });
}
