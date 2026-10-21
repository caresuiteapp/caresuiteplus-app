import { StyleSheet, Text, View } from 'react-native';
import { getTrainingDeadlineBoundaryWeb } from '@/lib/training/trainingDeadlineBoundary.web';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';

export function TrainingDeadlineBoundaryPanel() {
  const { c } = useCareLightPalette();
  const boundary = getTrainingDeadlineBoundaryWeb();

  return (
    <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}> 
      <Text style={[styles.title, { color: c.text }]}>Fortbildung und Fristen · Nachweisgrenze</Text>
      <Text style={[styles.body, { color: c.muted }]}> 
        Pflichtregel, Zuweisung, Frist, Bearbeitungs- und Abschlusszeit, Gültigkeit sowie Erinnerungsstufe sind getrennte Angaben. Der vorhandene Nachweis verweist nur über eine Dokumentkennung auf einen Beleg; die produktive Speicherung ist nicht freigegeben.
      </Text>
      <Text style={[styles.warning, { color: c.text }]}> 
        Zuweisung, Termin, Erinnerung oder deren Bestätigung schließen keine Pflicht. Auch ein Status „abgeschlossen“ belegt ohne bestätigte Teilnahme, unveränderliches Original und prüfbare Gültigkeitsgrundlage keine Erfüllung.
      </Text>
      <Text selectable style={[styles.meta, { color: c.muted }]}> 
        Status: {boundary.capability} · Original {boundary.proofOriginal} · Historie {boundary.appendOnlyRequirementHistory} · Live {boundary.livePersistence}
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
