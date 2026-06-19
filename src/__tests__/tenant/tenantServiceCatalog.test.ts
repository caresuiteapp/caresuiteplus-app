import { describe, expect, it } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  fetchTenantServiceCatalog,
  formatCatalogSummary,
  resetTenantServiceCatalogStore,
  saveTenantServiceCatalogItem,
  seedTenantServiceCatalogIfEmpty,
} from '@/lib/tenant/tenantServiceCatalogService';

describe('tenantServiceCatalogService', () => {
  it('liefert Demo-Standardleistungen für alle Module', async () => {
    resetTenantServiceCatalogStore();
    const result = await fetchTenantServiceCatalog(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items.some((item) => item.serviceKey === 'assist.alltagsbegleitung')).toBe(true);
    expect(result.data.items.some((item) => item.moduleKey === 'pflege')).toBe(true);
    expect(result.data.items.some((item) => item.moduleKey === 'stationaer')).toBe(true);
    expect(result.data.items.some((item) => item.moduleKey === 'beratung')).toBe(true);
    expect(formatCatalogSummary(result.data.items)).toContain('Assist');
    expect(formatCatalogSummary(result.data.items)).toContain('Std.');
  });

  it('speichert Katalog-Einträge im Demo-Modus', async () => {
    resetTenantServiceCatalogStore();
    const saved = await saveTenantServiceCatalogItem(
      DEMO_TENANT_ID,
      {
        moduleKey: 'assist',
        serviceKey: 'assist.custom.test',
        name: 'Testleistung',
        unit: 'hour',
        category: 'service',
        priceNet: 42,
      },
      'business_admin',
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.data.items.some((item) => item.serviceKey === 'assist.custom.test')).toBe(true);
  });
});
