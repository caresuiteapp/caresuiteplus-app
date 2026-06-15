import { beforeEach, describe, expect, it } from 'vitest';
import type { ProductKey, TenantProduct } from '@/types';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { hasPermission } from '@/lib/permissions';
import { isProductActive } from '@/lib/navigation';
import { getPermissionsForRole } from '@/data/demo/permissions';
import {
  activatePurchasedModule,
  calculateBillingItems,
  deactivateModule,
  getEffectiveModuleAccess,
  getModuleAccessSource,
  hasEffectiveModuleGateAccess,
  hasModuleAccess,
  hasOfficeBaseAccess,
  initializeModuleAccessStore,
  resetModuleAccessStore,
  resolveIncludedModules,
} from '@/lib/modules';

const TENANT = 'tenant-test-modules';

function baseModules(overrides: Partial<Record<ProductKey, Partial<TenantProduct>>> = {}): TenantProduct[] {
  const keys: ProductKey[] = ['office', 'assist', 'pflege', 'stationaer', 'beratung', 'akademie'];
  return keys.map((key) => ({
    id: `tp-${key}`,
    tenantId: TENANT,
    productId: `prod-${key}`,
    productKey: key,
    isActive: false,
    activatedAt: '2025-02-01T00:00:00.000Z',
    accessSource: 'free_available',
    includedByModuleKey: null,
    isBaseIncluded: false,
    billingStatus: 'free_available',
    accessType: 'free',
    priceCents: 0,
    premiumReady: false,
    ...overrides[key],
  }));
}

function seed(modules: TenantProduct[]) {
  initializeModuleAccessStore(TENANT, modules);
}

