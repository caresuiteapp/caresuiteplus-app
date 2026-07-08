import { describe, expect, it } from 'vitest';
import {
  calculateBillingPreview,
  calculatePlatformPricing,
  calculateTenantEntitlements,
  getTenantEntitlements,
  hasTenantModuleAccess,
  nextPlanVersionNumber,
  resolveEffectivePlanVersion,
  resolveFeatureAvailability,
  resolveModuleStateForTenant,
  resolveTenantSubscriptionStatus,
  subscriptionBlocksAccess,
} from '@/lib/platformConsole/foundation';
import {
  platformRoleCanWrite,
  platformRoleHasCapability,
  validatePlatformReason,
} from '@/lib/platformConsole/platformCapabilities';
import type {
  PlatformBillingPreviewInput,
  PlatformEntitlementInput,
  PlatformPlanVersion,
  PlatformPricingInput,
  PlatformTenantDiscount,
} from '@/types/platformConsole/foundation';

const BASE_VERSIONS: PlatformPlanVersion[] = [
  {
    id: 'v1',
    planKey: 'starter',
    versionNumber: 1,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveUntil: '2026-06-01T00:00:00.000Z',
    monthlyPriceCents: 4900,
    yearlyPriceCents: 49000,
    currency: 'EUR',
    status: 'active',
  },
  {
    id: 'v2',
    planKey: 'starter',
    versionNumber: 2,
    effectiveFrom: '2026-06-01T00:00:00.000Z',
    effectiveUntil: null,
    monthlyPriceCents: 5900,
    yearlyPriceCents: 59000,
    currency: 'EUR',
    status: 'active',
  },
];

describe('Platform Pricing Engine', () => {
  it('wählt aktuelle Plan-Version korrekt', () => {
    const v = resolveEffectivePlanVersion(BASE_VERSIONS, 'starter', new Date('2026-07-01T00:00:00.000Z'));
    expect(v?.id).toBe('v2');
    expect(v?.monthlyPriceCents).toBe(5900);
  });

  it('behält alte Version bei historischem Datum', () => {
    const v = resolveEffectivePlanVersion(BASE_VERSIONS, 'starter', new Date('2026-03-01T00:00:00.000Z'));
    expect(v?.id).toBe('v1');
    expect(v?.monthlyPriceCents).toBe(4900);
  });

  it('berechnet nächste Versionsnummer', () => {
    expect(nextPlanVersionNumber(BASE_VERSIONS, 'starter')).toBe(3);
  });

  it('addiert Add-on Preise und Override', () => {
    const input: PlatformPricingInput = {
      planVersions: BASE_VERSIONS,
      planKey: 'starter',
      billingInterval: 'monthly',
      at: '2026-07-01T00:00:00.000Z',
      priceOverrideMonthlyCents: 5500,
      addons: [
        {
          addonKey: 'sms',
          addonName: 'SMS Paket',
          billingInterval: 'monthly',
          monthlyPriceCents: 1200,
          yearlyPriceCents: 12000,
          priceOverrideCents: 900,
          status: 'active',
        },
      ],
    };
    const result = calculatePlatformPricing(input);
    expect(result.planPriceCents).toBe(5500);
    expect(result.addonTotalCents).toBe(900);
    expect(result.subtotalCents).toBe(6400);
  });
});

describe('Platform Entitlement Calculator', () => {
  const baseInput = (): PlatformEntitlementInput => ({
    subscriptionStatus: 'active',
    planModules: [{ moduleKey: 'wfm', accessState: 'active' }],
    addonModules: [{ moduleKey: 'messaging', accessState: 'active' }],
    manualOverrides: [],
    betaModules: [],
    moduleCatalog: [
      { moduleKey: 'wfm', status: 'available' },
      { moduleKey: 'messaging', status: 'available' },
      { moduleKey: 'payroll', status: 'beta', isBeta: true },
    ],
  });

  it('aktiviert Plan- und Add-on Module', () => {
    const ents = calculateTenantEntitlements(baseInput());
    expect(hasTenantModuleAccess('wfm', ents)).toBe(true);
    expect(hasTenantModuleAccess('messaging', ents)).toBe(true);
  });

  it('beta nur mit Entitlement', () => {
    const withoutBeta = calculateTenantEntitlements(baseInput());
    expect(hasTenantModuleAccess('payroll', withoutBeta)).toBe(false);

    const withBeta = calculateTenantEntitlements({
      ...baseInput(),
      betaModules: ['payroll'],
    });
    expect(hasTenantModuleAccess('payroll', withBeta)).toBe(true);
  });

  it('coming_soon ist sichtbar aber nicht nutzbar', () => {
    const ents = calculateTenantEntitlements({
      ...baseInput(),
      planModules: [{ moduleKey: 'docs', accessState: 'coming_soon' }],
      moduleCatalog: [{ moduleKey: 'docs', status: 'available' }],
    });
    expect(resolveModuleStateForTenant('docs', ents)).toBe('coming_soon');
    expect(hasTenantModuleAccess('docs', ents)).toBe(false);
    expect(resolveFeatureAvailability('docs', ents)).toBe('visible_locked');
  });

  it('disabled ist nicht nutzbar', () => {
    const ents = calculateTenantEntitlements({
      ...baseInput(),
      planModules: [{ moduleKey: 'legacy', accessState: 'disabled' }],
      moduleCatalog: [{ moduleKey: 'legacy', status: 'disabled' }],
    });
    expect(hasTenantModuleAccess('legacy', ents)).toBe(false);
    expect(resolveFeatureAvailability('legacy', ents)).toBe('hidden');
  });

  it('suspended Subscription blockiert Entitlements', () => {
    const ents = calculateTenantEntitlements({
      ...baseInput(),
      subscriptionStatus: 'suspended',
    });
    expect(ents).toHaveLength(0);
    expect(subscriptionBlocksAccess('suspended')).toBe(true);
  });

  it('getTenantEntitlements liefert sortierte Liste', () => {
    const ents = getTenantEntitlements(baseInput());
    expect(ents.length).toBeGreaterThan(0);
    expect(resolveTenantSubscriptionStatus('active')).toBe('active');
  });
});

