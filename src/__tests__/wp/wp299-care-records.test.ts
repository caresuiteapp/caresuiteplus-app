import { describe, expect, it } from 'vitest';
import { fetchCareRecordModuleSnapshot } from '@/lib/assist/careRecordsModuleService';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';

describe('WP299', () => {
  it('enforcePermission schützt Modul-Service', () => {
    expect(enforcePermission(null, 'assist.records.view' as never)).not.toBeNull();
  });

  it('Modul-Service liefert Snapshot', async () => {
    const result = await fetchCareRecordModuleSnapshot(DEMO_TENANT_ID, 'nurse');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recordCount).toBeGreaterThan(0);
  });
});
