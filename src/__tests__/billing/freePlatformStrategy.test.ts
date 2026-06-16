import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ProductKey, TenantProduct } from '@/types';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { isFreePlatformEnabled, getFreePlatformModules } from '@/lib/billing/freePlatformService';
import { activateFreeModuleForTenant, activateRegistrationModules } from '@/lib/billing/moduleActivationService';
import { canAccessPremiumFeature } from '@/lib/billing/productAccessService';
import {
  activateFreeModule,
  canAccessModule,
  getEffectiveModuleAccess,
  hasModuleAccess,
  initializeModuleAccessStore,
  resetModuleAccessStore,
} from '@/lib/modules';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const TENANT = 'tenant-free-platform-test';

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

describe('Free Platform Strategy', () => {
  beforeEach(() => {
    resetModuleAccessStore();
  });

  it('isFreePlatformEnabled returns true', () => {
    expect(isFreePlatformEnabled()).toBe(true);
  });

  it('getFreePlatformModules includes office and platform features', () => {
    const modules = getFreePlatformModules();
    expect(modules).toContain('office');
    expect(modules).toContain('communication');
    expect(modules).toContain('reporting');
    expect(modules.length).toBeGreaterThanOrEqual(12);
  });

  it('activateFreeModuleForTenant activates without payment', () => {
    initializeModuleAccessStore(TENANT, baseModules());
    const result = activateFreeModuleForTenant(TENANT, 'assist');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(hasModuleAccess('assist', TENANT)).toBe(true);
    const module = result.data.find((m) => m.productKey === 'assist');
    expect(module?.billingStatus).toBe('free_active');
    expect(module?.priceCents).toBe(0);
  });

  it('CareSuite+ Office auto free on registration modules', () => {
    initializeModuleAccessStore(TENANT, baseModules());
    activateRegistrationModules(TENANT, ['assist', 'pflege']);
    expect(hasModuleAccess('office', TENANT)).toBe(true);
    expect(hasModuleAccess('assist', TENANT)).toBe(true);
    expect(hasModuleAccess('pflege', TENANT)).toBe(true);
  });

  it('canAccessModule allows active modules without payment check', () => {
    initializeModuleAccessStore(TENANT, baseModules());
    activateFreeModule(TENANT, 'beratung');
    expect(canAccessModule('beratung', TENANT)).toBe(true);
    expect(canAccessModule('stationaer', TENANT)).toBe(false);
  });

  it('canAccessModule blocks admin_disabled', () => {
    initializeModuleAccessStore(
      TENANT,
      baseModules({
        pflege: { isActive: false, billingStatus: 'admin_disabled', accessSource: 'disabled' },
      }),
    );
    expect(canAccessModule('pflege', TENANT)).toBe(false);
  });

  it('canAccessPremiumFeature returns false for prepared connectors', () => {
    expect(canAccessPremiumFeature('datev')).toBe(false);
    expect(canAccessPremiumFeature('kim')).toBe(false);
  });

  it('registration flow activates modules — no payment', () => {
    initializeModuleAccessStore(DEMO_TENANT_ID, baseModules().map((m) => ({ ...m, tenantId: DEMO_TENANT_ID })));
    activateRegistrationModules(DEMO_TENANT_ID, ['assist']);
    expect(hasModuleAccess('office', DEMO_TENANT_ID)).toBe(true);
    expect(hasModuleAccess('assist', DEMO_TENANT_ID)).toBe(true);
  });

  it('BusinessRegisterScreen has no payment steps', () => {
    const screen = readSrc('src/screens/auth/BusinessRegisterScreen.tsx');
    expect(screen).not.toContain('trialOrPurchase');
    expect(screen).not.toContain('Modul kaufen');
    expect(screen).toContain('Registrieren');
    expect(screen).toContain('Module aktivieren');
    expect(screen).not.toMatch(/€/);
    expect(screen).not.toMatch(/kostenlos/i);
  });

  it('PremiumPreparedNotice component exists', () => {
    const notice = readSrc('src/components/billing/PremiumPreparedNotice.tsx');
    expect(notice).toContain('preparedOnly');
    expect(notice).toContain('DATEV');
  });

  it('SubscriptionScreen shows platform overview without prices', () => {
    const screen = readSrc('src/screens/business/SubscriptionScreen.tsx');
    expect(screen).toContain('Plattform');
    expect(screen).not.toMatch(/€/);
    expect(screen).not.toContain('Warenkorb-Vorschau');
    expect(screen).not.toContain('Pakete & Preise');
  });

  it('ModuleCard uses Aktivieren not Kaufen', () => {
    const card = readSrc('src/components/modules/ModuleCard.tsx');
    expect(card).toContain('Aktivieren');
    expect(card).toContain('Modul öffnen');
    expect(card).not.toMatch(/Kaufen/i);
    expect(card).not.toMatch(/€/);
  });

  it('AppStartScreen has no price messaging', () => {
    const screen = readSrc('src/screens/AppStartScreen.tsx');
    expect(screen).not.toMatch(/€/);
    expect(screen).not.toMatch(/kostenlos/i);
  });

  it('CompanySetupScreen has no price displays', () => {
    const screen = readSrc('src/screens/onboarding/CompanySetupScreen.tsx');
    expect(screen).not.toMatch(/€/);
    expect(screen).not.toContain('formatPriceEur');
    expect(screen).toContain('Paket wählen');
  });

  it('demo tenant modules use free_active billing status', () => {
    initializeModuleAccessStore(DEMO_TENANT_ID);
    const modules = getEffectiveModuleAccess(DEMO_TENANT_ID);
    const active = modules.filter((m) => m.isActive);
    expect(active.length).toBeGreaterThan(0);
    for (const mod of active) {
      expect(['free_active', 'included_base', 'purchased']).toContain(mod.accessSource);
    }
  });
});
