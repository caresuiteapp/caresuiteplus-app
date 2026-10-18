import type { RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import { enforcePermission } from '@/lib/permissions';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';

export type OfficeOwnIdentity = { employeeId: string | null };
type Input = { tenantId: string; userId: string; roleKey: RoleKey | null; effectivePermissions: readonly PermissionKey[] };

/** Resolve the signed-in Office profile, never a cached employee id or a portal account. */
export async function resolveOfficeOwnIdentity(input: Input): Promise<ServiceResult<OfficeOwnIdentity>> {
  if (!input.userId.trim() || !input.roleKey || isPortalOnlyRole(input.roleKey)) return { ok: false, error: 'Für die eigene Office-Erfassung ist ein angemeldeter Verwaltungszugang erforderlich.' };
  const denied = enforcePermission(input.roleKey, 'time.tracking.own.view', { effectivePermissions: input.effectivePermissions }) ?? guardServiceTenant(input.tenantId);
  if (denied) return denied;
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Keine sichere Datenbankverbindung.' };
  const auth = await client.auth.getUser();
  if (auth.error || auth.data.user?.id !== input.userId) return { ok: false, error: 'Die Anmeldung konnte nicht bestätigt werden. Bitte erneut anmelden.' };

  // These existing read-only RPCs derive their identity from auth.uid(). The
  // profile RPC handles profiles.id != profiles.auth_user_id correctly.
  const [tenant, employee] = await Promise.all([
    client.rpc('current_tenant_id'),
    client.rpc('current_employee_id_from_profile'),
  ]);
  if (tenant.error) return { ok: false, error: toGermanSupabaseError(tenant.error) };
  if (employee.error) return { ok: false, error: toGermanSupabaseError(employee.error) };
  if (tenant.data !== input.tenantId) return { ok: false, error: 'Die Mitarbeiterzuordnung gehört nicht zum geöffneten Unternehmen. Bitte die Anmeldung prüfen.' };
  // An Office administrator can legitimately have no personnel record.
  if (employee.data == null) return { ok: true, data: { employeeId: null } };
  if (typeof employee.data !== 'string' || !employee.data.trim()) return { ok: false, error: 'Die Mitarbeiterzuordnung konnte nicht eindeutig bestätigt werden.' };
  const employeeId = employee.data.trim();
  const { data, error } = await fromUnknownTable(client, 'employees').select('id,tenant_id,status,deleted_at')
    .eq('tenant_id', input.tenantId).eq('id', employeeId).maybeSingle();
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const row = data as Record<string, unknown> | null;
  if (!row || row.id !== employeeId || row.tenant_id !== input.tenantId) return { ok: false, error: 'Das zugeordnete Mitarbeiterprofil ist nicht verfügbar. Bitte die Zuordnung in der Personalverwaltung prüfen.' };
  const status = typeof row.status === 'string' ? row.status.trim().toLowerCase() : '';
  if (!status) return { ok: false, error: 'Der Status des zugeordneten Mitarbeiterprofils konnte nicht bestätigt werden.' };
  // Sickness/vacation describe absence, not a disabled login. Keep their
  // normal worktime rules; only explicit personnel disable states block here.
  if (row.deleted_at != null || ['inactive', 'terminated', 'blocked', 'deleted', 'archived', 'inaktiv', 'gesperrt', 'archiviert', 'gelöscht'].includes(status)) return { ok: false, error: 'Ihr zugeordnetes Mitarbeiterprofil ist deaktiviert oder gesperrt. Bitte die Personalverwaltung kontaktieren.' };
  return { ok: true, data: { employeeId } };
}
