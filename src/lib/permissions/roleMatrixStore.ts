import type { CanonicalWorkspaceRoleKey } from '@/types/permissions/workspace';
import type {
  PermissionAuditEvent,
  RoleAreaMatrix,
  TenantRoleMatrixEntry,
} from '@/types/permissions/roleMatrix';
import { WORKSPACE_ROLE_DEFINITIONS } from './workspaceRoles';
import { buildAllDefaultRoleMatrices, buildDefaultRoleMatrix } from './roleMatrixDefaults';

type TenantStore = {
  matrices: Map<CanonicalWorkspaceRoleKey, RoleAreaMatrix>;
  customRoles: Map<string, TenantRoleMatrixEntry>;
  auditEvents: PermissionAuditEvent[];
};

const TENANT_STORES = new Map<string, TenantStore>();

let auditCounter = 0;

function getStore(tenantId: string): TenantStore {
  let store = TENANT_STORES.get(tenantId);
  if (!store) {
    store = {
      matrices: new Map(
        Object.entries(buildAllDefaultRoleMatrices()) as [CanonicalWorkspaceRoleKey, RoleAreaMatrix][],
      ),
      customRoles: new Map(),
      auditEvents: [],
    };
    TENANT_STORES.set(tenantId, store);
  }
  return store;
}

export function resetRoleMatrixStore(tenantId?: string): void {
  if (tenantId) {
    TENANT_STORES.delete(tenantId);
    return;
  }
  TENANT_STORES.clear();
  auditCounter = 0;
}

export function getTenantRoleMatrix(
  tenantId: string,
  roleKey: CanonicalWorkspaceRoleKey,
): RoleAreaMatrix {
  const store = getStore(tenantId);
  return store.matrices.get(roleKey) ?? buildDefaultRoleMatrix(roleKey);
}

export function listTenantRoleMatrices(tenantId: string): TenantRoleMatrixEntry[] {
  const store = getStore(tenantId);
  return WORKSPACE_ROLE_DEFINITIONS.map((def) => {
    const custom = store.customRoles.get(def.canonicalKey);
    if (custom) return custom;
    return {
      tenantId,
      roleKey: def.canonicalKey,
      areaPermissions: store.matrices.get(def.canonicalKey) ?? buildDefaultRoleMatrix(def.canonicalKey),
      isCustomRole: false,
      isSystemRole: def.category === 'system',
      label: def.label,
      updatedAt: new Date().toISOString(),
    };
  });
}

export function setTenantRoleMatrix(
  tenantId: string,
  roleKey: CanonicalWorkspaceRoleKey,
  matrix: RoleAreaMatrix,
): void {
  const store = getStore(tenantId);
  store.matrices.set(roleKey, matrix);
}

export function restoreRoleMatrixDefaults(
  tenantId: string,
  roleKey: CanonicalWorkspaceRoleKey,
): RoleAreaMatrix {
  const defaults = buildDefaultRoleMatrix(roleKey);
  setTenantRoleMatrix(tenantId, roleKey, defaults);
  return defaults;
}

export function copyRoleMatrix(
  tenantId: string,
  sourceRoleKey: CanonicalWorkspaceRoleKey,
  targetRoleKey: CanonicalWorkspaceRoleKey,
): RoleAreaMatrix {
  const source = getTenantRoleMatrix(tenantId, sourceRoleKey);
  const copy = JSON.parse(JSON.stringify(source)) as RoleAreaMatrix;
  setTenantRoleMatrix(tenantId, targetRoleKey, copy);
  return copy;
}

export function appendPermissionAuditEvent(
  event: Omit<PermissionAuditEvent, 'id' | 'createdAt'>,
): PermissionAuditEvent {
  auditCounter += 1;
  const full: PermissionAuditEvent = {
    id: `perm-audit-${auditCounter}`,
    createdAt: new Date().toISOString(),
    ...event,
  };
  getStore(event.tenantId).auditEvents.push(full);
  return full;
}

export function listPermissionAuditEvents(tenantId: string): PermissionAuditEvent[] {
  return [...getStore(tenantId).auditEvents].reverse();
}

export function getAllTenantMatrices(tenantId: string): Record<CanonicalWorkspaceRoleKey, RoleAreaMatrix> {
  const store = getStore(tenantId);
  const result = {} as Record<CanonicalWorkspaceRoleKey, RoleAreaMatrix>;
  for (const def of WORKSPACE_ROLE_DEFINITIONS) {
    result[def.canonicalKey] = store.matrices.get(def.canonicalKey) ?? buildDefaultRoleMatrix(def.canonicalKey);
  }
  return result;
}

export function createCustomRoleEntry(
  tenantId: string,
  roleKey: CanonicalWorkspaceRoleKey,
  label: string,
  copiedFrom?: CanonicalWorkspaceRoleKey,
): TenantRoleMatrixEntry {
  const matrix = copiedFrom
    ? copyRoleMatrix(tenantId, copiedFrom, roleKey)
    : buildDefaultRoleMatrix(roleKey);
  const entry: TenantRoleMatrixEntry = {
    tenantId,
    roleKey,
    areaPermissions: matrix,
    isCustomRole: true,
    isSystemRole: false,
    label,
    copiedFromRoleKey: copiedFrom ?? null,
    updatedAt: new Date().toISOString(),
  };
  getStore(tenantId).customRoles.set(roleKey, entry);
  return entry;
}
