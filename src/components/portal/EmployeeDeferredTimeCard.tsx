import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { PremiumInput } from '@/components/ui/PremiumInput';
import { portalPremium } from '@/design/tokens/portalPremium';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { employeePortalAgendaDate, employeePortalAssignmentSchedule } from '@/lib/portal/employee/employeePortalAssignmentDisplay';
import { EmployeePortalAgendaAction } from './employee/EmployeePortalAgendaAction';
import { EmployeePortalAgendaCard, EmployeePortalAgendaStatus } from './employee/EmployeePortalAgendaCard';
import { employeePortalDesign as c } from './employee/employeePortalDesign';
import { useAuth } from '@/lib/auth/context';
import { ensurePortalWriteSession } from '@/lib/auth/portalSupabaseAuth';
import { formatEditableVisitTime, parseEditableVisitTime } from '@/lib/portal/employeeOpenVisitTimeEdit';
import { EMPLOYEE_DEFERRED_REASON_LABELS, type EmployeeDeferredTime } from '@/lib/portal/employeeDeferredTimeModel';
import { submitEmployeeDeferredTime } from '@/lib/portal/employeeDeferredTimeService';
import { validateOfficeTimeValues } from '@/lib/wfm/wfmOfficeStoredEntry';

const status = {
  correction_needed: { label: 'Korrektur erforderlich', tone: 'orange' },
  awaiting_review: { label: 'Wartet auf Freigabe', tone: 'cyan' },
  office_required: { label: 'Klärung durch die Verwaltung', tone: 'purple' },
} as const;

