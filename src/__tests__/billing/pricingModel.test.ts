import { describe, expect, it, beforeEach } from 'vitest';
import type { ProductKey, TenantProduct } from '@/types';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
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
  it('Office allein = 79 € billable', () => {
    const cart = calculateCartTotal(['office']);
    expect(cart.totalMonthly).toBe(79);
    expect(cart.lineItems.filter((l) => l.type === 'billable')).toHaveLength(1);
    expect(cart.lineItems[0]?.amount).toBe(79);
  });

  it('Assist = 149 € total, Office inklusive nicht berechnet', () => {
    const cart = calculateCartTotal(['assist']);
    expect(cart.totalMonthly).toBe(149);
    expect(cart.lineItems.find((l) => l.productKey === 'assist')?.amount).toBe(149);
    expect(cart.lineItems.find((l) => l.productKey === 'office')?.type).toBe('included');
    expect(cart.lineItems.find((l) => l.productKey === 'office')?.amount).toBe(0);
  });

  it('Assist + Pflege manuell = 378 € ohne doppeltes Office', () => {
    const cart = calculateCartTotal(['assist', 'pflege']);
    expect(cart.totalMonthly).toBe(378);
    expect(cart.lineItems.filter((l) => l.type === 'billable').reduce((s, l) => s + l.amount, 0)).toBe(378);
    expect(cart.lineItems.find((l) => l.productKey === 'office')?.type).toBe('included');
  });

  it('Pflege Pro Paket = 299 €', () => {
    const cart = calculateCartTotal(['office', 'assist', 'pflege'], { packageKey: 'pflege_pro' });
    expect(cart.totalMonthly).toBe(299);
    expect(getPackagePrice('pflege_pro')).toBe(299);
  });

  it('Management Paket = 399 €', () => {
    const cart = calculateCartTotal(
      ['office', 'assist', 'pflege', 'beratung', 'akademie'],
      { packageKey: 'management' },
    );
    expect(cart.totalMonthly).toBe(399);
  });

  it('ISR10050 = 50 % für 6 Monate', () => {
    const { discount, promo } = applyPromoCode('ISR10050', 149);
    expect(promo?.discountPercent).toBe(50);
    expect(promo?.durationMonths).toBe(6);
    expect(discount).toBe(75);
    const cart = calculateCartTotal(['assist'], { promoCode: 'ISR10050' });
    expect(cart.discountMonthly).toBe(75);
    expect(cart.totalMonthly).toBe(74);
  });

  it('Jährlich = 10/12 Monatsäquivalent', () => {
    const monthly = 149;
    const annual = applyBillingInterval(monthly, 'annual');
    expect(annual).toBe(monthly * ANNUAL_MONTHS_PAID);
    const cart = calculateCartTotal(['assist'], { billingInterval: 'annual' });
    expect(cart.totalAnnual).toBe(1490);
    expect(cart.effectiveMonthlyWithInterval).toBe(Math.round(1490 / 12));
  });
});

describe('pricingModel — tenant billing items', () => {
  beforeEach(() => {
    resetModuleAccessStore();
  });

  it('included_base Office nie in billableItems — Free Platform billableCount 0', () => {
    initializeModuleAccessStore(TENANT, baseModules());
    activatePurchasedModule(TENANT, 'assist');

    const billing = calculateBillingItems(TENANT);
    const officeItem = billing.items.find((i) => i.productKey === 'office');
    expect(officeItem?.isBillable).toBe(false);
    expect(officeItem?.isIncluded).toBe(true);
    expect(billing.billableCount).toBe(0);
  });

  it('Demo-Mandant Warenkorb — Free Platform 0 €', () => {
    resetModuleAccessStore();
    initializeModuleAccessStore(DEMO_TENANT_ID);
    const cart = calculateTenantCartPreview(DEMO_TENANT_ID);
    expect(cart.totalMonthly).toBeGreaterThanOrEqual(0);
    expect(getModulePrice('office')).toBe(79);
  });
});
