import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EmptyState, FilterChipGroup, InfoBanner, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import {
  carePlanActivityLabels, carePlanDays, planActivityFrequency,
  type CarePlanActivityDraft, type CarePlanActivityKind, type CarePlanDay,
} from '@/lib/pflege/carePlanActivities';
import type { CarePlanTask } from '@/types/modules/pflege';
import { spacing, typography } from '@/theme';

const options = carePlanDays.map(day => ({ key: String(day.key), label: day.name }));
const dayKeys = carePlanDays.map(day => day.key);

export function CarePlanActivityFields({ value, onChange, editable }: {
  value: CarePlanActivityDraft;
  onChange: (value: CarePlanActivityDraft) => void;
  editable: boolean;
}) {
  const { c } = useCareLightPalette();
  const drinking = value.kind === 'drinking';
  return (
    <View style={[styles.editor, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
      <Text style={[typography.label, { color: c.text }]}>Geplante Wochentage *</Text>
      <FilterChipGroup wrap multiple minSelected={0} options={options} value={value.days.map(String)}
        onChange={editable ? keys => onChange({ ...value, days: dayKeys.filter(day => keys.includes(String(day))) }) : undefined} />
      <PremiumButton title={value.days.length === 7 ? 'Alle Tage abwählen' : 'Alle Tage auswählen'} size="sm" variant="ghost"
        disabled={!editable} onPress={() => onChange({ ...value, days: value.days.length === 7 ? [] : [...dayKeys] })} />
      <PremiumInput label="Uhrzeiten *" hint="Im Format HH:MM, mehrere Uhrzeiten durch Komma trennen." placeholder="08:30, 13:00"
        value={value.times} maxLength={168} editable={editable} onChangeText={times => onChange({ ...value, times })} />
      <View style={styles.row}>
        <View style={styles.field}>
          <PremiumInput label={drinking ? 'Getränk oder Angebot *' : 'Position oder Bewegung *'} value={value.subject}
            maxLength={160} editable={editable} onChangeText={subject => onChange({ ...value, subject })} />
        </View>
        <View style={styles.field}>
          <PremiumInput label={drinking ? 'Trinkhilfsmittel' : 'Lagerungshilfsmittel'} value={value.equipment}
            maxLength={240} editable={editable} onChangeText={equipment => onChange({ ...value, equipment })} />
        </View>
      </View>
      {drinking ? <PremiumInput label="Angebotsmenge je Termin (ml)" hint="Optional. Die tatsächliche Trinkmenge wird im Protokoll erfasst."
        value={value.offeredMl} maxLength={4} keyboardType="number-pad" editable={editable}
        onChangeText={offeredMl => onChange({ ...value, offeredMl })} /> : null}
    </View>
  );
}

export function SavedCarePlanActivityPanel({ tasks, kind, onEdit, onFluidBalance }: {
  tasks: readonly CarePlanTask[];
  kind: CarePlanActivityKind;
  onEdit?: () => void;
  onFluidBalance?: () => void;
}) {
  const { c } = useCareLightPalette();
  const [day, setDay] = useState<CarePlanDay | null>(null);
  const entries = tasks.flatMap(task => task.itemState === 'cancelled' || task.activity?.kind !== kind ? [] : [
    { task, activity: task.activity },
  ]);
  const scheduled = day === null ? [] : entries.filter(({ activity, task }) =>
    task.itemState !== 'paused' && task.itemState !== 'completed' && activity.days.includes(day))
    .flatMap(({ activity, task }) => activity.times.map(time => ({ activity, task, time })))
    .sort((left, right) => left.time.localeCompare(right.time));
  const knownAmount = scheduled.reduce((sum, { activity }) => sum + (activity.offeredMl ?? 0), 0);
  const amountComplete = scheduled.every(({ activity }) => activity.offeredMl != null);
  const formatAmount = new Intl.NumberFormat('de-DE');

  return (
    <SectionPanel title={carePlanActivityLabels[kind]}>
      <View style={styles.row}>
        {onEdit ? <PremiumButton title="Planung bearbeiten" size="sm" onPress={onEdit} /> : null}
        {onFluidBalance ? <PremiumButton title="Flüssigkeitsbilanz in Vitalwerten erfassen" size="sm" variant="secondary" onPress={onFluidBalance} /> : null}
      </View>
      {entries.length ? <>
        <FilterChipGroup wrap options={[{ key: 'all', label: 'Ganze Woche' }, ...options]} value={day === null ? 'all' : String(day)}
          onChange={value => setDay(dayKeys.find(key => String(key) === value) ?? null)} />
        {day !== null && kind === 'drinking' && scheduled.length > 0 && knownAmount > 0 ? <InfoBanner variant="info" presentation="inline"
          title={`${formatAmount.format(knownAmount)} ml geplantes Angebot`}
          message={amountComplete ? 'Summe der vorgesehenen Angebote für diesen Wochentag.' : 'Summe der eingetragenen Mengen. Für einzelne Termine fehlt die Mengenangabe.'} /> : null}
        {day === null ? entries.map(({ activity, task }) => {
          const detail = [activity.subject, activity.equipment, activity.offeredMl == null ? '' : `${activity.offeredMl} ml je Termin`].filter(Boolean).join(' · ');
          const state = task.itemState === 'paused' ? 'Pausiert' : task.itemState === 'completed' ? 'Abgeschlossen' : undefined;
          return <View key={task.id} style={[styles.saved, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
            <Text style={[typography.bodyStrong, { color: c.text }]}>{task.label}</Text>
            <Text style={[typography.caption, { color: c.muted }]}>{planActivityFrequency(activity)}{state ? ` · ${state}` : ''}</Text>
            <Text style={[typography.body, { color: c.text }]}>{detail}</Text>
            {task.intervention ? <Text style={[typography.body, { color: c.text }]}>{task.intervention}</Text> : null}
          </View>;
        }) : scheduled.map(({ activity, task, time }) => <View key={`${task.id}:${time}`} style={[styles.saved, { borderColor: c.border }]}>
          <Text style={[typography.bodyStrong, { color: c.text }]}>{time} · {task.label}</Text>
          <Text style={[typography.body, { color: c.text }]}>{activity.subject}{activity.offeredMl == null ? '' : ` · ${activity.offeredMl} ml`}</Text>
          {activity.equipment ? <Text style={[typography.caption, { color: c.muted }]}>{activity.equipment}</Text> : null}
        </View>)}
        {day !== null && !scheduled.length ? <Text style={[typography.body, { color: c.muted }]}>Für diesen Wochentag sind keine aktiven Termine geplant.</Text> : null}
      </> : <EmptyState title="Noch keine Termine geplant" message="Im Pflegeplan können Wochentage, Uhrzeiten und die individuelle Unterstützung festgelegt werden." />}
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  editor: { gap: spacing.sm, padding: spacing.md, borderRadius: 16, borderWidth: 1, minWidth: 0 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, minWidth: 0 },
  field: { flexBasis: 200, flexGrow: 1, flexShrink: 1, minWidth: 0 },
  saved: { padding: spacing.md, gap: spacing.xs, borderWidth: 1, borderRadius: 14, minWidth: 0 },
});
