import { ScreenShell } from '@/components/layout';
import { PrivacySettingsHero } from '@/components/settings/PrivacySettingsHero';
import { DataSubjectRequestPanel } from '@/components/privacy/DataSubjectRequestPanel';

export function DataRequestScreen() {
  return (
    <ScreenShell
      title="Datenauskunft & Export"
      subtitle="Art. 15–20 DSGVO"
      showBack
    >
      <PrivacySettingsHero
        title="Datenauskunft & Datenportabilität"
        subtitle="Auskunft, Berichtigung, Export oder Einschränkung"
        articleLabel="Art. 15–20 DSGVO"
        icon="📋"
      />
      <DataSubjectRequestPanel
        title="Datenauskunft & Datenportabilität"
        subtitle="Auskunft, Berichtigung, Export oder Einschränkung"
        requestLabel="Auskunft / Export / Berichtigung"
        requestType="access"
        description="Stellen Sie hier Anfragen zu gespeicherten personenbezogenen Daten. Ihr Mandanten-Administrator oder unser Support bearbeitet berechtigte Anfragen innerhalb der gesetzlichen Fristen."
        notesPlaceholder="z. B. betroffene Person, Zeitraum, gewünschte Datenkategorien"
        notesHint="Je präziser die Angaben, desto schneller kann die Anfrage bearbeitet werden."
        alternateRoute="/settings/account-deletion"
        alternateLabel="Zur Kontolöschung"
      />
    </ScreenShell>
  );
}
