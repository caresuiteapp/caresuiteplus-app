import { DomainCreateScreen } from '@/screens/shared/DomainCreateScreen';
import { createQaEntry } from '@/lib/qa';
import { QA_DEMO_TENANT } from '@/data/demo/domains/qaDemo';
import { useAuth } from '@/lib/auth/context';
import type { QaItemKind } from '@/types/qa';

/** WP566 — QA Create */
export function QaCreateScreen() {
  const { profile } = useAuth();
  return (
    <DomainCreateScreen
      wpNumber={566}
      title="QA-Eintrag anlegen"
      entityLabel="Eintrag"
      fields={[
        { key: 'title', label: 'Titel', required: true },
        { key: 'kind', label: 'Art (pilot/bug/coverage)', required: true },
      ]}
      onSubmit={async (values) => {
        const kind = (values.kind as QaItemKind) || 'bug';
        const result = await createQaEntry(QA_DEMO_TENANT, values.title, kind, profile?.roleKey);
        if (!result.ok) return result;
        return { ok: true as const, id: result.data.id };
      }}
      successRoute={(id) => `/business/qa/${id}`}
    />
  );
}
