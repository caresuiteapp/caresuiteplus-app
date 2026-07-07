import type { ServiceResult } from '@/types';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { getServiceMode } from '@/lib/services/mode';
import {
  DEFAULT_TENANT_MODULES,
  type TenantModuleSettings,
} from '@/types/tenant/tenantCenter';
import {
  getTenantModuleSettingsCache,
  hasTenantModuleSettingsCache,
  setTenantModuleSettingsCache,
} from '@/lib/tenant/tenantModuleSettingsCache';
import { syncModuleAccessFromTenantSettings } from '@/lib/tenant/syncTenantModuleAccess';
import { fetchTenantCenter } from '@/lib/tenant/tenantCenterService';
import { hydrateTenantEnvironmentSettings } from '@/lib/environment/tenantEnvironmentSettingsHydration';

function mapTenantModuleRow(row: Record<string, unknown> | null): TenantModuleSettings {
  return {
    assistEnabled: row?.assist_enabled != null ? Boolean(row.assist_enabled) : true,
    pflegeEnabled: Boolean(row?.pflege_enabled),
    stationaerEnabled: Boolean(row?.stationaer_enabled),
    beratungEnabled: Boolean(row?.beratung_enabled),
  };
}

/** Mandanten-Center-Module aus Supabase laden und Modul-Gates synchronisieren. */
export async function hydrateTenantModuleSettings(
  tenantId: string,
): Promise<ServiceResult<TenantModuleSettings>> {
  if (!tenantId?.trim()) {
    return { ok: true, data: { ...DEFAULT_TENANT_MODULES } };
  }

  if (getServiceMode() !== 'supabase' || tenantId === DEMO_TENANT_ID) {
    const result = await fetchTenantCenter(tenantId);
    if (!result.ok) return result;
    setTenantModuleSettingsCache(tenantId, result.data.modules);
    syncModuleAccessFromTenantSettings(tenantId, result.data.modules);
    return { ok: true, data: result.data.modules };
  }

  const client = getSupabaseClient();
  if (!client) {
    const cached = getTenantModuleSettingsCache(tenantId);
    return { ok: true, data: cached };
  }

  const { data, error } = await fromUnknownTable(client, 'tenant_module_settings')
    .select('assist_enabled, pflege_enabled, stationaer_enabled, beratung_enabled')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  const modules = mapTenantModuleRow((data as Record<string, unknown> | null) ?? null);
  setTenantModuleSettingsCache(tenantId, modules);
  syncModuleAccessFromTenantSettings(tenantId, modules);
  return { ok: true, data: modules };
}

export async function ensureTenantModuleSettingsLoaded(tenantId: string): Promise<TenantModuleSettings> {
  if (hasTenantModuleSettingsCache(tenantId)) {
    return getTenantModuleSettingsCache(tenantId);
  }

  await Promise.all([
    hydrateTenantModuleSettings(tenantId),
    hydrateTenantEnvironmentSettings(tenantId),
  ]);
  return getTenantModuleSettingsCache(tenantId);
}
