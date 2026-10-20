import { describe, expect, it } from 'vitest';
import { fetchDataSubjectRequestsForAdmin, updateDataSubjectRequestStatusForAdmin } from '@/lib/privacy/dataSubjectRequestAdminService';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';

describe('DSGVO Admin list service (Sprint 51)', () => {
  it('fetchDataSubjectRequestsForAdmin liefert Demo-Liste für business_admin', async () => {
    const result = await fetchDataSubjectRequestsForAdmin(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0].tenantId).toBe(DEMO_TENANT_ID);
    }
  });

  it('fetchDataSubjectRequestsForAdmin verweigert ohne security.view', async () => {
    const result = await fetchDataSubjectRequestsForAdmin(DEMO_TENANT_ID, 'client_portal');
    expect(result.ok).toBe(false);
  });
});

describe('DSGVO Admin status update (Sprint 58)', () => {
  it('updateDataSubjectRequestStatusForAdmin aktualisiert Demo-Status für business_admin', async () => {
    const list = await fetchDataSubjectRequestsForAdmin(DEMO_TENANT_ID, 'business_admin');
    expect(list.ok).toBe(true);
    if (!list.ok) return;

    const target = list.data[0];
    const result = await updateDataSubjectRequestStatusForAdmin(
      DEMO_TENANT_ID,
      target.id,
      'running',
      'business_admin',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe('running');
    }
  });

  it('updateDataSubjectRequestStatusForAdmin verweigert ohne security.manage', async () => {
    const list = await fetchDataSubjectRequestsForAdmin(DEMO_TENANT_ID, 'business_admin');
    expect(list.ok).toBe(true);
    if (!list.ok) return;

    const result = await updateDataSubjectRequestStatusForAdmin(
      DEMO_TENANT_ID,
      list.data[0].id,
      'completed',
      'client_portal',
    );
    expect(result.ok).toBe(false);
  });
});
