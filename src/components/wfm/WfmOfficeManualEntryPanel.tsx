import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PremiumButton, SectionPanel, SuccessState } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { createWfmOfficeManualEntry } from '@/lib/wfm/wfmOfficeTimekeepingService';
import type { WfmOfficeWorkKind } from '@/types/modules/wfmOfficeTimekeeping';
import { typography } from '@/theme';

type Props = {
  tenantId: string;
  actorId: string;
  roleKey: import('@/types').RoleKey | null;
  employees: Array<{ id: string; name: string }>;
};

export function WfmOfficeManualEntryPanel({ tenantId, actorId, roleKey, employees }: Props) {
  const text = useAuroraAdaptiveText();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '');
  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [pauseMinutes, setPauseMinutes] = useState('30');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (workKind: WfmOfficeWorkKind) => {
    setLoading(true);
    setError(null);
    setMessage(null);
    const actualStartAt = new Date(`${workDate}T${startTime}:00`).toISOString();
    const actualEndAt = new Date(`${workDate}T${endTime}:00`).toISOString();
    const result = await createWfmOfficeManualEntry(tenantId, actorId, roleKey, {
      employeeId,
      workDate,
      workKind: workKind === 'nachtrag' ? 'nachtrag' : workKind,
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
      <View style={styles.row}>
        <TextInput
          value={employeeId}
          onChangeText={setEmployeeId}
          placeholder="Mitarbeiter-ID"
          placeholderTextColor={text.muted}
          style={[styles.input, { color: text.primary, borderColor: text.border }]}
        />
        <TextInput
          value={workDate}
          onChangeText={setWorkDate}
          placeholder="Datum YYYY-MM-DD"
          placeholderTextColor={text.muted}
          style={[styles.input, { color: text.primary, borderColor: text.border }]}
        />
      </View>
      <View style={styles.row}>
        <TextInput
          value={startTime}
          onChangeText={setStartTime}
          placeholder="Start HH:MM"
          placeholderTextColor={text.muted}
          style={[styles.input, { color: text.primary, borderColor: text.border }]}
        />
        <TextInput
          value={endTime}
          onChangeText={setEndTime}
          placeholder="Ende HH:MM"
          placeholderTextColor={text.muted}
          style={[styles.input, { color: text.primary, borderColor: text.border }]}
        />
        <TextInput
          value={pauseMinutes}
          onChangeText={setPauseMinutes}
          placeholder="Pause Min."
          placeholderTextColor={text.muted}
          style={[styles.input, { color: text.primary, borderColor: text.border }]}
        />
      </View>
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder="Grund / Notiz (Pflicht)"
        placeholderTextColor={text.muted}
        multiline
        style={[styles.input, styles.reason, { color: text.primary, borderColor: text.border }]}
      />
      <View style={styles.actions}>
        <PremiumButton title="Nachtrag Büro" loading={loading} onPress={() => void submit('buero')} />
        <PremiumButton
          title="Nachtrag Einsatz"
          variant="secondary"
          loading={loading}
          onPress={() => void submit('einsatz')}
        />
        <PremiumButton
          title="Nachtrag HO"
          variant="ghost"
          loading={loading}
          onPress={() => void submit('homeoffice')}
        />
      </View>
      {message ? <SuccessState title="Gespeichert" message={message} /> : null}
      {error ? <Text style={{ color: '#c0392b', ...typography.caption }}>{error}</Text> : null}
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm, marginBottom: careSpacing.sm },
  input: { borderWidth: 1, borderRadius: 8, padding: careSpacing.sm, minWidth: 120, flex: 1 },
  reason: { minHeight: 72, marginBottom: careSpacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
});
