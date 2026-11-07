import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { getServiceMode } from '@/lib/services/mode';
import type { ServiceResult } from '@/types';

export type EmployeePortalWorkspaceGrants = {
  products: string[];
  updatedAt: string | null;
};

const error = 'Die persönlichen Modulfreigaben konnten nicht geladen werden.';

function parseGrants(row: { allowed_products?: unknown; updated_at?: string | null } | null): ServiceResult<EmployeePortalWorkspaceGrants> {
  if (!row || (row.allowed_products !== null && (!Array.isArray(row.allowed_products) ||
    !row.allowed_products.every((key: unknown) => typeof key === 'string')))) return { ok: false, error };
  return { ok: true, data: { products: row.allowed_products ?? [], updatedAt: row.updated_at ?? null } };
}

/** Employees can only read their linked row through the existing personnel RLS. */
export async function loadEmployeePortalWorkspaceGrants(
  tenantId: string,
  employeeId: string,
  allowLegacySchema = false,
): Promise<ServiceResult<EmployeePortalWorkspaceGrants>> {
  if (getServiceMode() === 'demo') return { ok: true, data: { products: [], updatedAt: null } };
  const client = getSupabaseClient();
  if (!client) return { ok: false, error };
  const result = await fromUnknownTable(client, 'employees')
    .select('allowed_products,updated_at')
    .eq('tenant_id', tenantId)
    .eq('id', employeeId)
    .is('deleted_at', null)
    .maybeSingle();
  if (allowLegacySchema && result.error?.code === '42703') {
    const ownRow = await fromUnknownTable(client, 'employees').select('id')
      .eq('tenant_id', tenantId).eq('id', employeeId).is('deleted_at', null).maybeSingle();
    if (!ownRow.error && ownRow.data?.id === employeeId) return { ok: true, data: { products: [], updatedAt: null } };
  }
  return result.error ? { ok: false, error } : parseGrants(result.data);
}

/** Personnel editors use the same tenant-scoped write policy as other personnel changes. */
export async function saveEmployeePortalWorkspaceGrants(
  tenantId: string,
  employeeId: string,
  products: readonly string[],
  original: EmployeePortalWorkspaceGrants,
): Promise<ServiceResult<EmployeePortalWorkspaceGrants>> {
  const client = getSupabaseClient();
  if (!client || getServiceMode() !== 'supabase') return { ok: false, error: 'Zum Speichern wird eine Live-Verbindung benötigt.' };
  const write = fromUnknownTable(client, 'employees')
    .update({ allowed_products: [...products], updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', employeeId)
    .is('deleted_at', null);
  const checked = original.updatedAt ? write.eq('updated_at', original.updatedAt) : write.is('updated_at', null);
  const result = await checked.select('allowed_products,updated_at').maybeSingle();
  if (result.error || !result.data) {
    return { ok: false, error: 'Die Freigaben konnten nicht gespeichert werden. Laden Sie die Personalakte erneut und prüfen Sie Ihre Berechtigung.' };
  }
  return parseGrants(result.data);
}
