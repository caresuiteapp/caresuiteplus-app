// Generated native presentation from src/components/pflege/CareTourAssignmentEvidencePanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { View } from 'react-native';
import { InfoBanner, PremiumCard } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { getCareTourAssignmentEvidence } from "../../lib/pflege/careTourAssignmentEvidence.native.ts";
import { spacing, typography } from '@/theme';
export function CareTourAssignmentEvidencePanel() {
    const evidence = getCareTourAssignmentEvidence();
    const { c } = useCareLightPalette();
    return (<PremiumCard>
      <Text style={{ ...typography.h3, color: c.text }}>Kurze Strecke ist keine Einsatzfreigabe</Text>
      <Text style={{ ...typography.body, color: c.muted, marginTop: spacing.xs }}>
        Eine Tour führt derzeit genau eine Pflegekraft. Der vorbereitete SQL-Pfad prüft aktive
        Beschäftigung im Pflegemodul, Schichtabdeckung und Überschneidung. Die angezeigte
        Qualifikation ist jedoch nur ein Personalstammlabel und nicht an die konkrete Leistung gebunden.
      </Text>
      <InfoBanner variant="warning" title="Doppelbesetzung nicht reserviert" message="Anlass, zweite native Person, getrennte Eignungsprüfung und atomare Reservierung desselben Besuchsintervalls fehlen. Zwei Einzelpläne oder Namen bilden keine Doppelbesetzung."/>
      <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
        <Text style={{ ...typography.caption, color: c.text }}>• Fahrtzeit: {evidence.travelDurationRelation}</Text>
        <Text style={{ ...typography.caption, color: c.text }}>• Kapazität: {evidence.capacityRelation}</Text>
        <Text style={{ ...typography.caption, color: c.text }}>• Zugangsvoraussetzungen: {evidence.accessRequirementRelation}</Text>
      </View>
      <Text style={{ ...typography.caption, color: c.muted, marginTop: spacing.sm }}>
        Der Pflege-Tourenpfad enthält keine Distanzoptimierung. Damit wird eine kurze Strecke zwar nicht
        als Vorrang verwendet, aber Qualifikation, Doppelbesetzung, Kapazität und Zugang sind deshalb
        noch nicht vollständig geprüft oder freigegeben.
      </Text>
    </PremiumCard>);
}
