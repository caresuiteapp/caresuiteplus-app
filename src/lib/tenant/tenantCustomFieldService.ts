import { currentCompanyWorkflows } from './currentCompanyWorkflows';
import { guardLegacyCompanyWebAccess } from './companyLegacyWebAccess';
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
  includeInactive = false,
): Promise<ServiceResult<TenantCustomFieldDefinition[]>> {
  const webDenied = await guardLegacyCompanyWebAccess<TenantCustomFieldDefinition[]>(tenantId);
  if (webDenied) return webDenied;
  const denied = currentCompanyWorkflows ? null : enforcePermission<TenantCustomFieldDefinition[]>(actorRoleKey, TENANT_SETTINGS_PERMISSION);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (!isLiveServiceMode()) {
    const fields = DEMO_FIELDS.get(tenantId) ?? [];
    return { ok: true, data: currentCompanyWorkflows && !includeInactive ? fields.filter(field => field.isActive) : fields };
  }

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };

  let query = fromUnknownTable(client, 'tenant_custom_field_definitions')
    .select('*')
    .eq('tenant_id', tenantId);
  if (!currentCompanyWorkflows || !includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query.order('sort_order');

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: ((data ?? []) as Record<string, unknown>[]).map(mapDefinition) };
}

export type SaveCustomFieldInput = Omit<TenantCustomFieldDefinition, 'id'> & { id?: string };

export type SaveCustomFieldResult = ServiceResult<TenantCustomFieldDefinition[]> & {
  /** A confirmed write may succeed even if the following list refresh fails. */
  savedId?: string;
};

export async function saveTenantCustomFieldDefinition(
  tenantId: string,
  input: SaveCustomFieldInput,
  actorRoleKey?: RoleKey | null,
): Promise<SaveCustomFieldResult> {
  const webDenied = await guardLegacyCompanyWebAccess<TenantCustomFieldDefinition[]>(tenantId);
  if (webDenied) return webDenied;
  const denied = currentCompanyWorkflows ? null : enforcePermission<TenantCustomFieldDefinition[]>(actorRoleKey, TENANT_SETTINGS_PERMISSION);
  if (denied) return denied;

  if (currentCompanyWorkflows) {
    const tenantBlock = guardServiceTenant(tenantId);
    if (tenantBlock) return tenantBlock;
  }

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

  if (currentCompanyWorkflows) {
    const table = fromUnknownTable(client, 'tenant_custom_field_definitions');
    const query = input.id
      ? table.update(payload).eq('tenant_id', tenantId).eq('id', input.id)
      : table.insert(payload);
    const { data, error } = await query.select('id').maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    const savedId = typeof data?.id === 'string' ? data.id : '';
    if (!savedId || (input.id && savedId !== input.id)) {
      return { ok: false, error: 'Das Zusatzfeld konnte nicht gespeichert werden. Bitte laden Sie die Unternehmensdaten neu und prüfen Sie Ihre Berechtigung.' };
    }

    try {
      const refreshed = await fetchTenantCustomFieldDefinitions(tenantId, actorRoleKey, true);
      if (refreshed.ok) return refreshed;
      return { ok: false, savedId, error: `Das Zusatzfeld wurde gespeichert, aber die aktualisierte Liste konnte nicht geladen werden. ${refreshed.error}` };
    } catch {
      return { ok: false, savedId, error: 'Das Zusatzfeld wurde gespeichert, aber die aktualisierte Liste konnte nicht geladen werden. Bitte laden Sie die Unternehmensdaten neu.' };
    }
  }

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
