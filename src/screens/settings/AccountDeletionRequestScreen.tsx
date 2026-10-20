import { ScreenShell } from '@/components/layout';
import { PrivacySettingsHero } from '@/components/settings/PrivacySettingsHero';
import { DataSubjectRequestPanel } from '@/components/privacy/DataSubjectRequestPanel';

export function AccountDeletionRequestScreen() {
  return (
    <ScreenShell
      title="Kontolöschung"
      subtitle="Art. 17 DSGVO"
      showBack
    >
      <PrivacySettingsHero
        title="Antrag auf Kontolöschung"
        subtitle="Löschung personenbezogener Zugangsdaten"
        articleLabel="Art. 17 DSGVO"
        icon="🗑️"
      />
      <DataSubjectRequestPanel
        title="Antrag auf Kontolöschung"
        subtitle="Löschung personenbezogener Zugangsdaten"
        requestLabel="Kontolöschung (Art. 17 DSGVO)"
        requestType="deletion"
        description="Mit diesem Antrag beantragen Sie die Löschung Ihres Benutzerkontos und zugehöriger personenbezogener Daten, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen."
        notesPlaceholder="z. B. Mandant, Benutzerkonto, Grund der Löschung"
        notesHint="Pflichtangaben helfen bei der eindeutigen Zuordnung Ihres Kontos."
        alternateRoute="/settings/data-request"
        alternateLabel="Zu Datenauskunft & Export"
        showDeletionWarning
      />
    </ScreenShell>
  );
}
