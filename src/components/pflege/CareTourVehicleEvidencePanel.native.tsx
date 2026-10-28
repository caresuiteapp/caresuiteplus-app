// Generated native presentation from src/components/pflege/CareTourVehicleEvidencePanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import {} from 'react-native';
import { InfoBanner, PremiumCard } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { getCareTourVehicleEvidence } from "../../lib/pflege/careTourVehicleEvidence.native.ts";
import { spacing, typography } from '@/theme';
export function CareTourVehicleEvidencePanel() {
    const evidence = getCareTourVehicleEvidence();
    const { c } = useCareLightPalette();
    return (<PremiumCard>
      <Text style={{ ...typography.h3, color: c.text }}>Fahrzeuglabel ist kein Fahrtenbuch</Text>
      <Text style={{ ...typography.body, color: c.muted, marginTop: spacing.xs }}>
        Das Schema besitzt eine optionale Fahrzeugreferenz, der Pflege-Tourworkflow befüllt oder liest sie
        jedoch nicht. Er führt nur ein freies Label und prüft weder Verfügbarkeit noch Fahrerberechtigung.
      </Text>
      <InfoBanner variant="warning" title="Fahrt und Kilometer getrennt nachweisen" message="Kilometerbeginn, Kilometerende, Fahrtzweck und Übergabe fehlen. Ein Planlabel darf deshalb keine Fahrt abschließen und widersprüchliche Kilometer nicht verdecken."/>
      <Text style={{ ...typography.caption, color: c.muted, marginTop: spacing.sm }}>
        Planungslabel vorhanden: {evidence.plannedVehicleLabel === 'provided' ? 'ja' : 'nein'}.
        Fahrzeugreferenz im Workflow gebunden: {evidence.nativeVehicleReference === 'schema_only_unbound' ? 'nein' : 'ja'}.
      </Text>
    </PremiumCard>);
}
