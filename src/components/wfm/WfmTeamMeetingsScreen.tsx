import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CareDateInput, CareTimeInput } from '@/components/inputs';
import { ScreenShell } from '@/components/layout';
import { LockedActionBanner } from '@/components/permissions';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumButton, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { createWfmTeamMeeting, listWfmMeetingEmployees, listWfmTeamMeetings, setWfmTeamMeetingStatus } from '@/lib/wfm';
import { careSpacing } from '@/design/tokens/spacing';
import { typography } from '@/theme';

const today = () => new Date().toISOString().slice(0, 10);

export function WfmTeamMeetingsScreen() {
  const tenantId = useServiceTenantId();
  const { user, profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const [title, setTitle] = useState(''); const [date, setDate] = useState(today()); const [start, setStart] = useState('09:00'); const [end, setEnd] = useState('10:00');
  const [location, setLocation] = useState(''); const [description, setDescription] = useState(''); const [attendeeIds, setAttendeeIds] = useState<string[]>([]); const [paid, setPaid] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  const query = useAsyncQuery(useCallback(async () => {
    if (!tenantId) return { ok: true as const, data: { meetings: [], employees: [] } };
    const [meetings, employees] = await Promise.all([listWfmTeamMeetings(tenantId), listWfmMeetingEmployees(tenantId)]);
    if (!meetings.ok) return meetings;
    if (!employees.ok) return employees;
    return { ok: true as const, data: { meetings: meetings.data, employees: employees.data } };
  }, [tenantId]), [tenantId]);

  const create = async () => {
    if (!tenantId || !title.trim()) { setError('Titel des Meetings ist erforderlich.'); return; }
    const starts = new Date(`${date}T${start}:00`); const ends = new Date(`${date}T${end}:00`);
    if (!date || Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) { setError('Bitte Datum, Beginn und Ende vollständig auswählen.'); return; }
    if (ends <= starts) { setError('Das Ende muss nach dem Beginn liegen.'); return; }
    if (paid && attendeeIds.length === 0) { setError('Bitte mindestens eine teilnehmende Person auswählen.'); return; }
    const startsAt = starts.toISOString(); const endsAt = ends.toISOString();
    setSaving(true); setError(null);
    const result = await createWfmTeamMeeting({ tenantId, title, description, location, startsAt, endsAt, countsAsWorkTime: paid, attendeeIds, actorId: user?.id ?? profile?.id });
    setSaving(false); if (!result.ok) { setError(result.error); return; }
    setTitle(''); setDescription(''); setLocation(''); setAttendeeIds([]); await query.refresh();
  };

  const status = async (id: string, next: 'completed' | 'cancelled') => {
    if (!tenantId) return; setError(null);
    const result = await setWfmTeamMeetingStatus(tenantId, id, next, user?.id ?? profile?.id);
    if (!result.ok) { setError(result.error); return; } await query.refresh();
  };

  if (!can('time.settings.manage')) {
    return (
      <ScreenShell title="Team-Meetings" subtitle={roleLabel ?? 'Arbeitszeit'} showBack={false}>
        <LockedActionBanner message={check('time.settings.manage').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Team-Meetings" subtitle="Besprechungen und Sollzeitbuchungen" showBack={false} scroll>
      <SectionPanel title="Team-Meeting planen">
        <Field label="Titel" value={title} onChange={setTitle} placeholder="z. B. Monatsbesprechung" />
        <View style={styles.grid}>
          <View style={styles.structuredField}><CareDateInput label="Datum" value={date} onChange={setDate} showFormatHint={false} /></View>
          <View style={styles.structuredField}><CareTimeInput label="Beginn" value={start} onChange={setStart} showFormatHint={false} /></View>
          <View style={styles.structuredField}><CareTimeInput label="Ende" value={end} onChange={setEnd} showFormatHint={false} /></View>
          <Field label="Ort / Videolink" value={location} onChange={setLocation} />
        </View>
        <Field label="Tagesordnung / Beschreibung" value={description} onChange={setDescription} placeholder="Besprechungspunkte" />
        <Text style={styles.label}>Teilnehmende</Text>
        <View style={styles.chips}>{(query.data?.employees ?? []).map((employee) => { const selected = attendeeIds.includes(employee.id); return <Pressable key={employee.id} style={[styles.chip, selected ? styles.chipSelected : null]} onPress={() => setAttendeeIds((ids) => selected ? ids.filter((id) => id !== employee.id) : [...ids, employee.id])}><Text>{selected ? '✓ ' : ''}{employee.name}</Text></Pressable>; })}</View>
        <View style={styles.actions}><PremiumButton title={paid ? '✓ Als Arbeitszeit buchen' : 'Ohne Zeitbuchung'} variant="secondary" onPress={() => setPaid((value) => !value)} /><PremiumButton title="Meeting anlegen" onPress={() => void create()} loading={saving} /></View>
      </SectionPanel>
      <SectionPanel title="Geplante und vergangene Meetings">
        {query.loading ? <LoadingState message="Team-Meetings werden geladen…" /> : null}
        {query.error ? <ErrorState title="Team-Meetings nicht verfügbar" message={query.error} onRetry={() => void query.refresh()} /> : null}
        {!query.loading && !query.error && (query.data?.meetings ?? []).length === 0 ? <EmptyState title="Keine Team-Meetings" message="Planen Sie das erste Meeting." /> : null}
        {(query.data?.meetings ?? []).map((meeting) => <View key={meeting.id} style={styles.row}><View style={styles.rowHeading}><Text style={styles.title}>{meeting.title}</Text><PremiumBadge label={meeting.status === 'scheduled' ? 'Geplant' : meeting.status === 'completed' ? 'Abgeschlossen' : 'Abgesagt'} variant={meeting.status === 'scheduled' ? 'cyan' : meeting.status === 'completed' ? 'green' : 'muted'} /></View><Text style={styles.caption}>{new Date(meeting.startsAt).toLocaleString('de-DE')} – {new Date(meeting.endsAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}{meeting.location ? ` · ${meeting.location}` : ''}</Text><Text style={styles.caption}>{meeting.attendeeNames.length} Teilnehmende · {meeting.countsAsWorkTime ? 'wird als Arbeitszeit gebucht' : 'keine Zeitbuchung'}</Text>{meeting.status === 'scheduled' ? <View style={styles.actions}><PremiumButton title="Abschließen und Zeiten buchen" onPress={() => void status(meeting.id, 'completed')} /><PremiumButton title="Absagen" variant="secondary" onPress={() => void status(meeting.id, 'cancelled')} /></View> : null}</View>)}
      </SectionPanel>
      {error ? <ErrorState title="Aktion nicht möglich" message={error} onRetry={() => setError(null)} /> : null}
    </ScreenShell>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder} /></View>; }
const styles = StyleSheet.create({ grid: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm }, field: { flex: 1, minWidth: 180, gap: 4 }, structuredField: { flex: 1, minWidth: 180 }, label: { ...typography.caption }, input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 10, backgroundColor: '#fff' }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.xs }, chip: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }, chipSelected: { borderColor: '#22d3ee', backgroundColor: '#ecfeff' }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm }, row: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingVertical: careSpacing.md, gap: 5 }, rowHeading: { flexDirection: 'row', alignItems: 'center', gap: careSpacing.sm }, title: { ...typography.bodyStrong }, caption: { ...typography.caption } });
