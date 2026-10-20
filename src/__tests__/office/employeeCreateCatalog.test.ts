import { describe, expect, it } from 'vitest';
import { getAllCatalogEntries } from '@/data/demo/templates';
import { getDropdownOptions } from '@/lib/templates';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';

describe('employee create catalogs', () => {
  it('includes employee role and department catalog entries', () => {
    const catalogs = getAllCatalogEntries();
    const roles = catalogs.filter((entry) => entry.catalogType === 'employee_role');
    const departments = catalogs.filter((entry) => entry.catalogType === 'employee_department');

    expect(roles.length).toBeGreaterThanOrEqual(10);
    expect(departments.length).toBeGreaterThanOrEqual(8);
    expect(roles.some((entry) => entry.label === 'Pflegefachkraft')).toBe(true);
    expect(departments.some((entry) => entry.label === 'Assist / Außendienst')).toBe(true);
  });

  it('loads dropdown options without error for employee create fields', async () => {
    const types = ['employee_role', 'employee_department', 'employee_status'] as const;

    for (const catalogType of types) {
      const result = await getDropdownOptions(DEMO_TENANT_ID, catalogType, 'business_admin');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.length).toBeGreaterThan(0);
      }
    }
  });
});
