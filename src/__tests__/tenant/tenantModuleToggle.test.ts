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

  it('deaktiviert Pflege über Hub und blendet Rail/Dashboard aus', async () => {
    seedTenantCenterModules({
      assistEnabled: true,
      pflegeEnabled: true,
      stationaerEnabled: false,
      beratungEnabled: false,
    });
    expect(getVisibleMainModuleRailItems({ tenantId: TENANT, roleKey: ADMIN }).map((m) => m.key)).toContain(
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
    expect(rows.map((row) => row.moduleKey)).toEqual(['office', 'assist', 'akademie']);
  });

  it('aktiviert Beratung über Hub und zeigt Modul in Navigation', async () => {
    const result = await setTenantModuleEnabled(TENANT, 'beratung', true, ADMIN);
    expect(result.ok).toBe(true);
    expect(getTenantModuleSettingsCache(TENANT).beratungEnabled).toBe(true);
    expect(hasModuleAccess('beratung', TENANT)).toBe(true);

    const railKeys = getVisibleMainModuleRailItems({ tenantId: TENANT, roleKey: ADMIN }).map((m) => m.key);
    expect(railKeys).toContain('beratung');
  });

  it('steuert Akademie nur über moduleAccessService', async () => {
    const deactivate = await setTenantModuleEnabled(TENANT, 'akademie', false, ADMIN);
    expect(deactivate.ok).toBe(true);
    expect(hasModuleAccess('akademie', TENANT)).toBe(false);
    expect(getEffectiveModuleAccess(TENANT).find((m) => m.productKey === 'akademie')?.isEffective).toBe(false);

    const activate = await setTenantModuleEnabled(TENANT, 'akademie', true, ADMIN);
    expect(activate.ok).toBe(true);
    expect(hasModuleAccess('akademie', TENANT)).toBe(true);
  });
});
