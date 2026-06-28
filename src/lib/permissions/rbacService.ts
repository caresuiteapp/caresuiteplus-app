import type { PermissionKey, RoleKey, ServiceResult } from '@/types';
import type {
  EmployeeDataScope,
  EmployeePermissionOverride,
  EmployeeRoleAssignment,
  EffectivePermissionSet,
  PermissionAuditLogEntry,
  RoleTemplate,
} from '@/types/permissions/rbac';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import {
  isSupabaseMissingTableError,
  isSupabaseRlsError,
  isSupabaseSchemaMismatchError,
  toGermanSupabaseError,
} from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { getPermissionsForRole, ROLE_PERMISSIONS } from './staticRolePermissions';
import { buildSystemRoleTemplateSeeds } from './permissionCatalogSeedData';

type RbacEmployeeState = {
  assignments: EmployeeRoleAssignment[];
  overrides: EmployeePermissionOverride[];
  scopes: EmployeeDataScope[];
};

const employeeRbacStore = new Map<string, RbacEmployeeState>();
const roleTemplateStore = new Map<string, RoleTemplate>();
const roleTemplatePermissionStore = new Map<string, Set<PermissionKey>>();
const auditLogStore: PermissionAuditLogEntry[] = [];

function employeeStoreKey(tenantId: string, employeeId: string): string {
  return `${tenantId}:${employeeId}`;
}

function initDemoRoleTemplates(): void {
  if (roleTemplateStore.size > 0) return;
  for (const seed of buildSystemRoleTemplateSeeds()) {
    const id = `rt-${seed.roleKey}`;
    roleTemplateStore.set(id, {
      id,
      tenantId: null,
      roleKey: seed.roleKey,
      name: seed.name,
      description: null,
      level: seed.level,
      isSystemRole: true,
      isEditable: false,
    });
    roleTemplatePermissionStore.set(id, new Set(seed.permissions));
  }
}

export function resetRbacDemoStore(): void {
  employeeRbacStore.clear();
  roleTemplateStore.clear();
  roleTemplatePermissionStore.clear();
  auditLogStore.length = 0;
}

function isOverrideActive(override: EmployeePermissionOverride, at = new Date()): boolean {
  if (override.validFrom && new Date(override.validFrom) > at) return false;
  if (override.validUntil && new Date(override.validUntil) < at) return false;
  return true;
}

function permissionsForRoleKey(roleKey: RoleKey): PermissionKey[] {
  return [...getPermissionsForRole(roleKey)];
}

function permissionsForTemplateId(templateId: string): PermissionKey[] {
  const perms = roleTemplatePermissionStore.get(templateId);
  if (perms) return [...perms];
  const template = roleTemplateStore.get(templateId);
  if (template?.roleKey && ROLE_PERMISSIONS[template.roleKey as RoleKey]) {
    return permissionsForRoleKey(template.roleKey as RoleKey);
  }
  return [];
}

export function mergeEffectivePermissions(
  roleKeys: RoleKey[],
  templateIds: string[],
  overrides: EmployeePermissionOverride[],
  scopes: EmployeeDataScope[],
  employeeId: string,
  tenantId: string,
  primaryRoleKey: RoleKey | null,
): EffectivePermissionSet {
  const permissionSet = new Set<PermissionKey>();
  const sources: EffectivePermissionSet['sources'] = {};

  for (const templateId of templateIds) {
    for (const perm of permissionsForTemplateId(templateId)) {
      permissionSet.add(perm);
      sources[perm] = 'role';
    }
  }

  for (const roleKey of roleKeys) {
    for (const perm of permissionsForRoleKey(roleKey)) {
      permissionSet.add(perm);
      sources[perm] = 'role';
    }
  }

  for (const override of overrides) {
    if (!isOverrideActive(override)) continue;
    if (override.allowed) {
      permissionSet.add(override.permissionKey);
      sources[override.permissionKey] = 'override_grant';
    } else {
      permissionSet.delete(override.permissionKey);
      sources[override.permissionKey] = 'override_deny';
    }
  }

  return {
    employeeId,
    tenantId,
    primaryRoleKey,
    roleKeys: [...new Set(roleKeys)],
    roleTemplateIds: [...new Set(templateIds)],
    permissions: [...permissionSet].sort(),
    overrides,
    scopes,
    sources,
  };
}

