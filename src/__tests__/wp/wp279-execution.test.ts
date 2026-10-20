import { describe, expect, it } from 'vitest';
import { fetchExecutionModuleSnapshot } from '@/lib/assist/executionModuleService';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';

describe('WP279', () => {
  it('enforcePermission schützt Modul-Service', () => {
    expect(enforcePermission(null, 'assist.execution.view' as never)).not.toBeNull();
  });

  it('Modul-Service liefert Snapshot', async () => {
    const result = await fetchExecutionModuleSnapshot(DEMO_TENANT_ID, 'nurse');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recordCount).toBeGreaterThan(0);
  });
});
