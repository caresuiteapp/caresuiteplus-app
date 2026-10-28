// Generated native presentation from src/components/office/OccupationalSafetyPortalBoundaryPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { StyleSheet, View } from 'react-native';
import { getOccupationalSafetyPortalBoundaryWeb } from "../../lib/office/occupationalSafetyPortalBoundary.native.ts";
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
export function OccupationalSafetyPortalBoundaryPanel() {
    const { c } = useCareLightPalette();
    const boundary = getOccupationalSafetyPortalBoundaryWeb();
    return (<View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.title, { color: c.text }]}>Arbeitsschutz und Belastung · Portalgrenze</Text>
      <Text style={[styles.body, { color: c.muted }]}>
        Unterweisungs- und Personalakten bleiben personenbezogene Beschäftigtendaten. Die Klientenportal-Projektion verwendet ausschließlich freigegebene klientenbezogene Quellen; Haushaltsgefahren sind Angaben zur Versorgung und kein Arbeitsschutzbefund einer beschäftigten Person.
      </Text>
      <Text style={[styles.warning, { color: c.text }]}>
        Gefährdung, Maßnahme, Meldung und zuständige Stelle besitzen noch keinen nativen Arbeitsschutzvertrag. Die Anwendung sperrt Klientenportale, eine tatsächlich ausgerollte feld- und rollenbezogene Datenbanktrennung ist damit jedoch nicht bewiesen.
      </Text>
      <Text selectable style={[styles.meta, { color: c.muted }]}>
        Status: {boundary.capability} · Anwendung {boundary.clientPortalApplicationAccess} · Datenbank {boundary.clientPortalDatabaseIsolation} · Historie {boundary.appendOnlyHistory}
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
