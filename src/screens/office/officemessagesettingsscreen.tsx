import { ModuleDashboardShell } from '@/components/layout/platform';
import { EmptyState } from '@/components/ui';

export function OfficeMessageSettingsScreen() {
  return (
    <ModuleDashboardShell moduleLabel="Office" title="Nachrichten-Einstellungen" subtitle="Wird wiederhergestellt">
      <EmptyState
        title="Einstellungen"
        message="Die Messaging-Einstellungen werden nach der Dateiwiederherstellung erneut verfügbar."
      />
    </ModuleDashboardShell>
  );
}