export function getEmployeeRbacStateSync(
  tenantId: string,
  employeeId: string,
): RbacEmployeeState {
  return (
    employeeRbacStore.get(employeeStoreKey(tenantId, employeeId)) ?? {
      assignments: [],
      overrides: [],
      scopes: [],
    }
  );
}

export function resolveRoleBasePermissionsSync(
  tenantId: string,
  employeeId: string,
  primaryRoleKey: RoleKey | null,
  additionalRoleKeys: RoleKey[] = [],
): PermissionKey[] {
  initDemoRoleTemplates();

  const state = getEmployeeRbacStateSync(tenantId, employeeId);
  const assignments = state.assignments;

  const roleKeysFromAssignments = assignments
    .map((a) => a.roleKey)
    .filter((k): k is RoleKey => k != null);
  const templateIds = assignments
    .map((a) => a.roleTemplateId)
    .filter((id): id is string => id != null);

  const allRoleKeys = [
    ...(primaryRoleKey ? [primaryRoleKey] : []),
    ...additionalRoleKeys,
    ...roleKeysFromAssignments,
  ];

  const primary = assignments.find((a) => a.isPrimary)?.roleKey ?? primaryRoleKey;

  return mergeEffectivePermissions(
    allRoleKeys,
    templateIds,
    [],
    [],
    employeeId,
    tenantId,
    primary,
  ).permissions;
}

export function resolveEffectivePermissionsSync(
  tenantId: string,
  employeeId: string,
  primaryRoleKey: RoleKey | null,
  additionalRoleKeys: RoleKey[] = [],
): EffectivePermissionSet {
  initDemoRoleTemplates();

  const state = getEmployeeRbacStateSync(tenantId, employeeId);
  const assignments = state.assignments;
  const overrides = state.overrides;
  const scopes = state.scopes;

  const roleKeysFromAssignments = assignments
    .map((a) => a.roleKey)
    .filter((k): k is RoleKey => k != null);
  const templateIds = assignments
    .map((a) => a.roleTemplateId)
    .filter((id): id is string => id != null);

  const allRoleKeys = [
    ...(primaryRoleKey ? [primaryRoleKey] : []),
    ...additionalRoleKeys,
    ...roleKeysFromAssignments,
  ];

  const primary = assignments.find((a) => a.isPrimary)?.roleKey ?? primaryRoleKey;

  return mergeEffectivePermissions(
    allRoleKeys,
    templateIds,
    overrides,
    scopes,
    employeeId,
    tenantId,
    primary,
  );
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidRbacContext(tenantId: string, employeeId: string): boolean {
  return UUID_PATTERN.test(tenantId) && UUID_PATTERN.test(employeeId);
}

function shouldUseSyncRbacFallback(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    isSupabaseMissingTableError(error) ||
    isSupabaseRlsError(error) ||
    isSupabaseSchemaMismatchError(error)
  );
}

function syncEffectivePermissionsFallback(
  tenantId: string,
  employeeId: string,
  primaryRoleKey: RoleKey | null,
  additionalRoleKeys: RoleKey[],
): ServiceResult<EffectivePermissionSet> {
  return {
    ok: true,
    data: resolveEffectivePermissionsSync(tenantId, employeeId, primaryRoleKey, additionalRoleKeys),
  };
}

