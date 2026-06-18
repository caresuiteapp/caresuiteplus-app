import { ModuleDashboardShell } from '@/components/layout/platform';
import { EmptyState } from '@/components/ui';

export function OfficeMessageTemplatesScreen() {
  return (
    <ModuleDashboardShell moduleLabel="Office" title="Nachrichten-Vorlagen" subtitle="Wird wiederhergestellt">
      <EmptyState
        title="Vorlagen"
        message="Die Vorlagen-Verwaltung wird nach der Dateiwiederherstellung erneut verfügbar."
      />
    </ModuleDashboardShell>
  );
}
