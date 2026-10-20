import { describe, expect, it } from 'vitest';
import { fetchCarePlanModuleSnapshot } from '@/lib/pflege/pflegeModuleService';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';

describe('WP379', () => {
  it('enforcePermission schützt Modul-Service', () => {
    expect(enforcePermission(null, 'pflege.plans.view' as never)).not.toBeNull();
  });

  it('Modul-Service liefert Snapshot', async () => {
    const result = await fetchCarePlanModuleSnapshot(DEMO_TENANT_ID, 'nurse');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recordCount).toBeGreaterThan(0);
  });
});