export async function resolveEffectivePermissions(
  tenantId: string,
  employeeId: string,
  primaryRoleKey: RoleKey | null,
  additionalRoleKeys: RoleKey[] = [],
): Promise<ServiceResult<EffectivePermissionSet>> {
  if (getServiceMode() !== 'supabase') {
    return syncEffectivePermissionsFallback(tenantId, employeeId, primaryRoleKey, additionalRoleKeys);
  }

  if (!isValidRbacContext(tenantId, employeeId)) {
    return syncEffectivePermissionsFallback(tenantId, employeeId, primaryRoleKey, additionalRoleKeys);
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  }

  const assignmentsResult = await fromUnknownTable(supabase, 'employee_role_assignments')
    .select('id, tenant_id, employee_id, role_template_id, role_key, is_primary, assigned_by, assigned_at')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId);

  if (assignmentsResult.error && shouldUseSyncRbacFallback(assignmentsResult.error)) {
    return syncEffectivePermissionsFallback(tenantId, employeeId, primaryRoleKey, additionalRoleKeys);
  }

  if (assignmentsResult.error) {
    return { ok: false, error: toGermanSupabaseError(assignmentsResult.error) };
  }

  const overridesResult = await fromUnknownTable(supabase, 'employee_permission_overrides')
    .select(
      'id, tenant_id, employee_id, permission_key, allowed, reason, valid_from, valid_until, created_by',
    )
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId);

  if (overridesResult.error && shouldUseSyncRbacFallback(overridesResult.error)) {
    return syncEffectivePermissionsFallback(tenantId, employeeId, primaryRoleKey, additionalRoleKeys);
  }

  if (overridesResult.error) {
    return { ok: false, error: toGermanSupabaseError(overridesResult.error) };
  }

  const scopesResult = await fromUnknownTable(supabase, 'employee_data_scopes')
    .select('id, tenant_id, employee_id, module, scope_type, scope_value')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId);

  if (scopesResult.error && shouldUseSyncRbacFallback(scopesResult.error)) {
    return syncEffectivePermissionsFallback(tenantId, employeeId, primaryRoleKey, additionalRoleKeys);
  }

  if (scopesResult.error) {
    return { ok: false, error: toGermanSupabaseError(scopesResult.error) };
  }

  const assignments: EmployeeRoleAssignment[] = (assignmentsResult.data ?? []).map((row) => ({
    id: row.id as string,
    tenantId: row.tenant_id as string,
    employeeId: row.employee_id as string,
    roleTemplateId: (row.role_template_id as string | null) ?? null,
    roleKey: (row.role_key as RoleKey | null) ?? null,
    isPrimary: Boolean(row.is_primary),
    assignedBy: (row.assigned_by as string | null) ?? null,
    assignedAt: row.assigned_at as string,
  }));

  const overrides: EmployeePermissionOverride[] = (overridesResult.data ?? []).map((row) => ({
    id: row.id as string,
    tenantId: row.tenant_id as string,
    employeeId: row.employee_id as string,
    permissionKey: row.permission_key as PermissionKey,
    allowed: Boolean(row.allowed),
    reason: (row.reason as string | null) ?? null,
    validFrom: (row.valid_from as string | null) ?? null,
    validUntil: (row.valid_until as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
  }));

  const scopes: EmployeeDataScope[] = (scopesResult.data ?? []).map((row) => ({
    id: row.id as string,
    tenantId: row.tenant_id as string,
    employeeId: row.employee_id as string,
    module: row.module as string,
    scopeType: row.scope_type as string,
    scopeValue: (row.scope_value as string | null) ?? null,
  }));

  const roleKeysFromAssignments = assignments
    .map((a) => a.roleKey)
    .filter((k): k is RoleKey => k != null);
  const templateIds = assignments
    .map((a) => a.roleTemplateId)
    .filter((id): id is string => id != null);

  const allRoleKeys = [
    ...(primaryRoleKey ? [primaryRoleKey] : []),
    ...additionalRoleKeys,
    ...roleKeysFromAssignments,
  ];

  const primary =
    assignments.find((a) => a.isPrimary)?.roleKey ??
    primaryRoleKey;

  let templatePermissions: PermissionKey[] = [];
  if (templateIds.length > 0) {
    const permsResult = await fromUnknownTable(supabase, 'role_template_permissions')
      .select('permission_key, role_template_id, allowed')
      .in('role_template_id', templateIds);

    if (!permsResult.error && permsResult.data) {
      templatePermissions = permsResult.data
        .filter((row) => Boolean(row.allowed))
        .map((row) => row.permission_key as PermissionKey);
    }
  }

  const effective = mergeEffectivePermissions(
    allRoleKeys,
    templateIds,
    overrides,
    scopes,
    employeeId,
    tenantId,
    primary,
  );

  if (templatePermissions.length > 0) {
    const merged = new Set(effective.permissions);
    for (const perm of templatePermissions) merged.add(perm);
    effective.permissions = [...merged].sort();
  }

  persistEmployeeRbacState(tenantId, employeeId, { assignments, overrides, scopes });

  return { ok: true, data: effective };
}

