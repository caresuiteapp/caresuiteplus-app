import { describe, expect, it } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { fetchDashboardSnapshot } from '@/lib/dashboard/dashboardService';
import { enforcePermission } from '@/lib/permissions';

describe('WP19', () => {
  it('enforcePermission schützt Dashboard', () => {
    expect(enforcePermission(null, 'dashboard.view' as never)).not.toBeNull();
  });

  it('Dashboard-Service liefert Snapshot', async () => {
    const result = await fetchDashboardSnapshot(DEMO_TENANT_ID, 'business_admin', 'business');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.kpis.length).toBeGreaterThan(0);
  });
});
