import type { RoleKey, ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { resolveAuthenticatedProfileId } from '@/lib/auth/resolveAuthenticatedProfile';
import { mapLegacyRoleKeyToRoleKey } from '@/lib/permissions/workspaceRoles';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

export type QmReadScope = Readonly<{
  tenantId: string;
  profileId: string;
  authUserId: string;
  roleKey: RoleKey;
  accessToken: string;
  expiresAt: number | null;
}>;
export type QmReadPermission = 'qm.view' | 'qm.view_versions';
const changed = 'Das angemeldete QM-Konto konnte nicht bestätigt werden. Bitte erneut anmelden.';

/** Uses the existing database role decision. It never grants access from a local admin label. */
export async function confirmQmReadScope(
  scope: QmReadScope,
  isCurrent: () => boolean,
  requiredPermissions: readonly QmReadPermission[] = ['qm.view'],
): Promise<ServiceResult<void>> {
  const required = [...new Set<QmReadPermission>(['qm.view', ...requiredPermissions])];
  if (required.some(permission => permission !== 'qm.view' && permission !== 'qm.view_versions')) {
    return { ok: false, error: 'Die angefragten QM-Leserechte sind ungültig.' };
  }
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Die Verbindung zum Qualitätsmanagement ist nicht verfügbar.' };
  const current = () => isCurrent() && (scope.expiresAt === null || scope.expiresAt > Date.now());
  const sessionMatches = async () => {
    if (!current()) return false;
    const result = await client.auth.getSession();
    const session = result.data.session;
    return current() && !result.error && session?.access_token === scope.accessToken && session.user.id === scope.authUserId;
  };
  try {
    if (!await sessionMatches()) return { ok: false, error: changed };
    const user = await client.auth.getUser(scope.accessToken);
    if (!current() || user.error || user.data.user?.id !== scope.authUserId || user.data.user.is_anonymous) {
      return { ok: false, error: changed };
    }
    const resolved = await resolveAuthenticatedProfileId(scope.tenantId);
    if (!current() || !resolved.ok || resolved.data !== scope.profileId) return { ok: false, error: changed };
    const profile = await fromUnknownTable(client, 'profiles')
      .select('id,tenant_id,auth_user_id,role_id,is_active,status,roles(id,key)')
      .eq('id', scope.profileId).eq('tenant_id', scope.tenantId).maybeSingle();
    const row = profile.data as {
      id?: string; tenant_id?: string; auth_user_id?: string | null; role_id?: string;
      is_active?: boolean; status?: string; roles?: { id?: string; key?: string } | null;
    } | null;
    if (!current() || profile.error || !row || row.id !== scope.profileId || row.tenant_id !== scope.tenantId
      || (row.id !== scope.authUserId && row.auth_user_id !== scope.authUserId)
      || row.is_active !== true || row.status !== 'active' || !row.role_id || row.roles?.id !== row.role_id
      || mapLegacyRoleKeyToRoleKey(row.roles?.key) !== scope.roleKey) return { ok: false, error: changed };

    // Respect a tenant-specific permission set as well as the authoritative database decision.
    const overrides = await fromUnknownTable(client, 'role_permission_sets').select('permission_key')
      .eq('tenant_id', scope.tenantId).eq('role_key', scope.roleKey);
    if (!current() || overrides.error || !Array.isArray(overrides.data)) {
      return { ok: false, error: 'Die aktuellen QM-Berechtigungen konnten nicht bestätigt werden.' };
    }
    if (overrides.data.length && !required.every(permission => overrides.data.some(item => item.permission_key === permission))) {
      return { ok: false, error: 'Für dieses Konto ist der QM-Lesezugriff nicht freigegeben.' };
    }
    for (const permission of required) {
      if (!current()) return { ok: false, error: changed };
      const decision = await client.rpc('has_role_permission', {
        input_permission_key: permission, input_product_key: 'office', input_action: 'view',
      });
      if (!current() || decision.error) return { ok: false, error: 'Die aktuellen QM-Berechtigungen konnten nicht bestätigt werden.' };
      if (decision.data !== true) return { ok: false, error: 'Für dieses Konto ist der QM-Lesezugriff nicht freigegeben.' };
    }
    if (!await sessionMatches()) return { ok: false, error: changed };
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: 'Die aktuellen QM-Berechtigungen konnten nicht bestätigt werden. Bitte erneut laden.' };
  }
}
