import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  activatePurchasedModule,
  getEffectiveModuleAccess,
  hasModuleAccess,
  initializeModuleAccessStore,
  resetModuleAccessStore,
} from '@/lib/modules/moduleAccessService';
import {
  getVisibleMainModuleRailItems,
} from '@/lib/navigation/mainmodulerail';
import { buildZentraleModuleOverviewRows } from '@/lib/dashboard/zentraleModuleOverview';
import { emptyBusinessDashboardMetrics } from '@/lib/dashboard/businessDashboardMetrics';
import { setTenantModuleEnabled } from '@/lib/tenant/tenantModuleToggleService';
import {
  getTenantModuleSettingsCache,
  resetTenantModuleSettingsCache,
  setTenantModuleSettingsCache,
} from '@/lib/tenant/tenantModuleSettingsCache';
import { syncModuleAccessFromTenantSettings } from '@/lib/tenant/syncTenantModuleAccess';
import { resetTenantCenterStore } from '@/lib/tenant/tenantCenterService';

const TENANT = DEMO_TENANT_ID;
const ADMIN = 'business_admin' as const;

function seedTenantCenterModules(modules: {
  assistEnabled: boolean;
  pflegeEnabled: boolean;
  stationaerEnabled: boolean;
  beratungEnabled: boolean;
}) {
  setTenantModuleSettingsCache(TENANT, modules);
  syncModuleAccessFromTenantSettings(TENANT, modules);
}

describe('tenantModuleToggleService', () => {
  beforeEach(() => {
    vi.stubGlobal('__DEV__', false);
    resetModuleAccessStore();
    resetTenantModuleSettingsCache();
    resetTenantCenterStore();
    initializeModuleAccessStore(TENANT);
    activatePurchasedModule(TENANT, 'office');
    activatePurchasedModule(TENANT, 'akademie');
    seedTenantCenterModules({
      assistEnabled: true,
      pflegeEnabled: false,
      stationaerEnabled: false,
      beratungEnabled: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('deaktiviert einen alten Pflege-Schalter ohne das unveröffentlichte Modul einzublenden', async () => {
    seedTenantCenterModules({
      assistEnabled: true,
      pflegeEnabled: true,
      stationaerEnabled: false,
      beratungEnabled: false,
    });
    expect(getVisibleMainModuleRailItems({ tenantId: TENANT, roleKey: ADMIN }).map((m) => m.key)).not.toContain(
      'pflege',
    );

    const result = await setTenantModuleEnabled(TENANT, 'pflege', false, ADMIN);
    expect(result.ok).toBe(true);
    expect(getTenantModuleSettingsCache(TENANT).pflegeEnabled).toBe(false);
    expect(hasModuleAccess('pflege', TENANT)).toBe(false);

    const railKeys = getVisibleMainModuleRailItems({ tenantId: TENANT, roleKey: ADMIN }).map((m) => m.key);
    expect(railKeys).not.toContain('pflege');

    const rows = buildZentraleModuleOverviewRows(
      {
        ...emptyBusinessDashboardMetrics(),
        tableAvailability: {
          ...emptyBusinessDashboardMetrics().tableAvailability,
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
      },
      'dark',
      'kpi',
      { tenantId: TENANT, roleKey: ADMIN },
    );
    expect(rows.map((row) => row.moduleKey)).toEqual(['office', 'assist']);
  });

  it('schaltet das veröffentlichte Assist-Modul und die zugehörige Office-Rail tatsächlich um', async () => {
    const visible = () => getVisibleMainModuleRailItems({ tenantId: TENANT, roleKey: ADMIN }).map(m => m.key);
    expect(visible()).toContain('assist');
    expect(visible()).toContain('office');
    const disabled = await setTenantModuleEnabled(TENANT, 'assist', false, ADMIN);
    expect(disabled.ok).toBe(true);
    expect(getTenantModuleSettingsCache(TENANT).assistEnabled).toBe(false);
    expect(hasModuleAccess('assist', TENANT)).toBe(false);
    expect(visible()).not.toContain('assist');
    expect(visible()).not.toContain('office');
    const enabled = await setTenantModuleEnabled(TENANT, 'assist', true, ADMIN);
    expect(enabled.ok).toBe(true);
    expect(getTenantModuleSettingsCache(TENANT).assistEnabled).toBe(true);
    expect(hasModuleAccess('assist', TENANT)).toBe(true);
    expect(visible()).toContain('assist');
    expect(visible()).toContain('office');
  });

  it('hält Beratung im Hub und in der Navigation global gesperrt', async () => {
    const result = await setTenantModuleEnabled(TENANT, 'beratung', true, ADMIN);
    expect(result.ok).toBe(false);
    expect(getTenantModuleSettingsCache(TENANT).beratungEnabled).toBe(false);
    expect(hasModuleAccess('beratung', TENANT)).toBe(false);

    const railKeys = getVisibleMainModuleRailItems({ tenantId: TENANT, roleKey: ADMIN }).map((m) => m.key);
    expect(railKeys).not.toContain('beratung');
  });

  it('steuert Akademie nur über moduleAccessService', async () => {
    const deactivate = await setTenantModuleEnabled(TENANT, 'akademie', false, ADMIN);
    expect(deactivate.ok).toBe(true);
    expect(hasModuleAccess('akademie', TENANT)).toBe(false);
    expect(getEffectiveModuleAccess(TENANT).find((m) => m.productKey === 'akademie')?.isEffective).toBe(false);

    const activate = await setTenantModuleEnabled(TENANT, 'akademie', true, ADMIN);
    expect(activate.ok).toBe(false);
    expect(hasModuleAccess('akademie', TENANT)).toBe(false);
  });
});
