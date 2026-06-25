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
import type { ServiceResult } from '@/types';
import { buildAssistCatalogSnapshot } from '@/data/seeds/assistCatalogSeeds';

const snapshot = buildAssistCatalogSnapshot();

type TenantStore = {
  groups: CatalogGroup[];
  definitions: CatalogDefinition[];
  items: CatalogItem[];
  bindings: TemplateBinding[];
  deactivations: Set<string>;
  audit: CatalogAuditEvent[];
};

const tenantStores = new Map<string, TenantStore>();

function cloneStore(): TenantStore {
  return {
    groups: snapshot.groups.map((g) => ({ ...g })),
    definitions: snapshot.definitions.map((d) => ({ ...d })),
    items: snapshot.items.map((i) => ({ ...i, payloadJson: { ...i.payloadJson }, tags: [...i.tags] })),
    bindings: snapshot.bindings.map((b) => ({ ...b, conditionsJson: { ...b.conditionsJson } })),
    deactivations: new Set(),
    audit: [],
  };
}

function store(tenantId: string): TenantStore {
  if (!tenantStores.has(tenantId)) tenantStores.set(tenantId, cloneStore());
  return tenantStores.get(tenantId)!;
}

function now(): string {
  return new Date().toISOString();
}

function isItemVisible(item: CatalogItem, deactivations: Set<string>, includeInactive?: boolean): boolean {
  if (deactivations.has(item.id)) return Boolean(includeInactive);
  if (!includeInactive && !item.isActive) return false;
  return true;
}

function mapItemWithDeactivation(item: CatalogItem, deactivations: Set<string>): CatalogItem {
  if (deactivations.has(item.id)) return { ...item, isActive: false };
  return item;
}