export function hasEffectivePermission(
  effective: EffectivePermissionSet,
  permission: PermissionKey,
): boolean {
  return effective.permissions.includes(permission);
}

export async function setEmployeeRoleAssignments(
  tenantId: string,
  employeeId: string,
  roleKeys: RoleKey[],
  primaryRoleKey: RoleKey,
): Promise<ServiceResult<EmployeeRoleAssignment[]>> {
  initDemoRoleTemplates();

  const assignments: EmployeeRoleAssignment[] = roleKeys.map((roleKey, index) => {
    const template = [...roleTemplateStore.values()].find(
      (t) => t.roleKey === roleKey && t.tenantId === null,
    );
    return {
      id: `era-${employeeId}-${roleKey}-${index}`,
      tenantId,
      employeeId,
      roleTemplateId: template?.id ?? null,
      roleKey,
      isPrimary: roleKey === primaryRoleKey,
      assignedBy: null,
      assignedAt: new Date().toISOString(),
    };
  });

  if (getServiceMode() !== 'supabase') {
    employeeRbacStore.set(employeeStoreKey(tenantId, employeeId), {
      assignments,
      overrides: employeeRbacStore.get(employeeStoreKey(tenantId, employeeId))?.overrides ?? [],
      scopes: employeeRbacStore.get(employeeStoreKey(tenantId, employeeId))?.scopes ?? [],
    });
    return { ok: true, data: assignments };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  }

  const { error: deleteError } = await fromUnknownTable(supabase, 'employee_role_assignments')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId);

  if (deleteError && !isSupabaseMissingTableError(deleteError)) {
    return { ok: false, error: toGermanSupabaseError(deleteError) };
  }

  if (isSupabaseMissingTableError(deleteError)) {
    employeeRbacStore.set(employeeStoreKey(tenantId, employeeId), {
      assignments,
      overrides: [],
      scopes: [],
    });
    return { ok: true, data: assignments };
  }

  const rows = assignments.map((a) => ({
    tenant_id: tenantId,
    employee_id: employeeId,
    role_template_id: a.roleTemplateId,
    role_key: a.roleKey,
    is_primary: a.isPrimary,
    assigned_at: a.assignedAt,
  }));

  const { data, error } = await fromUnknownTable(supabase, 'employee_role_assignments')
    .insert(rows)
    .select('id, tenant_id, employee_id, role_template_id, role_key, is_primary, assigned_by, assigned_at');

  if (error) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      id: row.id as string,
      tenantId: row.tenant_id as string,
      employeeId: row.employee_id as string,
      roleTemplateId: (row.role_template_id as string | null) ?? null,
      roleKey: (row.role_key as RoleKey | null) ?? null,
      isPrimary: Boolean(row.is_primary),
      assignedBy: (row.assigned_by as string | null) ?? null,
      assignedAt: row.assigned_at as string,
    })),
  };
}

function persistEmployeeRbacState(
  tenantId: string,
  employeeId: string,
  patch: Partial<RbacEmployeeState>,
): RbacEmployeeState {
  const key = employeeStoreKey(tenantId, employeeId);
  const current = getEmployeeRbacStateSync(tenantId, employeeId);
  const next = { ...current, ...patch };
  employeeRbacStore.set(key, next);
  return next;
}

