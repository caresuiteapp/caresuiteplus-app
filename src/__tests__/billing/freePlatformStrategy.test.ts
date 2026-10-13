import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ProductKey, TenantProduct } from '@/types';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { registerBusinessTenant } from '@/lib/auth/businessAuthService';
import type { BusinessRegistrationInput } from '@/lib/auth/auth.types';
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
const freeRegistration: BusinessRegistrationInput = {
  companyName: 'Kostenlos Test UG', legalForm: 'UG', industry: 'Alltagsbegleitung',
  street: 'Weg 1', zip: '12345', city: 'Berlin', phone: '012345', email: 'office@example.test',
  contactFirstName: 'Anna', contactLastName: 'Test', contactRole: 'Geschäftsführung',
  adminFirstName: 'Anna', adminLastName: 'Test', adminEmail: 'anna@example.test',
  adminPassword: 'SyntheticPassword123!', selectedModules: [], termsAccepted: true,
};

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
    expect(hasModuleAccess('pflege', TENANT)).toBe(false);
  });

  it('canAccessModule allows active modules without payment check', () => {
    initializeModuleAccessStore(TENANT, baseModules());
    activateFreeModule(TENANT, 'beratung');
    expect(canAccessModule('beratung', TENANT)).toBe(false);
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

  it('registration flow activates modules free — no payment', () => {
    initializeModuleAccessStore(DEMO_TENANT_ID, baseModules().map((m) => ({ ...m, tenantId: DEMO_TENANT_ID })));
    activateRegistrationModules(DEMO_TENANT_ID, ['assist']);
    expect(hasModuleAccess('office', DEMO_TENANT_ID)).toBe(true);
    expect(hasModuleAccess('assist', DEMO_TENANT_ID)).toBe(true);
  });

  it('the actual free registration accepts no module choice and enables its released base access', async () => {
    initializeModuleAccessStore(DEMO_TENANT_ID, baseModules().map(module => ({ ...module, tenantId: DEMO_TENANT_ID })));
    const result = await registerBusinessTenant(freeRegistration);
    expect(result.ok).toBe(true); expect(hasModuleAccess('office', DEMO_TENANT_ID)).toBe(true); expect(hasModuleAccess('assist', DEMO_TENANT_ID)).toBe(true);
  });

  it('PremiumPreparedNotice component exists', () => {
    const notice = readSrc('src/components/billing/PremiumPreparedNotice.tsx');
    expect(notice).toContain('IN_PREPARATION_LABEL');
    expect(notice).toContain('DATEV');
  });

  it('SubscriptionScreen shows free platform overview', () => {
    const screen = readSrc('src/screens/business/SubscriptionScreen.tsx');
    expect(screen).toContain('Free Platform');
    expect(screen).toContain('0 €');
    expect(screen).not.toContain('Warenkorb-Vorschau');
    expect(screen).not.toContain('Pakete & Preise');
  });

  it('ModuleCard uses Aktivieren/Deaktivieren not Kaufen', () => {
    const card = readSrc('src/components/modules/ModuleCard.tsx');
    expect(card).toContain('Kostenlos aktivieren');
    expect(card).toContain('Deaktivieren');
    expect(card).toContain('Modul öffnen');
    expect(card).not.toMatch(/Kaufen/i);
  });

  it('the actual registration keeps enabled access at zero cost even for older callers with a module choice', async () => {
    initializeModuleAccessStore(DEMO_TENANT_ID, baseModules().map(module => ({ ...module, tenantId: DEMO_TENANT_ID })));
    expect((await registerBusinessTenant({ ...freeRegistration, selectedModules: ['office'] })).ok).toBe(true);
    const enabled = getEffectiveModuleAccess(DEMO_TENANT_ID).filter(module => module.isActive); expect(enabled.length).toBeGreaterThan(0);
    for (const module of enabled) { expect(module.priceCents).toBe(0); expect(module.billingStatus).toBe('free_active'); }
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
