import { describe, expect, it } from 'vitest';
import { fetchDashboardSnapshot } from '@/lib/dashboard/dashboardService';
import { enforcePermission } from '@/lib/permissions';

describe('WP19', () => {
  it('enforcePermission schützt Dashboard', () => {
    expect(enforcePermission(null, 'dashboard.view' as never)).not.toBeNull();
  });

  it('Dashboard-Service liefert Snapshot', async () => {
    const result = await fetchDashboardSnapshot('demo-tenant', 'business_admin', 'business' as import('@/types/dashboard').DashboardScope);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.kpis.length).toBeGreaterThan(0);
  });
});
