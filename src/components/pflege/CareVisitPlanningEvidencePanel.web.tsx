import { Text, View } from 'react-native';
import { InfoBanner, PremiumCard } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import type { CareTour } from '@/lib/pflege/careTourPlanningService';
import { buildCareVisitPlanningEvidence } from '@/lib/pflege/careVisitPlanningEvidence.web';
import { spacing, typography } from '@/theme';

export function CareVisitPlanningEvidencePanel({ tours }: { tours: readonly CareTour[] }) {
  const evidence = buildCareVisitPlanningEvidence(tours);
  const { c } = useCareLightPalette();
  const counts = evidence.tourCounts;
  return (
    <PremiumCard>
      <Text style={{ ...typography.h3, color: c.text }}>Entwurf ist kein regulärer Besuchstermin</Text>
      <Text style={{ ...typography.body, color: c.muted, marginTop: spacing.xs }}>
        Der gelieferte Tourenstand enthält {counts.draft} Entwürfe, {counts.published} freigegebene,
        {' '}{counts.inProgress} laufende, {counts.completed} abgeschlossene und {counts.cancelled} abgesagte
        Touren mit insgesamt {evidence.stopCount} Einsätzen. Daraus wird weder eine vereinbarte Besuchsfrequenz
        noch tatsächliche Versorgung abgeleitet.
      </Text>
      <InfoBanner
        variant="warning"
        title="Unterbrechung vor Freigabe nicht vollständig gebunden"
        message="Ressourcenliste und Entwurf prüfen die datumsspezifisch aktive Aufnahme noch nicht. Vorbereitete SQL-Guards sperren erst Freigabe und Versorgungsstart gegen eine aktive Aufnahme am Tourdatum."
      />
      <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
        <Text style={{ ...typography.caption, color: c.text }}>• Bedarf und Frequenz: nicht strukturiert an eine Planversion gebunden</Text>
        <Text style={{ ...typography.caption, color: c.text }}>• Zeitfenster und Dauer: im Entwurf vorhanden, aber kein Versorgungsnachweis</Text>
        <Text style={{ ...typography.caption, color: c.text }}>• Leistungsarten: derzeit freie Leistungszusammenfassung ohne native Leistungsart-ID</Text>
      </View>
      <Text style={{ ...typography.caption, color: c.muted, marginTop: spacing.sm }}>
        Laut vorbereitetem SQL darf eine pausierte oder beendete Aufnahme nicht freigegeben oder begonnen werden;
        die Ausführung in der ausgerollten Datenbank ist noch offen. Bis Ressourcenliste und Entwurf dieselbe
        datumsspezifische Aufnahmeprüfung verwenden, bleibt die Vermeidung neuer regulärer Termine nur teilweise nachgewiesen.
      </Text>
    </PremiumCard>
  );
}
