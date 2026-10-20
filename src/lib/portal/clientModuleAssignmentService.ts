import type { ServiceResult } from '@/types';
import type { ClientModuleAssignment, PortalModuleKey } from '@/lib/portal/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { filterPortalModuleKeys, isPortalModuleKey, sortPortalModules } from '@/lib/portal/engine/portalModuleKeys';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function mapAssignmentRow(row: Record<string, unknown>): ClientModuleAssignment | null {
  const moduleKey = String(row.module_key ?? '');
  if (!isPortalModuleKey(moduleKey)) return null;
  const status = String(row.status ?? 'active');
  const isActive =
    row.is_active === undefined
      ? status !== 'inactive' && status !== 'deactivated'
      : row.is_active !== false;
  return {
    moduleKey,
    isPrimary: row.is_primary === true,
    isActive,
    assignedAt: String(row.assigned_at ?? row.created_at ?? new Date().toISOString()),
  };
}

/** Read active portal module assignments for a client. */
export async function fetchClientModuleAssignments(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientModuleAssignment[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const { data, error } = await fromUnknownTable(supabase, 'client_module_assignments')
    .select('module_key, is_primary, is_active, assigned_at, created_at, status')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .order('assigned_at', { ascending: true });

  if (error) {
    if (isMissingTableError(error)) {
      return { ok: true, data: [] };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  const assignments = ((data ?? []) as Record<string, unknown>[])
    .map(mapAssignmentRow)
    .filter((row): row is ClientModuleAssignment => row !== null && row.isActive);

  return { ok: true, data: assignments };
}

/** Office: replace portal-relevant module assignments for a client. */
export async function saveClientModuleAssignments(
  tenantId: string,
  clientId: string,
  moduleKeys: PortalModuleKey[],
  assignedBy?: string | null,
): Promise<ServiceResult<{ saved: PortalModuleKey[] }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const uniqueModules = sortPortalModules(filterPortalModuleKeys([...new Set(moduleKeys)]));
  const primaryModule = uniqueModules[0] ?? null;
  const selectedModules = new Set(uniqueModules);

  const { data: existing, error: readError } = await fromUnknownTable(
    supabase,
    'client_module_assignments',
  )
    .select('module_key')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId);

  if (readError && !isMissingTableError(readError)) {
    return { ok: false, error: toGermanSupabaseError(readError) };
  }

  const existingKeys = ((existing ?? []) as Record<string, unknown>[])
    .map((row) => String(row.module_key ?? ''))
    .filter((key): key is PortalModuleKey => isPortalModuleKey(key));

  if (uniqueModules.length > 0) {
    const upsertPayloads = uniqueModules.map((moduleKey) => ({
      tenant_id: tenantId,
      client_id: clientId,
      module_key: moduleKey,
      is_primary: moduleKey === primaryModule,
      is_active: true,
      assigned_by: assignedBy ?? null,
      assigned_at: new Date().toISOString(),
      status: 'active',
    }));

    const { error: upsertError } = await fromUnknownTable(supabase, 'client_module_assignments').upsert(
      upsertPayloads,
      { onConflict: 'tenant_id,client_id,module_key' },
    );
    if (upsertError) return { ok: false, error: toGermanSupabaseError(upsertError) };
  }

  const toDeactivate = existingKeys.filter((moduleKey) => !selectedModules.has(moduleKey));
  if (toDeactivate.length > 0) {
    const { error: deactivateError } = await fromUnknownTable(supabase, 'client_module_assignments')
      .update({ is_active: false, is_primary: false, status: 'inactive' })
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .in('module_key', toDeactivate);
    if (deactivateError) return { ok: false, error: toGermanSupabaseError(deactivateError) };
  }

  return { ok: true, data: { saved: uniqueModules } };
}

/** Map intake assignedModules catalog values to portal module keys. */
export function mapIntakeModulesToPortal(modules: string[]): PortalModuleKey[] {
  return filterPortalModuleKeys(modules);
}
