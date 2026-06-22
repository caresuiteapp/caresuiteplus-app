import { describe, expect, it } from 'vitest';
import { fetchIntegrationModuleSnapshot } from '@/lib/integrations/integrationsModuleService';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';

describe('WP499', () => {
  it('enforcePermission schützt Modul-Service', () => {
    expect(enforcePermission(null, 'integrations.manage' as never)).not.toBeNull();
  });

  it('Modul-Service liefert Snapshot', async () => {
    const result = await fetchIntegrationModuleSnapshot(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recordCount).toBeGreaterThan(0);
  });
});
