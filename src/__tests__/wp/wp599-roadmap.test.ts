import { describe, expect, it } from 'vitest';
import { fetchRoadmapHub } from '@/lib/roadmap';
import { ROADMAP_DEMO_TENANT } from '@/data/demo/domains/roadmapDemo';
import { enforcePermission } from '@/lib/permissions';

describe('WP599 Roadmap', () => {
  it('enforcePermission schützt Roadmap-Service', () => {
    expect(enforcePermission(null, 'roadmap.view')).not.toBeNull();
  });

  it('fetchRoadmapHub liefert Phasen', async () => {
    const result = await fetchRoadmapHub(ROADMAP_DEMO_TENANT, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.phases.length).toBe(4);
  });
});
