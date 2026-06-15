import { describe, expect, it } from 'vitest';
import { fetchBusinessModuleSnapshot } from '@/lib/business/businessModuleService';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';

describe('WP139', () => {
  it('enforcePermission schützt Modul-Service', () => {
    expect(enforcePermission(null, 'dashboard.view' as never)).not.toBeNull();
  });

  it('Modul-Service liefert Snapshot', async () => {
    const result = await fetchBusinessModuleSnapshot(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recordCount).toBeGreaterThan(0);
  });
});
