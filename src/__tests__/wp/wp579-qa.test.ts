import { describe, expect, it } from 'vitest';
import { fetchQaHub } from '@/lib/qa';
import { QA_DEMO_TENANT } from '@/data/demo/domains/qaDemo';
import { enforcePermission } from '@/lib/permissions';

describe('WP579 QA', () => {
  it('enforcePermission schützt QA-Service', () => {
    expect(enforcePermission(null, 'qa.view')).not.toBeNull();
  });

  it('fetchQaHub liefert Coverage', async () => {
    const result = await fetchQaHub(QA_DEMO_TENANT, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.testCoveragePercent).toBeGreaterThan(0);
  });
});
