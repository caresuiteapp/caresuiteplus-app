// Generated native presentation from src/components/pflege/CareTourSeriesEvidencePanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import {} from 'react-native';
import { InfoBanner, PremiumCard } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { getCareTourSeriesEvidence } from "../../lib/pflege/careTourSeriesEvidence.native.ts";
import { spacing, typography } from '@/theme';
export function CareTourSeriesEvidencePanel() {
    const evidence = getCareTourSeriesEvidence();
    const { c } = useCareLightPalette();
    return (<PremiumCard>
      <Text style={{ ...typography.h3, color: c.text }}>Einzelne Tour ist keine Serie</Text>
      <Text style={{ ...typography.body, color: c.muted, marginTop: spacing.xs }}>
        Der Pflegepfad speichert ein Tourdatum und lokale Stoppzeiten. Er führt keine versionierte
        Wiederholungsregel, Zeitzone oder datierte Ausnahme für bestätigte Einzeltermine.
      </Text>
      <InfoBanner variant="warning" title="Feiertag und Einzeländerung separat entscheiden" message="Ein Kalenderhinweis oder eine Serie aus einem anderen Modul ändert keine Pflegetour. Ohne native Ausnahme und Originalhistorie darf ein Einzeltermin die übrigen Vorkommen nicht umschreiben."/>
      <Text style={{ ...typography.caption, color: c.muted, marginTop: spacing.sm }}>
        Pflege-Serienvertrag vorhanden: {evidence.nativeSeriesRule === 'not_provided' ? 'nein' : 'ja'}.
        Assistenz-Wiederholung ist Pflege-Tournachweis: {evidence.assistanceRecurrenceIsCareTourProof ? 'ja' : 'nein'}.
      </Text>
    </PremiumCard>);
}
