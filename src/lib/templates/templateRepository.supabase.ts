import type { ServiceResult } from '@/types';
import type {
  CareSuiteTemplate,
  CatalogEntry,
  CreateCatalogEntryInput,
  CreateTemplateInput,
  DropdownOption,
  TemplateDashboardStats,
  TemplateListFilters,
  TemplateUsageLog,
  TenantTemplateSettings,
  UpdateCatalogEntryInput,
  UpdateTemplateInput,
} from '@/types/templates';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function getClient() {
  return getSupabaseClient();
}

function mapTemplateRow(row: Record<string, unknown>): CareSuiteTemplate {
  return {
    id: String(row.id),
    tenantId: row.tenant_id ? String(row.tenant_id) : null,
    scope: row.scope as CareSuiteTemplate['scope'],
    moduleKey: row.module_key as CareSuiteTemplate['moduleKey'],
    templateType: row.template_type as CareSuiteTemplate['templateType'],
    status: row.status as CareSuiteTemplate['status'],
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    categoryKey: row.category_key ? String(row.category_key) : null,
    content: String(row.content),
    variables: (row.variables as string[]) ?? [],
    tags: (row.tags as string[]) ?? [],
    sortOrder: Number(row.sort_order ?? 0),
    isDefault: Boolean(row.is_default),
    isRequired: Boolean(row.is_required),
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapCatalogRow(row: Record<string, unknown>): CatalogEntry {
  return {
    id: String(row.id),
    tenantId: row.tenant_id ? String(row.tenant_id) : null,
    catalogType: row.catalog_type as CatalogEntry['catalogType'],
    valueKey: String(row.value_key),
    label: String(row.label),
    description: row.description ? String(row.description) : null,
    moduleKey: row.module_key as CatalogEntry['moduleKey'],
    isSystem: Boolean(row.is_system),
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export const templateSupabaseRepository = {
  async list(tenantId: string, filters: TemplateListFilters = {}): Promise<ServiceResult<CareSuiteTemplate[]>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    let query = fromUnknownTable(supabase, 'templates')
      .select('*')
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);

    if (filters.scope === 'system') query = query.is('tenant_id', null);
    if (filters.scope === 'tenant') query = query.eq('tenant_id', tenantId);
    if (filters.moduleKey) query = query.eq('module_key', filters.moduleKey);
    if (filters.templateType) query = query.eq('template_type', filters.templateType);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.categoryKey) query = query.eq('category_key', filters.categoryKey);

    const { data, error } = await query.order('sort_order').order('title');
    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    let rows = (data ?? []).map(mapTemplateRow);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter((t) =>
        `${t.title} ${t.description ?? ''} ${t.content}`.toLowerCase().includes(q),
      );
    }
    return { ok: true, data: rows };
  },

  async getById(tenantId: string, id: string): Promise<ServiceResult<CareSuiteTemplate | null>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'templates')
      .select('*')
      .eq('id', id)
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: data ? mapTemplateRow(data) : null };
  },

  async create(
    tenantId: string,
    input: CreateTemplateInput,
    createdBy?: string | null,
  ): Promise<ServiceResult<CareSuiteTemplate>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'templates')
      .insert({
        tenant_id: tenantId,
        scope: 'tenant',
        module_key: input.moduleKey,
        template_type: input.templateType,
        status: input.status ?? 'draft',
        title: input.title.trim(),
        description: input.description ?? null,
        category_key: input.categoryKey ?? null,
        content: input.content,
        variables: input.variables ?? [],
        tags: input.tags ?? [],
        created_by: createdBy ?? null,
      } as never)
      .select('*')
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapTemplateRow(data) };
  },

  async update(
    tenantId: string,
    id: string,
    patch: UpdateTemplateInput,
  ): Promise<ServiceResult<CareSuiteTemplate>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.title != null) payload.title = patch.title;
    if (patch.description !== undefined) payload.description = patch.description;
    if (patch.categoryKey !== undefined) payload.category_key = patch.categoryKey;
    if (patch.content != null) payload.content = patch.content;
    if (patch.variables != null) payload.variables = patch.variables;
    if (patch.tags != null) payload.tags = patch.tags;
    if (patch.status != null) payload.status = patch.status;
    if (patch.sortOrder != null) payload.sort_order = patch.sortOrder;

    const { data, error } = await fromUnknownTable(supabase, 'templates')
      .update(payload as never)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*')
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) return { ok: false, error: 'Nur Mandantenvorlagen können bearbeitet werden.' };
    return { ok: true, data: mapTemplateRow(data) };
  },

  async archive(tenantId: string, id: string): Promise<ServiceResult<CareSuiteTemplate>> {
    return this.update(tenantId, id, { status: 'archived' });
  },

  async duplicateSystemForTenant(
    tenantId: string,
    systemTemplateId: string,
    createdBy?: string | null,
  ): Promise<ServiceResult<CareSuiteTemplate>> {
    const original = await this.getById(tenantId, systemTemplateId);
    if (!original.ok) return original;
    if (!original.data || original.data.scope !== 'system') {
      return { ok: false, error: 'Systemvorlage nicht gefunden.' };
    }
    return this.create(
      tenantId,
      {
        moduleKey: original.data.moduleKey,
        templateType: original.data.templateType,
        title: `${original.data.title} (Kopie)`,
        description: original.data.description,
        categoryKey: original.data.categoryKey,
        content: original.data.content,
        variables: original.data.variables,
        tags: [...original.data.tags, 'kopie'],
        status: 'draft',
      },
      createdBy,
    );
  },

  async getDashboardStats(tenantId: string): Promise<ServiceResult<TemplateDashboardStats>> {
    const list = await this.list(tenantId, {});
    if (!list.ok) return list;
    const all = list.data;
    return {
      ok: true,
      data: {
        systemCount: all.filter((t) => t.scope === 'system').length,
        tenantCount: all.filter((t) => t.scope === 'tenant').length,
        activeCount: all.filter((t) => t.status === 'active').length,
        archivedCount: all.filter((t) => t.status === 'archived').length,
        modulesWithTemplates: new Set(all.map((t) => t.moduleKey)).size,
        topTemplates: [],
      },
    };
  },

  async logUsage(
    tenantId: string,
    templateId: string,
    moduleKey: CareSuiteTemplate['moduleKey'],
    context?: string | null,
  ): Promise<ServiceResult<TemplateUsageLog>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'template_usage_logs')
      .insert({
        tenant_id: tenantId,
        template_id: templateId,
        module_key: moduleKey,
        context: context ?? null,
      } as never)
      .select('*')
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    const row = data as Record<string, unknown>;
    return {
      ok: true,
      data: {
        id: String(row.id),
        tenantId: String(row.tenant_id),
        templateId: String(row.template_id),
        moduleKey: row.module_key as CareSuiteTemplate['moduleKey'],
        context: row.context ? String(row.context) : null,
        usedAt: String(row.used_at),
      },
    };
  },

  async getSettings(tenantId: string): Promise<ServiceResult<TenantTemplateSettings>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'tenant_template_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) {
      return {
        ok: true,
        data: {
          tenantId,
          allowTenantOverrides: true,
          defaultLocale: 'de-DE',
          showSystemTemplates: true,
          updatedAt: new Date().toISOString(),
        },
      };
    }
    const settingsRow = data as Record<string, unknown>;
    return {
      ok: true,
      data: {
        tenantId,
        allowTenantOverrides: Boolean(settingsRow.allow_tenant_overrides),
        defaultLocale: String(settingsRow.default_locale ?? 'de-DE'),
        showSystemTemplates: Boolean(settingsRow.show_system_templates),
        updatedAt: String(settingsRow.updated_at),
      },
    };
  },

  async updateSettings(
    tenantId: string,
    patch: Partial<Omit<TenantTemplateSettings, 'tenantId'>>,
  ): Promise<ServiceResult<TenantTemplateSettings>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'tenant_template_settings')
      .upsert({
        tenant_id: tenantId,
        allow_tenant_overrides: patch.allowTenantOverrides,
        default_locale: patch.defaultLocale,
        show_system_templates: patch.showSystemTemplates,
        updated_at: new Date().toISOString(),
      } as never)
      .select('*')
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    const updatedRow = data as Record<string, unknown>;
    return {
      ok: true,
      data: {
        tenantId,
        allowTenantOverrides: Boolean(updatedRow.allow_tenant_overrides),
        defaultLocale: String(updatedRow.default_locale ?? 'de-DE'),
        showSystemTemplates: Boolean(updatedRow.show_system_templates),
        updatedAt: String(updatedRow.updated_at),
      },
    };
  },
};

