import { describe, expect, it } from 'vitest';
import { fetchEmployeeModuleSnapshot } from '@/lib/office/employeesModuleService';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';

describe('WP199', () => {
  it('enforcePermission schützt Modul-Service', () => {
    expect(enforcePermission(null, 'office.employees.view' as never)).not.toBeNull();
  });

  it('Modul-Service liefert Snapshot', async () => {
    const result = await fetchEmployeeModuleSnapshot(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recordCount).toBeGreaterThan(0);
  });
});