export const assistCatalogDemoRepository = {
  async listGroups(tenantId: string): Promise<ServiceResult<CatalogGroup[]>> {
    const s = store(tenantId);
    return { ok: true, data: s.groups.filter((g) => g.isActive).sort((a, b) => a.sortOrder - b.sortOrder) };
  },

  async listDefinitions(
    tenantId: string,
    filters: CatalogListFilters = {},
  ): Promise<ServiceResult<CatalogDefinition[]>> {
    const s = store(tenantId);
    let rows = [...s.definitions];
    if (filters.groupKey) {
      const g = s.groups.find((x) => x.groupKey === filters.groupKey);
      rows = rows.filter((d) => d.groupId === g?.id);
    }
    if (filters.catalogKey) rows = rows.filter((d) => d.catalogKey === filters.catalogKey);
    if (filters.moduleScope) rows = rows.filter((d) => d.moduleScope === filters.moduleScope);
    if (filters.isActive === true) rows = rows.filter((d) => d.isActive);
    if (filters.isActive === false) rows = rows.filter((d) => !d.isActive);
    if (filters.isSystem === true) rows = rows.filter((d) => d.isSystemDefault);
    if (filters.isSystem === false) rows = rows.filter((d) => !d.isSystemDefault);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter((d) => `${d.name} ${d.catalogKey}`.toLowerCase().includes(q));
    }
    return { ok: true, data: rows.sort((a, b) => a.sortOrder - b.sortOrder) };
  },

  async listItems(
    tenantId: string,
    catalogKey: string,
    filters: CatalogListFilters = {},
  ): Promise<ServiceResult<CatalogItem[]>> {
    const s = store(tenantId);
    const def = s.definitions.find((d) => d.catalogKey === catalogKey);
    if (!def) return { ok: true, data: [] };
    let rows = s.items.filter((i) => i.catalogId === def.id && isItemVisible(i, s.deactivations, filters.includeInactive));
    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter((i) => `${i.label} ${i.itemKey}`.toLowerCase().includes(q));
    }
    rows = rows.map((i) => mapItemWithDeactivation(i, s.deactivations));
    return { ok: true, data: rows.sort((a, b) => a.sortOrder - b.sortOrder) };
  },

  async createItem(
    tenantId: string,
    input: CreateCatalogItemInput,
  ): Promise<ServiceResult<CatalogItem>> {
    const s = store(tenantId);
    const item: CatalogItem = {
      id: `tenant-item-${Date.now()}`,
      tenantId,
      catalogId: input.catalogId,
      parentItemId: input.parentItemId ?? null,
      itemKey: input.itemKey,
      label: input.label,
      shortLabel: input.shortLabel ?? null,
      description: input.description ?? null,
      helperText: input.helperText ?? null,
      tags: input.tags ?? [],
      icon: input.icon ?? null,
      color: input.color ?? null,
      sortOrder: input.sortOrder ?? s.items.length,
      isSystemDefault: false,
      isActive: true,
      isBillableRelevant: input.isBillableRelevant ?? false,
      isDocumentationRequired: input.isDocumentationRequired ?? false,
      isSignatureRelevant: input.isSignatureRelevant ?? false,
      isRiskRelevant: input.isRiskRelevant ?? false,
      defaultDurationMinutes: input.defaultDurationMinutes ?? null,
      defaultPriceHint: null,
      defaultUnit: null,
      payloadJson: input.payloadJson ?? {},
      createdAt: now(),
      updatedAt: now(),
    };
    s.items.push(item);
    s.audit.push({
      id: `audit-${Date.now()}`,
      tenantId,
      entityType: 'catalog_item',
      entityId: item.id,
      action: 'create',
      moduleScope: 'assist',
      actorUserId: null,
      oldValueJson: null,
      newValueJson: item as unknown as Record<string, unknown>,
      summary: `Eintrag "${item.label}" angelegt`,
      createdAt: now(),
    });
    return { ok: true, data: item };
  },

  async updateItem(
    tenantId: string,
    itemId: string,
    patch: UpdateCatalogItemInput,
  ): Promise<ServiceResult<CatalogItem>> {
    const s = store(tenantId);
    const idx = s.items.findIndex((i) => i.id === itemId && (i.tenantId === tenantId || i.tenantId === null));
    if (idx < 0) return { ok: false, error: 'Eintrag nicht gefunden.' };
    const prev = s.items[idx];
    if (prev.isSystemDefault && prev.tenantId === null) return { ok: false, error: 'Systemeinträge sind schreibgeschützt.' };
    const next = {
      ...prev,
      ...patch,
      payloadJson: { ...prev.payloadJson, ...(patch.payloadJson ?? {}) },
      updatedAt: now(),
    };
    s.items[idx] = next;
    return { ok: true, data: next };
  },

  async deactivateItem(tenantId: string, itemId: string): Promise<ServiceResult<CatalogItem>> {
    const s = store(tenantId);
    const item = s.items.find((i) => i.id === itemId);
    if (!item) return { ok: false, error: 'Eintrag nicht gefunden.' };
    if (item.isSystemDefault && item.tenantId === null) {
      s.deactivations.add(itemId);
      return { ok: true, data: { ...item, isActive: false } };
    }
    return this.updateItem(tenantId, itemId, { isActive: false });
  },

  async listBindings(tenantId: string): Promise<ServiceResult<TemplateBinding[]>> {
    return { ok: true, data: store(tenantId).bindings };
  },

  async listAudit(tenantId: string): Promise<ServiceResult<CatalogAuditEvent[]>> {
    return { ok: true, data: store(tenantId).audit.slice().reverse() };
  },

  async copySystemCatalogToTenant(tenantId: string, catalogKey: string): Promise<ServiceResult<CatalogDefinition>> {
    const s = store(tenantId);
    const systemDef = s.definitions.find((d) => d.catalogKey === catalogKey && d.isSystemDefault);
    if (!systemDef) return { ok: false, error: 'Systemkatalog nicht gefunden.' };
    const copy: CatalogDefinition = {
      ...systemDef,
      id: `tenant-def-${catalogKey}-${Date.now()}`,
      tenantId,
      isSystemDefault: false,
      isEditable: true,
      createdAt: now(),
      updatedAt: now(),
    };
    s.definitions.push(copy);
    const systemItems = s.items.filter((i) => i.catalogId === systemDef.id);
    for (const si of systemItems) {
      s.items.push({
        ...si,
        id: `tenant-copy-${si.id}-${Date.now()}`,
        tenantId,
        catalogId: copy.id,
        parentItemId: si.parentItemId
          ? s.items.find((x) => x.itemKey === si.itemKey && x.catalogId === copy.id)?.id ?? null
          : null,
        isSystemDefault: false,
        createdAt: now(),
        updatedAt: now(),
      });
    }
    return { ok: true, data: copy };
  },

  resetForTests(): void {
    tenantStores.clear();
  },
};
