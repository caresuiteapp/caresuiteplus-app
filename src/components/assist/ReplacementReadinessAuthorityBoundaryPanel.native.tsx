// Generated native presentation from src/components/assist/ReplacementReadinessAuthorityBoundaryPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { StyleSheet, View } from 'react-native';
import { getReplacementReadinessAuthorityBoundaryWeb } from "../../lib/assist/replacementReadinessAuthorityBoundary.native.ts";
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
export function ReplacementReadinessAuthorityBoundaryPanel() {
    const { c } = useCareLightPalette();
    const boundary = getReplacementReadinessAuthorityBoundaryWeb();
    return (<View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.title, { color: c.text }]}>Vertretung und Bereitschaft · Befugnisgrenze</Text>
      <Text style={[styles.body, { color: c.muted }]}>
        Abwesenheit, Verfügbarkeit, Vertretungsvorschlag und Bereitschaftszeit sind getrennte Planungsangaben. Der vorhandene Vertrag führt keine bestätigte Erreichbarkeit und keine befristete, auf konkrete Handlungen begrenzte Befugnis der Vertretung.
      </Text>
      <Text style={[styles.warning, { color: c.text }]}>
        Auswahl, Zuweisung oder Bereitschaft übertragen keine Rolle und keine pauschalen Rechte. Erforderliche Zugriffe müssen eigenständig, zweckgebunden und zeitlich begrenzt autorisiert sowie widerrufen werden.
      </Text>
      <Text selectable style={[styles.meta, { color: c.muted }]}>
        Status: {boundary.capability} · Kontakt {boundary.reachableContactChannel} · Befugnis {boundary.temporaryAuthorityScope} · Ablauf {boundary.authorityExpiry}
      </Text>
    </View>);
}
const styles = StyleSheet.create({
    panel: { padding: careSpacing.lg, borderWidth: 1, borderRadius: 18, gap: careSpacing.xs },
    title: { fontSize: 17, fontWeight: '800' },
    body: { fontSize: 14, lineHeight: 21 },
    warning: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
    meta: { fontSize: 12, lineHeight: 18 },
});
