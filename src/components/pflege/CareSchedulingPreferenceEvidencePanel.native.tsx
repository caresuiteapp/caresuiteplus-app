// Generated native presentation from src/components/pflege/CareSchedulingPreferenceEvidencePanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import {} from 'react-native';
import { InfoBanner, PremiumCard } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { getCareSchedulingPreferenceEvidence } from "../../lib/pflege/careSchedulingPreferenceEvidence.native.ts";
import { spacing, typography } from '@/theme';
export function CareSchedulingPreferenceEvidencePanel() {
    const evidence = getCareSchedulingPreferenceEvidence();
    const { c } = useCareLightPalette();
    return (<PremiumCard>
      <Text style={{ ...typography.h3, color: c.text }}>Wunsch ist keine Terminvereinbarung</Text>
      <Text style={{ ...typography.body, color: c.muted, marginTop: spacing.xs }}>
        Gespeicherte Wunschtage, Wunschzeiten, Personalgeschlecht und Einsatzhäufigkeit sind
        Planungspräferenzen. Quelle, Gültigkeit, Vereinbarungsfassung und Priorität fehlen.
      </Text>
      <InfoBanner variant="warning" title="Bezugspflege nicht zugesichert" message="Ein Personalname oder eine bestehende Zuordnung belegt kein vereinbartes Bezugsteam. Stammteam, Vertretungsregel, Priorität und historische Zusage sind nicht nativ gebunden."/>
      <Text style={{ ...typography.caption, color: c.muted, marginTop: spacing.sm }}>
        Der Tourstopp führt weder die zugrunde liegende Präferenz noch eine Vereinbarung oder einen
        Abweichungsgrund. Planabweichungen sind deshalb vor Übernahme nicht vollständig sichtbar.
        Automatische Freigabe: {evidence.automaticRelease ? 'ja' : 'nein'}.
      </Text>
    </PremiumCard>);
}
