import { describe, expect, it } from 'vitest';
import { fetchCourseModuleSnapshot } from '@/lib/akademie/akademieModuleService';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';

describe('WP439', () => {
  it('enforcePermission schützt Modul-Service', () => {
    expect(enforcePermission(null, 'akademie.courses.view' as never)).not.toBeNull();
  });

  it('Modul-Service liefert Snapshot', async () => {
    const result = await fetchCourseModuleSnapshot(DEMO_TENANT_ID, 'akademie_admin');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recordCount).toBeGreaterThan(0);
  });
});