export const catalogSupabaseRepository = {
  async list(
    tenantId: string,
    catalogType?: CatalogEntry['catalogType'],
  ): Promise<ServiceResult<CatalogEntry[]>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    let query = fromUnknownTable(supabase, 'catalog_entries')
      .select('*')
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
    if (catalogType) query = query.eq('catalog_type', catalogType);

    const { data, error } = await query.order('sort_order').order('label');
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    const rows = (data ?? []).map(mapCatalogRow).filter((e) => e.isActive);
    const filtered = catalogType ? rows : rows;
    return { ok: true, data: filtered };
  },

  async create(tenantId: string, input: CreateCatalogEntryInput): Promise<ServiceResult<CatalogEntry>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'catalog_entries')
      .insert({
        tenant_id: tenantId,
        catalog_type: input.catalogType,
        value_key: input.valueKey,
        label: input.label.trim(),
        description: input.description ?? null,
        module_key: input.moduleKey,
        is_system: false,
        is_active: true,
        sort_order: input.sortOrder ?? 999,
      } as never)
      .select('*')
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapCatalogRow(data) };
  },

  async update(
    tenantId: string,
    id: string,
    patch: UpdateCatalogEntryInput,
  ): Promise<ServiceResult<CatalogEntry>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.label != null) payload.label = patch.label;
    if (patch.description !== undefined) payload.description = patch.description;
    if (patch.isActive != null) payload.is_active = patch.isActive;
    if (patch.sortOrder != null) payload.sort_order = patch.sortOrder;

    const { data, error } = await fromUnknownTable(supabase, 'catalog_entries')
      .update(payload as never)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*')
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) return { ok: false, error: 'Katalogeintrag nicht gefunden.' };
    return { ok: true, data: mapCatalogRow(data) };
  },

  async archive(tenantId: string, id: string): Promise<ServiceResult<CatalogEntry>> {
    return this.update(tenantId, id, { isActive: false });
  },

  async getDropdownOptions(
    tenantId: string,
    catalogType: CatalogEntry['catalogType'],
  ): Promise<ServiceResult<DropdownOption[]>> {
    const result = await this.list(tenantId, catalogType);
    if (!result.ok) return result;
    return {
      ok: true,
      data: result.data.map((e) => ({
        value: e.valueKey,
        label: e.label,
        description: e.description,
        isSystem: e.isSystem,
      })),
    };
  },
};
