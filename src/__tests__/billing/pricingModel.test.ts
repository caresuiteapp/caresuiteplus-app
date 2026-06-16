import { describe, expect, it, beforeEach } from 'vitest';
import type { ProductKey, TenantProduct } from '@/types';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  activatePurchasedModule,
  calculateBillingItems,
  initializeModuleAccessStore,
  resetModuleAccessStore,
} from '@/lib/modules';
import {
  ANNUAL_MONTHS_PAID,
  applyBillingInterval,
  applyPromoCode,
  calculateCartTotal,
  calculateTenantCartPreview,
  formatPriceEur,
  getModulePrice,
  getPackagePrice,
} from '@/lib/billing';

const TENANT = 'tenant-billing-test';

function baseModules(overrides: Partial<Record<ProductKey, Partial<TenantProduct>>> = {}): TenantProduct[] {
  const keys: ProductKey[] = ['office', 'assist', 'pflege', 'stationaer', 'beratung', 'akademie'];
  return keys.map((key) => ({
    id: `tp-${key}`,
    tenantId: TENANT,
    productId: `prod-${key}`,
    productKey: key,
    isActive: false,
    activatedAt: '2025-02-01T00:00:00.000Z',
    accessSource: 'disabled',
    includedByModuleKey: null,
    isBaseIncluded: false,
    billingStatus: 'not_billed',
    ...overrides[key],
  }));
}

describe('pricingModel — catalog', () => {
  it('Office allein = 0 billable', () => {
    const cart = calculateCartTotal(['office']);
    expect(cart.totalMonthly).toBe(0);
    expect(cart.lineItems.filter((l) => l.type === 'billable')).toHaveLength(0);
  });

  it('Assist = 0 total, Office inklusive nicht berechnet', () => {
    const cart = calculateCartTotal(['assist']);
    expect(cart.totalMonthly).toBe(0);
    expect(cart.lineItems.find((l) => l.productKey === 'office')?.type).toBe('included');
    expect(cart.lineItems.find((l) => l.productKey === 'office')?.amount).toBe(0);
  });

  it('Assist + Pflege manuell = 0 ohne doppeltes Office', () => {
    const cart = calculateCartTotal(['assist', 'pflege']);
    expect(cart.totalMonthly).toBe(0);
    expect(cart.lineItems.filter((l) => l.type === 'billable').reduce((s, l) => s + l.amount, 0)).toBe(0);
    expect(cart.lineItems.find((l) => l.productKey === 'office')?.type).toBe('included');
  });

  it('Pflege Pro Paket = 0', () => {
    const cart = calculateCartTotal(['office', 'assist', 'pflege'], { packageKey: 'pflege_pro' });
    expect(cart.totalMonthly).toBe(0);
    expect(getPackagePrice('pflege_pro')).toBe(0);
  });

  it('Management Paket = 0', () => {
    const cart = calculateCartTotal(
      ['office', 'assist', 'pflege', 'beratung', 'akademie'],
      { packageKey: 'management' },
    );
    expect(cart.totalMonthly).toBe(0);
  });

  it('formatPriceEur hides zero amounts', () => {
    expect(formatPriceEur(0)).toBe('');
    expect(formatPriceEur(79)).toContain('79');
  });

  it('ISR10050 promo still applies to legacy amounts', () => {
    const { discount, promo } = applyPromoCode('ISR10050', 149);
    expect(promo?.discountPercent).toBe(50);
    expect(promo?.durationMonths).toBe(6);
    expect(discount).toBe(75);
  });

  it('Jährlich = 10/12 Monatsäquivalent', () => {
    const monthly = 149;
    const annual = applyBillingInterval(monthly, 'annual');
    expect(annual).toBe(monthly * ANNUAL_MONTHS_PAID);
    const cart = calculateCartTotal(['assist'], { billingInterval: 'annual' });
    expect(cart.totalAnnual).toBe(0);
    expect(cart.effectiveMonthlyWithInterval).toBe(0);
  });
});

describe('pricingModel — tenant billing items', () => {
  beforeEach(() => {
    resetModuleAccessStore();
  });

  it('included_base Office nie in billableItems — billableCount 0', () => {
    initializeModuleAccessStore(TENANT, baseModules());
    activatePurchasedModule(TENANT, 'assist');

    const billing = calculateBillingItems(TENANT);
    const officeItem = billing.items.find((i) => i.productKey === 'office');
    expect(officeItem?.isBillable).toBe(false);
    expect(officeItem?.isIncluded).toBe(true);
    expect(billing.billableCount).toBe(0);
  });

  it('Demo-Mandant Warenkorb — 0', () => {
    resetModuleAccessStore();
    initializeModuleAccessStore(DEMO_TENANT_ID);
    const cart = calculateTenantCartPreview(DEMO_TENANT_ID);
    expect(cart.totalMonthly).toBe(0);
    expect(getModulePrice('office')).toBe(0);
  });
});
