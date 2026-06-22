import { describe, expect, it } from 'vitest';
import { fetchAssignmentModuleSnapshot } from '@/lib/assist/assistPlanningModuleService';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';

describe('WP259', () => {
  it('enforcePermission schützt Modul-Service', () => {
    expect(enforcePermission(null, 'assist.assignments.view' as never)).not.toBeNull();
  });

  it('Modul-Service liefert Snapshot', async () => {
    const result = await fetchAssignmentModuleSnapshot(DEMO_TENANT_ID, 'dispatch');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recordCount).toBeGreaterThan(0);
  });
});
