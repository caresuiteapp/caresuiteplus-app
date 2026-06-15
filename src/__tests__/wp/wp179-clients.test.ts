import { describe, expect, it } from 'vitest';
import { fetchClientModuleSnapshot } from '@/lib/office/clientsModuleService';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';

describe('WP179', () => {
  it('enforcePermission schützt Modul-Service', () => {
    expect(enforcePermission(null, 'office.clients.view' as never)).not.toBeNull();
  });

  it('Modul-Service liefert Snapshot', async () => {
    const result = await fetchClientModuleSnapshot(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recordCount).toBeGreaterThan(0);
  });
});
