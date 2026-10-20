import type { ServiceResult } from '@/types';
import type { EnvironmentMode, TenantEnvironmentSettings } from '@/types/environment';
import { isDemoSupabaseTenantId, isInternalTestTenantId, isLiveProtectedTenantId } from '@/data/constants/demoGuard';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { isValidEnvironmentMode } from './environmentModeCatalog';
import {
  cacheTenantEnvironmentSettings,
  getTenantEnvironmentSettings,
} from './tenantEnvironmentSettingsService';

function mapRow(row: Record<string, unknown>): TenantEnvironmentSettings {
  const modeRaw = String(row.mode ?? 'production');
  const mode: EnvironmentMode = isValidEnvironmentMode(modeRaw) ? modeRaw : 'production';
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    mode,
    demoDataSetKey: row.demo_data_set_key != null ? String(row.demo_data_set_key) : null,
    isPilotTenant: Boolean(row.is_pilot_tenant),
    pilotPhase: row.pilot_phase != null ? String(row.pilot_phase) : null,
    showKnownRisks: Boolean(row.show_known_risks),
    feedbackModulePrepared: Boolean(row.feedback_module_prepared),
    providerSandboxOnly: Boolean(row.provider_sandbox_only),
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function defaultSettingsForTenant(tenantId: string): TenantEnvironmentSettings | null {
  if (tenantId === DEMO_TENANT_ID || isDemoSupabaseTenantId(tenantId)) return null;
  if (isInternalTestTenantId(tenantId)) {
    return {
      id: `tes-internal-${tenantId.slice(0, 8)}`,
      tenantId,
      mode: 'internal_test',
      demoDataSetKey: null,
      isPilotTenant: false,
      pilotPhase: null,
      showKnownRisks: false,
      feedbackModulePrepared: false,
      providerSandboxOnly: true,
      notes: 'Internal test tenant (fallback).',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  if (isLiveProtectedTenantId(tenantId)) {
    return {
      id: `tes-live-${tenantId.slice(0, 8)}`,
      tenantId,
      mode: 'production',
      demoDataSetKey: null,
      isPilotTenant: false,
      pilotPhase: null,
      showKnownRisks: false,
      feedbackModulePrepared: false,
      providerSandboxOnly: false,
      notes: 'LIVE protected tenant (fallback).',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  return null;
}

/** Loads tenant environment mode from Supabase into the in-memory cache. */
export async function hydrateTenantEnvironmentSettings(
  tenantId: string,
): Promise<ServiceResult<TenantEnvironmentSettings | null>> {
  if (!tenantId?.trim()) {
    return { ok: true, data: null };
  }

  if (getServiceMode() !== 'supabase' || tenantId === DEMO_TENANT_ID) {
    return { ok: true, data: getTenantEnvironmentSettings(tenantId) };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { ok: true, data: getTenantEnvironmentSettings(tenantId) };
  }

  const { data, error } = await fromUnknownTable(client, 'tenant_environment_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  if (data) {
    const mapped = mapRow(data as Record<string, unknown>);
    cacheTenantEnvironmentSettings(mapped);
    return { ok: true, data: mapped };
  }

  const fallback = defaultSettingsForTenant(tenantId) ?? getTenantEnvironmentSettings(tenantId);
  if (fallback) {
    cacheTenantEnvironmentSettings(fallback);
  }
  return { ok: true, data: fallback };
}

export async function ensureTenantEnvironmentSettingsLoaded(
  tenantId: string,
): Promise<TenantEnvironmentSettings | null> {
  const cached = getTenantEnvironmentSettings(tenantId);
  if (cached) return cached;
  const result = await hydrateTenantEnvironmentSettings(tenantId);
  if (!result.ok) return getTenantEnvironmentSettings(tenantId);
  return result.data ?? getTenantEnvironmentSettings(tenantId);
}
