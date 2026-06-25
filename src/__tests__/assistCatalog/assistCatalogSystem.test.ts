import {
  buildAssistCatalogSnapshot,
  getCatalogItemsByKey,
  getPackageChildTasks,
} from '@/data/seeds/assistCatalogSeeds';
import { assistCatalogDemoRepository } from '@/lib/assistCatalog/assistCatalogDemoRepository';
import {
  loadAssistAssignmentOptions,
  loadCatalogItems,
  loadCatalogs,
} from '@/lib/assistCatalog';
import { loadTaskPackageItems } from '@/lib/assistCatalog/assistTaskPackageService';
import { catalogItemsToTaskDrafts } from '@/lib/assistCatalog/assistAssignmentOptionsService';

const TENANT = 'tenant-assist-catalog-test';
const ADMIN = 'business_admin' as const;

describe('assistCatalogSeeds', () => {
  it('builds complete system snapshot without duplicates', () => {
    const snap = buildAssistCatalogSnapshot();
    const keys = new Set(snap.items.map((i) => `${i.catalogId}::${i.itemKey}`));
    expect(keys.size).toBe(snap.items.length);
    expect(snap.definitions.length).toBeGreaterThanOrEqual(20);
    expect(getCatalogItemsByKey('assist.assignment.subjects').length).toBe(30);
    expect(getCatalogItemsByKey('assist.task.packages').length).toBe(15);
  });

  it('resolves package child tasks', () => {
    const packages = getCatalogItemsByKey('assist.task.packages');
    const pkg = packages.find((p) => p.itemKey === 'hw_standard_2h');
    expect(pkg).toBeDefined();
    const children = getPackageChildTasks(pkg!.id);
    expect(children.length).toBeGreaterThan(5);
    expect(children.some((c) => c.payloadJson.isMandatory)).toBe(true);
  });
});

describe('assistCatalogService (demo)', () => {
  beforeEach(() => {
    assistCatalogDemoRepository.resetForTests();
  });

  it('loads system catalogs for tenant', async () => {
    const defs = await loadCatalogs(TENANT, { moduleScope: 'assist' }, ADMIN);
    expect(defs.ok).toBe(true);
    if (defs.ok) {
      expect(defs.data.some((d) => d.catalogKey === 'assist.assignment.subjects')).toBe(true);
    }
  });

  it('loads assignment subjects', async () => {
    const items = await loadCatalogItems(TENANT, 'assist.assignment.subjects', {}, ADMIN);
    expect(items.ok).toBe(true);
    if (items.ok) expect(items.data.length).toBe(30);
  });

  it('creates tenant catalog item and writes audit', async () => {
    const defs = await loadCatalogs(TENANT, { catalogKey: 'assist.assignment.subjects' }, ADMIN);
    expect(defs.ok).toBe(true);
    if (!defs.ok) return;
    const created = await assistCatalogDemoRepository.createItem(TENANT, {
      catalogId: defs.data[0].id,
      itemKey: 'custom_betreff',
      label: 'Individueller Testbetreff',
    });
    expect(created.ok).toBe(true);
    const audit = await assistCatalogDemoRepository.listAudit(TENANT);
    expect(audit.ok).toBe(true);
    if (audit.ok) expect(audit.data.some((e) => e.action === 'create')).toBe(true);
  });

  it('deactivates system item for tenant overlay', async () => {
    const items = await loadCatalogItems(TENANT, 'assist.assignment.subjects', {}, ADMIN);
    expect(items.ok).toBe(true);
    if (!items.ok) return;
    const first = items.data[0];
    const deactivated = await assistCatalogDemoRepository.deactivateItem(TENANT, first.id);
    expect(deactivated.ok).toBe(true);
    const reloaded = await loadCatalogItems(TENANT, 'assist.assignment.subjects', { includeInactive: true }, ADMIN);
    if (reloaded.ok) {
      expect(reloaded.data.find((i) => i.id === first.id)?.isActive).toBe(false);
    }
  });
});

describe('assistAssignmentOptionsService', () => {
  beforeEach(() => {
    assistCatalogDemoRepository.resetForTests();
  });

  it('aggregates assignment options', async () => {
    const res = await loadAssistAssignmentOptions(TENANT, ADMIN);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.subjects.length).toBe(30);
      expect(res.data.taskPackages.length).toBe(15);
      expect(res.data.documentationBlocks.length).toBeGreaterThan(10);
    }
  });

  it('loads task package items as drafts', async () => {
    const packages = await loadCatalogItems(TENANT, 'assist.task.packages', {}, ADMIN);
    expect(packages.ok).toBe(true);
    if (!packages.ok) return;
    const pkg = packages.data.find((p) => !p.parentItemId && p.itemKey === 'hw_standard_2h');
    expect(pkg).toBeDefined();
    const tasks = await loadTaskPackageItems(TENANT, pkg!.id, ADMIN);
    expect(tasks.ok).toBe(true);
    if (tasks.ok) {
      expect(tasks.data.length).toBeGreaterThan(5);
      expect(catalogItemsToTaskDrafts([])).toEqual([]);
    }
  });

  it('excludes not_executable tasks from assignment options', async () => {
    const res = await loadAssistAssignmentOptions(TENANT, ADMIN);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.taskItems.every((t) => !t.payloadJson.notExecutable)).toBe(true);
    }
  });
});

describe('tenant isolation', () => {
  beforeEach(() => {
    assistCatalogDemoRepository.resetForTests();
  });

  it('tenant-created items are scoped to tenant store', async () => {
    const defs = await loadCatalogs(TENANT, { catalogKey: 'assist.assignment.subjects' }, ADMIN);
    if (!defs.ok) throw new Error('defs failed');
    await assistCatalogDemoRepository.createItem(TENANT, {
      catalogId: defs.data[0].id,
      itemKey: 'tenant_only',
      label: 'Nur Mandant A',
    });
    const other = await loadCatalogItems('tenant-other', 'assist.assignment.subjects', {}, ADMIN);
    expect(other.ok).toBe(true);
    if (other.ok) {
      expect(other.data.some((i) => i.itemKey === 'tenant_only')).toBe(false);
    }
  });
});
