import { describe, expect, it } from 'vitest';
import { fetchSecurityHub } from '@/lib/security';
import { SECURITY_DEMO_TENANT } from '@/data/demo/domains/securityDemo';
import { enforcePermission } from '@/lib/permissions';

describe('WP559 Security', () => {
  it('enforcePermission schützt Security-Service', () => {
    expect(enforcePermission(null, 'security.view')).not.toBeNull();
  });

  it('fetchSecurityHub liefert DSGVO-Score', async () => {
    const result = await fetchSecurityHub(SECURITY_DEMO_TENANT, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.dsgvoScorePercent).toBeGreaterThan(0);
  });
});
