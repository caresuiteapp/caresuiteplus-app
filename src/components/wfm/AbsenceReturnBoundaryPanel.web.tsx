import { StyleSheet, Text, View } from 'react-native';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
import { getAbsenceReturnBoundaryWeb } from '@/lib/wfm/absenceReturnBoundary.web';

export function AbsenceReturnBoundaryPanel() {
  const { c } = useCareLightPalette();
  const boundary = getAbsenceReturnBoundaryWeb();

  return (
    <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}> 
      <Text style={[styles.title, { color: c.text }]}>Abwesenheit und Rückkehr · Nachweisgrenze</Text>
      <Text style={[styles.body, { color: c.muted }]}> 
        Abwesenheitsart, interne oder persönliche Notizen, Krankheitsdetails, Dokumente und Entscheidungsgründe bleiben Beschäftigtendaten. Klienteninformationen erhalten höchstens den Zeitraum „nicht verfügbar“; Abwesenheitskalender sind für das Klientenportal nicht freigegeben.
      </Text>
      <Text style={[styles.warning, { color: c.text }]}> 
        Das Ende eines Abwesenheitszeitraums und der Status „abgeschlossen“ belegen weder die tatsächliche Rückkehr noch uneingeschränkte Einsatzfähigkeit. Ein verknüpftes Rückkehrereignis, befristete Einschränkungen und eine unveränderliche Entscheidungsfolge fehlen; der getrennte Einsatzfähigkeits-Snapshot schließt diese Lücke nicht.
      </Text>
      <Text selectable style={[styles.meta, { color: c.muted }]}> 
        Status: {boundary.capability} · Klientenprojektion {boundary.clientPortalProjection} · Rückkehr {boundary.actualReturnEvidence} · SQL {boundary.deployedDatabaseEvidence}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: careSpacing.lg, borderWidth: 1, borderRadius: 18, gap: careSpacing.xs },
  title: { fontSize: 17, fontWeight: '800' },
  body: { fontSize: 14, lineHeight: 21 },
  warning: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  meta: { fontSize: 12, lineHeight: 18 },
});
