import { describe, expect, it } from 'vitest';
import { fetchDocumentModuleSnapshot } from '@/lib/office/officeDocsModuleService';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';

describe('WP219', () => {
  it('enforcePermission schützt Modul-Service', () => {
    expect(enforcePermission(null, 'office.documents.view' as never)).not.toBeNull();
  });

  it('Modul-Service liefert Snapshot', async () => {
    const result = await fetchDocumentModuleSnapshot(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recordCount).toBeGreaterThan(0);
  });
});