export async function fetchEmployeePermissionOverrides(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<EmployeePermissionOverride[]>> {
  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: getEmployeeRbacStateSync(tenantId, employeeId).overrides };
  }

  if (!isValidRbacContext(tenantId, employeeId)) {
    return { ok: true, data: getEmployeeRbacStateSync(tenantId, employeeId).overrides };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  }

  const { data, error } = await fromUnknownTable(supabase, 'employee_permission_overrides')
    .select(
      'id, tenant_id, employee_id, permission_key, allowed, reason, valid_from, valid_until, created_by',
    )
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId);

  if (error) {
    if (shouldUseSyncRbacFallback(error)) {
      return { ok: true, data: getEmployeeRbacStateSync(tenantId, employeeId).overrides };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  const overrides: EmployeePermissionOverride[] = (data ?? []).map((row) => ({
    id: row.id as string,
    tenantId: row.tenant_id as string,
    employeeId: row.employee_id as string,
    permissionKey: row.permission_key as PermissionKey,
    allowed: Boolean(row.allowed),
    reason: (row.reason as string | null) ?? null,
    validFrom: (row.valid_from as string | null) ?? null,
    validUntil: (row.valid_until as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
  }));

  persistEmployeeRbacState(tenantId, employeeId, { overrides });

  return {
    ok: true,
    data: overrides,
  };
}

export async function fetchEmployeeDataScopes(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<EmployeeDataScope[]>> {
  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: getEmployeeRbacStateSync(tenantId, employeeId).scopes };
  }

  if (!isValidRbacContext(tenantId, employeeId)) {
    return { ok: true, data: getEmployeeRbacStateSync(tenantId, employeeId).scopes };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  }

  const { data, error } = await fromUnknownTable(supabase, 'employee_data_scopes')
    .select('id, tenant_id, employee_id, module, scope_type, scope_value')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId);

  if (error) {
    if (shouldUseSyncRbacFallback(error)) {
      return { ok: true, data: getEmployeeRbacStateSync(tenantId, employeeId).scopes };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  const scopes: EmployeeDataScope[] = (data ?? []).map((row) => ({
    id: row.id as string,
    tenantId: row.tenant_id as string,
    employeeId: row.employee_id as string,
    module: row.module as string,
    scopeType: row.scope_type as string,
    scopeValue: (row.scope_value as string | null) ?? null,
  }));

  persistEmployeeRbacState(tenantId, employeeId, { scopes });

  return {
    ok: true,
    data: scopes,
  };
}

export type SaveEmployeePermissionOverridesInput = {
  tenantId: string;
  employeeId: string;
  overrides: EmployeePermissionOverride[];
  actorId?: string | null;
  actorRole?: RoleKey | null;
  reason?: string | null;
  ipAddress?: string | null;
};

export async function saveEmployeePermissionOverrides(
  input: SaveEmployeePermissionOverridesInput,
): Promise<ServiceResult<EmployeePermissionOverride[]>> {
  const { tenantId, employeeId, overrides } = input;
  const previous = getEmployeeRbacStateSync(tenantId, employeeId).overrides;

  if (getServiceMode() !== 'supabase') {
    persistEmployeeRbacState(tenantId, employeeId, { overrides });
    await writePermissionAuditLog({
      tenantId,
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      targetEmployeeId: employeeId,
      targetRoleTemplateId: null,
      action: 'permission_overrides_updated',
      oldValue: { overrides: previous },
      newValue: { overrides },
      reason: input.reason ?? null,
      ipAddress: input.ipAddress ?? null,
    });
    return { ok: true, data: overrides };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    persistEmployeeRbacState(tenantId, employeeId, { overrides });
    await writePermissionAuditLog({
      tenantId,
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      targetEmployeeId: employeeId,
      targetRoleTemplateId: null,
      action: 'permission_overrides_updated',
      oldValue: { overrides: previous },
      newValue: { overrides },
      reason: input.reason ?? null,
      ipAddress: input.ipAddress ?? null,
    });
    return { ok: true, data: overrides };
  }

  const { error: deleteError } = await fromUnknownTable(supabase, 'employee_permission_overrides')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId);

  if (deleteError && !isSupabaseMissingTableError(deleteError)) {
    return { ok: false, error: toGermanSupabaseError(deleteError) };
  }

  if (isSupabaseMissingTableError(deleteError)) {
    persistEmployeeRbacState(tenantId, employeeId, { overrides });
    return { ok: true, data: overrides };
  }

  if (overrides.length > 0) {
    const rows = overrides.map((override) => ({
      tenant_id: tenantId,
      employee_id: employeeId,
      permission_key: override.permissionKey,
      allowed: override.allowed,
      reason: override.reason,
      valid_from: override.validFrom,
      valid_until: override.validUntil,
      created_by: input.actorId ?? override.createdBy,
    }));

    const { data, error } = await fromUnknownTable(supabase, 'employee_permission_overrides')
      .insert(rows)
      .select(
        'id, tenant_id, employee_id, permission_key, allowed, reason, valid_from, valid_until, created_by',
      );

    if (error) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    const saved = (data ?? []).map((row) => ({
      id: row.id as string,
      tenantId: row.tenant_id as string,
      employeeId: row.employee_id as string,
      permissionKey: row.permission_key as PermissionKey,
      allowed: Boolean(row.allowed),
      reason: (row.reason as string | null) ?? null,
      validFrom: (row.valid_from as string | null) ?? null,
      validUntil: (row.valid_until as string | null) ?? null,
      createdBy: (row.created_by as string | null) ?? null,
    }));

    persistEmployeeRbacState(tenantId, employeeId, { overrides: saved });
    await writePermissionAuditLog({
      tenantId,
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      targetEmployeeId: employeeId,
      targetRoleTemplateId: null,
      action: 'permission_overrides_updated',
      oldValue: { overrides: previous },
      newValue: { overrides: saved },
      reason: input.reason ?? null,
      ipAddress: input.ipAddress ?? null,
    });
    return { ok: true, data: saved };
  }

  persistEmployeeRbacState(tenantId, employeeId, { overrides: [] });
  await writePermissionAuditLog({
    tenantId,
    actorId: input.actorId ?? null,
    actorRole: input.actorRole ?? null,
    targetEmployeeId: employeeId,
    targetRoleTemplateId: null,
    action: 'permission_overrides_updated',
    oldValue: { overrides: previous },
    newValue: { overrides: [] },
    reason: input.reason ?? null,
    ipAddress: input.ipAddress ?? null,
  });
  return { ok: true, data: [] };
}

export type SaveEmployeeDataScopesInput = {
  tenantId: string;
  employeeId: string;
  scopes: EmployeeDataScope[];
  actorId?: string | null;
  actorRole?: RoleKey | null;
  reason?: string | null;
  ipAddress?: string | null;
};

export async function saveEmployeeDataScopes(
  input: SaveEmployeeDataScopesInput,
): Promise<ServiceResult<EmployeeDataScope[]>> {
  const { tenantId, employeeId, scopes } = input;
  const previous = getEmployeeRbacStateSync(tenantId, employeeId).scopes;

  if (getServiceMode() !== 'supabase') {
    persistEmployeeRbacState(tenantId, employeeId, { scopes });
    await writePermissionAuditLog({
      tenantId,
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      targetEmployeeId: employeeId,
      targetRoleTemplateId: null,
      action: 'data_scopes_updated',
      oldValue: { scopes: previous },
      newValue: { scopes },
      reason: input.reason ?? null,
      ipAddress: input.ipAddress ?? null,
    });
    return { ok: true, data: scopes };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    persistEmployeeRbacState(tenantId, employeeId, { scopes });
    await writePermissionAuditLog({
      tenantId,
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      targetEmployeeId: employeeId,
      targetRoleTemplateId: null,
      action: 'data_scopes_updated',
      oldValue: { scopes: previous },
      newValue: { scopes },
      reason: input.reason ?? null,
      ipAddress: input.ipAddress ?? null,
    });
    return { ok: true, data: scopes };
  }

  const { error: deleteError } = await fromUnknownTable(supabase, 'employee_data_scopes')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId);

  if (deleteError && !isSupabaseMissingTableError(deleteError)) {
    return { ok: false, error: toGermanSupabaseError(deleteError) };
  }

  if (isSupabaseMissingTableError(deleteError)) {
    persistEmployeeRbacState(tenantId, employeeId, { scopes });
    return { ok: true, data: scopes };
  }

  if (scopes.length > 0) {
    const rows = scopes.map((scope) => ({
      tenant_id: tenantId,
      employee_id: employeeId,
      module: scope.module,
      scope_type: scope.scopeType,
      scope_value: scope.scopeValue,
    }));

    const { data, error } = await fromUnknownTable(supabase, 'employee_data_scopes')
      .insert(rows)
      .select('id, tenant_id, employee_id, module, scope_type, scope_value');

    if (error) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    const saved = (data ?? []).map((row) => ({
      id: row.id as string,
      tenantId: row.tenant_id as string,
      employeeId: row.employee_id as string,
      module: row.module as string,
      scopeType: row.scope_type as string,
      scopeValue: (row.scope_value as string | null) ?? null,
    }));

    persistEmployeeRbacState(tenantId, employeeId, { scopes: saved });
    await writePermissionAuditLog({
      tenantId,
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      targetEmployeeId: employeeId,
      targetRoleTemplateId: null,
      action: 'data_scopes_updated',
      oldValue: { scopes: previous },
      newValue: { scopes: saved },
      reason: input.reason ?? null,
      ipAddress: input.ipAddress ?? null,
    });
    return { ok: true, data: saved };
  }

  persistEmployeeRbacState(tenantId, employeeId, { scopes: [] });
  await writePermissionAuditLog({
    tenantId,
    actorId: input.actorId ?? null,
    actorRole: input.actorRole ?? null,
    targetEmployeeId: employeeId,
    targetRoleTemplateId: null,
    action: 'data_scopes_updated',
    oldValue: { scopes: previous },
    newValue: { scopes: [] },
    reason: input.reason ?? null,
    ipAddress: input.ipAddress ?? null,
  });
  return { ok: true, data: [] };
}

