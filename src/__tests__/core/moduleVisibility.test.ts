import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  activatePurchasedModule,
  initializeModuleAccessStore,
  resetModuleAccessStore,
} from '@/lib/modules/moduleAccessService';
import {
  isModuleScopeNavigable,
  isModuleScopeVisible,
  resolveModuleNavState,
  resolveModuleScopeFromPath,
} from '@/lib/modules';
import { checkModuleAccess, getModuleSwitcherItems, getTabsForArea } from '@/lib/navigation';

const TENANT = DEMO_TENANT_ID;
const ADMIN = 'business_admin' as const;
const NURSE = 'nurse' as const;

describe('moduleVisibilityService', () => {
  beforeEach(() => {
    vi.stubGlobal('__DEV__', false);
    resetModuleAccessStore();
    initializeModuleAccessStore(TENANT);
    activatePurchasedModule(TENANT, 'office');
    activatePurchasedModule(TENANT, 'assist');
    activatePurchasedModule(TENANT, 'pflege');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('live office ist sichtbar und navigierbar', () => {
    const state = resolveModuleNavState('office', { tenantId: TENANT, roleKey: NURSE });
    expect(state.effectiveStatus).toBe('live');
    expect(state.isVisible).toBe(true);
    expect(state.isNavigable).toBe(true);
  });

  it('beta assist ist sichtbar und navigierbar bei aktivem Mandant', () => {
    const state = resolveModuleNavState('assist', { tenantId: TENANT, roleKey: NURSE });
    expect(state.effectiveStatus).toBe('beta');
    expect(state.isVisible).toBe(true);
    expect(state.isNavigable).toBe(true);
  });

  it('coming_soon stationaer ist sichtbar aber nicht navigierbar', () => {
    activatePurchasedModule(TENANT, 'stationaer');
    const state = resolveModuleNavState('stationaer', { tenantId: TENANT, roleKey: ADMIN });
    expect(state.effectiveStatus).toBe('coming_soon');
    expect(state.isVisible).toBe(true);
    expect(state.isNavigable).toBe(false);
    expect(isModuleScopeVisible('stationaer', { tenantId: TENANT, roleKey: NURSE })).toBe(true);
    expect(isModuleScopeNavigable('stationaer', { tenantId: TENANT, roleKey: NURSE })).toBe(false);
  });

  it('disabled ti ist vollständig versteckt', () => {
    expect(isModuleScopeVisible('ti', { tenantId: TENANT, roleKey: ADMIN })).toBe(false);
    expect(getTabsForArea('business', { tenantId: TENANT, roleKey: ADMIN }).some((t) => t.key === 'platform')).toBe(
      false,
    );
    expect(
      getTabsForArea('business', { tenantId: TENANT, roleKey: ADMIN }).some((t) => t.key === 'integrations'),
    ).toBe(false);
  });

  it('internal reporting nur für Admin sichtbar', () => {
    expect(isModuleScopeVisible('reporting', { tenantId: TENANT, roleKey: NURSE })).toBe(false);
    expect(isModuleScopeVisible('reporting', { tenantId: TENANT, roleKey: ADMIN })).toBe(true);
    expect(isModuleScopeNavigable('reporting', { tenantId: TENANT, roleKey: ADMIN })).toBe(true);
  });

  it('Modul-Switcher blendet disabled aus und markiert coming_soon', () => {
    const items = getModuleSwitcherItems(TENANT, NURSE);
    expect(items).toHaveLength(6);
    const stationaer = items.find((item) => item.productKey === 'stationaer');
    expect(stationaer?.visibilityStatus).toBe('coming_soon');
    expect(stationaer?.isNavigable).toBe(false);
  });
});

describe('checkModuleAccess — Direkt-Routen', () => {
  beforeEach(() => {
    vi.stubGlobal('__DEV__', false);
    resetModuleAccessStore();
    initializeModuleAccessStore(TENANT);
    activatePurchasedModule(TENANT, 'office');
    activatePurchasedModule(TENANT, 'pflege');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('erlaubt live office route', () => {
    const decision = checkModuleAccess('/office/clients', NURSE, TENANT);
    expect(decision.shouldRedirect).toBe(false);
  });

  it('blockiert coming_soon direkt route', () => {
    activatePurchasedModule(TENANT, 'beratung');
    const decision = checkModuleAccess('/beratung/cases', NURSE, TENANT);
    expect(decision.shouldRedirect).toBe(true);
    expect(decision.reason).toBe('module_coming_soon');
  });

  it('blockiert disabled ti direkt route', () => {
    const decision = checkModuleAccess('/business/ti/kim', ADMIN, TENANT);
    expect(decision.shouldRedirect).toBe(true);
    expect(decision.reason).toBe('module_disabled');
  });

  it('blockiert internal insight für Pflegekraft', () => {
    const decision = checkModuleAccess('/insight', NURSE, TENANT);
    expect(decision.shouldRedirect).toBe(true);
    expect(decision.reason).toBe('module_internal');
  });

  it('erlaubt internal insight für Admin', () => {
    const decision = checkModuleAccess('/insight', ADMIN, TENANT);
    expect(decision.shouldRedirect).toBe(false);
  });

  it('resolveModuleScopeFromPath mappt Business-Bereiche', () => {
    expect(resolveModuleScopeFromPath('/business/platform/ai')).toBe('platform');
    expect(resolveModuleScopeFromPath('/business/messages')).toBe('communication');
    expect(resolveModuleScopeFromPath('/pflege/vitalwerte')).toBe('pflege');
  });
});
