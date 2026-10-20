import { describe, expect, it } from 'vitest';
import { fetchPlatformModuleSnapshot } from '@/lib/platform/platformModuleService';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';

describe('WP479', () => {
  it('enforcePermission schützt Modul-Service', () => {
    expect(enforcePermission(null, 'platform.ai.manage' as never)).not.toBeNull();
  });

  it('Modul-Service liefert Snapshot', async () => {
    const result = await fetchPlatformModuleSnapshot(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recordCount).toBeGreaterThan(0);
  });
});
