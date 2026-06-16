import type { RoleKey, ServiceResult } from '@/types';
import type { CanonicalWorkspaceRoleKey } from '@/types/permissions/workspace';
import type {
  PermissionAreaKey,
  PermissionAuditEvent,
  PermissionMatrixPreview,
  RoleAreaMatrix,
  SaveRoleMatrixInput,
  TenantRoleMatrixEntry,
} from '@/types/permissions/roleMatrix';
import { PERMISSION_AREAS, PERMISSION_ACTIONS } from '@/types/permissions/roleMatrix';
import { enforcePermission } from './enforce';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';
import { WORKSPACE_ROLE_DEFINITIONS } from './workspaceRoles';
import {
  buildDefaultRoleMatrix,
  diffMatrices,
  hasBillingAdminAccess,
  hasHealthDataAccess,
} from './roleMatrixDefaults';
import {
  portalAreaWithoutTenant,
  validateRoleMatrixChange,
} from './roleMatrixProtection';
import {
  appendPermissionAuditEvent,
  copyRoleMatrix,
  createCustomRoleEntry,
  getAllTenantMatrices,
  getTenantRoleMatrix,
  listPermissionAuditEvents,
  listTenantRoleMatrices,
  restoreRoleMatrixDefaults,
  setTenantRoleMatrix,
} from './roleMatrixStore';

