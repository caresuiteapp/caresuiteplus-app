import { DomainCreateScreen } from '@/screens/shared/DomainCreateScreen';
import { createRoadmapEntry } from '@/lib/roadmap';
import { ROADMAP_DEMO_TENANT } from '@/data/demo/domains/roadmapDemo';
import { useAuth } from '@/lib/auth/context';
import type { RoadmapPhase } from '@/types/roadmap';

/** WP586 — Roadmap Create */
export function RoadmapCreateScreen() {
  const { profile } = useAuth();
  return (
    <DomainCreateScreen
      wpNumber={586}
      title="Meilenstein anlegen"
      entityLabel="Meilenstein"
      fields={[
        { key: 'title', label: 'Titel', required: true },
        { key: 'phase', label: 'Phase (discovery/pilot/launch/scale)', required: true },
      ]}
      onSubmit={async (values) => {
        const phase = (values.phase as RoadmapPhase) || 'pilot';
        const result = await createRoadmapEntry(ROADMAP_DEMO_TENANT, values.title, phase, profile?.roleKey);
        if (!result.ok) return result;
        return { ok: true as const, id: result.data.id };
      }}
      successRoute={(id) => `/business/roadmap/${id}`}
    />
  );
}