export function appendPermissionAuditLogEntry(entry: Omit<PermissionAuditLogEntry, 'id' | 'createdAt'>): void {
  auditLogStore.push({
    ...entry,
    id: `pal-${auditLogStore.length + 1}`,
    createdAt: new Date().toISOString(),
  });
}

export async function writePermissionAuditLog(
  entry: Omit<PermissionAuditLogEntry, 'id' | 'createdAt'>,
): Promise<ServiceResult<void>> {
  appendPermissionAuditLogEntry(entry);

  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: undefined };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  }

  const { error } = await fromUnknownTable(supabase, 'permission_audit_log').insert({
    tenant_id: entry.tenantId,
    actor_id: entry.actorId,
    actor_role: entry.actorRole,
    target_employee_id: entry.targetEmployeeId,
    target_role_template_id: entry.targetRoleTemplateId,
    action: entry.action,
    old_value: entry.oldValue,
    new_value: entry.newValue,
    reason: entry.reason,
    ip_address: entry.ipAddress,
  });

  if (error && !isSupabaseMissingTableError(error)) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: undefined };
}

export function listPermissionAuditLogForEmployee(
  tenantId: string,
  employeeId: string,
): PermissionAuditLogEntry[] {
  return auditLogStore.filter(
    (e) => e.tenantId === tenantId && e.targetEmployeeId === employeeId,
  );
}
