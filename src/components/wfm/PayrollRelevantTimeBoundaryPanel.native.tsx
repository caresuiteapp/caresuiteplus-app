// Generated native presentation from src/components/wfm/PayrollRelevantTimeBoundaryPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { StyleSheet, View } from 'react-native';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
import { getPayrollRelevantTimeBoundaryWeb } from "../../lib/wfm/payrollRelevantTimeBoundary.native.ts";
export function PayrollRelevantTimeBoundaryPanel() {
    const { c } = useCareLightPalette();
    const boundary = getPayrollRelevantTimeBoundaryWeb();
    return (<View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}> 
      <Text style={[styles.title, { color: c.text }]}>Lohnrelevante Zeiten · Nachweisgrenze</Text>
      <Text style={[styles.body, { color: c.muted }]}> 
        Nur freigegebene, nicht exportblockierende Reviews dürfen in den geprüften Export. Der Export-Snapshot hält Beschäftigten-, Review- und Ursprungsreferenz; Korrekturexporte ersetzen das frühere Item nachvollziehbar, ohne es umzuschreiben.
      </Text>
      <Text style={[styles.warning, { color: c.text }]}> 
        Planzeit, Tourreihenfolge und der gesperrte Alt-Sitzungsexport sind keine Lohnfakten. Fahrt- und Bereitschaftszeit sind nicht vollständig an den Review-Export gebunden; Zuschläge und mikrosekundengenaue Originalereignisse fehlen im Exportvertrag. Ein ausgerollter SQL-/RLS-Nachweis liegt nicht vor.
      </Text>
      <Text selectable style={[styles.meta, { color: c.muted }]}> 
        Status: {boundary.capability} · Freigabe {boundary.approvedOnlyExport} · Quelle {boundary.sourceTrace} · SQL {boundary.deployedDatabaseEvidence}
      </Text>
    </View>);
}
const styles = StyleSheet.create({
    panel: { padding: careSpacing.lg, borderWidth: 1, borderRadius: 18, gap: careSpacing.xs, marginBottom: careSpacing.md },
    title: { fontSize: 17, fontWeight: '800' },
    body: { fontSize: 14, lineHeight: 21 },
    warning: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
    meta: { fontSize: 12, lineHeight: 18 },
});
