import { describe, expect, it } from 'vitest';
import { fetchTripModuleSnapshot } from '@/lib/assist/tripsModuleService';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';

describe('WP319', () => {
  it('enforcePermission schützt Modul-Service', () => {
    expect(enforcePermission(null, 'assist.trips.view' as never)).not.toBeNull();
  });

  it('Modul-Service liefert Snapshot', async () => {
    const result = await fetchTripModuleSnapshot(DEMO_TENANT_ID, 'caregiver');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recordCount).toBeGreaterThan(0);
  });
});
