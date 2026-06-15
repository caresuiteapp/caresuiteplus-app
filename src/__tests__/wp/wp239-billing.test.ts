import { describe, expect, it } from 'vitest';
import { fetchInvoiceModuleSnapshot } from '@/lib/office/billingModuleService';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';

describe('WP239', () => {
  it('enforcePermission schützt Modul-Service', () => {
    expect(enforcePermission(null, 'office.invoices.view' as never)).not.toBeNull();
  });

  it('Modul-Service liefert Snapshot', async () => {
    const result = await fetchInvoiceModuleSnapshot(DEMO_TENANT_ID, 'billing');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recordCount).toBeGreaterThan(0);
  });
});
