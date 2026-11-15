// Generated native presentation from src/components/pflege/MedicationEventTimeInput.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeLabel,NativeInput,NativeSelect,NativeOption} from '@/components/layout/NativeWorkspaceElements.native';
import { useId, useMemo } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
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
type TimeInputProps = {
    value: MedicationEventTime;
    onChange(value: MedicationEventTime): void;
    disabled?: boolean;
    label?: string;
    pickers?: boolean;
};
const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
export function MedicationEventTimeInput({ value, onChange, disabled = false, label = 'Tatsächlicher Ereigniszeitpunkt', pickers = false, }: TimeInputProps) {
    const id = useId();
    const candidates = useMemo(() => berlinEventCandidates(value.date, value.time), [value.date, value.time]);
    const changeDate = (date: string) => onChange({ ...value, date, selected: '' });
    const changeTime = (time: string) => onChange({ ...value, time, selected: '' });
    const chooseDay = (offset: number) => {
        const today = currentMedicationEventTime().date;
        const day = new Date(today + 'T12:00:00Z');
        day.setUTCDate(day.getUTCDate() + offset);
        changeDate(day.toISOString().slice(0, 10));
    };
    const [hour = '', minute = ''] = value.time.split(':');
    return <View style={styles.group}>
    <View style={styles.row}>
      {pickers && Platform.OS === 'web' ? <>
        <View style={styles.field}>
          <NativeLabel htmlFor={id + '-date'} style={pickerLabel}>{label} · Datum *</NativeLabel>
          <NativeInput type="date" id={id + '-date'} lang="de-DE" max={currentMedicationEventTime().date} value={value.date} disabled={disabled} onChange={event => changeDate(event.currentTarget.value)} style={pickerInput}/>
        </View>
        <View style={styles.field}>
          <NativeLabel htmlFor={id + '-time'} style={pickerLabel}>Uhrzeit · Berlin *</NativeLabel>
          <NativeInput type="time" id={id + '-time'} lang="de-DE" value={value.time} disabled={disabled} onChange={event => changeTime(event.currentTarget.value)} style={pickerInput}/>
        </View>
      </> : <>
        <View style={styles.field}><PremiumInput label={`${label}${pickers ? ' ·' : ':'} Datum *`} accessibilityLabel={`${label}: Datum`} hint="JJJJ-MM-TT · Deutschland" value={value.date} editable={!disabled} onChangeText={changeDate}/></View>
        {pickers ? <View style={[styles.row, styles.field]}>
          <View style={styles.timePart}>
            <NativeLabel htmlFor={id + '-hour'} style={pickerLabel}>Stunde *</NativeLabel>
            <NativeSelect id={id + '-hour'} value={hour} disabled={disabled} onChange={event => changeTime(event.currentTarget.value + ':' + minute)} style={pickerInput}>
              {hours.map(key => <NativeOption value={key} key={key}>{key}</NativeOption>)}
            </NativeSelect>
          </View>
          <View style={styles.timePart}>
            <NativeLabel htmlFor={id + '-minute'} style={pickerLabel}>Minute *</NativeLabel>
            <NativeSelect id={id + '-minute'} value={minute} disabled={disabled} onChange={event => changeTime(hour + ':' + event.currentTarget.value)} style={pickerInput}>
              {minutes.map(key => <NativeOption value={key} key={key}>{key}</NativeOption>)}
            </NativeSelect>
          </View>
        </View> : <View style={styles.field}><PremiumInput label="Uhrzeit *" accessibilityLabel={`${label}: Uhrzeit`} hint="HH:MM · Europe/Berlin" value={value.time} editable={!disabled} onChangeText={changeTime}/></View>}
      </>}
    </View>
    {pickers ? <View style={styles.shortcuts}>
      <PremiumButton title="Heute" variant="secondary" size="sm" disabled={disabled} onPress={() => chooseDay(0)}/>
      <PremiumButton title="Gestern" variant="secondary" size="sm" disabled={disabled} onPress={() => chooseDay(-1)}/>
      <PremiumButton title="Jetzt" variant="secondary" size="sm" disabled={disabled} onPress={() => onChange(currentMedicationEventTime())}/>
    </View> : <PremiumButton title="Aktuelle Zeit übernehmen" variant="secondary" disabled={disabled} onPress={() => onChange(currentMedicationEventTime())}/>}
    {!candidates.length ? <InfoBanner variant="warning" title="Datum oder Uhrzeit prüfen" message="Der Zeitpunkt ist ungültig. Beim Wechsel zur Sommerzeit existieren bestimmte Uhrzeiten nicht."/> : null}
    {candidates.length > 1 ? <><InfoBanner variant="warning" title="Doppelte Uhrzeit durch Zeitumstellung" message="Bitte ausdrücklich auswählen, welche der beiden Uhrzeiten gemeint ist."/><FilterChipGroup wrap options={candidates.map(key => ({ key, label: key.endsWith('+02:00') ? 'Sommerzeit (UTC+02)' : 'Winterzeit (UTC+01)' }))} value={value.selected} onChange={disabled ? undefined : selected => onChange({ ...value, selected })}/></> : null}
  </View>;
}
const pickerLabel = { display: 'block', fontSize: 14, fontWeight: 650, marginBottom: 6, color: '#153A57' } as const;
const pickerInput = {
    width: '100%', boxSizing: 'border-box', minHeight: 46, border: '1px solid #B9D0E3',
    borderRadius: 12, backgroundColor: '#F4F9FD', color: '#142C46', fontSize: 16,
    fontFamily: 'inherit', padding: '9px 12px',
} as const;
const styles = StyleSheet.create({
    group: { gap: spacing.sm },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    field: { flex: 1, flexBasis: 240, minWidth: 0 },
    timePart: { flex: 1, minWidth: 74 },
    shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
