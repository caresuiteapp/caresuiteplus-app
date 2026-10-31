// Generated native presentation from src/screens/business/office/ClientRecordDiagnosisNotesPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { InfoBanner, PremiumButton, PremiumCard, SectionPanel } from '@/components/ui';
import { projectClientDiagnosisNotesWeb } from "../../../lib/clients/clientDiagnosisNotes.native.ts";
import { colors, spacing, typography } from '@/theme';
type Props = {
    diagnoses: readonly string[] | null;
    clientId: string;
    canViewStructured: boolean;
};
export function ClientRecordDiagnosisNotesPanel({ diagnoses, clientId, canViewStructured }: Props) {
    const router = useRouter();
    const projection = projectClientDiagnosisNotesWeb(diagnoses);
    return <SectionPanel title="Gespeicherte Diagnosehinweise" subtitle="Gelieferte Einträge; keine Diagnosefreigabe oder vollständige Historie">
    {projection.state === 'unavailable' ? <InfoBanner variant="info" message="Der aktuelle eigene Diagnosenbestand und das erforderliche sensible Leserecht sind nicht bestätigt."/> : null}
    {projection.state === 'unknown' ? <InfoBanner variant="info" message="Unbekannt: Im gelieferten Bestand ist kein strukturierter Diagnosehinweis enthalten. Das bestätigt nicht, dass keine Diagnose besteht."/> : null}
    {projection.state === 'present' ? <View style={styles.list}>{projection.entries.map(entry => <PremiumCard key={`diagnosis-${entry.ordinal}`} style={styles.card}>
      <Text selectable style={styles.note}>{entry.noteState === 'value' ? entry.note : 'Leer im gelieferten Diagnosenfeld'}</Text>
      <Text style={styles.meta}>Quelle: Nicht geliefert</Text>
      <Text style={styles.meta}>Diagnosedatum: Nicht geliefert</Text>
      <Text style={styles.warning}>Der gespeicherte Hinweis bestätigt weder fachliche Diagnose, Aktualität, Autorenschaft noch Freigabe. Lieferreihenfolge und Ordnungsnummer sind keine native Identität oder Historie.</Text>
    </PremiumCard>)}</View> : null}
    {canViewStructured ? <PremiumButton title="Strukturierte Diagnosen- und Allergiehistorie öffnen" variant="secondary" onPress={() => router.push(`/office/clients/${clientId}/clinical-history`)}/> : <InfoBanner variant="info" message="Die strukturierte Historie benötigt aktuelle sensible Akten- und Diagnosenrechte."/>}
  </SectionPanel>;
}
const styles = StyleSheet.create({
    list: { gap: spacing.md },
    card: { gap: spacing.xs },
    note: { ...typography.bodyStrong, color: colors.textPrimary },
    meta: { ...typography.body, color: colors.textMuted },
    warning: { ...typography.caption, color: colors.textMuted },
});
