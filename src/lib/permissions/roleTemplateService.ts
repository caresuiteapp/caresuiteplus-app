import type { RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import type { RoleTemplate } from '@/types/permissions/rbac';
import { ROLE_LABELS } from '@/data/constants/roleLabels';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { writePermissionAuditLog } from './rbacService';
import { getPermissionsForRole } from './staticRolePermissions';
import { buildSystemRoleTemplateSeeds, SYSTEM_ROLE_TEMPLATE_LEVELS } from './permissionCatalogSeedData';

const demoTenantRoleStore = new Map<string, RoleTemplate>();
const demoTenantRolePermissions = new Map<string, Set<PermissionKey>>();

export function resetRoleTemplateDemoStore(): void {
  demoTenantRoleStore.clear();
  demoTenantRolePermissions.clear();
}

function mapTemplateRow(row: Record<string, unknown>): RoleTemplate {
  return {
    id: row.id as string,
    tenantId: (row.tenant_id as string | null) ?? null,
    roleKey: row.role_key as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    level: Number(row.level ?? 0),
    isSystemRole: Boolean(row.is_system_role),
    isEditable: Boolean(row.is_editable),
  };
}

export async function listRoleTemplates(
  tenantId: string,
): Promise<ServiceResult<RoleTemplate[]>> {
  if (getServiceMode() !== 'supabase') {
    const seeds = buildSystemRoleTemplateSeeds();
    const systemTemplates = seeds.map((seed) => ({
      id: `rt-${seed.roleKey}`,
      tenantId: null,
      roleKey: seed.roleKey,
      name: seed.name,
      description: null,
      level: seed.level,
      isSystemRole: true,
      isEditable: false,
    }));
    const tenantCustom = [...demoTenantRoleStore.values()].filter((t) => t.tenantId === tenantId);
    return { ok: true, data: [...systemTemplates, ...tenantCustom] };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  }

  const { data, error } = await fromUnknownTable(supabase, 'role_templates')
    .select('id, tenant_id, role_key, name, description, level, is_system_role, is_editable')
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .order('level', { ascending: false });

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      const seeds = buildSystemRoleTemplateSeeds();
      return {
        ok: true,
        data: seeds.map((seed) => ({
          id: `rt-${seed.roleKey}`,
          tenantId: null,
          roleKey: seed.roleKey,
          name: seed.name,
          description: null,
          level: seed.level,
          isSystemRole: true,
          isEditable: false,
        })),
      };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: (data ?? []).map((row) => mapTemplateRow(row as Record<string, unknown>)) };
}

export async function listAssignableRoleTemplates(
  tenantId: string,
): Promise<ServiceResult<RoleTemplate[]>> {
  const result = await listRoleTemplates(tenantId);
  if (!result.ok) return result;
  const assignableKeys: RoleKey[] = [
    'caregiver',
    'nurse',
    'dispatch',
    'counselor',
    'employee_portal',
    'business_manager',
    'billing',
    'business_admin',
    'akademie_admin',
  ];
  return {
    ok: true,
    data: result.data.filter(
      (t) => assignableKeys.includes(t.roleKey as RoleKey) || t.tenantId === tenantId,
    ),
  };
}

export function getRoleTemplateLabel(roleKey: RoleKey): string {
  return ROLE_LABELS[roleKey] ?? roleKey;
}

export function getRoleTemplateLevel(roleKey: RoleKey): number {
  return SYSTEM_ROLE_TEMPLATE_LEVELS[roleKey] ?? 0;
}

