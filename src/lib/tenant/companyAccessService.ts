import type { ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CompanyAccess, CompanyAccessProfile, CompanyScopeGrant, CompanyScopeSaveInput, CompanyScopeSaveReceipt, CompanyScopeSnapshot } from '@/types/tenant/companyAccess';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PERMISSIONS = new Set<PermissionKey>(['business.tenant.manage', 'inventory.view', 'inventory.manage_items', 'inventory.issue', 'inventory.return_manage', 'inventory.report_damage', 'inventory.offboarding', 'inventory.audit_view', 'office.employees.view', 'office.employees.edit', 'office.documents.view']);
const row = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const grant = (value: unknown): value is CompanyScopeGrant => {
  const item = row(value);
  return Boolean(item && ['entity', 'site', 'department'].includes(String(item.kind)) && UUID.test(String(item.targetId)));
};
function connection(tenantId: string): SupabaseClient {
  const block = guardServiceTenant(tenantId);
  if (block) throw new Error(block.error);
  if (!UUID.test(tenantId)) throw new Error('Das Unternehmen konnte nicht eindeutig zugeordnet werden.');
  if (getServiceMode() !== 'supabase') throw new Error('Die Zugriffsprüfung benötigt eine aktive Datenbankverbindung.');
  const client = getSupabaseClient();
  if (!client) throw new Error('Die Datenbankverbindung ist nicht verfügbar.');
  return client as unknown as SupabaseClient;
}
function failure<T>(error: unknown, saving = false): ServiceResult<T> {
  const code = String(row(error)?.code ?? '');
  if (['42883', '42P01', 'PGRST202', 'PGRST205'].includes(code)) return { ok: false, error: 'Die Zugriffsverwaltung ist auf dem Server noch nicht eingerichtet.' };
  if (code === '42501') return { ok: false, error: 'Für diese Zugriffsverwaltung fehlt Ihnen die Berechtigung.' };
  if (code === '40001') return { ok: false, error: 'Die Zugriffsrechte wurden inzwischen geändert. Bitte neu laden und die Angaben vergleichen.' };
  const message = error instanceof Error ? error.message : typeof row(error)?.message === 'string' && ['22023', '23514'].includes(code) ? String(row(error)?.message) : 'Die Zugriffsrechte konnten nicht geprüft werden.';
  return { ok: false, error: saving ? `${message} Bitte neu laden und den Speicherstand prüfen, bevor Sie den Vorgang wiederholen.` : message };
}
export async function loadCompanyAccess(tenantId: string): Promise<ServiceResult<CompanyAccess>> {
  try {
    const { data, error } = await connection(tenantId).rpc('company_access_permissions', { p_tenant_id: tenantId });
    if (error) throw error;
    const value = row(data);
    if (!value || !Array.isArray(value.permissions) || value.permissions.some(permission => !PERMISSIONS.has(permission)) || typeof value.scopeLimited !== 'boolean' || typeof value.canManageScopes !== 'boolean') throw new Error('Die Zugriffsprüfung hat keine gültige Antwort geliefert.');
    return { ok: true, data: { permissions: [...new Set(value.permissions)] as PermissionKey[], scopeLimited: value.scopeLimited, canManageScopes: value.canManageScopes } };
  } catch (error) { return failure(error); }
}
export async function loadCompanyScopeGrants(tenantId: string): Promise<ServiceResult<CompanyScopeSnapshot>> {
  try {
    const { data, error } = await connection(tenantId).rpc('company_scope_people', { p_tenant_id: tenantId });
    if (error) throw error;
    const value = row(data);
    if (!value || !Array.isArray(value.profiles) || value.profiles.some(item => {
      const profile = row(item);
      return !profile || !UUID.test(String(profile.id)) || typeof profile.displayName !== 'string' || typeof profile.roleKey !== 'string'
        || typeof profile.scopeLimited !== 'boolean' || typeof profile.hasLegacyLimits !== 'boolean' || typeof profile.isCurrentProfile !== 'boolean'
        || !Number.isInteger(profile.version) || Number(profile.version) < 0 || !Array.isArray(profile.grants) || !profile.grants.every(grant);
    })) throw new Error('Die gespeicherten Zugriffsbereiche konnten nicht vollständig gelesen werden.');
    return { ok: true, data: { profiles: value.profiles as CompanyAccessProfile[] } };
  } catch (error) { return failure(error); }
}
const inFlight = new Set<string>();
export async function saveCompanyScopeGrant(tenantId: string, input: CompanyScopeSaveInput): Promise<ServiceResult<CompanyScopeSaveReceipt>> {
  const lock = `${tenantId}:${input.profileId}`;
  if (inFlight.has(lock)) return { ok: false, error: 'Diese Zugriffsrechte werden bereits gespeichert.' };
  inFlight.add(lock);
  let attempted = false;
  try {
    const client = connection(tenantId);
    if (!UUID.test(input.profileId) || typeof input.limited !== 'boolean' || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 0
      || !Array.isArray(input.grants) || input.grants.length > 100 || !input.grants.every(grant)
      || (!input.limited && input.grants.length > 0) || new Set(input.grants.map(item => `${item.kind}:${item.targetId}`)).size !== input.grants.length) throw new Error('Bitte die Zugriffsbereiche vollständig und ohne doppelte Einträge auswählen.');
    attempted = true;
    const { data, error } = await client.rpc('company_scope_save', { p_tenant_id: tenantId, p_profile_id: input.profileId, p_scope_limited: input.limited, p_grants: input.grants, p_expected_version: input.expectedVersion });
    if (error) throw error;
    const value = row(data);
    if (!value || value.profileId !== input.profileId || value.scopeLimited !== input.limited || value.version !== input.expectedVersion + 1) throw new Error('Der Speicherstand konnte nicht bestätigt werden.');
    return { ok: true, data: value as CompanyScopeSaveReceipt };
  } catch (error) { return failure(error, attempted); }
  finally { inFlight.delete(lock); }
}
