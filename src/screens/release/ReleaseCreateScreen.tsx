import { DomainCreateScreen } from '@/screens/shared/DomainCreateScreen';
import { createRelease } from '@/lib/release';
import { RELEASE_DEMO_TENANT } from '@/data/demo/domains/releaseDemo';
import { useAuth } from '@/lib/auth/context';
import type { EnvProfileKey } from '@/types/release';

/** WP526 — Create/Edit Wizard Release */
export function ReleaseCreateScreen() {
  const { profile } = useAuth();
  return (
    <DomainCreateScreen
      wpNumber={526}
      title="Release anlegen"
      entityLabel="Release"
      fields={[
        { key: 'title', label: 'Titel', required: true },
        { key: 'env', label: 'Umgebung (development/staging/production)', required: true },
      ]}
      onSubmit={async (values) => {
        const env = (values.env as EnvProfileKey) || 'staging';
        const result = await createRelease(RELEASE_DEMO_TENANT, values.title, env, profile?.roleKey);
        if (!result.ok) return result;
        return { ok: true as const, id: result.data.id };
      }}
      successRoute={(id) => `/business/release/${id}`}
    />
  );
}
