import type { RoleKey, ServiceResult } from '@/types';
import type { CustomFieldDataType, TenantCustomFieldDefinition, TenantModuleKey } from '@/types/tenant/tenantCenter';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant, isLiveServiceMode } from '@/lib/services/liveServiceGuard';
import { TENANT_SETTINGS_PERMISSION } from './tenantSettingsRoute';

const DEMO_FIELDS = new Map<string, TenantCustomFieldDefinition[]>();

function mapDefinition(row: Record<string, unknown>): TenantCustomFieldDefinition {
  return {
    id: String(row.id),
    groupId: row.group_id ? String(row.group_id) : null,
    fieldKey: String(row.field_key),
    label: String(row.label),
    dataType: row.data_type as CustomFieldDataType,
    moduleKey: row.module_key ? (row.module_key as TenantModuleKey) : null,
    functionKey: row.function_key ? String(row.function_key) : null,
    visibility: (row.visibility as Record<string, unknown>) ?? {},
    validation: (row.validation as Record<string, unknown>) ?? {},
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export function resolveCustomFieldPlaceholder(fieldKey: string): string {
  return `{{tenant.custom.${fieldKey}}}`;
}

export async function fetchTenantCustomFieldDefinitions(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantCustomFieldDefinition[]>> {
  const denied = enforcePermission<TenantCustomFieldDefinition[]>(actorRoleKey, TENANT_SETTINGS_PERMISSION);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (!isLiveServiceMode()) {
    return { ok: true, data: DEMO_FIELDS.get(tenantId) ?? [] };
  }

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };

  const { data, error } = await fromUnknownTable(client, 'tenant_custom_field_definitions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order');

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: ((data ?? []) as Record<string, unknown>[]).map(mapDefinition) };
}

export type SaveCustomFieldInput = Omit<TenantCustomFieldDefinition, 'id'> & { id?: string };

export async function saveTenantCustomFieldDefinition(
  tenantId: string,
  input: SaveCustomFieldInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantCustomFieldDefinition[]>> {
  const denied = enforcePermission<TenantCustomFieldDefinition[]>(actorRoleKey, TENANT_SETTINGS_PERMISSION);
  if (denied) return denied;

  if (!input.fieldKey.trim() || !input.label.trim()) {
    return { ok: false, error: 'Schlüssel und Bezeichnung sind erforderlich.' };
  }

  if (!isLiveServiceMode()) {
    const list = DEMO_FIELDS.get(tenantId) ?? [];
    const next: TenantCustomFieldDefinition = {
      ...input,
      id: input.id ?? `demo-field-${input.fieldKey}`,
    };
    const index = list.findIndex((field) => field.fieldKey === input.fieldKey);
    if (index >= 0) list[index] = next;
    else list.push(next);
    DEMO_FIELDS.set(tenantId, list);
    return { ok: true, data: list };
  }

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };

  const payload = {
    tenant_id: tenantId,
    group_id: input.groupId,
    field_key: input.fieldKey.trim(),
    label: input.label.trim(),
    data_type: input.dataType,
    module_key: input.moduleKey,
    function_key: input.functionKey,
    visibility: input.visibility,
    validation: input.validation,
    is_active: input.isActive,
    sort_order: input.sortOrder,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await fromUnknownTable(client, 'tenant_custom_field_definitions')
      .update(payload)
      .eq('tenant_id', tenantId)
      .eq('id', input.id);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
  } else {
    const { error } = await fromUnknownTable(client, 'tenant_custom_field_definitions').insert(payload);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
  }

  return fetchTenantCustomFieldDefinitions(tenantId, actorRoleKey);
}

export function resetTenantCustomFieldStore(): void {
  DEMO_FIELDS.clear();
}
