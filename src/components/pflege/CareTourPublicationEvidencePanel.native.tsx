// Generated native presentation from src/components/pflege/CareTourPublicationEvidencePanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import {} from 'react-native';
import { InfoBanner, PremiumCard } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { getCareTourPublicationEvidence } from "../../lib/pflege/careTourPublicationEvidence.native.ts";
import { spacing, typography } from '@/theme';
export function CareTourPublicationEvidencePanel() {
    const evidence = getCareTourPublicationEvidence();
    const { c } = useCareLightPalette();
    return (<PremiumCard>
      <Text style={{ ...typography.h3, color: c.text }}>Veröffentlicht ist nicht zugestellt</Text>
      <Text style={{ ...typography.body, color: c.muted, marginTop: spacing.xs }}>
        Die Tour kann den Status veröffentlicht erhalten. Der Pflegepfad führt aber keine unveränderliche
        Planversion, keine adressierten Empfänger und keinen persönlichen Empfang genau dieser Fassung.
      </Text>
      <InfoBanner variant="warning" title="Aktuelle Planfassung persönlich nachweisen" message="Sichtbarkeit oder eine zusammengefasste Bestätigungszahl belegt weder Zustellung noch Kenntnisnahme. Änderungen benötigen eine adressierte Mitteilung mit Bezug auf alte und neue Fassung."/>
      <Text style={{ ...typography.caption, color: c.muted, marginTop: spacing.sm }}>
        Veröffentlichungsstatus vorhanden: {evidence.publishedStatus === 'provided' ? 'ja' : 'nein'}.
        Persönliche Quittierung vorhanden: {evidence.personalAcknowledgement === 'not_provided' ? 'nein' : 'ja'}.
      </Text>
    </PremiumCard>);
}
