import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  hasEffectiveModuleGateAccess,
  hasLegacyTenantModuleGateAccess,
  initializeModuleAccessStore,
  resetModuleAccessStore,
} from '@/lib/modules/moduleAccessService';
import { evaluatePlatformModuleAccess } from '@/lib/modules/platformModuleKeyMap';
import {
  hasPlatformModuleHydration,
  isProductAllowedByPlatform,
  resetPlatformTenantModuleStore,
  seedPlatformTenantModulesForDemo,
} from '@/lib/modules/platformTenantModuleAccess';
import { checkProductAccess } from '@/lib/navigation/redirects';
import { resolveModuleNavState } from '@/lib/modules/moduleVisibilityService';

const TENANT = 'tenant-platform-gate-001';

describe('Platform tenant module enforcement', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    resetModuleAccessStore();
    resetPlatformTenantModuleStore();
    initializeModuleAccessStore(TENANT);
  });

  afterEach(() => {
    resetModuleAccessStore();
    resetPlatformTenantModuleStore();
  });

  it('1. enabled platform module → Zugriff erlaubt', () => {
    seedPlatformTenantModulesForDemo(TENANT, [
      {
        moduleKey: 'assist',
        status: 'enabled',
        isTrial: false,
        trialEndsAt: null,
        startsAt: null,
        endsAt: null,
        manualOverride: false,
      },
    ]);
    expect(hasPlatformModuleHydration(TENANT)).toBe(true);
    expect(isProductAllowedByPlatform(TENANT, 'assist', false)).toBe(true);
    expect(hasEffectiveModuleGateAccess('assist', TENANT)).toBe(true);
  });

  it('2. disabled platform module → Zugriff verweigert', () => {
    seedPlatformTenantModulesForDemo(TENANT, [
      {
        moduleKey: 'assist',
        status: 'disabled',
        isTrial: false,
        trialEndsAt: null,
        startsAt: null,
        endsAt: null,
        manualOverride: true,
      },
    ]);
    expect(hasEffectiveModuleGateAccess('assist', TENANT)).toBe(false);
  });

  it('3. locked platform module → Zugriff verweigert', () => {
    const decision = evaluatePlatformModuleAccess(
      {
        moduleKey: 'care',
        status: 'locked',
        isTrial: false,
        trialEndsAt: null,
        startsAt: null,
        endsAt: null,
        manualOverride: true,
      },
      true,
    );
    expect(decision.source).toBe('platform');
    expect(decision.allowed).toBe(false);
  });

  it('4. expired trial → Zugriff verweigert', () => {
    seedPlatformTenantModulesForDemo(TENANT, [
      {
        moduleKey: 'care',
        status: 'trial',
        isTrial: true,
        trialEndsAt: '2020-01-01T00:00:00.000Z',
        startsAt: null,
        endsAt: null,
        manualOverride: false,
      },
    ]);
    expect(hasEffectiveModuleGateAccess('pflege', TENANT)).toBe(false);
  });

  it('5. active trial → Zugriff erlaubt', () => {
    seedPlatformTenantModulesForDemo(TENANT, [
      {
        moduleKey: 'care',
        status: 'trial',
        isTrial: true,
        trialEndsAt: '2099-01-01T00:00:00.000Z',
        startsAt: null,
        endsAt: null,
        manualOverride: false,
      },
    ]);
    expect(hasEffectiveModuleGateAccess('pflege', TENANT)).toBe(true);
  });

  it('6. missing platform entry + tenant_products aktiv → Fallback erlaubt', () => {
    seedPlatformTenantModulesForDemo(TENANT, []);
    expect(hasLegacyTenantModuleGateAccess('office', TENANT)).toBe(true);
    expect(hasEffectiveModuleGateAccess('office', TENANT)).toBe(true);
  });

  it('7. explicit platform disabled überschreibt tenant_products enabled', () => {
    seedPlatformTenantModulesForDemo(TENANT, [
      {
        moduleKey: 'office',
        status: 'disabled',
        isTrial: false,
        trialEndsAt: null,
        startsAt: null,
        endsAt: null,
        manualOverride: true,
      },
    ]);
    expect(hasLegacyTenantModuleGateAccess('office', TENANT)).toBe(true);
    expect(hasEffectiveModuleGateAccess('office', TENANT)).toBe(false);
  });

  it('8. Navigation blendet deaktiviertes Modul aus (admin bypass blockiert bei platform deny)', () => {
    seedPlatformTenantModulesForDemo(TENANT, [
      {
        moduleKey: 'assist',
        status: 'disabled',
        isTrial: false,
        trialEndsAt: null,
        startsAt: null,
        endsAt: null,
        manualOverride: true,
      },
    ]);
    const nav = resolveModuleNavState('assist', {
      tenantId: TENANT,
      roleKey: 'business_admin',
    });
    expect(nav.isNavigable).toBe(false);
  });

  it('9. Direkte Route wird geblockt', () => {
    seedPlatformTenantModulesForDemo(TENANT, [
      {
        moduleKey: 'assist',
        status: 'disabled',
        isTrial: false,
        trialEndsAt: null,
        startsAt: null,
        endsAt: null,
        manualOverride: true,
      },
    ]);
    const decision = checkProductAccess('/assist', 'business_admin', TENANT);
    expect(decision.shouldRedirect).toBe(true);
    expect(decision.message).toContain('nicht freigeschaltet');
  });

  it('10. Read-Gating schreibt kein Audit (reine Evaluierung)', () => {
    const before = evaluatePlatformModuleAccess(null, true);
    const after = evaluatePlatformModuleAccess(null, true);
    expect(before).toEqual(after);
  });
});

describe('Demo tenant ohne Platform-Hydration', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    resetPlatformTenantModuleStore();
    resetModuleAccessStore();
  });

  it('DEMO_TENANT_ID nutzt Legacy-Fallback ohne Hydration-Flag', () => {
    expect(hasPlatformModuleHydration(DEMO_TENANT_ID)).toBe(false);
    expect(hasEffectiveModuleGateAccess('office', DEMO_TENANT_ID)).toBe(true);
  });
});
