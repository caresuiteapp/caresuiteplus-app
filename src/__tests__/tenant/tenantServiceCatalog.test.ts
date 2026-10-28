import { describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  fetchTenantServiceCatalog,
  resetTenantServiceCatalogStore,
  saveTenantServiceCatalogItem,
} from '@/lib/tenant/tenantServiceCatalogService';

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

describe('tenantServiceCatalogService', () => {
  it('liefert ohne Serververbindung keine nativen Beispielpreise als Unternehmenskatalog', async () => {
    resetTenantServiceCatalogStore();
    const result = await fetchTenantServiceCatalog(DEMO_TENANT_ID, 'business_admin');
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('aktive Datenverbindung') });
  });

  it('meldet ohne Serververbindung keine erfolgreiche native Katalogspeicherung', async () => {
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
    expect(saved).toMatchObject({ ok: false, error: expect.stringContaining('aktive Datenverbindung') });
  });
});
