// Generated native presentation from src/components/office/EmployeeQualificationBoundaryPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { StyleSheet, View } from 'react-native';
import { getEmployeeQualificationBoundaryWeb } from "../../lib/office/employeeQualificationBoundary.native.ts";
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
export function EmployeeQualificationBoundaryPanel() {
    const { c } = useCareLightPalette();
    const boundary = getEmployeeQualificationBoundaryWeb();
    return (<View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.title, { color: c.text }]}>Qualifikationen und Einsatzfreigabe · Nachweisgrenze</Text>
      <Text style={[styles.body, { color: c.muted }]}>
        Die angezeigten Abschlüsse, Zusatzqualifikationen, Gültigkeiten und Prüfmerkmale sind aktuelle Personalakteneinträge. Ein Titel, eine Checkbox oder der Status „gültig“ beweist noch keine Kompetenz für eine konkrete Tätigkeit und ersetzt weder Originalnachweis noch vollständige Änderungshistorie.
      </Text>
      <Text style={[styles.warning, { color: c.text }]}>
        Abgelaufene Nachweise dürfen nicht als passende automatische Zuordnung verwendet werden. Der vorhandene Tourenvorschlag prüft dies teilweise; ein weiterer statischer Vertretungspfad wertet jedoch keine nativen Dokumente oder Ablaufdaten aus. Eine vollständige automatische Einsatzfreigabe ist deshalb nicht nachgewiesen.
      </Text>
      <Text selectable style={[styles.meta, { color: c.muted }]}>
        Status: {boundary.capability} · Tätigkeitsbezug {boundary.activitySpecificQualificationRelation} · Originalhistorie {boundary.appendOnlyQualificationHistory} · automatische Freigabe {boundary.completeAutomaticAssignmentRelease}
      </Text>
    </View>);
}
const styles = StyleSheet.create({
    panel: {
        padding: careSpacing.lg,
        borderWidth: 1,
        borderRadius: 18,
        gap: careSpacing.xs,
    },
    title: { fontSize: 17, fontWeight: '800' },
    body: { fontSize: 14, lineHeight: 21 },
    warning: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
    meta: { fontSize: 12, lineHeight: 18 },
});
