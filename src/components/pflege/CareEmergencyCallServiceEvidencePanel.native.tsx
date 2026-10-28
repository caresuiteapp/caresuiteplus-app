// Generated native presentation from src/components/pflege/CareEmergencyCallServiceEvidencePanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import {} from 'react-native';
import { InfoBanner, PremiumCard } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { getCareEmergencyCallServiceEvidence } from "../../lib/pflege/careEmergencyCallServiceEvidence.native.ts";
import { spacing, typography } from '@/theme';
export function CareEmergencyCallServiceEvidencePanel() {
    const evidence = getCareEmergencyCallServiceEvidence();
    const { c } = useCareLightPalette();
    return (<PremiumCard>
      <Text style={{ ...typography.h3, color: c.text }}>Partneranfrage ist kein aktiver Hausnotruf</Text>
      <Text style={{ ...typography.body, color: c.muted, marginTop: spacing.xs }}>
        Der Marktplatz kennt die Kategorie „Hausnotruf“ und einen Demo-Anfrageablauf. Damit sind weder
        ein eigener Auftrag noch ein installiertes Gerät, eine Kontaktkette oder ein tatsächlicher Alarm belegt.
      </Text>
      <InfoBanner variant="warning" title="Alarmkette und Rückmeldung separat nachweisen" message="Vertrag, Gerätezuordnung, Alarmannahme, Eskalation und Rückmeldung benötigen native Identitäten und einen unveränderlichen Verlauf. Anfrage-, Partner- oder Provisionsstatus dürfen diese Nachweise nicht ersetzen."/>
      <Text style={{ ...typography.caption, color: c.muted, marginTop: spacing.sm }}>
        Partnerkategorie vorhanden: {evidence.marketplaceCategory === 'provided' ? 'ja' : 'nein'}.
        Eigener Alarmverlauf vorhanden: {evidence.alarmEventLedger === 'not_provided' ? 'nein' : 'ja'}.
      </Text>
    </PremiumCard>);
}
