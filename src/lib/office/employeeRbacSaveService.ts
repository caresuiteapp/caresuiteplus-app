import type { PermissionKey, RoleKey, ServiceResult } from '@/types';
import type {
  EmployeeDataScope,
  EmployeePermissionOverride,
  PermissionCatalogEntry,
} from '@/types/permissions/rbac';
import { enforcePermission } from '@/lib/permissions/enforce';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  diffPermissionsToOverrides,
  validateCriticalChangeReason,
} from '@/lib/permissions/permissionChangeHelpers';
import {
  resolveEffectivePermissionsSync,
  resolveRoleBasePermissionsSync,
  saveEmployeeDataScopes,
  saveEmployeePermissionOverrides,
  writePermissionAuditLog,
} from '@/lib/permissions/rbacService';

export const DATA_SCOPE_TYPE_OPTIONS = [
  { key: 'tenant', label: 'Gesamter Mandant' },
  { key: 'team', label: 'Eigenes Team' },
  { key: 'location', label: 'Standort' },
  { key: 'own_only', label: 'Nur eigene Datensätze' },
] as const;

export type EmployeeRbacSavePatch = {
  roleKey: RoleKey;
  additionalRoleKeys?: RoleKey[];
  desiredPermissions?: PermissionKey[];
  overrides?: EmployeePermissionOverride[];
  dataScopes?: EmployeeDataScope[];
  changeReason?: string | null;
};

export async function saveEmployeeRbacState(
  tenantId: string,
  employeeId: string,
  patch: EmployeeRbacSavePatch,
  catalog: PermissionCatalogEntry[],
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): Promise<ServiceResult<void>> {
  const denied = enforcePermission(actorRoleKey, 'office.employees.edit');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const previousEffective = resolveEffectivePermissionsSync(
    tenantId,
    employeeId,
    patch.roleKey,
    patch.additionalRoleKeys ?? [],
  );

  if (patch.desiredPermissions) {
    const roleBase = resolveRoleBasePermissionsSync(
      tenantId,
      employeeId,
      patch.roleKey,
      patch.additionalRoleKeys ?? [],
    );

    const reasonError = validateCriticalChangeReason(
      catalog,
      previousEffective.permissions,
      patch.desiredPermissions,
      patch.changeReason,
    );
    if (reasonError) {
      return { ok: false, error: reasonError };
    }

    const overrideDrafts = diffPermissionsToOverrides(roleBase, patch.desiredPermissions);
    const overrides: EmployeePermissionOverride[] = overrideDrafts.map((draft, index) => ({
      id: `override-${employeeId}-${draft.permissionKey}-${index}`,
      tenantId,
      employeeId,
      permissionKey: draft.permissionKey,
      allowed: draft.allowed,
      reason: patch.changeReason ?? null,
      validFrom: null,
      validUntil: null,
      createdBy: actorProfileId ?? null,
    }));

    const savedOverrides = await saveEmployeePermissionOverrides({
      tenantId,
      employeeId,
      overrides,
      actorId: actorProfileId ?? null,
      actorRole: actorRoleKey ?? null,
      reason: patch.changeReason ?? null,
    });
    if (!savedOverrides.ok) return savedOverrides;
  } else if (patch.overrides) {
    const savedOverrides = await saveEmployeePermissionOverrides({
      tenantId,
      employeeId,
      overrides: patch.overrides,
      actorId: actorProfileId ?? null,
      actorRole: actorRoleKey ?? null,
      reason: patch.changeReason ?? null,
    });
    if (!savedOverrides.ok) return savedOverrides;
  }

  if (patch.dataScopes) {
    const savedScopes = await saveEmployeeDataScopes({
      tenantId,
      employeeId,
      scopes: patch.dataScopes,
      actorId: actorProfileId ?? null,
      actorRole: actorRoleKey ?? null,
      reason: patch.changeReason ?? null,
    });
    if (!savedScopes.ok) return savedScopes;
  }

  const nextEffective = resolveEffectivePermissionsSync(
    tenantId,
    employeeId,
    patch.roleKey,
    patch.additionalRoleKeys ?? [],
  );

  await writePermissionAuditLog({
    tenantId,
    actorId: actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    targetEmployeeId: employeeId,
    targetRoleTemplateId: null,
    action: 'employee_rbac_saved',
    oldValue: {
      permissions: previousEffective.permissions,
      overrides: previousEffective.overrides,
      scopes: previousEffective.scopes,
    },
    newValue: {
      roleKey: patch.roleKey,
      additionalRoleKeys: patch.additionalRoleKeys,
      permissions: nextEffective.permissions,
      overrides: nextEffective.overrides,
      scopes: nextEffective.scopes,
    },
    reason: patch.changeReason ?? null,
    ipAddress: null,
  });

  return { ok: true, data: undefined };
}