async function matrixDemoDelay(ms = 120): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchRoleMatrixOverview(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantRoleMatrixEntry[]>> {
  const denied = enforcePermission<TenantRoleMatrixEntry[]>(actorRoleKey, 'business.modules.manage');
  if (denied) return denied;
  const block = guardLiveDemoFeature<TenantRoleMatrixEntry[]>(tenantId, 'Rollenmatrix');
  if (block) return block;
  await matrixDemoDelay();
  return { ok: true, data: listTenantRoleMatrices(tenantId) };
}

export async function fetchRoleMatrixForRole(
  tenantId: string,
  roleKey: CanonicalWorkspaceRoleKey,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantRoleMatrixEntry>> {
  const denied = enforcePermission<TenantRoleMatrixEntry>(actorRoleKey, 'business.modules.manage');
  if (denied) return denied;
  const block = guardLiveDemoFeature<TenantRoleMatrixEntry>(tenantId, 'Rollenmatrix');
  if (block) return block;
  await matrixDemoDelay();
  const entry = listTenantRoleMatrices(tenantId).find((r) => r.roleKey === roleKey);
  if (!entry) return { ok: false, error: 'Rolle nicht gefunden.' };
  return { ok: true, data: entry };
}

export function previewRoleMatrixChange(
  tenantId: string,
  roleKey: CanonicalWorkspaceRoleKey,
  nextMatrix: RoleAreaMatrix,
): PermissionMatrixPreview {
  const current = getTenantRoleMatrix(tenantId, roleKey);
  const changes = diffMatrices(current, nextMatrix);
  const grantedAreas = [...new Set(changes.filter((c) => c.to).map((c) => c.area))];
  const revokedAreas = [...new Set(changes.filter((c) => !c.to && c.from).map((c) => c.area))];
  const warnings: string[] = [];

  if (hasHealthDataAccess(nextMatrix) && !hasHealthDataAccess(current)) {
    warnings.push('Gesundheitsdaten-Zugriff wird neu freigegeben.');
  }
  if (hasBillingAdminAccess(nextMatrix) && !hasBillingAdminAccess(current)) {
    warnings.push('Abrechnungs-Administration wird erweitert.');
  }
  const portalErr = portalAreaWithoutTenant(nextMatrix, tenantId);
  if (portalErr) warnings.push(portalErr);

  return {
    roleKey,
    grantedAreas,
    revokedAreas,
    warnings,
    requiresHealthDataConfirm: hasHealthDataAccess(nextMatrix) && !hasHealthDataAccess(current),
    requiresBillingConfirm: hasBillingAdminAccess(nextMatrix) && !hasBillingAdminAccess(current),
  };
}

export async function saveRoleMatrix(
  input: SaveRoleMatrixInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantRoleMatrixEntry>> {
  const denied = enforcePermission<TenantRoleMatrixEntry>(actorRoleKey, 'business.modules.manage');
  if (denied) return denied;
  const block = guardLiveDemoFeature<TenantRoleMatrixEntry>(input.tenantId, 'Rollenmatrix');
  if (block) return block;

  const portalErr = portalAreaWithoutTenant(input.areaPermissions, input.tenantId);
  if (portalErr) return { ok: false, error: portalErr };

  const validation = validateRoleMatrixChange(
    input,
    getAllTenantMatrices(input.tenantId),
    input.actorRoleKey ?? undefined,
  );
  if (!validation.ok) {
    return {
      ok: false,
      error: [...validation.errors, ...validation.warnings].join(' '),
    };
  }

  const current = getTenantRoleMatrix(input.tenantId, input.roleKey);
  const changes = diffMatrices(current, input.areaPermissions);
  setTenantRoleMatrix(input.tenantId, input.roleKey, input.areaPermissions);

  for (const change of changes) {
    appendPermissionAuditEvent({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId ?? null,
      actorRoleKey: input.actorRoleKey ?? actorRoleKey ?? null,
      targetRoleKey: input.roleKey,
      action: 'update',
      areaKey: change.area,
      permissionAction: change.action,
      previousValue: change.from,
      newValue: change.to,
      summary: `${input.roleKey}: ${change.area}.${change.action} ${change.from ? 'entzogen' : 'gewährt'}`,
    });
  }

  await matrixDemoDelay();
  const entry = listTenantRoleMatrices(input.tenantId).find((r) => r.roleKey === input.roleKey);
  return entry ? { ok: true, data: entry } : { ok: false, error: 'Speichern fehlgeschlagen.' };
}

export async function restoreRoleDefaults(
  tenantId: string,
  roleKey: CanonicalWorkspaceRoleKey,
  actorUserId?: string | null,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantRoleMatrixEntry>> {
  const denied = enforcePermission<TenantRoleMatrixEntry>(actorRoleKey, 'business.modules.manage');
  if (denied) return denied;
  const block = guardLiveDemoFeature<TenantRoleMatrixEntry>(tenantId, 'Rollenmatrix');
  if (block) return block;

  restoreRoleMatrixDefaults(tenantId, roleKey);
  appendPermissionAuditEvent({
    tenantId,
    actorUserId: actorUserId ?? null,
    actorRoleKey: actorRoleKey ?? null,
    targetRoleKey: roleKey,
    action: 'restore_defaults',
    summary: `Standardrechte für ${roleKey} wiederhergestellt`,
  });

  await matrixDemoDelay();
  const entry = listTenantRoleMatrices(tenantId).find((r) => r.roleKey === roleKey);
  return entry ? { ok: true, data: entry } : { ok: false, error: 'Wiederherstellung fehlgeschlagen.' };
}

export async function copyRolePermissions(
  tenantId: string,
  sourceRoleKey: CanonicalWorkspaceRoleKey,
  targetRoleKey: CanonicalWorkspaceRoleKey,
  actorUserId?: string | null,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantRoleMatrixEntry>> {
  const denied = enforcePermission<TenantRoleMatrixEntry>(actorRoleKey, 'business.modules.manage');
  if (denied) return denied;
  const block = guardLiveDemoFeature<TenantRoleMatrixEntry>(tenantId, 'Rollenmatrix');
  if (block) return block;

  copyRoleMatrix(tenantId, sourceRoleKey, targetRoleKey);
  appendPermissionAuditEvent({
    tenantId,
    actorUserId: actorUserId ?? null,
    actorRoleKey: actorRoleKey ?? null,
    targetRoleKey: targetRoleKey,
    action: 'copy',
    summary: `Rechte von ${sourceRoleKey} nach ${targetRoleKey} kopiert`,
  });

  await matrixDemoDelay();
  const entry = listTenantRoleMatrices(tenantId).find((r) => r.roleKey === targetRoleKey);
  return entry ? { ok: true, data: entry } : { ok: false, error: 'Kopieren fehlgeschlagen.' };
}

export async function fetchPermissionAuditHistory(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<PermissionAuditEvent[]>> {
  const denied = enforcePermission<PermissionAuditEvent[]>(actorRoleKey, 'business.modules.manage');
  if (denied) return denied;
  const block = guardLiveDemoFeature<PermissionAuditEvent[]>(tenantId, 'Rollenmatrix-Audit');
  if (block) return block;
  await matrixDemoDelay();
  return { ok: true, data: listPermissionAuditEvents(tenantId) };
}

export function getPermissionAreaLabel(area: PermissionAreaKey): string {
  return PERMISSION_AREAS.find((a) => a.key === area)?.label ?? area;
}

export function listSystemRoles(): { key: CanonicalWorkspaceRoleKey; label: string }[] {
  return WORKSPACE_ROLE_DEFINITIONS.map((r) => ({ key: r.canonicalKey, label: r.label }));
}

export function getEffectivePermissionsForRole(
  tenantId: string,
  roleKey: CanonicalWorkspaceRoleKey,
): RoleAreaMatrix {
  return getTenantRoleMatrix(tenantId, roleKey);
}

export async function createCustomRoleWithPermissions(
  tenantId: string,
  roleKey: CanonicalWorkspaceRoleKey,
  label: string,
  copiedFrom?: CanonicalWorkspaceRoleKey,
  actorUserId?: string | null,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantRoleMatrixEntry>> {
  const denied = enforcePermission<TenantRoleMatrixEntry>(actorRoleKey, 'business.modules.manage');
  if (denied) return denied;
  const block = guardLiveDemoFeature<TenantRoleMatrixEntry>(tenantId, 'Rollenmatrix');
  if (block) return block;

  const entry = createCustomRoleEntry(tenantId, roleKey, label, copiedFrom);
  appendPermissionAuditEvent({
    tenantId,
    actorUserId: actorUserId ?? null,
    actorRoleKey: actorRoleKey ?? null,
    targetRoleKey: roleKey,
    action: 'create_custom',
    summary: `Benutzerdefinierte Rolle "${label}" angelegt`,
  });

  await matrixDemoDelay();
  return { ok: true, data: entry };
}

export { buildDefaultRoleMatrix, PERMISSION_AREAS, PERMISSION_ACTIONS };
