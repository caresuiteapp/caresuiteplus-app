// Generated native presentation from src/components/pflege/MedicationHistoricalPlan.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PremiumButton } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { spacing, typography } from '@/theme';
import type { HistoricalMedicationHistory, HistoricalMedicationField } from "../../lib/pflege/medicationHistoricalPlan.native.ts";
type Props = {
    history: HistoricalMedicationHistory;
    eventId: string;
};
export function MedicationHistoricalPlan({ history, eventId }: Props) {
    const { c } = useCareLightPalette();
    const [showOriginal, setShowOriginal] = useState(false);
    const [showPlan, setShowPlan] = useState(false);
    const styles = useMemo(() => StyleSheet.create({
        container: { gap: spacing.sm, width: '100%', minWidth: 0 },
        title: { ...typography.body, color: c.text, fontWeight: '700', flexShrink: 1, maxWidth: '100%' },
        note: { ...typography.caption, color: c.muted, flexShrink: 1, maxWidth: '100%' },
        warning: { ...typography.caption, color: c.warning, flexShrink: 1, maxWidth: '100%' },
        value: { ...typography.body, color: c.text, flexShrink: 1, maxWidth: '100%' },
        row: { gap: spacing.xs, minWidth: 0, width: '100%' },
        original: { ...typography.caption, color: c.muted, flexShrink: 1, maxWidth: '100%' },
    }), [c]);
    const plan = history.entries.find(value => value.eventId === eventId);
    if (history.error || !plan)
        return <View style={styles.container}><Text style={styles.warning}>{history.error ?? 'Der eigene historische Verordnungsbeleg ist nicht bestätigt.'}</Text></View>;
    const renderField = (value: HistoricalMedicationField) => <View key={value.key} style={styles.row}><Text style={styles.note}>{value.label}</Text><Text style={value.state === 'invalid' ? styles.warning : styles.value}>{value.display}</Text></View>;
    return <View style={styles.container}>
    <Text style={styles.title}>Originalplan dieser Dokumentation</Text>
    {renderField(plan.planTime)}
    {renderField(plan.actualTime)}
    <Text style={styles.note}>Ein Plantermin bestätigt keine Durchführung. Aus diesen Zeiten wird kein zulässiges Abweichungsfenster abgeleitet.</Text>
    <Text style={plan.snapshotState === 'recorded' ? styles.note : styles.warning}>{plan.message}</Text>
    {plan.version ? renderField(plan.version) : null}
    {plan.ownSnapshot ? <>
      <PremiumButton title={showPlan ? 'Gespeicherten Gabeplan und Bedingungen schließen' : 'Gespeicherten Gabeplan und Bedingungen anzeigen'} variant="secondary" onPress={() => setShowPlan(value => !value)}/>
      {showPlan ? plan.fields.map(renderField) : null}
      <PremiumButton title={showOriginal ? 'Vollständiges Verordnungsoriginal schließen' : 'Vollständiges Verordnungsoriginal anzeigen'} variant="secondary" onPress={() => setShowOriginal(value => !value)}/>
      {showOriginal ? <Text style={styles.original}>{JSON.stringify(plan.originalSnapshot, null, 2)}</Text> : null}
    </> : null}
  </View>;
}
