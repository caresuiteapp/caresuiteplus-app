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

  const { data: existing, error: readError } = await fromUnknownTable(
    supabase,
    'client_module_assignments',
  )
    .select('id, module_key')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId);

  if (readError && !isMissingTableError(readError)) {
    return { ok: false, error: toGermanSupabaseError(readError) };
  }

  const existingRows = (existing ?? []) as Record<string, unknown>[];
  const existingKeys = new Set(existingRows.map((row) => String(row.module_key ?? '')));

  for (const row of existingRows) {
    const key = String(row.module_key ?? '');
    if (!isPortalModuleKey(key)) continue;
    if (uniqueModules.includes(key)) continue;
    const { error } = await fromUnknownTable(supabase, 'client_module_assignments')
      .delete()
      .eq('id', String(row.id));
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
  }

  if (uniqueModules.length === 0) {
    return { ok: true, data: { saved: [] } };
  }

  for (const moduleKey of uniqueModules) {
    const payload = {
      tenant_id: tenantId,
      client_id: clientId,
      module_key: moduleKey,
      is_primary: moduleKey === primaryModule,
      is_active: true,
      assigned_by: assignedBy ?? null,
      assigned_at: new Date().toISOString(),
      status: 'active',
    };

    if (existingKeys.has(moduleKey)) {
      const { error } = await fromUnknownTable(supabase, 'client_module_assignments')
        .update(payload)
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .eq('module_key', moduleKey);
      if (error) return { ok: false, error: toGermanSupabaseError(error) };
    } else {
      const { error } = await fromUnknownTable(supabase, 'client_module_assignments').insert(payload);
      if (error) return { ok: false, error: toGermanSupabaseError(error) };
    }
  }

  return { ok: true, data: { saved: uniqueModules } };
}

/** Map intake assignedModules catalog values to portal module keys. */
export function mapIntakeModulesToPortal(modules: string[]): PortalModuleKey[] {
  return filterPortalModuleKeys(modules);
}
