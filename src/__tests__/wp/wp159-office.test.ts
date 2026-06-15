import { describe, expect, it } from 'vitest';
import { fetchOfficeModuleSnapshot } from '@/lib/office/officeModuleService';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';

describe('WP159', () => {
  it('enforcePermission schützt Modul-Service', () => {
    expect(enforcePermission(null, 'office.access' as never)).not.toBeNull();
  });

  it('Modul-Service liefert Snapshot', async () => {
    const result = await fetchOfficeModuleSnapshot(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recordCount).toBeGreaterThan(0);
  });
});
