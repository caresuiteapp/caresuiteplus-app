import { ScreenShell } from '@/components/layout';
import { DataSubjectRequestsAdminListView } from '@/components/privacy/DataSubjectRequestsAdminListView';

/** DSGVO Admin — Betroffenenanfragen für business_admin (Sprint 51/58). */
export function DataSubjectRequestsAdminScreen() {
  return (
    <ScreenShell
      title="Betroffenenanfragen"
      subtitle="DSGVO · Mandanten-Admin"
      showBack
    >
      <DataSubjectRequestsAdminListView />
    </ScreenShell>
  );
}
