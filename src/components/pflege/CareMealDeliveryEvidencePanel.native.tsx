// Generated native presentation from src/components/pflege/CareMealDeliveryEvidencePanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import {} from 'react-native';
import { InfoBanner, PremiumCard } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { getCareMealDeliveryEvidence } from "../../lib/pflege/careMealDeliveryEvidence.native.ts";
import { spacing, typography } from '@/theme';
export function CareMealDeliveryEvidencePanel() {
    const evidence = getCareMealDeliveryEvidence();
    const { c } = useCareLightPalette();
    return (<PremiumCard>
      <Text style={{ ...typography.h3, color: c.text }}>Essensdienst-Anfrage ist keine Auslieferung</Text>
      <Text style={{ ...typography.body, color: c.muted, marginTop: spacing.xs }}>
        Der Marktplatz kennt Essensdienste und Demo-Anfragen. Ein eigener Mahlzeitenauftrag mit Kostform,
        Liefertermin und tatsächlicher Übergabe ist damit nicht dokumentiert.
      </Text>
      <InfoBanner variant="warning" title="Planung, Lieferung und Ausfall getrennt führen" message="Eine Anfrage oder geplante Lieferung darf nicht als erbracht gelten. Auslieferung, Empfänger:in, Übergabe, Ausfallgrund und Rückmeldung benötigen eigene unveränderliche Ereignisse."/>
      <Text style={{ ...typography.caption, color: c.muted, marginTop: spacing.sm }}>
        Essensdienst-Kategorie vorhanden: {evidence.marketplaceCategory === 'provided' ? 'ja' : 'nein'}.
        Tatsächliches Lieferereignis vorhanden: {evidence.actualDeliveryEvent === 'not_provided' ? 'nein' : 'ja'}.
      </Text>
    </PremiumCard>);
}
