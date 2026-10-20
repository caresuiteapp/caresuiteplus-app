import { DomainCreateScreen } from '@/screens/shared/DomainCreateScreen';
import { createReportDraft } from '@/lib/reporting';
import { REPORTING_DEMO_TENANT } from '@/data/demo/reportingDemo';
import { useAuth } from '@/lib/auth/context';

/** WP506 — Create/Edit Wizard Bericht */
export function ReportCreateScreen() {
  const { profile } = useAuth();
  return (
    <DomainCreateScreen
      wpNumber={506}
      title="Bericht anlegen"
      entityLabel="Bericht"
      fields={[
        { key: 'title', label: 'Titel', required: true },
        { key: 'category', label: 'Kategorie' },
      ]}
      onSubmit={async (values) => {
        const result = await createReportDraft(
          REPORTING_DEMO_TENANT,
          values.title,
          profile?.roleKey,
        );
        if (!result.ok) return result;
        return { ok: true as const, id: result.data.id };
      }}
      successRoute={(id) => `/business/reporting/${id}`}
    />
  );
}
