import { describe, expect, it } from 'vitest';
import { fetchReleaseHub } from '@/lib/release';
import { RELEASE_DEMO_TENANT } from '@/data/demo/domains/releaseDemo';
import { enforcePermission } from '@/lib/permissions';

describe('WP539 Release', () => {
  it('enforcePermission schützt Release-Service', () => {
    expect(enforcePermission(null, 'release.view')).not.toBeNull();
  });

  it('fetchReleaseHub liefert Manifest', async () => {
    const result = await fetchReleaseHub(RELEASE_DEMO_TENANT, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.manifest.appVersion).toBe('1.0.0');
  });
});
