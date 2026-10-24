// Generated native presentation from src/screens/pflege/TourPlanningPresentation.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { FilterChipGroup, PremiumInput } from '@/components/ui';
import { tourPlanningTimeCandidates, tourPlanningLocalTime } from "../../lib/pflege/tourPlanningWorkspaceForm.native.ts";
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { colors, spacing } from '@/theme';
const when = (value: string) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(value));
export function PlanningPacket({ packet }: {
    packet: unknown;
}) {
    const styles = useStyles();
    const p = packet as {
        versionLabel: string;
        startedAt: string;
        endedAt: string;
        activity: string;
        accessSummary: string;
        stops: {
            stopId: string;
            clientLabel: string | null;
            windowStart: string;
            windowEnd: string;
            serviceType: string;
            frequency: string;
        }[];
    };
    if (!p || !Array.isArray(p.stops))
        return <Text style={styles.body}>Für diese ältere Fassung liegt kein gesonderter adressierter Planinhalt vor.</Text>;
    return <View style={styles.stack}><Text style={styles.heading}>{p.versionLabel} · {when(p.startedAt)} bis {when(p.endedAt)} (Berlin)</Text><Text style={styles.body}>{p.activity} · {p.accessSummary}</Text>{p.stops.map(stop => <View key={stop.stopId} style={styles.item}><Text style={styles.heading}>{stop.clientLabel || 'Pflegefall ohne gespeicherten Namensstand'}</Text><Text style={styles.body}>{when(stop.windowStart)} bis {when(stop.windowEnd)} · {stop.serviceType} · {stop.frequency}</Text></View>)}</View>;
}
export function PlanningTimeField({ label, value, onChange, disabled }: {
    label: string;
    value: string;
    onChange(value: string): void;
    disabled: boolean;
}) {
    const styles = useStyles(), candidates = tourPlanningTimeCandidates(value);
    return <View style={styles.stack}><PremiumInput label={label} value={tourPlanningLocalTime(value)} onChangeText={onChange} placeholder="JJJJ-MM-TTTHH:MM:SS" editable={!disabled}/><Text style={styles.caption}>Ortszeit: {Intl.DateTimeFormat().resolvedOptions().timeZone}{/(Z|[+-]\d{2}:\d{2})$/.test(value) ? ` · ursprünglicher Zeitpunkt: ${value}` : ''}</Text>{candidates.length > 1 ? <><Text style={styles.body}>Diese Ortszeit tritt zweimal auf. Den tatsächlichen UTC-Abstand wählen.</Text><FilterChipGroup wrap options={candidates} value={value} onChange={disabled ? undefined : onChange}/></> : null}</View>;
}
function useStyles() { const { c } = useCareLightPalette(); const adaptive = useAdaptiveContentStyles(); return useMemo(() => StyleSheet.create({ stack: { minWidth: 0, gap: spacing.md }, item: { backgroundColor: c.surfaceAlt, borderColor: c.border, minWidth: 0, padding: spacing.md, gap: spacing.xs }, heading: { color: colors.textPrimary, fontWeight: '700', flexShrink: 1 }, body: { color: colors.textPrimary, lineHeight: 21, flexShrink: 1 }, caption: { color: colors.textSecondary, lineHeight: 19, flexShrink: 1 } }), [adaptive, c]); }
