import { StyleSheet, Text, View } from 'react-native';
import { getEmployeeMasterDataBoundaryWeb } from '@/lib/office/employeeMasterDataBoundary.web';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';

export function EmployeeMasterDataBoundaryPanel() {
  const { c } = useCareLightPalette();
  const boundary = getEmployeeMasterDataBoundaryWeb();

  return (
    <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.title, { color: c.text }]}>Personalstamm und Austritt · Nachweisgrenze</Text>
      <Text style={[styles.body, { color: c.muted }]}>
        Die angezeigten Stammdaten, Eintrittsangaben, Funktion, Abteilung und der aktuelle Status sind ein aktueller Beschäftigten-Snapshot. Sie bilden keine vollständige Vertrags-, Rollen- oder Beschäftigungsänderungshistorie und ersetzen keine Personalakte mit Originalbelegen.
      </Text>
      <Text style={[styles.warning, { color: c.text }]}>
        Ein Austrittsdatum oder inaktiver Status beweist weder den vollständigen Entzug aller Portal-, Geräte-, E-Mail-, Telefon- und Cloud-Zugänge noch die unveränderte Erhaltung aller historischen Autorenangaben. Erst die einzelnen bestätigten Sperr- und Historienbelege dürfen dafür ausgewertet werden.
      </Text>
      <Text selectable style={[styles.meta, { color: c.muted }]}>
        Status: {boundary.capability} · Portalentzug {boundary.portalRevocationWorkflow} · externe Zugänge {boundary.externalAccessRevocation} · Autorenhistorie {boundary.historicalAuthorPreservationProof}
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