describe('moduleAccessService — Office Basis-Modul (Free Platform)', () => {
  beforeEach(() => {
    resetModuleAccessStore();
  });

  it('Office allein ist kostenlos aktiv', () => {
    seed(baseModules({ office: { isActive: true, accessSource: 'free_active', billingStatus: 'free_active' } }));

    expect(hasModuleAccess('office', TENANT)).toBe(true);
    expect(hasOfficeBaseAccess(TENANT)).toBe(true);
    expect(getModuleAccessSource('office', TENANT)).toBe('free_active');
    expect(calculateBillingItems(TENANT).billableCount).toBe(0);
  });

  it('Assist aktiviert Office automatisch', () => {
    seed(baseModules());
    activatePurchasedModule(TENANT, 'assist');

    expect(hasModuleAccess('assist', TENANT)).toBe(true);
    expect(hasModuleAccess('office', TENANT)).toBe(true);
    expect(['free_active', 'included_base']).toContain(getModuleAccessSource('office', TENANT));
  });

  it('Pflege aktiviert Office automatisch', () => {
    seed(baseModules());
    activatePurchasedModule(TENANT, 'pflege');

    expect(hasModuleAccess('office', TENANT)).toBe(true);
  });

  it('mehrere Fachmodule — Office enthalten, Free Platform billableCount 0', () => {
    seed(baseModules());
    activatePurchasedModule(TENANT, 'assist');
    activatePurchasedModule(TENANT, 'pflege');

    const billing = calculateBillingItems(TENANT);
    expect(billing.totalActiveCount).toBe(3);
    expect(billing.billableCount).toBe(0);
    expect(billing.includedCount).toBeGreaterThanOrEqual(1);
  });

  it('Office bereits aktiv + Assist hinzugefügt — beide aktiv', () => {
    seed(
      baseModules({
        office: { isActive: true, accessSource: 'free_active', billingStatus: 'free_active' },
      }),
    );
    activatePurchasedModule(TENANT, 'assist');

    expect(hasModuleAccess('office', TENANT)).toBe(true);
    expect(hasModuleAccess('assist', TENANT)).toBe(true);
    expect(calculateBillingItems(TENANT).billableCount).toBe(0);
  });

  it('letztes Fachmodul deaktiviert — Office nur included_base wird deaktiviert', () => {
    seed(baseModules());
    activatePurchasedModule(TENANT, 'assist');
    expect(hasModuleAccess('office', TENANT)).toBe(true);

    deactivateModule(TENANT, 'assist');

    expect(hasModuleAccess('assist', TENANT)).toBe(false);
    expect(hasModuleAccess('office', TENANT)).toBe(false);
  });

  it('letztes Fachmodul deaktiviert — Office purchased/free_active bleibt aktiv', () => {
    seed(
      baseModules({
        office: { isActive: true, accessSource: 'free_active', billingStatus: 'free_active' },
      }),
    );
    activatePurchasedModule(TENANT, 'assist');
    deactivateModule(TENANT, 'assist');

    expect(hasModuleAccess('office', TENANT)).toBe(true);
    expect(getModuleAccessSource('office', TENANT)).toBe('free_active');
  });

  it('keine Module aktiv', () => {
    seed(baseModules());

    expect(hasModuleAccess('office', TENANT)).toBe(false);
    expect(hasOfficeBaseAccess(TENANT)).toBe(false);
    expect(calculateBillingItems(TENANT).totalActiveCount).toBe(0);
  });

  it('included_base Office kann nicht direkt deaktiviert werden', () => {
    seed(baseModules());
    activatePurchasedModule(TENANT, 'assist');

    const officeSource = getModuleAccessSource('office', TENANT);
    if (officeSource === 'included_base') {
      const result = deactivateModule(TENANT, 'office');
      expect(result.ok).toBe(false);
      expect(hasModuleAccess('office', TENANT)).toBe(true);
    } else {
      expect(hasModuleAccess('office', TENANT)).toBe(true);
    }
  });

  it('resolveIncludedModules fügt Office bei Fachmodulen hinzu', () => {
    expect(resolveIncludedModules(['assist'])).toContain('office');
    expect(resolveIncludedModules(['office'])).toEqual(['office']);
    expect(resolveIncludedModules([])).toEqual([]);
  });

  it('Modul-Gate: Assist impliziert Office-Zugriff', () => {
    seed(baseModules());
    activatePurchasedModule(TENANT, 'assist');

    expect(hasEffectiveModuleGateAccess('assist', TENANT)).toBe(true);
    expect(hasEffectiveModuleGateAccess('office', TENANT)).toBe(true);
  });

  it('isProductActive nutzt Office-Gate über aktives Fachmodul', () => {
    seed(baseModules());
    activatePurchasedModule(TENANT, 'assist');

    expect(isProductActive('office', TENANT)).toBe(true);
    expect(isProductActive('stationaer', TENANT)).toBe(false);
  });

  it('Rollen vs. Modul-Zugriff bleiben getrennt', () => {
    seed(baseModules());
    const permissionsBefore = getPermissionsForRole('nurse');
    activatePurchasedModule(TENANT, 'pflege');
    const permissionsAfter = getPermissionsForRole('nurse');

    expect(hasModuleAccess('office', TENANT)).toBe(true);
    expect(permissionsBefore).toEqual(permissionsAfter);
    expect(hasPermission('nurse', 'business.modules.manage')).toBe(false);
  });
});

describe('moduleAccessService — Demo-Mandant', () => {
  beforeEach(() => {
    resetModuleAccessStore();
    initializeModuleAccessStore(DEMO_TENANT_ID);
  });

  it('Demo-Mandant hat Office und aktive Fachmodule (free_active)', () => {
    expect(hasModuleAccess('office', DEMO_TENANT_ID)).toBe(true);
    expect(hasModuleAccess('assist', DEMO_TENANT_ID)).toBe(true);
    expect(hasModuleAccess('stationaer', DEMO_TENANT_ID)).toBe(false);
    const office = getEffectiveModuleAccess(DEMO_TENANT_ID).find((m) => m.productKey === 'office');
    expect(['free_active', 'purchased']).toContain(office?.accessSource);
  });
});
