import type { PermissionKey, RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant, isLiveServiceMode } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
export type CompanyCostCenterScope = { tenantId: string; roleKey: RoleKey | null; effectivePermissions?: readonly PermissionKey[] };
export type CompanyCostCenter = { id: string; code: string; name: string; organizationId: string | null; isActive: boolean; updatedAt: string };
export type CompanyCostCenterSnapshot = { costCenters: CompanyCostCenter[]; organizations: { id: string; code: string; name: string; isActive: boolean }[] };
export type CompanyCostCenterInput = { id?: string; expectedUpdatedAt?: string; code: string; name: string; organizationId: string | null; isActive: boolean };
type Row = Record<string, unknown>;
const row = (value: unknown): Row | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function mapCost(value: unknown, tenantId: string): CompanyCostCenter {
  const item = row(value);
  if (!item || item.tenant_id !== tenantId || typeof item.id !== 'string' || !UUID.test(item.id) || typeof item.code !== 'string' || typeof item.name !== 'string' || typeof item.is_active !== 'boolean' || typeof item.updated_at !== 'string') throw new Error('Die Kostenstellendaten konnten nicht vollständig gelesen werden.');
  return { id: item.id, code: item.code, name: item.name, organizationId: item.organization_id ? String(item.organization_id) : null, isActive: item.is_active, updatedAt: item.updated_at };
}
function connection(scope: CompanyCostCenterScope) {
  const tenant = guardServiceTenant(scope.tenantId); if (tenant) throw new Error(tenant.error);
  const denied = enforcePermission(scope.roleKey, 'business.tenant.manage', { effectivePermissions: scope.effectivePermissions }); if (denied) throw new Error(denied.error);
  if (!isLiveServiceMode()) throw new Error('Kostenstellen benötigen eine aktive Datenverbindung.');
  const client = getSupabaseClient(); if (!client) throw new Error('Datenverbindung nicht verfügbar.');
  return client;
}
function errorText(error: unknown) {
  const item = row(error); const code = String(item?.code ?? '');
  if (['42883', 'PGRST202'].includes(code)) return 'Die Kostenstellenverwaltung ist auf dem Server noch nicht eingerichtet.';
  if (code === '42501') return 'Für unternehmensweite Kostenstellen fehlt Ihnen die Berechtigung.';
  if (code === '40001') return 'Die Kostenstelle wurde inzwischen geändert. Bitte neu laden und die Angaben vergleichen.';
  if (code === '23505') return 'Dieses Kostenstellenkürzel ist bereits vergeben.';
  if (['22023', '23514'].includes(code) && typeof item?.message === 'string') return item.message;
  return error instanceof Error ? error.message : 'Die Kostenstellen konnten nicht verarbeitet werden.';
}
export function validateCompanyCostCenter(input: CompanyCostCenterInput): string | null {
  if (!/^[A-Z0-9][A-Z0-9._/-]{0,39}$/.test(input.code.trim().toUpperCase())) return 'Bitte ein Kürzel mit höchstens 40 Buchstaben, Ziffern oder . _ / - eingeben.';
  if (!input.name.trim() || input.name.trim().length > 160) return 'Bitte eine Bezeichnung mit 1 bis 160 Zeichen eingeben.';
  if (typeof input.isActive !== 'boolean' || input.organizationId !== null && !UUID.test(input.organizationId)) return 'Bitte Status und Arbeitsbereich prüfen.';
  if (input.id && (!UUID.test(input.id) || !input.expectedUpdatedAt)) return 'Der vorherige Speicherstand fehlt. Bitte neu laden.';
  return null;
}
export async function loadCompanyCostCenters(scope: CompanyCostCenterScope): Promise<ServiceResult<CompanyCostCenterSnapshot>> {
  try {
    const client = connection(scope); const result: CompanyCostCenterSnapshot = { costCenters: [], organizations: [] };
    for (let offset = 0; ; offset += 200) {
      const response = await client.rpc('company_cost_centers_read' as never, { p_tenant_id: scope.tenantId, p_offset: offset } as never);
      if (response.error) throw response.error;
      const data = row(response.data); if (!data || !Array.isArray(data.costCenters) || !Array.isArray(data.organizations)) throw new Error('Die Kostenstellen konnten nicht vollständig gelesen werden.');
      result.costCenters.push(...data.costCenters.map(item => mapCost(item, scope.tenantId)));
      result.organizations.push(...data.organizations.map(item => { const value = row(item); if (!value || typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.code !== 'string' || typeof value.is_active !== 'boolean') throw new Error('Die Arbeitsbereiche konnten nicht gelesen werden.'); return { id: value.id, name: value.name, code: value.code, isActive: value.is_active }; }));
      if (data.costCenters.length < 200 && data.organizations.length < 200) return { ok: true, data: result };
    }
  } catch (error) { return { ok: false, error: errorText(error) }; }
}
export async function saveCompanyCostCenter(scope: CompanyCostCenterScope, input: CompanyCostCenterInput): Promise<ServiceResult<CompanyCostCenter> & { reloadRequired?: boolean }> {
  let attempted = false;
  try {
    const client = connection(scope); const invalid = validateCompanyCostCenter(input); if (invalid) return { ok: false, error: invalid };
    attempted = true;
    const result = await client.rpc('company_cost_center_save' as never, { p_tenant_id: scope.tenantId, p_id: input.id ?? null, p_expected_updated_at: input.expectedUpdatedAt ?? null, p_code: input.code.trim().toUpperCase(), p_name: input.name.trim(), p_organization_id: input.organizationId, p_is_active: input.isActive } as never);
    if (result.error) throw result.error;
    const saved = mapCost(result.data, scope.tenantId); if (input.id && saved.id !== input.id) throw new Error('Die gespeicherte Kostenstelle konnte nicht bestätigt werden.');
    return { ok: true, data: saved };
  } catch (error) { return { ok: false, error: errorText(error), reloadRequired: attempted }; }
}