export function EmployeeDeferredTimeCard({ task, compact, onSaved, onSubmitted, onOpenVisit }: {
  task: EmployeeDeferredTime;
  compact: boolean;
  onSaved: () => Promise<boolean>;
  onSubmitted: (message: string) => void;
  onOpenVisit?: () => void;
}) {
  const { portalSession } = useAuth();
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(''), [end, setEnd] = useState('');
  const [pause, setPause] = useState('0'), [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(null);
  const flight = useRef(false);
  const needsCorrection = task.state === 'correction_needed';
  const begin = () => {
    if (flight.current || !needsCorrection) return;
    setStart(formatEditableVisitTime(task.entry?.actualStartAt ?? null));
    setEnd(formatEditableVisitTime(task.entry?.actualEndAt ?? null));
    setPause(String(task.entry?.pauseMinutes ?? 0)); setReason(''); setMessage(null); setEditing(true);
  };
  const save = async () => {
    if (flight.current || !needsCorrection) return;
    const startedAt = parseEditableVisitTime(start), endedAt = parseEditableVisitTime(end);
    const pauseMinutes = /^\d+$/.test(pause.trim()) ? Number(pause.trim()) : NaN;
    const invalid = validateOfficeTimeValues(startedAt, endedAt, pauseMinutes);
    if (invalid || !startedAt || !endedAt) { setMessage(invalid ?? 'Bitte Beginn und Ende vollständig angeben.'); return; }
    if (!reason.trim()) { setMessage('Bitte begründen Sie die Korrektur.'); return; }
    flight.current = true; setBusy(true); setMessage(null);
    try {
      const session = await ensurePortalWriteSession(portalSession, 'workflow');
      if (!session.ok) throw new Error(session.error);
      const result = await submitEmployeeDeferredTime({ task, startedAt, endedAt, pauseMinutes, reason });
      if (!result.ok) throw new Error(result.error);
      setEditing(false);
      const refreshed = await onSaved().catch(() => false);
      onSubmitted(refreshed ? 'Korrektur eingereicht. Die Verwaltung prüft die Zeiten vor der Nachberechnung.'
        : 'Korrektur eingereicht. Der Listenstand konnte noch nicht aktualisiert werden. Bitte erneut laden.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Die Korrektur konnte nicht gespeichert werden.'); }
    finally { flight.current = false; setBusy(false); }
  };
  const workDate = employeePortalAgendaDate(new Date(`${task.workDate}T12:00:00`));
  const actual = task.entry?.actualStartAt && task.entry.actualEndAt
    ? employeePortalAssignmentSchedule({ startsAt: task.entry.actualStartAt, endsAt: task.entry.actualEndAt })
    : null;
  const close = () => { if (!busy) setEditing(false); };

  return (
    <>
      <EmployeePortalAgendaCard date={workDate} title={task.label} compact={compact}
        tone={needsCorrection ? 'warning' : 'past'} testID={`deferred-time-${task.id}`}
        status={<EmployeePortalAgendaStatus {...status[task.state]} />}
        actions={needsCorrection || onOpenVisit ? <>
          {needsCorrection ? <EmployeePortalAgendaAction label="Zeiten korrigieren" icon="create-outline" primary busy={busy} onPress={begin} /> : null}
          {onOpenVisit ? <EmployeePortalAgendaAction label="Einsatz nachbearbeiten" icon="arrow-forward-outline" busy={busy} onPress={onOpenVisit} /> : null}
        </> : null}>
        <Text style={styles.copy}>{EMPLOYEE_DEFERRED_REASON_LABELS[task.reason]}</Text>
        {actual?.duration ? (
          <View style={styles.actual}>
            <Text style={styles.actualTime}>Erfasst {actual.time}</Text>
            {actual.endDay ? <Text style={styles.copy}>Ende am {actual.endDay}</Text> : null}
          </View>
        ) : null}
        {task.note ? <Text style={styles.copy}>{task.note}</Text> : null}
      </EmployeePortalAgendaCard>

      {editing ? (
        <PlatformModal title="Zeitkorrektur" subtitle={workDate.date}
          visible onClose={close} dismissOnBackdrop={false} surfaceScope="personal"
          minWidth={280} maxWidth={600} maxHeightRatio={0.88}
          footerActions={[
            { title: 'Abbrechen', variant: 'secondary', disabled: busy, onPress: close },
            { title: 'Korrektur zur Prüfung einreichen', variant: 'primary', loading: busy, disabled: busy || !needsCorrection, onPress: save },
          ]}>
          <View style={styles.form}>
            <Text style={styles.dialogSubject}>{task.label}</Text>
            <Text style={styles.dialogCopy}>Tragen Sie die geleisteten Zeiten ein. Die Verwaltung prüft Ihre Korrektur.</Text>
            <PremiumInput label="Arbeitsbeginn (TT.MM.JJJJ HH:MM)" accessibilityLabel="Arbeitsbeginn (TT.MM.JJJJ HH:MM)" value={start} onChangeText={setStart} editable={!busy && needsCorrection} onLightSurface />
            <PremiumInput label="Arbeitsende (TT.MM.JJJJ HH:MM)" accessibilityLabel="Arbeitsende (TT.MM.JJJJ HH:MM)" value={end} onChangeText={setEnd} editable={!busy && needsCorrection} onLightSurface />
            <PremiumInput label="Pause in Minuten" accessibilityLabel="Pause in Minuten" value={pause} onChangeText={setPause} keyboardType="number-pad" editable={!busy && needsCorrection} onLightSurface />
            <PremiumInput label="Grund der Korrektur" accessibilityLabel="Grund der Korrektur" value={reason} onChangeText={setReason} multiline editable={!busy && needsCorrection} onLightSurface />
            {!needsCorrection ? <Text style={styles.error} accessibilityRole="alert">Dieser Eintrag wird inzwischen von der Verwaltung bearbeitet.</Text> : null}
            {message ? <Text style={styles.error} accessibilityRole="alert">{message}</Text> : null}
          </View>
        </PlatformModal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create(withCareSuiteTypography({
  copy: { color: c.muted, fontSize: font(13), lineHeight: font(19) },
  actual: { gap: 2 },
  actualTime: { color: c.text, fontSize: font(13), lineHeight: font(19), fontWeight: '700' },
  form: { gap: 12 },
  dialogSubject: { color: portalPremium.text.primary, fontSize: font(16), lineHeight: font(22), fontWeight: '700' },
  dialogCopy: { color: portalPremium.text.secondary, fontSize: font(14), lineHeight: font(21) },
  error: { color: portalPremium.accent.danger, fontSize: font(14), lineHeight: font(21) },
}));
