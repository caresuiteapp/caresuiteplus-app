import { describe, expect, it } from 'vitest';
import { fetchEmployeePortalModuleSnapshot } from '@/lib/portal/employeePortalModuleService';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';

describe('WP339', () => {
  it('enforcePermission schützt Modul-Service', () => {
    expect(enforcePermission(null, 'portal.employee.profile.view' as never)).not.toBeNull();
  });

  it('Modul-Service liefert Snapshot', async () => {
    const result = await fetchEmployeePortalModuleSnapshot(DEMO_TENANT_ID, 'employee_portal');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recordCount).toBeGreaterThan(0);
  });
});
