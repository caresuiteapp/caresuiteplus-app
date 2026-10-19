import { Text } from 'react-native';
import { InfoBanner, PremiumCard } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { getCareFleetMaintenanceEvidence } from '@/lib/pflege/careFleetMaintenanceEvidence.web';
import { spacing, typography } from '@/theme';

export function CareFleetMaintenanceEvidencePanel() {
  const evidence = getCareFleetMaintenanceEvidence();
  const { c } = useCareLightPalette();
  return (
    <PremiumCard>
      <Text style={{ ...typography.h3, color: c.text }}>Inventarstatus ist keine Wartungsfreigabe</Text>
      <Text style={{ ...typography.body, color: c.muted, marginTop: spacing.xs }}>
        Das Inventar kennt Fahrzeugkategorien und aktuelle Zustände wie „In Wartung“. Der Tourworkflow
        bindet seine optionale Fahrzeugreferenz aber nicht und prüft diesen Zustand vor Veröffentlichung nicht.
      </Text>
      <InfoBanner
        variant="warning"
        title="Nicht verfügbare Fahrzeuge vor Freigabe sperren"
        message="Wartungsfrist, Prüfergebnis, Außerbetriebnahme und Ersatz fehlen. Ein Label oder aktueller Inventarstatus ersetzt keine versionierte Wartungshistorie und keine atomare Verfügbarkeitsprüfung."
      />
      <Text style={{ ...typography.caption, color: c.muted, marginTop: spacing.sm }}>
        Inventarstatus vorhanden: {evidence.inventoryCurrentStatus === 'provided' ? 'ja' : 'nein'}.
        Tourfreigabe prüft Verfügbarkeit: {evidence.tourReleaseAvailabilityGuard === 'not_provided' ? 'nein' : 'ja'}.
      </Text>
    </PremiumCard>
  );
}