describe('Platform Billing Preview Engine', () => {
  const pricing = calculatePlatformPricing({
    planVersions: BASE_VERSIONS,
    planKey: 'starter',
    billingInterval: 'monthly',
    at: '2026-07-01T00:00:00.000Z',
    addons: [
      {
        addonKey: 'sms',
        addonName: 'SMS',
        billingInterval: 'monthly',
        monthlyPriceCents: 1000,
        yearlyPriceCents: 10000,
        priceOverrideCents: null,
        status: 'active',
      },
    ],
  });

  function preview(discounts: PlatformTenantDiscount[], credit = 0, at?: string) {
    const input: PlatformBillingPreviewInput = { pricing, discounts, creditBalanceCents: credit, at };
    return calculateBillingPreview(input);
  }

  it('berechnet Plan und Add-ons korrekt', () => {
    const result = preview([]);
    expect(result.subtotalCents).toBe(6900);
  });

  it('wendet Prozent-Rabatt korrekt an', () => {
    const result = preview([
      {
        discountKey: 'launch10',
        discountType: 'percentage',
        percentage: 10,
        amountCents: null,
        status: 'active',
        startsAt: null,
        endsAt: null,
      },
    ]);
    expect(result.discountCents).toBe(690);
    expect(result.totalCents).toBe(6210);
  });

  it('wendet Fixbetrag-Rabatt korrekt an', () => {
    const result = preview([
      {
        discountKey: 'goodwill',
        discountType: 'fixed_amount',
        percentage: null,
        amountCents: 500,
        status: 'active',
        startsAt: null,
        endsAt: null,
      },
    ]);
    expect(result.discountCents).toBe(500);
    expect(result.totalCents).toBe(6400);
  });

  it('wendet Credit an ohne negative Rechnung', () => {
    const result = preview([], 10000);
    expect(result.creditCents).toBe(6900);
    expect(result.totalCents).toBe(0);
  });

  it('ignoriert abgelaufenen Rabatt', () => {
    const result = preview([
      {
        discountKey: 'expired',
        discountType: 'percentage',
        percentage: 50,
        amountCents: null,
        status: 'active',
        startsAt: '2026-01-01T00:00:00.000Z',
        endsAt: '2026-02-01T00:00:00.000Z',
      },
    ], 0, '2026-07-01T00:00:00.000Z');
    expect(result.discountCents).toBe(0);
    expect(result.totalCents).toBe(6900);
  });

  it('ignoriert pausierten/inaktiven Rabatt', () => {
    const result = preview([
      {
        discountKey: 'paused',
        discountType: 'fixed_amount',
        percentage: null,
        amountCents: 1000,
        status: 'revoked',
        startsAt: null,
        endsAt: null,
      },
    ]);
    expect(result.discountCents).toBe(0);
  });
});

describe('Platform Foundation RPC rules (client-side RBAC/reason)', () => {
  it('Platform Owner darf schreiben', () => {
    expect(platformRoleHasCapability('platform_owner', 'plans.write')).toBe(true);
    expect(platformRoleCanWrite('platform_owner')).toBe(true);
  });

  it('Platform Viewer darf nicht schreiben', () => {
    expect(platformRoleHasCapability('platform_readonly', 'plans.write')).toBe(false);
    expect(platformRoleCanWrite('platform_readonly')).toBe(false);
  });

  it('Mandantenrolle hat keinen Platform-Zugriff', () => {
    expect(platformRoleHasCapability(null, 'plans.write')).toBe(false);
    expect(platformRoleHasCapability(null, 'billing.write')).toBe(false);
  });

  it('reason_required bei kritischen Aktionen', () => {
    expect(validatePlatformReason('')).toMatch(/Grund/);
    expect(validatePlatformReason('ab')).toMatch(/Grund/);
    expect(validatePlatformReason('Foundation Smoke Grund')).toBeNull();
  });
});
