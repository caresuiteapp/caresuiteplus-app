// Generated native presentation from src/components/pflege/CareTourReplanningEvidencePanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import {} from 'react-native';
import { InfoBanner, PremiumCard } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { getCareTourReplanningEvidence } from "../../lib/pflege/careTourReplanningEvidence.native.ts";
import { spacing, typography } from '@/theme';
export function CareTourReplanningEvidencePanel() {
    const evidence = getCareTourReplanningEvidence();
    const { c } = useCareLightPalette();
    return (<PremiumCard>
      <Text style={{ ...typography.h3, color: c.text }}>Statuswechsel ist keine Umplanung</Text>
      <Text style={{ ...typography.body, color: c.muted, marginTop: spacing.xs }}>
        Der kontrollierte Pfad schützt erwartete Statusstände und verlangt Gründe für Absage oder
        Ausfall. Er bietet jedoch keine atomare Änderung von Pflegekraft, Reihenfolge oder Zeitfenster.
      </Text>
      <InfoBanner variant="warning" title="Begonnene Besuche nicht still ersetzen" message="Tatsächlicher Start, Ende und Status bleiben Ereignisfakten. Eine neue Tour oder ein neuer Name darf sie nicht überschreiben; ein nativer Umplanungs- und Vertretungsvertrag fehlt."/>
      <Text style={{ ...typography.caption, color: c.muted, marginTop: spacing.sm }}>
        Planversion, alter/neuer Fassungssnapshot und adressierter Benachrichtigungsnachweis fehlen.
        Stille automatische Umplanung: {evidence.silentAutomaticReplan ? 'ja' : 'nein'}.
      </Text>
    </PremiumCard>);
}
