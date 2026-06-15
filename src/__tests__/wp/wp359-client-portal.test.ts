import { describe, expect, it } from 'vitest';
import { fetchClientPortalModuleSnapshot } from '@/lib/portal/clientPortalModuleService';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';

describe('WP359', () => {
  it('enforcePermission schützt Modul-Service', () => {
    expect(enforcePermission(null, 'portal.client.profile.view' as never)).not.toBeNull();
  });

  it('Modul-Service liefert Snapshot', async () => {
    const result = await fetchClientPortalModuleSnapshot(DEMO_TENANT_ID, 'client_portal');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recordCount).toBeGreaterThan(0);
  });
});
