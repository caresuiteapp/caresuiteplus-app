import { beforeEach, describe, expect, it } from 'vitest';
import type { ProductKey, TenantProduct } from '@/types';
import {
  activateFreeModule,
  getEffectiveModuleAccess,
  hasEffectiveModuleGateAccess,
  hasModuleAccess,
  initializeModuleAccessStore,
  UNRELEASED_MODULE_KEYS,
} from '@/lib/modules/moduleAccessService';

const TENANT = 'tenant-unreleased-lock';
const LOCKED: ProductKey[] = ['pflege', 'stationaer', 'beratung', 'akademie'];

function activeModule(productKey: ProductKey): TenantProduct {
  return {
    id: `tp-${productKey}`,
    tenantId: TENANT,
    productId: `prod-${productKey}`,
    productKey,
    isActive: true,
    activatedAt: new Date().toISOString(),
    accessSource: 'free_active',
    includedByModuleKey: null,
    isBaseIncluded: false,
    billingStatus: 'free_active',
    accessType: 'free',
    priceCents: 0,
    premiumReady: true,
  };
}

describe('global lock for unreleased modules', () => {
  beforeEach(() => initializeModuleAccessStore(TENANT, LOCKED.map(activeModule)));

  it('keeps the exact unreleased module list centrally defined', () => {
    expect(UNRELEASED_MODULE_KEYS).toEqual(LOCKED);
  });

  it.each(LOCKED)('denies %s even when stale tenant data says active', (productKey) => {
    expect(hasModuleAccess(productKey, TENANT)).toBe(false);
    expect(hasEffectiveModuleGateAccess(productKey, TENANT)).toBe(false);

    const effective = getEffectiveModuleAccess(TENANT).find(
      (module) => module.productKey === productKey,
    );
    expect(effective).toMatchObject({
      isActive: false,
      isEffective: false,
      accessSource: 'disabled',
      billingStatus: 'premium_prepared',
      premiumReady: false,
    });
  });

  it.each(LOCKED)('rejects activation of %s for every tenant', (productKey) => {
    const result = activateFreeModule(TENANT, productKey);
    expect(result.ok).toBe(false);
  });
});
