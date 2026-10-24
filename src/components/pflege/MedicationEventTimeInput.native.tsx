// Generated native presentation from src/components/pflege/MedicationEventTimeInput.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { FilterChipGroup, InfoBanner, PremiumButton, PremiumInput } from '@/components/ui';
import { berlinEventCandidates, berlinEventInput } from '@/lib/pflege/medicationAdministrationDomain';
import { spacing } from '@/theme';
export type MedicationEventTime = {
    date: string;
    time: string;
    selected: string;
};
export function currentMedicationEventTime(): MedicationEventTime { return { ...berlinEventInput(new Date()), selected: '' }; }
export function medicationEventInstant(value: MedicationEventTime): string {
    const candidates = berlinEventCandidates(value.date, value.time);
    return candidates.length === 1 ? candidates[0] : candidates.includes(value.selected) ? value.selected : '';
}
export function MedicationEventTimeInput({ value, onChange, disabled = false, label = 'Tatsächlicher Ereigniszeitpunkt' }: {
    value: MedicationEventTime;
    onChange(value: MedicationEventTime): void;
    disabled?: boolean;
    label?: string;
}) {
    const candidates = useMemo(() => berlinEventCandidates(value.date, value.time), [value.date, value.time]);
    return <View style={styles.group}>
    <View style={styles.row}>
      <View style={styles.field}><PremiumInput label={`${label}: Datum *`} accessibilityLabel={`${label}: Datum`} hint="JJJJ-MM-TT · Deutschland" value={value.date} editable={!disabled} onChangeText={date => onChange({ ...value, date, selected: '' })}/></View>
      <View style={styles.field}><PremiumInput label="Uhrzeit *" accessibilityLabel={`${label}: Uhrzeit`} hint="HH:MM · Europe/Berlin" value={value.time} editable={!disabled} onChangeText={time => onChange({ ...value, time, selected: '' })}/></View>
    </View>
    <PremiumButton title="Aktuelle Zeit übernehmen" variant="secondary" disabled={disabled} onPress={() => onChange(currentMedicationEventTime())}/>
    {!candidates.length ? <InfoBanner variant="warning" title="Datum oder Uhrzeit prüfen" message="Der Zeitpunkt ist ungültig. Beim Wechsel zur Sommerzeit existieren bestimmte Uhrzeiten nicht."/> : null}
    {candidates.length > 1 ? <><InfoBanner variant="warning" title="Doppelte Uhrzeit durch Zeitumstellung" message="Bitte ausdrücklich auswählen, welche der beiden Uhrzeiten gemeint ist."/><FilterChipGroup wrap options={candidates.map(key => ({ key, label: key.endsWith('+02:00') ? 'Sommerzeit (UTC+02)' : 'Winterzeit (UTC+01)' }))} value={value.selected} onChange={disabled ? undefined : selected => onChange({ ...value, selected })}/></> : null}
  </View>;
}
const styles = StyleSheet.create({ group: { gap: spacing.sm }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, field: { flex: 1, flexBasis: 240, minWidth: 0 } });
