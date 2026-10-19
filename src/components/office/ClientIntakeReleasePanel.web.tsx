import { StyleSheet, Text, View } from 'react-native';
import { InfoBanner } from '@/components/ui';
import { ClientWorkspaceButton, ClientWorkspacePanel } from './ClientWorkspacePrimitives';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
import { INTAKE_DOCUMENT_STATUS_LABELS } from '@/features/intakeDocuments/intakeDocumentTypes';
import type { useClientIntakeWizard } from '@/hooks/useClientIntakeWizard.web';

type Wizard = ReturnType<typeof useClientIntakeWizard>;
const signatureLabels = { client: 'Klient:in', employee: 'Mitarbeitende:r', legal_representative: 'Vertretung' } as const;
const phases = {
  ready: 'Angaben prüfen',
  'draft-dispatched': 'Speicherung der Akte noch ungeklärt',
  'documents-dispatched': 'Speicherung der Unterlagen noch ungeklärt',
  'submit-dispatched': 'Aufnahmeabschluss noch ungeklärt',
  complete: 'Aufnahmeabschluss bestätigt',
  'existing-selected': 'Bestandsakte ausgewählt',
} as const;

/** The saved evidence and the care decision remain visibly separate. */
export function ClientIntakeReleasePanel({ wizard, onRecovered }: { wizard: Wizard; onRecovered(id: string): void }) {
  const text = useAdaptiveContentStyles();
  const progress = wizard.workflowProgress;
  if (!progress || wizard.isEditMode) return null;
  const unresolved = ['draft-dispatched', 'documents-dispatched', 'submit-dispatched'].includes(progress.stage);
  const form = wizard.form;
  const documentsStep = wizard.steps.indexOf('vertraege_einwilligungen');
  return (
    <ClientWorkspacePanel title="Unterlagen und Aufnahmefreigabe" subtitle={phases[progress.stage]} compact>
      <View style={styles.stack} accessibilityLiveRegion="polite">
        <Text style={text.body}>Unterlagen: {progress.documentsConfirmed ? 'Gemeinsame Speicherquittung liegt vor' : 'Für diesen Stand noch nicht gemeinsam bestätigt'}</Text>
        {form.intakeDocuments.length ? form.intakeDocuments.map(doc => (
          <View key={doc.templateKey} style={styles.document}>
            <Text style={text.body}>{doc.title} · Fassung {doc.version}</Text>
            <Text style={text.caption}>{INTAKE_DOCUMENT_STATUS_LABELS[doc.status]} · {Object.keys(doc.signatures).map(role => signatureLabels[role as keyof typeof signatureLabels]).join(', ') || 'Keine Unterschrift erfasst'}</Text>
          </View>
        )) : <Text style={text.caption}>Die erforderlichen Unterlagen werden im Abschnitt Verträge und Einwilligungen zusammengestellt.</Text>}
        <Text style={text.body}>Kapazität: {form.intakeCapacityStatus === 'confirmed' ? 'Als bestätigt erfasst' : 'Nicht bestätigt'}</Text>
        <Text style={text.body}>Aufnahmeentscheidung: {form.intakeAdmissionDecision === 'accepted' ? 'Freigabe erfasst' : form.intakeAdmissionDecision === 'rejected' ? 'Abgelehnt' : 'Offen'}</Text>
        <InfoBanner message={unresolved
          ? 'Die Antwort auf einen Speichervorgang fehlt. Die Prüfung ruft ausschließlich den Beleg dieses Vorgangs ab. Sie legt keine zweite Akte an und wiederholt keine Unterschrift oder Aktivierung.'
          : 'Die Speicherbestätigung belegt den abgeglichenen Datenstand. Die fachliche Aufnahmeentscheidung und die Prüfung der tatsächlich unterzeichnenden Personen bleiben erforderlich.'} />
        <View style={styles.actions}>
          {documentsStep >= 0 ? <ClientWorkspaceButton label="Unterlagen ansehen" compact disabled={wizard.submitting}
            onPress={() => wizard.goToStep(documentsStep)} /> : null}
          {unresolved ? <ClientWorkspaceButton label="Gespeicherten Vorgang prüfen" compact disabled={wizard.submitting}
            onPress={() => { void wizard.recoverPendingWrite().then(id => { if (id) onRecovered(id); }); }} /> : null}
        </View>
      </View>
    </ClientWorkspacePanel>
  );
}

const styles = StyleSheet.create({
  stack: { gap: careSpacing.sm, minWidth: 0 },
  document: { gap: careSpacing.xs, minWidth: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: careSpacing.sm },
});
