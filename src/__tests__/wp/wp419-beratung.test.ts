import { describe, expect, it } from 'vitest';
import { fetchCaseModuleSnapshot } from '@/lib/beratung/beratungModuleService';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';

describe('WP419', () => {
  it('enforcePermission schützt Modul-Service', () => {
    expect(enforcePermission(null, 'beratung.cases.view' as never)).not.toBeNull();
  });

  it('Modul-Service liefert Snapshot', async () => {
    const result = await fetchCaseModuleSnapshot(DEMO_TENANT_ID, 'counselor');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recordCount).toBeGreaterThan(0);
  });
});
