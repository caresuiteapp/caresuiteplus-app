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
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  SYSTEM_CATALOG_ENTRIES,
  SYSTEM_TEMPLATES,
  SYSTEM_TEMPLATE_CATEGORIES,
} from '@/data/demo/templates';

let tenantTemplates: CareSuiteTemplate[] = [];
let tenantCatalogEntries: CatalogEntry[] = [];
let usageLogs: TemplateUsageLog[] = [];
let templateSettings: TenantTemplateSettings = {
  tenantId: DEMO_TENANT_ID,
  allowTenantOverrides: true,
  defaultLocale: 'de-DE',
  showSystemTemplates: true,
  updatedAt: new Date().toISOString(),
};

let idCounter = 1;

function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

function matchesFilters(t: CareSuiteTemplate, filters: TemplateListFilters, tenantId: string): boolean {
  const visible =
    t.scope === 'system' || (t.scope === 'tenant' && t.tenantId === tenantId);
  if (!visible) return false;
  if (filters.scope && t.scope !== filters.scope) return false;
  if (filters.moduleKey && t.moduleKey !== filters.moduleKey) return false;
  if (filters.templateType && t.templateType !== filters.templateType) return false;
  if (filters.status && t.status !== filters.status) return false;
  if (filters.categoryKey && t.categoryKey !== filters.categoryKey) return false;
  if (filters.search) {
    const q = filters.search.toLowerCase();
    const hay = `${t.title} ${t.description ?? ''} ${t.content} ${t.tags.join(' ')}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export function resetTemplateDemoStore(): void {
  tenantTemplates = [];
  tenantCatalogEntries = [];
  usageLogs = [];
  idCounter = 1;
  templateSettings = {
    tenantId: DEMO_TENANT_ID,
    allowTenantOverrides: true,
    defaultLocale: 'de-DE',
    showSystemTemplates: true,
    updatedAt: new Date().toISOString(),
  };
}

export const templateDemoRepository = {
  async list(tenantId: string, filters: TemplateListFilters = {}): Promise<ServiceResult<CareSuiteTemplate[]>> {
    const all = [...SYSTEM_TEMPLATES, ...tenantTemplates.filter((t) => t.tenantId === tenantId)];
    const filtered = all.filter((t) => matchesFilters(t, filters, tenantId));
    filtered.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'de'));
    return { ok: true, data: filtered };
  },

  async getById(tenantId: string, id: string): Promise<ServiceResult<CareSuiteTemplate | null>> {
    const all = [...SYSTEM_TEMPLATES, ...tenantTemplates.filter((t) => t.tenantId === tenantId)];
    const found = all.find((t) => t.id === id) ?? null;
    return { ok: true, data: found };
  },

  async create(tenantId: string, input: CreateTemplateInput, createdBy?: string | null): Promise<ServiceResult<CareSuiteTemplate>> {
    const now = new Date().toISOString();
    const created: CareSuiteTemplate = {
      id: nextId('tpl-tenant'),
      tenantId,
      scope: 'tenant',
      moduleKey: input.moduleKey,
      templateType: input.templateType,
      status: input.status ?? 'draft',
      title: input.title.trim(),
      description: input.description ?? null,
      categoryKey: input.categoryKey ?? null,
      content: input.content,
      variables: input.variables ?? [],
      tags: input.tags ?? [],
      sortOrder: 999,
      isDefault: false,
      isRequired: false,
      createdBy: createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    };
    tenantTemplates.push(created);
    return { ok: true, data: created };
  },

  async update(tenantId: string, id: string, patch: UpdateTemplateInput): Promise<ServiceResult<CareSuiteTemplate>> {
    const idx = tenantTemplates.findIndex((t) => t.id === id && t.tenantId === tenantId);
    if (idx < 0) return { ok: false, error: 'Nur Mandantenvorlagen können bearbeitet werden.' };
    const updated = {
      ...tenantTemplates[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    tenantTemplates[idx] = updated;
    return { ok: true, data: updated };
  },

  async archive(tenantId: string, id: string): Promise<ServiceResult<CareSuiteTemplate>> {
    return this.update(tenantId, id, { status: 'archived' });
  },

  async duplicateSystemForTenant(
    tenantId: string,
    systemTemplateId: string,
    createdBy?: string | null,
  ): Promise<ServiceResult<CareSuiteTemplate>> {
    const system = SYSTEM_TEMPLATES.find((t) => t.id === systemTemplateId);
    if (!system) return { ok: false, error: 'Systemvorlage nicht gefunden.' };
    return this.create(
      tenantId,
      {
        moduleKey: system.moduleKey,
        templateType: system.templateType,
        title: `${system.title} (Kopie)`,
        description: system.description,
        categoryKey: system.categoryKey,
        content: system.content,
        variables: system.variables,
        tags: [...system.tags, 'kopie'],
        status: 'draft',
      },
      createdBy,
    );
  },

  async getDashboardStats(tenantId: string): Promise<ServiceResult<TemplateDashboardStats>> {
    const all = [...SYSTEM_TEMPLATES, ...tenantTemplates.filter((t) => t.tenantId === tenantId)];
    const active = all.filter((t) => t.status === 'active');
    const archived = all.filter((t) => t.status === 'archived');
    const modules = new Set(all.map((t) => t.moduleKey));
    const usageCounts = new Map<string, number>();
    for (const log of usageLogs.filter((l) => l.tenantId === tenantId)) {
      usageCounts.set(log.templateId, (usageCounts.get(log.templateId) ?? 0) + 1);
    }
    const topTemplates = [...usageCounts.entries()]
      .map(([id, usageCount]) => {
        const t = all.find((x) => x.id === id);
        return t ? { id, title: t.title, usageCount } : null;
      })
      .filter((x): x is { id: string; title: string; usageCount: number } => x != null)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5);

    return {
      ok: true,
      data: {
        systemCount: SYSTEM_TEMPLATES.length,
        tenantCount: tenantTemplates.filter((t) => t.tenantId === tenantId).length,
        activeCount: active.length,
        archivedCount: archived.length,
        modulesWithTemplates: modules.size,
        topTemplates,
      },
    };
  },

  async logUsage(
    tenantId: string,
    templateId: string,
    moduleKey: CareSuiteTemplate['moduleKey'],
    context?: string | null,
  ): Promise<ServiceResult<TemplateUsageLog>> {
    const log: TemplateUsageLog = {
      id: nextId('tpl-usage'),
      tenantId,
      templateId,
      moduleKey,
      context: context ?? null,
      usedAt: new Date().toISOString(),
    };
    usageLogs.push(log);
    return { ok: true, data: log };
  },

  async getSettings(tenantId: string): Promise<ServiceResult<TenantTemplateSettings>> {
    return {
      ok: true,
      data: { ...templateSettings, tenantId },
    };
  },

  async updateSettings(
    tenantId: string,
    patch: Partial<Omit<TenantTemplateSettings, 'tenantId'>>,
  ): Promise<ServiceResult<TenantTemplateSettings>> {
    templateSettings = {
      ...templateSettings,
      ...patch,
      tenantId,
      updatedAt: new Date().toISOString(),
    };
    return { ok: true, data: templateSettings };
  },

  getCategories() {
    return SYSTEM_TEMPLATE_CATEGORIES;
  },
};

export const catalogDemoRepository = {
  async list(tenantId: string, catalogType?: CatalogEntry['catalogType']): Promise<ServiceResult<CatalogEntry[]>> {
    const system = SYSTEM_CATALOG_ENTRIES.filter((e) => !catalogType || e.catalogType === catalogType);
    const tenant = tenantCatalogEntries.filter(
      (e) => e.tenantId === tenantId && (!catalogType || e.catalogType === catalogType),
    );
    const merged = [...system, ...tenant].filter((e) => e.isActive);
    merged.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'de'));
    return { ok: true, data: merged };
  },

  async create(tenantId: string, input: CreateCatalogEntryInput): Promise<ServiceResult<CatalogEntry>> {
    const now = new Date().toISOString();
    const entry: CatalogEntry = {
      id: nextId('cat-tenant'),
      tenantId,
      catalogType: input.catalogType,
      valueKey: input.valueKey,
      label: input.label.trim(),
      description: input.description ?? null,
      moduleKey: input.moduleKey,
      isSystem: false,
      isActive: true,
      sortOrder: input.sortOrder ?? 999,
      createdAt: now,
      updatedAt: now,
    };
    tenantCatalogEntries.push(entry);
    return { ok: true, data: entry };
  },

  async update(tenantId: string, id: string, patch: UpdateCatalogEntryInput): Promise<ServiceResult<CatalogEntry>> {
    const idx = tenantCatalogEntries.findIndex((e) => e.id === id && e.tenantId === tenantId);
    if (idx < 0) return { ok: false, error: 'Nur Mandanten-Katalogeinträge können bearbeitet werden.' };
    tenantCatalogEntries[idx] = {
      ...tenantCatalogEntries[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    return { ok: true, data: tenantCatalogEntries[idx] };
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
