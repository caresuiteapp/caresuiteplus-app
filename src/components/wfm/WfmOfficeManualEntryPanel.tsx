import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { CareDateInput, CareEntitySelect, CareTimeInput } from '@/components/inputs';
import { ListFilterSelect, PremiumButton, SectionPanel, SuccessState, useWorkflowFeedback } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { createWfmOfficeManualEntry } from '@/lib/wfm/wfmOfficeTimekeepingService';
import type { WfmOfficeWorkKind } from '@/types/modules/wfmOfficeTimekeeping';
import type { WfmEditorState } from './WfmOfficeTimeHistoryPanel';
import { validateOfficeTimeValues } from '@/lib/wfm/wfmOfficeStoredEntry';
import { typography } from '@/theme';

type Props = {
  tenantId: string;
  actorId: string;
  roleKey: import('@/types').RoleKey | null;
  employees: { id: string; name: string }[];
  initialDate?: string;
  onChanged?: () => Promise<void>;
  onEditorStateChange?: (state: WfmEditorState) => void;
};

export function WfmOfficeManualEntryPanel({ tenantId, actorId, roleKey, employees, initialDate, onChanged, onEditorStateChange }: Props) {
  const text = useAuroraAdaptiveText();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '');
  const [workDate, setWorkDate] = useState(initialDate ?? new Date().toLocaleDateString('en-CA'));
  const [endDate, setEndDate] = useState(workDate);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [pauseMinutes, setPauseMinutes] = useState('30');
  const [workKind, setWorkKind] = useState<WfmOfficeWorkKind>('buero');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const savingRef = useRef(false);
  const requestId = useRef<string | null>(null);
  const feedback = useWorkflowFeedback();
  useEffect(() => { onEditorStateChange?.({ dirty, busy: loading, childOpen: false }); }, [dirty, loading, onEditorStateChange]);
  useEffect(() => () => onEditorStateChange?.({ dirty: false, busy: false, childOpen: false }), [onEditorStateChange]);
  const change = <T,>(setter: (value: T) => void) => (value: T) => { setDirty(true); setter(value); };

  const submit = async () => {
    if (savingRef.current) return;
    setError(null);
    setMessage(null);
    if (!employeeId) { setError('Bitte eine mitarbeitende Person auswählen.'); return; }
    if (!workDate || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      setError('Bitte Arbeitstag, Beginn und Ende vollständig auswählen.');
      return;
    }
    const start = new Date(`${workDate}T${startTime}:00`);
    const end = new Date(`${endDate}T${endTime}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setError('Das Ende muss nach dem Beginn liegen.');
      return;
    }
    if (!reason.trim()) { setError('Eine Begründung für den Nachtrag ist erforderlich.'); return; }
    const invalid = validateOfficeTimeValues(start.toISOString(), end.toISOString(), Number(pauseMinutes));
    if (invalid) { setError(invalid); return; }
    savingRef.current = true;
    setLoading(true);
    requestId.current ??= crypto.randomUUID();
    const feedbackId = feedback.showLoading('Nachtrag wird dauerhaft gespeichert…');
    try {
      const result = await createWfmOfficeManualEntry(tenantId, actorId, roleKey, {
        entryId: requestId.current, employeeId, workDate, workKind,
        actualStartAt: start.toISOString(), actualEndAt: end.toISOString(), pauseMinutes: Number(pauseMinutes), reason,
      });
      if (!result.ok) { setError(result.error); return; }
      setMessage(`Nachtrag für ${result.data.employeeName} gespeichert (Prüfstatus: offen zur Prüfung).`);
      setReason(''); setDirty(false); requestId.current = null;
      await onChanged?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Der Nachtrag konnte nicht gespeichert werden.'); }
    finally { savingRef.current = false; setLoading(false); feedback.dismiss(feedbackId); }

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
        onChange={change(setEmployeeId)}
        placeholder="Mitarbeitende aus dem System auswählen"
        emptyMessage="Keine aktiven Mitarbeitenden vorhanden."
        required
      />
      <CareDateInput label="Arbeitstag" value={workDate} onChange={value => { if (endDate === workDate) setEndDate(value); change(setWorkDate)(value); }} showFormatHint={false} />
      <CareDateInput label="Enddatum" value={endDate} onChange={change(setEndDate)} showFormatHint={false} />
      <View style={styles.row}>
        <CareTimeInput label="Beginn" value={startTime} onChange={change(setStartTime)} showFormatHint={false} />
        <CareTimeInput label="Ende" value={endTime} onChange={change(setEndTime)} showFormatHint={false} />
        <View><Text style={{ color: text.primary }}>Pause (Minuten)</Text><TextInput accessibilityLabel="Pause in Minuten" value={pauseMinutes} onChangeText={change(setPauseMinutes)} keyboardType="number-pad" style={{ borderWidth: 1, borderColor: '#B8D1EA', borderRadius: 10, padding: 12, color: text.primary, minWidth: 110 }} /></View>
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
        onChange={(value) => { setDirty(true); setWorkKind(value as WfmOfficeWorkKind); }}
      />
      <TextInput
        value={reason}
        onChangeText={change(setReason)}
        placeholder="Grund / Notiz (Pflicht)"
        placeholderTextColor={text.muted}
        multiline
        style={[styles.input, styles.reason, { color: text.primary, borderColor: text.border }]}
      />
      <View style={styles.actions}>
        <PremiumButton title="Nachtrag speichern" loading={loading} disabled={!employeeId || loading} onPress={() => void submit()} />
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
