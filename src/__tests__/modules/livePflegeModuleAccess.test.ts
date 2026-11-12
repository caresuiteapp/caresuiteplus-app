import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantProduct } from '@/types';
import { DEFAULT_TENANT_MODULES } from '@/types/tenant/tenantCenter';
import {
  getEffectiveModuleAccess,
  getTenantModules,
  hasEffectiveModuleGateAccess,
  hasLegacyTenantModuleGateAccess,
  hasModuleAccess,
  initializeModuleAccessStore,
  resetModuleAccessStore,
  subscribeModuleAccess,
} from '@/lib/modules/moduleAccessService';
import {
  resetPlatformTenantModuleStore,
  seedPlatformTenantModulesForDemo,
} from '@/lib/modules/platformTenantModuleAccess';
import { getVisibleMainModuleRailItems } from '@/lib/navigation/mainmodulerail';
import { checkProductAccess } from '@/lib/navigation/redirects';
import { syncModuleAccessFromTenantSettings } from '@/lib/tenant/syncTenantModuleAccess';
import {
  resetTenantModuleSettingsCache,
  setTenantModuleSettingsCache,
} from '@/lib/tenant/tenantModuleSettingsCache';

const TENANT = 'tenant-live-pflege';

function product(overrides: Partial<TenantProduct> = {}): TenantProduct {
  return {
    id: 'pf-prod', tenantId: TENANT, productId: 'pflege-product', productKey: 'pflege',
    isActive: true, activatedAt: '2026-11-01T00:00:00Z', accessSource: 'free_active',
    includedByModuleKey: null, isBaseIncluded: false, billingStatus: 'free_active',
    accessType: 'free', priceCents: 0, premiumReady: false, ...overrides,
  };
}

function hydrateSettings(pflegeEnabled: boolean, tenantId = TENANT): void {
  const settings = { ...DEFAULT_TENANT_MODULES, pflegeEnabled };
  setTenantModuleSettingsCache(tenantId, settings);
  syncModuleAccessFromTenantSettings(tenantId, settings);
}

function railHasPflege(): boolean {
  return getVisibleMainModuleRailItems({ tenantId: TENANT, roleKey: 'business_admin' })
    .some((item) => item.key === 'pflege');
}

describe('Live-Pflege: Mandanteneinstellung und Produktfreigabe', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    resetModuleAccessStore();
    resetTenantModuleSettingsCache();
    resetPlatformTenantModuleStore();
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each([false, true])('behält die gespeicherte Deaktivierung bei beiden Antwortreihenfolgen (%s)', (productFirst) => {
    const entitlement = product();
    if (productFirst) initializeModuleAccessStore(TENANT, [entitlement], 'live');
    hydrateSettings(false);
    if (!productFirst) initializeModuleAccessStore(TENANT, [entitlement], 'live');

    expect(getTenantModules(TENANT).find((row) => row.productKey === 'pflege')).toEqual(entitlement);
    expect(getEffectiveModuleAccess(TENANT).find((row) => row.productKey === 'pflege')?.isEffective).toBe(false);
    expect(hasModuleAccess('pflege', TENANT)).toBe(false);
    expect(railHasPflege()).toBe(false);

    hydrateSettings(true);
    expect(hasEffectiveModuleGateAccess('pflege', TENANT)).toBe(true);
    expect(railHasPflege()).toBe(true);
  });

  it('zeigt den Bereich erst mit den zwei Antworten und meldet eine späte Produktfreigabe', () => {
    hydrateSettings(true);
    expect(railHasPflege()).toBe(false);
    const observed: boolean[] = [];
    const unsubscribe = subscribeModuleAccess(() => { observed.push(railHasPflege()); });
    initializeModuleAccessStore(TENANT, [product()], 'live');
    unsubscribe();
    expect(observed).toEqual([true]);
  });

  it.each([
    product({ isActive: false }),
    product({ billingStatus: 'admin_disabled' }),
    product({ accessSource: 'expired' }),
  ])('erzeugt aus dem Schalter keine fehlende oder gesperrte Lizenz: %o', (entitlement) => {
    initializeModuleAccessStore(TENANT, [entitlement], 'live');
    hydrateSettings(true);
    expect(hasEffectiveModuleGateAccess('pflege', TENANT)).toBe(false);
    expect(railHasPflege()).toBe(false);
    expect(getTenantModules(TENANT).find((row) => row.productKey === 'pflege')).toEqual(entitlement);
  });

  it('behält explizite Plattform-Entscheidungen vor dem lokalen Fallback bei', () => {
    initializeModuleAccessStore(TENANT, [product()], 'live');
    hydrateSettings(true);
    const record = {
      moduleKey: 'care', isTrial: false, trialEndsAt: null,
      startsAt: null, endsAt: null, manualOverride: true,
    };
    seedPlatformTenantModulesForDemo(TENANT, [{ ...record, status: 'locked' }]);
    expect(hasLegacyTenantModuleGateAccess('pflege', TENANT)).toBe(true);
    expect(hasEffectiveModuleGateAccess('pflege', TENANT)).toBe(false);
    expect(checkProductAccess('/pflege', 'business_admin', TENANT).shouldRedirect).toBe(true);

    hydrateSettings(false);
    seedPlatformTenantModulesForDemo(TENANT, [{ ...record, status: 'enabled' }]);
    expect(hasLegacyTenantModuleGateAccess('pflege', TENANT)).toBe(false);
    expect(hasEffectiveModuleGateAccess('pflege', TENANT)).toBe(true);
  });
});
