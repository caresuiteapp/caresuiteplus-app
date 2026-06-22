import { describe, expect, it } from 'vitest';
import { fetchResidentModuleSnapshot } from '@/lib/stationaer/stationaerModuleService';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';

describe('WP399', () => {
  it('enforcePermission schützt Modul-Service', () => {
    expect(enforcePermission(null, 'stationaer.residents.view' as never)).not.toBeNull();
  });

  it('Modul-Service liefert Snapshot', async () => {
    const result = await fetchResidentModuleSnapshot(DEMO_TENANT_ID, 'nurse');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recordCount).toBeGreaterThan(0);
  });
});
