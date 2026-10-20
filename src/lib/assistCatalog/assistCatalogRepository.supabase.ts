import type { ServiceResult } from '@/types';
import type {
  CatalogAuditEvent,
  CatalogDefinition,
  CatalogGroup,
  CatalogItem,
  CatalogListFilters,
  CreateCatalogItemInput,
  TemplateBinding,
  UpdateCatalogItemInput,
} from '@/types/assistCatalog';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { assistCatalogDemoRepository } from './assistCatalogDemoRepository';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: 'Supabase nicht verfügbar.' };
}

function mapGroup(row: Record<string, unknown>): CatalogGroup {
  return {
    id: String(row.id),
    tenantId: row.tenant_id ? String(row.tenant_id) : null,
    moduleScope: row.module_scope as CatalogGroup['moduleScope'],
    groupKey: String(row.group_key),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    icon: row.icon ? String(row.icon) : null,
    color: row.color ? String(row.color) : null,
    sortOrder: Number(row.sort_order ?? 0),
    isSystemDefault: Boolean(row.is_system_default),
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapDefinition(row: Record<string, unknown>): CatalogDefinition {
  return {
    id: String(row.id),
    tenantId: row.tenant_id ? String(row.tenant_id) : null,
    groupId: row.group_id ? String(row.group_id) : null,
    moduleScope: row.module_scope as CatalogDefinition['moduleScope'],
    catalogKey: String(row.catalog_key),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    catalogType: row.catalog_type as CatalogDefinition['catalogType'],
    selectionMode: row.selection_mode as CatalogDefinition['selectionMode'],
    visibilityScope: String(row.visibility_scope),
    requiredPermission: row.required_permission ? String(row.required_permission) : null,
    isSystemDefault: Boolean(row.is_system_default),
    isEditable: Boolean(row.is_editable),
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapItem(row: Record<string, unknown>): CatalogItem {
  return {
    id: String(row.id),
    tenantId: row.tenant_id ? String(row.tenant_id) : null,
    catalogId: String(row.catalog_id),
    parentItemId: row.parent_item_id ? String(row.parent_item_id) : null,
    itemKey: String(row.item_key),
    label: String(row.label),
    shortLabel: row.short_label ? String(row.short_label) : null,
    description: row.description ? String(row.description) : null,
    helperText: row.helper_text ? String(row.helper_text) : null,
    tags: (row.tags as string[]) ?? [],
    icon: row.icon ? String(row.icon) : null,
    color: row.color ? String(row.color) : null,
    sortOrder: Number(row.sort_order ?? 0),
    isSystemDefault: Boolean(row.is_system_default),
    isActive: Boolean(row.is_active),
    isBillableRelevant: Boolean(row.is_billable_relevant),
    isDocumentationRequired: Boolean(row.is_documentation_required),
    isSignatureRelevant: Boolean(row.is_signature_relevant),
    isRiskRelevant: Boolean(row.is_risk_relevant),
    defaultDurationMinutes: row.default_duration_minutes != null ? Number(row.default_duration_minutes) : null,
    defaultPriceHint: row.default_price_hint != null ? Number(row.default_price_hint) : null,
    defaultUnit: row.default_unit ? String(row.default_unit) : null,
    payloadJson: (row.payload_json as CatalogItem['payloadJson']) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapBinding(row: Record<string, unknown>): TemplateBinding {
  return {
    id: String(row.id),
    tenantId: row.tenant_id ? String(row.tenant_id) : null,
    templateId: row.template_id ? String(row.template_id) : null,
    catalogId: row.catalog_id ? String(row.catalog_id) : null,
    targetModule: String(row.target_module),
    targetArea: row.target_area as TemplateBinding['targetArea'],
    targetComponent: row.target_component ? String(row.target_component) : null,
    targetField: row.target_field ? String(row.target_field) : null,
    bindingType: String(row.binding_type),
    isRequired: Boolean(row.is_required),
    isDefault: Boolean(row.is_default),
    sortOrder: Number(row.sort_order ?? 0),
    conditionsJson: (row.conditions_json as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function withFallback<T>(
  tenantId: string,
  fn: () => Promise<ServiceResult<T>>,
  fallback: () => Promise<ServiceResult<T>>,
): Promise<ServiceResult<T>> {
  const res = await fn();
  if (!res.ok && res.error.includes('nicht verfügbar')) return fallback();
  if (res.ok && Array.isArray(res.data) && res.data.length === 0) return fallback();
  return res;
}

export const assistCatalogSupabaseRepository = {
  async listGroups(tenantId: string): Promise<ServiceResult<CatalogGroup[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return assistCatalogDemoRepository.listGroups(tenantId);
    const { data, error } = await fromUnknownTable(supabase, 'catalog_groups')
      .select('*')
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .eq('is_active', true)
      .order('sort_order');
    if (error) {
      if (isMissingTableError(error)) return assistCatalogDemoRepository.listGroups(tenantId);
      return { ok: false, error: toGermanSupabaseError(error) };
    }
    if (!data?.length) return assistCatalogDemoRepository.listGroups(tenantId);
    return { ok: true, data: data.map(mapGroup) };
  },

  async listDefinitions(
    tenantId: string,
    filters: CatalogListFilters = {},
  ): Promise<ServiceResult<CatalogDefinition[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return assistCatalogDemoRepository.listDefinitions(tenantId, filters);
    let query = fromUnknownTable(supabase, 'catalog_definitions')
      .select('*')
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
    if (filters.catalogKey) query = query.eq('catalog_key', filters.catalogKey);
    if (filters.moduleScope) query = query.eq('module_scope', filters.moduleScope);
    if (filters.isActive === true) query = query.eq('is_active', true);
    const { data, error } = await query.order('sort_order');
    if (error) {
      if (isMissingTableError(error)) return assistCatalogDemoRepository.listDefinitions(tenantId, filters);
      return { ok: false, error: toGermanSupabaseError(error) };
    }
    if (!data?.length) return assistCatalogDemoRepository.listDefinitions(tenantId, filters);
    let rows = data.map(mapDefinition);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter((d) => `${d.name} ${d.catalogKey}`.toLowerCase().includes(q));
    }
    return { ok: true, data: rows };
  },

  async listItems(
    tenantId: string,
    catalogKey: string,
    filters: CatalogListFilters = {},
  ): Promise<ServiceResult<CatalogItem[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return assistCatalogDemoRepository.listItems(tenantId, catalogKey, filters);

    const defRes = await this.listDefinitions(tenantId, { catalogKey });
    if (!defRes.ok) return defRes;
    const def = defRes.data[0];
    if (!def) return { ok: true, data: [] };

    const { data, error } = await fromUnknownTable(supabase, 'catalog_items')
      .select('*')
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .eq('catalog_id', def.id)
      .order('sort_order');
    if (error) {
      if (isMissingTableError(error)) return assistCatalogDemoRepository.listItems(tenantId, catalogKey, filters);
      const fallback = await assistCatalogDemoRepository.listItems(tenantId, catalogKey, filters);
      if (fallback.ok && fallback.data.length > 0) return fallback;
      return { ok: false, error: toGermanSupabaseError(error) };
    }
    if (!data?.length) return assistCatalogDemoRepository.listItems(tenantId, catalogKey, filters);

    const { data: deactivations } = await fromUnknownTable(supabase, 'catalog_item_deactivations')
      .select('catalog_item_id')
      .eq('tenant_id', tenantId);
    const deactivated = new Set((deactivations ?? []).map((d) => String((d as Record<string, unknown>).catalog_item_id)));

    let rows = data
      .map(mapItem)
      .filter((i) => filters.includeInactive || (i.isActive && !deactivated.has(i.id)));
    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter((i) => `${i.label} ${i.itemKey}`.toLowerCase().includes(q));
    }
    return { ok: true, data: rows };
  },

  async createItem(tenantId: string, input: CreateCatalogItemInput): Promise<ServiceResult<CatalogItem>> {
    const supabase = getSupabaseClient();
    if (!supabase) return assistCatalogDemoRepository.createItem(tenantId, input);
    const { data, error } = await fromUnknownTable(supabase, 'catalog_items')
      .insert({
        tenant_id: tenantId,
        catalog_id: input.catalogId,
        parent_item_id: input.parentItemId ?? null,
        item_key: input.itemKey,
        label: input.label,
        short_label: input.shortLabel ?? null,
        description: input.description ?? null,
        helper_text: input.helperText ?? null,
        tags: input.tags ?? [],
        icon: input.icon ?? null,
        color: input.color ?? null,
        sort_order: input.sortOrder ?? 0,
        is_system_default: false,
        is_active: true,
        is_billable_relevant: input.isBillableRelevant ?? false,
        is_documentation_required: input.isDocumentationRequired ?? false,
        is_signature_relevant: input.isSignatureRelevant ?? false,
        is_risk_relevant: input.isRiskRelevant ?? false,
        default_duration_minutes: input.defaultDurationMinutes ?? null,
        payload_json: input.payloadJson ?? {},
      })
      .select('*')
      .single();
    if (error) {
      if (isMissingTableError(error)) return assistCatalogDemoRepository.createItem(tenantId, input);
      return { ok: false, error: toGermanSupabaseError(error) };
    }
    return { ok: true, data: mapItem(data as Record<string, unknown>) };
  },

  async updateItem(
    tenantId: string,
    itemId: string,
    patch: UpdateCatalogItemInput,
  ): Promise<ServiceResult<CatalogItem>> {
    const supabase = getSupabaseClient();
    if (!supabase) return assistCatalogDemoRepository.updateItem(tenantId, itemId, patch);
    const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.label != null) body.label = patch.label;
    if (patch.description != null) body.description = patch.description;
    if (patch.isActive != null) body.is_active = patch.isActive;
    if (patch.sortOrder != null) body.sort_order = patch.sortOrder;
    if (patch.payloadJson != null) body.payload_json = patch.payloadJson;
    const { data, error } = await fromUnknownTable(supabase, 'catalog_items')
      .update(body)
      .eq('id', itemId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();
    if (error) {
      if (isMissingTableError(error)) return assistCatalogDemoRepository.updateItem(tenantId, itemId, patch);
      return { ok: false, error: toGermanSupabaseError(error) };
    }
    return { ok: true, data: mapItem(data as Record<string, unknown>) };
  },

  async deactivateItem(tenantId: string, itemId: string): Promise<ServiceResult<CatalogItem>> {
    const supabase = getSupabaseClient();
    if (!supabase) return assistCatalogDemoRepository.deactivateItem(tenantId, itemId);

    const { data: itemRow } = await fromUnknownTable(supabase, 'catalog_items').select('*').eq('id', itemId).maybeSingle();
    if (!itemRow) return { ok: false, error: 'Eintrag nicht gefunden.' };
    const item = mapItem(itemRow as Record<string, unknown>);
    if (item.isSystemDefault && item.tenantId === null) {
      const { error } = await fromUnknownTable(supabase, 'catalog_item_deactivations').upsert({
        tenant_id: tenantId,
        catalog_item_id: itemId,
      });
      if (error && isMissingTableError(error)) return assistCatalogDemoRepository.deactivateItem(tenantId, itemId);
      if (error) return { ok: false, error: toGermanSupabaseError(error) };
      return { ok: true, data: { ...item, isActive: false } };
    }
    return this.updateItem(tenantId, itemId, { isActive: false });
  },

  async listBindings(tenantId: string): Promise<ServiceResult<TemplateBinding[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return assistCatalogDemoRepository.listBindings(tenantId);
    const { data, error } = await fromUnknownTable(supabase, 'template_bindings')
      .select('*')
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .order('sort_order');
    if (error) {
      if (isMissingTableError(error)) return assistCatalogDemoRepository.listBindings(tenantId);
      return { ok: false, error: toGermanSupabaseError(error) };
    }
    if (!data?.length) return assistCatalogDemoRepository.listBindings(tenantId);
    return { ok: true, data: data.map(mapBinding) };
  },

  async listAudit(tenantId: string): Promise<ServiceResult<CatalogAuditEvent[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return assistCatalogDemoRepository.listAudit(tenantId);
    const { data, error } = await fromUnknownTable(supabase, 'catalog_audit_events')
      .select('*')
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      if (isMissingTableError(error)) return assistCatalogDemoRepository.listAudit(tenantId);
      return { ok: false, error: toGermanSupabaseError(error) };
    }
    return {
      ok: true,
      data: (data ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        return {
          id: String(r.id),
          tenantId: r.tenant_id ? String(r.tenant_id) : null,
          entityType: String(r.entity_type),
          entityId: String(r.entity_id),
          action: r.action as CatalogAuditEvent['action'],
          moduleScope: r.module_scope as CatalogAuditEvent['moduleScope'],
          actorUserId: r.actor_user_id ? String(r.actor_user_id) : null,
          oldValueJson: (r.old_value_json as Record<string, unknown>) ?? null,
          newValueJson: (r.new_value_json as Record<string, unknown>) ?? null,
          summary: r.summary ? String(r.summary) : null,
          createdAt: String(r.created_at),
        };
      }),
    };
  },

  async copySystemCatalogToTenant(tenantId: string, catalogKey: string): Promise<ServiceResult<CatalogDefinition>> {
    return withFallback(
      tenantId,
      async () => unavailable(),
      () => assistCatalogDemoRepository.copySystemCatalogToTenant(tenantId, catalogKey),
    );
  },
};

export { withFallback, unavailable };