export async function fetchRoleTemplatePermissions(
  templateId: string,
  fallbackRoleKey?: RoleKey | null,
): Promise<ServiceResult<PermissionKey[]>> {
  const demoPerms = demoTenantRolePermissions.get(templateId);
  if (demoPerms) {
    return { ok: true, data: [...demoPerms] };
  }

  if (getServiceMode() !== 'supabase') {
    if (fallbackRoleKey) {
      return { ok: true, data: [...getPermissionsForRole(fallbackRoleKey)] };
    }
    return { ok: true, data: [] };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  }

  const { data, error } = await fromUnknownTable(supabase, 'role_template_permissions')
    .select('permission_key, allowed')
    .eq('role_template_id', templateId);

  if (error) {
    if (isSupabaseMissingTableError(error) && fallbackRoleKey) {
      return { ok: true, data: [...getPermissionsForRole(fallbackRoleKey)] };
    }
    if (isSupabaseMissingTableError(error)) {
      return { ok: true, data: [] };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  const permissions = (data ?? [])
    .filter((row) => Boolean(row.allowed))
    .map((row) => row.permission_key as PermissionKey);

  if (!permissions.length && fallbackRoleKey) {
    return { ok: true, data: [...getPermissionsForRole(fallbackRoleKey)] };
  }

  return { ok: true, data: permissions };
}

export type CreateTenantRoleTemplateInput = {
  tenantId: string;
  name: string;
  description?: string | null;
  roleKey?: string;
  permissions?: PermissionKey[];
  sourceTemplateId?: string | null;
  actorId?: string | null;
  actorRole?: RoleKey | null;
  reason?: string | null;
};

export async function createTenantRoleTemplate(
  input: CreateTenantRoleTemplateInput,
): Promise<ServiceResult<RoleTemplate>> {
  const roleKey =
    input.roleKey ??
    `custom_${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)}_${Date.now()}`;

  let permissions = input.permissions ?? [];
  if (!permissions.length && input.sourceTemplateId) {
    const sourcePerms = await fetchRoleTemplatePermissions(input.sourceTemplateId);
    if (sourcePerms.ok) permissions = sourcePerms.data;
  }

  if (getServiceMode() !== 'supabase') {
    const id = `rt-custom-${Date.now()}`;
    const template: RoleTemplate = {
      id,
      tenantId: input.tenantId,
      roleKey,
      name: input.name.trim(),
      description: input.description ?? null,
      level: 30,
      isSystemRole: false,
      isEditable: true,
    };
    demoTenantRoleStore.set(id, template);
    demoTenantRolePermissions.set(id, new Set(permissions));
    await writePermissionAuditLog({
      tenantId: input.tenantId,
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      targetEmployeeId: null,
      targetRoleTemplateId: id,
      action: 'role_template_created',
      oldValue: null,
      newValue: { template, permissions },
      reason: input.reason ?? null,
      ipAddress: null,
    });
    return { ok: true, data: template };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  }

  const { data, error } = await fromUnknownTable(supabase, 'role_templates')
    .insert({
      tenant_id: input.tenantId,
      role_key: roleKey,
      name: input.name.trim(),
      description: input.description ?? null,
      level: 30,
      is_system_role: false,
      is_editable: true,
    })
    .select('id, tenant_id, role_key, name, description, level, is_system_role, is_editable')
    .single();

  if (error) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  const template = mapTemplateRow(data as Record<string, unknown>);

  if (permissions.length > 0) {
    const permRows = permissions.map((permissionKey) => ({
      role_template_id: template.id,
      permission_key: permissionKey,
      allowed: true,
    }));
    await fromUnknownTable(supabase, 'role_template_permissions').insert(permRows);
  }

  await writePermissionAuditLog({
    tenantId: input.tenantId,
    actorId: input.actorId ?? null,
    actorRole: input.actorRole ?? null,
    targetEmployeeId: null,
    targetRoleTemplateId: template.id,
    action: 'role_template_created',
    oldValue: null,
    newValue: { template, permissions },
    reason: input.reason ?? null,
    ipAddress: null,
  });

  return { ok: true, data: template };
}

export async function duplicateRoleTemplate(
  tenantId: string,
  sourceTemplateId: string,
  newName: string,
  actorId?: string | null,
  actorRole?: RoleKey | null,
): Promise<ServiceResult<RoleTemplate>> {
  const templates = await listRoleTemplates(tenantId);
  if (!templates.ok) return templates;

  const source = templates.data.find((item) => item.id === sourceTemplateId);
  if (!source) return { ok: false, error: 'Rollenvorlage nicht gefunden.' };

  const sourcePerms = await fetchRoleTemplatePermissions(
    sourceTemplateId,
    source.roleKey as RoleKey,
  );

  return createTenantRoleTemplate({
    tenantId,
    name: newName.trim(),
    description: source.description,
    sourceTemplateId,
    permissions: sourcePerms.ok ? sourcePerms.data : [],
    actorId,
    actorRole,
    reason: `Dupliziert von ${source.name}`,
  });
}

export async function updateTenantRoleTemplate(
  tenantId: string,
  templateId: string,
  patch: { name?: string; description?: string | null },
  actorId?: string | null,
  actorRole?: RoleKey | null,
): Promise<ServiceResult<RoleTemplate>> {
  const demoTemplate = demoTenantRoleStore.get(templateId);
  if (demoTemplate && demoTemplate.tenantId === tenantId) {
    const updated = {
      ...demoTemplate,
      name: patch.name?.trim() ?? demoTemplate.name,
      description: patch.description !== undefined ? patch.description : demoTemplate.description,
    };
    demoTenantRoleStore.set(templateId, updated);
    await writePermissionAuditLog({
      tenantId,
      actorId: actorId ?? null,
      actorRole: actorRole ?? null,
      targetEmployeeId: null,
      targetRoleTemplateId: templateId,
      action: 'role_template_updated',
      oldValue: { template: demoTemplate },
      newValue: { template: updated },
      reason: null,
      ipAddress: null,
    });
    return { ok: true, data: updated };
  }

  if (getServiceMode() !== 'supabase') {
    return { ok: false, error: 'Rollenvorlage nicht gefunden.' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  }

  const updatePatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) updatePatch.name = patch.name.trim();
  if (patch.description !== undefined) updatePatch.description = patch.description;

  const { data, error } = await fromUnknownTable(supabase, 'role_templates')
    .update(updatePatch)
    .eq('id', templateId)
    .eq('tenant_id', tenantId)
    .select('id, tenant_id, role_key, name, description, level, is_system_role, is_editable')
    .single();

  if (error) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  const template = mapTemplateRow(data as Record<string, unknown>);
  await writePermissionAuditLog({
    tenantId,
    actorId: actorId ?? null,
    actorRole: actorRole ?? null,
    targetEmployeeId: null,
    targetRoleTemplateId: templateId,
    action: 'role_template_updated',
    oldValue: null,
    newValue: { template },
    reason: null,
    ipAddress: null,
  });
  return { ok: true, data: template };
}

export async function saveRoleTemplatePermissions(
  tenantId: string,
  templateId: string,
  permissions: PermissionKey[],
  actorId?: string | null,
  actorRole?: RoleKey | null,
  reason?: string | null,
): Promise<ServiceResult<PermissionKey[]>> {
  const previousResult = await fetchRoleTemplatePermissions(templateId);
  const previous = previousResult.ok ? previousResult.data : [];

  if (getServiceMode() !== 'supabase') {
    demoTenantRolePermissions.set(templateId, new Set(permissions));
    await writePermissionAuditLog({
      tenantId,
      actorId: actorId ?? null,
      actorRole: actorRole ?? null,
      targetEmployeeId: null,
      targetRoleTemplateId: templateId,
      action: 'role_template_permissions_updated',
      oldValue: { permissions: previous },
      newValue: { permissions },
      reason: reason ?? null,
      ipAddress: null,
    });
    return { ok: true, data: permissions };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  }

  const { error: deleteError } = await fromUnknownTable(supabase, 'role_template_permissions')
    .delete()
    .eq('role_template_id', templateId);

  if (deleteError && !isSupabaseMissingTableError(deleteError)) {
    return { ok: false, error: toGermanSupabaseError(deleteError) };
  }

  if (permissions.length > 0) {
    const rows = permissions.map((permissionKey) => ({
      role_template_id: templateId,
      permission_key: permissionKey,
      allowed: true,
    }));
    const { error } = await fromUnknownTable(supabase, 'role_template_permissions').insert(rows);
    if (error) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }
  }

  await writePermissionAuditLog({
    tenantId,
    actorId: actorId ?? null,
    actorRole: actorRole ?? null,
    targetEmployeeId: null,
    targetRoleTemplateId: templateId,
    action: 'role_template_permissions_updated',
    oldValue: { permissions: previous },
    newValue: { permissions },
    reason: reason ?? null,
    ipAddress: null,
  });

  return { ok: true, data: permissions };
}

export async function deleteTenantRoleTemplate(
  tenantId: string,
  templateId: string,
  actorId?: string | null,
  actorRole?: RoleKey | null,
): Promise<ServiceResult<void>> {
  const demoTemplate = demoTenantRoleStore.get(templateId);
  if (demoTemplate && demoTemplate.tenantId === tenantId) {
    demoTenantRoleStore.delete(templateId);
    demoTenantRolePermissions.delete(templateId);
    await writePermissionAuditLog({
      tenantId,
      actorId: actorId ?? null,
      actorRole: actorRole ?? null,
      targetEmployeeId: null,
      targetRoleTemplateId: templateId,
      action: 'role_template_deleted',
      oldValue: { template: demoTemplate },
      newValue: null,
      reason: null,
      ipAddress: null,
    });
    return { ok: true, data: undefined };
  }

  if (getServiceMode() !== 'supabase') {
    return { ok: false, error: 'Rollenvorlage nicht gefunden.' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  }

  const { error } = await fromUnknownTable(supabase, 'role_templates')
    .delete()
    .eq('id', templateId)
    .eq('tenant_id', tenantId)
    .eq('is_system_role', false);

  if (error) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  await writePermissionAuditLog({
    tenantId,
    actorId: actorId ?? null,
    actorRole: actorRole ?? null,
    targetEmployeeId: null,
    targetRoleTemplateId: templateId,
    action: 'role_template_deleted',
    oldValue: null,
    newValue: null,
    reason: null,
    ipAddress: null,
  });

  return { ok: true, data: undefined };
}
