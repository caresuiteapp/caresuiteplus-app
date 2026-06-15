import { describe, expect, it } from 'vitest';
import { runPermissionMatrix } from '@/lib/permissions/testMatrix';
import { enforcePermission } from '@/lib/permissions';

describe('WP99', () => {
  it('enforcePermission blockiert Gast', () => {
    expect(enforcePermission(null, 'dashboard.view')).not.toBeNull();
  });

  it('Permission-Matrix liefert Ergebnisse', () => {
    const result = runPermissionMatrix();
    expect(result.passed).toBeGreaterThan(0);
    expect(result.failed).toBe(0);
  });
});
