import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  activatePurchasedModule,
  deactivateModule,
  initializeModuleAccessStore,
  resetModuleAccessStore,
} from '@/lib/modules/moduleAccessService';
import {
  resetTenantModuleSettingsCache,
  setTenantModuleSettingsCache,
} from '@/lib/tenant/tenantModuleSettingsCache';
import { syncModuleAccessFromTenantSettings } from '@/lib/tenant/syncTenantModuleAccess';
import {
  isModuleScopeNavigable,
  isModuleScopeVisible,
  resolveModuleNavState,
  resolveModuleScopeFromPath,
} from '@/lib/modules';
import { checkModuleAccess, checkRoleAccess, getModuleSwitcherItems, getTabsForArea } from '@/lib/navigation';
import { getVisibleMainModuleRailItems } from '@/lib/navigation/mainmodulerail';
import { buildZentraleModuleOverviewRows } from '@/lib/dashboard/zentraleModuleOverview';
import { emptyBusinessDashboardMetrics } from '@/lib/dashboard/businessDashboardMetrics';

const TENANT = DEMO_TENANT_ID;
const ADMIN = 'business_admin' as const;
const NURSE = 'nurse' as const;

function seedTenantCenterModules(
  modules: {
    assistEnabled: boolean;
    pflegeEnabled: boolean;
    stationaerEnabled: boolean;
    beratungEnabled: boolean;
  },
) {
  setTenantModuleSettingsCache(TENANT, modules);
  syncModuleAccessFromTenantSettings(TENANT, modules);
}

describe('moduleVisibilityService', () => {
  beforeEach(() => {
    vi.stubGlobal('__DEV__', false);
    resetModuleAccessStore();
    resetTenantModuleSettingsCache();
    initializeModuleAccessStore(TENANT);
    activatePurchasedModule(TENANT, 'office');
    activatePurchasedModule(TENANT, 'assist');
    activatePurchasedModule(TENANT, 'pflege');
    seedTenantCenterModules({
      assistEnabled: true,
      pflegeEnabled: true,
      stationaerEnabled: false,
      beratungEnabled: false,
    });
    deactivateModule(TENANT, 'akademie');
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

  it('beta stationaer ist sichtbar und navigierbar bei aktivem Mandant', () => {
    activatePurchasedModule(TENANT, 'stationaer');
    const state = resolveModuleNavState('stationaer', { tenantId: TENANT, roleKey: ADMIN });
    expect(state.effectiveStatus).toBe('beta');
    expect(state.isVisible).toBe(true);
    expect(state.isNavigable).toBe(true);
    expect(isModuleScopeVisible('stationaer', { tenantId: TENANT, roleKey: NURSE })).toBe(true);
    expect(isModuleScopeNavigable('stationaer', { tenantId: TENANT, roleKey: NURSE })).toBe(true);
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

  it('connect ist für Admin sichtbar und navigierbar (beta)', () => {
    expect(isModuleScopeVisible('connect', { tenantId: TENANT, roleKey: ADMIN })).toBe(true);
    expect(isModuleScopeNavigable('connect', { tenantId: TENANT, roleKey: ADMIN })).toBe(true);
  });

  it('internal reporting nur für Admin sichtbar', () => {
    expect(isModuleScopeVisible('reporting', { tenantId: TENANT, roleKey: NURSE })).toBe(false);
    expect(isModuleScopeVisible('reporting', { tenantId: TENANT, roleKey: ADMIN })).toBe(true);
    expect(isModuleScopeNavigable('reporting', { tenantId: TENANT, roleKey: ADMIN })).toBe(true);
  });

  it('Modul-Switcher zeigt nur aktive Mandanten-Module', () => {
    const items = getModuleSwitcherItems(TENANT, NURSE);
    expect(items.every((item) => item.isActive)).toBe(true);
    expect(items.map((item) => item.productKey)).toEqual(['office', 'assist', 'pflege']);
    expect(items.find((item) => item.productKey === 'stationaer')).toBeUndefined();
  });

  it('MainModuleRail blendet inaktive Module aus', () => {
    const visible = getVisibleMainModuleRailItems({ tenantId: TENANT, roleKey: NURSE });
    const keys = visible.map((item) => item.key);
    expect(keys).toContain('zentrale');
    expect(keys).toContain('admin');
    expect(keys).toContain('office');
    expect(keys).toContain('assist');
    expect(keys).toContain('pflege');
    expect(keys).not.toContain('stationaer');
    expect(keys).not.toContain('beratung');
    expect(keys).not.toContain('akademie');
  });

  it('Zentrale-Übersicht zeigt nur aktive Module', () => {
    seedTenantCenterModules({
      assistEnabled: true,
      pflegeEnabled: false,
      stationaerEnabled: false,
      beratungEnabled: false,
    });
    const metrics = {
      ...emptyBusinessDashboardMetrics(),
      tableAvailability: {
        clients: true,
        assignments: true,
        employees: true,
        invoices: true,
        tasks: true,
        messages: true,
        modules: true,
        portalUsers: true,
        documents: true,
        portalRequests: true,
        serviceRecords: true,
        budgets: true,
        appointments: true,
      },
    };
    const rows = buildZentraleModuleOverviewRows(metrics, 'dark', 'kpi', {
      tenantId: TENANT,
      roleKey: NURSE,
    });
    expect(rows.map((row) => row.moduleKey)).toEqual(['office', 'assist']);
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

  it('erlaubt beta beratung route bei aktivem Mandant', () => {
    seedTenantCenterModules({
      assistEnabled: true,
      pflegeEnabled: true,
      stationaerEnabled: false,
      beratungEnabled: true,
    });
    activatePurchasedModule(TENANT, 'beratung');
    const decision = checkModuleAccess('/beratung/cases', 'counselor', TENANT);
    expect(decision.shouldRedirect).toBe(false);
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
    expect(resolveModuleScopeFromPath('/business/connect')).toBe('connect');
    expect(resolveModuleScopeFromPath('/pflege/vitalwerte')).toBe('pflege');
  });

  it('erlaubt beta connect route für Admin', () => {
    const decision = checkModuleAccess('/business/connect', ADMIN, TENANT);
    expect(decision.shouldRedirect).toBe(false);
  });

  it('blockiert connect providers route für Pflegekraft (Rolle)', () => {
    const decision = checkRoleAccess('/business/connect/providers', NURSE);
    expect(decision.shouldRedirect).toBe(true);
    expect(decision.reason).toBe('wrong_role');
  });
});
