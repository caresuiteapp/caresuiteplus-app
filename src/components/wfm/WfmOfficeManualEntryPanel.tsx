import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { CareDateInput, CareEntitySelect, CareTimeInput } from '@/components/inputs';
import { ListFilterSelect, PremiumButton, SectionPanel, SuccessState } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { createWfmOfficeManualEntry } from '@/lib/wfm/wfmOfficeTimekeepingService';
import type { WfmOfficeWorkKind } from '@/types/modules/wfmOfficeTimekeeping';
import { typography } from '@/theme';

type Props = {
  tenantId: string;
  actorId: string;
  roleKey: import('@/types').RoleKey | null;
  employees: { id: string; name: string }[];
};

export function WfmOfficeManualEntryPanel({ tenantId, actorId, roleKey, employees }: Props) {
  const text = useAuroraAdaptiveText();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '');
  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [pauseMinutes, setPauseMinutes] = useState('30');
  const [workKind, setWorkKind] = useState<WfmOfficeWorkKind>('buero');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setMessage(null);
    if (!employeeId) { setError('Bitte eine mitarbeitende Person auswählen.'); return; }
    if (!workDate || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      setError('Bitte Arbeitstag, Beginn und Ende vollständig auswählen.');
      return;
    }
    const start = new Date(`${workDate}T${startTime}:00`);
    const end = new Date(`${workDate}T${endTime}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setError('Das Ende muss nach dem Beginn liegen.');
      return;
    }
    if (!reason.trim()) { setError('Eine Begründung für den Nachtrag ist erforderlich.'); return; }
    setLoading(true);
    const actualStartAt = start.toISOString();
    const actualEndAt = end.toISOString();
    const result = await createWfmOfficeManualEntry(tenantId, actorId, roleKey, {
      employeeId,
      workDate,
      workKind,
      actualStartAt,
      actualEndAt,
      pauseMinutes: Number(pauseMinutes) || 0,
      reason,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(`Nachtrag für ${result.data.employeeName} gespeichert (Prüfstatus: offen zur Prüfung).`);
    setReason('');
  };

  return (
    <SectionPanel title="Office-Zeit nachtragen" subtitle="Manueller Nachtrag mit Pflichtbegründung und Audit">
      <Text style={{ color: text.secondary, ...typography.caption, marginBottom: careSpacing.sm }}>
        Mitarbeitende auswählen, Datum/Zeiten eintragen, Begründung ist Pflicht.
      </Text>
      <CareEntitySelect
        label="Mitarbeitende"
        value={employeeId}
        options={employees.map((employee) => ({ value: employee.id, label: employee.name }))}
        onChange={setEmployeeId}
        placeholder="Mitarbeitende aus dem System auswählen"
        emptyMessage="Keine aktiven Mitarbeitenden vorhanden."
        required
      />
      <CareDateInput label="Arbeitstag" value={workDate} onChange={setWorkDate} showFormatHint={false} />
      <View style={styles.row}>
        <CareTimeInput label="Beginn" value={startTime} onChange={setStartTime} showFormatHint={false} />
        <CareTimeInput label="Ende" value={endTime} onChange={setEndTime} showFormatHint={false} />
        <ListFilterSelect
          label="Pause"
          value={pauseMinutes}
          options={['0', '15', '30', '45', '60'].map((value) => ({ key: value, label: `${value} Minuten` }))}
          onChange={setPauseMinutes}
          style={styles.select}
        />
      </View>
      <ListFilterSelect
        label="Arbeitsart"
        value={workKind}
        options={[
          { key: 'buero', label: 'Büro' },
          { key: 'einsatz', label: 'Einsatz' },
          { key: 'homeoffice', label: 'Homeoffice' },
          { key: 'fahrt', label: 'Fahrzeit' },
        ]}
        onChange={(value) => setWorkKind(value as WfmOfficeWorkKind)}
      />
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder="Grund / Notiz (Pflicht)"
        placeholderTextColor={text.muted}
        multiline
        style={[styles.input, styles.reason, { color: text.primary, borderColor: text.border }]}
      />
      <View style={styles.actions}>
        <PremiumButton title="Nachtrag speichern" loading={loading} disabled={!employeeId} onPress={() => void submit()} />
      </View>
      {message ? <SuccessState title="Gespeichert" message={message} /> : null}
      {error ? <Text style={{ color: '#c0392b', ...typography.caption }}>{error}</Text> : null}
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm, marginBottom: careSpacing.sm },
  input: { borderWidth: 1, borderRadius: 8, padding: careSpacing.sm, minWidth: 120, flex: 1 },
  select: { minWidth: 160, flex: 1 },
  reason: { minHeight: 72, marginBottom: careSpacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
});
