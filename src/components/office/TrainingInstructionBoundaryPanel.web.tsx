import { StyleSheet, Text, View } from 'react-native';
import { getTrainingInstructionBoundaryWeb } from '@/lib/training/trainingInstructionBoundary.web';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';

export function TrainingInstructionBoundaryPanel() {
  const { c } = useCareLightPalette();
  const boundary = getTrainingInstructionBoundaryWeb();

  return (
    <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.title, { color: c.text }]}>Einarbeitung und Einweisung · Nachweisgrenze</Text>
      <Text style={[styles.body, { color: c.muted }]}>
        Kurs, Person, Bearbeitungszeiten, Ergebnis, Gültigkeit und Prüfmerkmale bilden einen Schulungsnachweis. Der vorhandene Vertrag führt jedoch kein konkretes Gerät mit Version und keine Bestätigung der eingewiesenen Person; die Dokumentreferenz lädt kein unveränderliches Original.
      </Text>
      <Text style={[styles.warning, { color: c.text }]}>
        Teilnahme, Abschluss oder Quiz-Ergebnis dürfen nicht als gesonderte Kompetenzfeststellung für eine konkrete Tätigkeit gelten. Ohne eigene Kompetenzentscheidung und unveränderliche Einweisungshistorie ist eine automatische Einsatzfreigabe nicht nachgewiesen.
      </Text>
      <Text selectable style={[styles.meta, { color: c.muted }]}>
        Status: {boundary.capability} · Gerät/Version {boundary.deviceAndVersionRelation} · Bestätigung {boundary.participantConfirmation} · Kompetenzfeststellung {boundary.separateCompetenceAssessment}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: careSpacing.lg,
    borderWidth: 1,
    borderRadius: 18,
    gap: careSpacing.xs,
  },
  title: { fontSize: 17, fontWeight: '800' },
  body: { fontSize: 14, lineHeight: 21 },
  warning: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  meta: { fontSize: 12, lineHeight: 18 },
});
