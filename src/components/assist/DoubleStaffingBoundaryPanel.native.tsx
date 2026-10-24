// Generated native presentation from src/components/assist/DoubleStaffingBoundaryPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { StyleSheet, View } from 'react-native';
import { getDoubleStaffingBoundaryWeb } from "../../lib/assist/doubleStaffingBoundary.native.ts";
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
export function DoubleStaffingBoundaryPanel() {
    const { c } = useCareLightPalette();
    const boundary = getDoubleStaffingBoundaryWeb();
    return (<View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.title, { color: c.text }]}>Doppelte Besetzung · Nachweisgrenze</Text>
      <Text style={[styles.body, { color: c.muted }]}>Der vorhandene Einsatz- und Tourenvertrag reserviert genau eine Mitarbeitendenkennung pro Einsatzintervall. Konflikt- und Vertretungsprüfungen schützen diese einzelne Zuordnung; ein zweiter Vorschlag oder Name ist keine zweite Reservierung.</Text>
      <Text style={[styles.warning, { color: c.text }]}>Für eine echte Doppelbesetzung fehlen Anlass, zweite native Zuordnung, getrennte Eignungsprüfung beider Personen und eine atomare Reservierung desselben Zeitraums. Zwei parallele Einzelpläne dürfen nicht still als gemeinsamer Einsatz gelten.</Text>
      <Text selectable style={[styles.meta, { color: c.muted }]}>Status: {boundary.capability} · zweite Person {boundary.secondEmployeeRelation} · Doppelreservierung {boundary.atomicReservationOfBothPeople} · Gesamtnachweis {boundary.completeDoubleStaffingReservation}</Text>
    </View>);
}
const styles = StyleSheet.create({
    panel: { padding: careSpacing.lg, borderWidth: 1, borderRadius: 18, gap: careSpacing.xs },
    title: { fontSize: 17, fontWeight: '800' },
    body: { fontSize: 14, lineHeight: 21 },
    warning: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
    meta: { fontSize: 12, lineHeight: 18 },
});
