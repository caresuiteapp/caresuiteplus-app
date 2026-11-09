import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useLiveRefresh } from '@/hooks/core/useLiveRefresh';
import { useConnectivity } from '@/hooks/useConnectivity';
import { usePermissions } from '@/hooks/usePermissions';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchPortalTimeTrackingSettings } from '@/lib/timeTracking/timeTrackingSettingsService';
import { getWfmTodayStatus, isWfmSessionActive, isWfmSessionPaused, wfmClockIn, wfmClockOut, wfmPause, wfmResume, wfmSwitchWorkType } from '@/lib/wfm/wfmClockService';
import { wfmOfficeCheckInByToken } from '@/lib/wfm/wfmCheckinService';
import { evaluateAndStoreArbzgForToday } from '@/lib/wfm/wfmRuleEngine';
import { getWfmEmployeeTimeAccountOverview } from '@/lib/wfm/wfmTimeAccountService';
import { deriveWfmTimelineTotals } from '@/lib/wfm/wfmTimeline';
import { workDateFromIso } from '@/lib/wfm/wfmWorkSessionRepository';
import { listWfmWorkTypesForClockIn } from '@/lib/wfm/wfmWorkTypes';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import type { RoleKey } from '@/types';
import type { WfmTodayStatus, WfmWorkTypeKey } from '@/types/modules/wfm';
import { EmployeePortalAgendaAction, agendaFocusRing } from './EmployeePortalAgendaAction';
import { EmployeePortalAgendaStatus } from './EmployeePortalAgendaCard';
import { EmployeePortalAgendaHero, useEmployeePortalAgendaLayout } from './EmployeePortalAgendaLayout';
import { ClientRecordLoading, ClientRecordPanel, ClientRecordViewport, clientRecordTextWrap } from './EmployeePortalClientRecordLayout';
import { WorktimeAccount, WorktimeHistory, WorktimeNotice, WorktimeRules, WorktimeShortcuts } from './EmployeePortalWorktimeDetails';
import { employeePortalDesign as c } from './employeePortalDesign';

const workTypes = listWfmWorkTypesForClockIn();
type ActivityKey = Exclude<WfmWorkTypeKey, 'pause'>;
type WorktimeAction = 'start' | 'pause' | 'resume' | 'switch' | 'finish' | 'checkin';
const activityIcons: Record<ActivityKey, keyof typeof Ionicons.glyphMap> = {
  buero: 'business-outline', homeoffice: 'home-outline', einsatz: 'briefcase-outline',
  bereitschaft: 'notifications-outline', fortbildung: 'school-outline', besprechung: 'people-outline', fahrt: 'car-outline',
};
const successfulAction: Record<WorktimeAction, string> = {
  start: 'Arbeitsblock gestartet.', pause: 'Pause gestartet.', resume: 'Arbeit fortgesetzt.',
  switch: 'Tätigkeit gewechselt.', finish: 'Arbeitsblock abgeschlossen.', checkin: 'Büro-Check-in gespeichert. Die Zeiterfassung läuft.',
};

function currentActivity(status: WfmTodayStatus | null) {
  const mode = status?.session?.workMode;
  if (!mode || !status) return undefined;
  for (const event of [...status.events].reverse()) {
    if (event.eventType === 'clock_out' || event.eventType === 'office_check_out') break;
    const type = workTypes.find(item => item.workMode === mode && item.startEventType === event.eventType);
    if (type) return type;
  }
  return workTypes.find(item => item.workMode === mode);
}

const longDate = new Intl.DateTimeFormat('de-DE', { dateStyle: 'full', timeZone: 'Europe/Berlin' });
const monthDate = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });

function formatClock(minutes: number | null) {
  if (minutes == null) return '—';
  return [Math.floor(minutes / 60), minutes % 60].map(part => String(part).padStart(2, '0')).join(':');
}

type Layout = ReturnType<typeof useEmployeePortalAgendaLayout>;

export function EmployeePortalWorktimeScreen() {
  const layout = useEmployeePortalAgendaLayout();
  const tenantId = useServiceTenantId();
  const actor = usePortalActor();
  const { user, profile } = useAuth();
  const { isOffline } = useConnectivity();
  const { can } = usePermissions();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 6_000);
    return () => clearInterval(timer);
  }, []);

  const userId = user?.id ?? profile?.id;
  const roleKey = actor.roleKey;
  const usesVerifiedLink = roleKey === 'employee_portal' || roleKey === 'caregiver' || roleKey === 'nurse';
  const employeeId = usesVerifiedLink ? actor.employeeId : profile?.employeeId ?? null;
  const loadingLink = !actor.isReady || actor.isResolvingEmployeeLink;
  const linked = !usesVerifiedLink || Boolean(employeeId);
  const canView = can('time.tracking.own.view');
  const workDate = workDateFromIso(new Date(now).toISOString());
  const offline = isOffline || Boolean(actor.employeeLinkReadOnly);
  const date = longDate.format(new Date(now));

  return (
    <PortalTabScreen title="Arbeitszeit" contentOwnsHero scroll={false}>
      <ClientRecordViewport layout={layout} testID="employee-worktime-page">
        {tenantId && userId && roleKey && !loadingLink && linked && canView ? (
          <WorktimeWorkspace key={`${tenantId}:${userId}:${actor.actorId}:${roleKey}:${employeeId}:${workDate}`}
            layout={layout} now={now} workDate={workDate} offline={offline} date={date}
            tenantId={tenantId} userId={userId} roleKey={roleKey} employeeId={employeeId} />
        ) : (
          <>
            <EmployeePortalAgendaHero layout={layout} artwork="time" kicker="MEIN ARBEITSTAG" title="Arbeitszeit" subtitle={date} />
            {loadingLink && !offline ? <ClientRecordLoading message="Mitarbeiterzugang wird geprüft…" /> : (
              <WorktimeNotice tone="error">{offline
                ? 'Verbinden Sie sich mit dem Internet, um die Arbeitszeit zu öffnen.'
                : !canView ? 'Die Arbeitszeit ist für Ihren Zugang nicht freigegeben.'
                : 'Ihr Zugang ist noch keinem Mitarbeiterprofil zugeordnet. Bitte wenden Sie sich an die Verwaltung.'}</WorktimeNotice>
            )}
          </>
        )}
      </ClientRecordViewport>
    </PortalTabScreen>
  );
}

function WorktimeWorkspace({ layout, now, workDate, date, offline, tenantId, userId, roleKey, employeeId }: {
  layout: Layout; now: number; workDate: string; date: string; offline: boolean;
  tenantId: string; userId: string; roleKey: RoleKey; employeeId: string | null;
}) {
  const router = useRouter();
  const { can } = usePermissions();
  const wfmOptions = useMemo(() => ({ employeeId, source: 'portal' as const }), [employeeId]);
  const [activity, setActivity] = useState<WfmWorkTypeKey | null>(null);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<WorktimeAction | null>(null);
  const [dialog, setDialog] = useState<'start' | 'checkin' | 'finish' | null>(null);
  const [consent, setConsent] = useState(false);
  const [feedback, setFeedback] = useState<{ action: WorktimeAction; message: string; error: boolean } | null>(null);
  const lock = useRef(false);

  const actorArgs = [tenantId, userId, roleKey] as const;
  const queryScope = `${tenantId}:${userId}:${roleKey}:${employeeId}:${workDate}`;
  const queryDeps = [tenantId, userId, roleKey, wfmOptions, workDate];
  const status = useAsyncQuery(() => getWfmTodayStatus(...actorArgs, wfmOptions), queryDeps,
    { queryKey: `employee-worktime:${queryScope}`, enabled: !offline, refreshOnAppFocus: false });
  const settings = useAsyncQuery(() => fetchPortalTimeTrackingSettings(tenantId, roleKey), queryDeps,
    { queryKey: `employee-worktime-settings:${queryScope}`, enabled: !offline });
  const account = useAsyncQuery(() => getWfmEmployeeTimeAccountOverview(...actorArgs, workDate, wfmOptions), queryDeps,
    { queryKey: `employee-worktime-account:${queryScope}`, enabled: !offline });
  const rules = useAsyncQuery(() => evaluateAndStoreArbzgForToday(...actorArgs, wfmOptions), queryDeps,
    { queryKey: `employee-worktime-rules:${queryScope}`, enabled: !offline && status.data != null });

  const snapshot = status.data;
  const session = snapshot?.session ?? null;
  const active = isWfmSessionActive(session);
  const paused = isWfmSessionPaused(session);
  const selected = currentActivity(snapshot);
  const nextActivity = activity ?? (active ? selected?.key : null) ?? 'buero';
  const nextActivityLabel = workTypes.find(item => item.key === nextActivity)?.label;
  const collapseActivities = layout.compact || layout.shortLandscape;
  const statusError = status.refreshError ?? status.error;
  const settingsError = settings.refreshError ?? settings.error;
  const stale = offline || Boolean(statusError);
  const totals = active && !stale && snapshot
    ? deriveWfmTimelineTotals(snapshot.events, { session, nowIso: new Date(now).toISOString() }) : null;
  const hasTotals = snapshot != null && (!active || snapshot.blockCount > 0);
  const actual = hasTotals ? totals?.netMinutes ?? session?.netMinutes ?? 0 : null;
  const pause = hasTotals ? totals?.pauseMinutes ?? session?.pauseMinutes ?? 0 : null;
  const canStart = can('time.tracking.own.start');
  const controlsReady = Boolean(snapshot) && !stale;
  const startEnabled = controlsReady && !active && canStart && settings.data?.moduleEnabled === true
    && !settings.refreshing && !settingsError;
  const allowed = {
    start: startEnabled,
    checkin: startEnabled && /^[A-Z0-9]{8}$/.test(code),
    pause: controlsReady && active && !paused && can('time.tracking.own.pause'),
    resume: controlsReady && paused && can('time.tracking.own.resume'),
    switch: controlsReady && active && !paused && nextActivity !== selected?.key && can('time.tracking.own.switch'),
    finish: controlsReady && active && can('time.tracking.own.close'),
  };
  const syncing = status.refreshing || settings.refreshing;
  const locked = busy != null || status.refreshing;
  const pickerEnabled = !locked && (active
    ? controlsReady && !paused && can('time.tracking.own.switch') : startEnabled);
  const stateLabel = !snapshot ? 'Status ausstehend' : stale ? 'Letzter Stand'
    : paused ? 'In Pause' : active ? 'Erfassung läuft' : session?.endedAt ? 'Block beendet' : 'Bereit zum Start';
  const startBlockReason = !active && controlsReady && (!canStart ? 'Ihr Zugang kann erfasste Zeiten einsehen.'
    : settingsError ?? (!settings.loading && settings.data && !settings.data.moduleEnabled
      ? 'Die Zeiterfassung ist derzeit deaktiviert. Die Verwaltung kann sie freigeben.' : null));

  const refreshAll = async () => {
    if (lock.current || syncing || offline) return;
    lock.current = true;
    try {
      void settings.refresh();
      void account.refresh();
      void rules.refresh();
      await status.refresh();
    } finally {
      lock.current = false;
    }
  };

  useLiveRefresh({
    enabled: !offline,
    onRefresh: () => { if (!status.loading) void refreshAll(); },
    pollMs: 0,
  });

  const runAction = async (action: WorktimeAction, confirmed = false) => {
    if (lock.current || locked || !allowed[action]) return;
    if (workDate !== workDateFromIso(new Date().toISOString())) {
      setFeedback({ action, error: true, message: 'Der Kalendertag hat gewechselt. Bitte laden Sie die Arbeitszeit neu.' });
      return;
    }
    if (!confirmed && (action === 'finish'
      || ((action === 'start' || action === 'checkin') && settings.data?.requirePrivacyConsent && !consent))) {
      setDialog(action);
      return;
    }
    lock.current = true;
    setBusy(action);
    setFeedback(null);
    try {
      const calls = {
        start: () => wfmClockIn(...actorArgs, nextActivity, wfmOptions),
        checkin: () => wfmOfficeCheckInByToken(...actorArgs, code, wfmOptions),
        pause: () => wfmPause(...actorArgs, wfmOptions),
        resume: () => wfmResume(...actorArgs, wfmOptions),
        switch: () => wfmSwitchWorkType(...actorArgs, nextActivity, wfmOptions),
        finish: () => wfmClockOut(...actorArgs, wfmOptions),
      };
      const result = await calls[action]();
      if (result.ok) {
        status.setData(result.data);
        setFeedback({ action, message: successfulAction[action], error: false });
        setActivity(null);
        setActivityExpanded(false);
        if (action === 'checkin') setCode('');
      } else {
        setFeedback({ action, message: result.error, error: true });
        await status.refresh();
      }
      void account.refresh();
      void rules.refresh();
    } catch {
      setFeedback({ action, error: true, message: 'Die Aktion konnte nicht bestätigt werden. Der aktuelle Stand wird neu geladen.' });
      await status.refresh();
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  const feedbackAt = (checkin: boolean) => feedback && (feedback.action === 'checkin') === checkin
    ? <WorktimeNotice tone={feedback.error ? 'error' : 'success'}>{feedback.message}</WorktimeNotice> : null;

  const clockPanel = (
    <ClientRecordPanel title="Stempeluhr" icon="timer-outline">
      <View style={styles.clockPlate}>
        <LinearGradient colors={['rgba(75,178,219,0.17)', 'rgba(10,24,39,0.18)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={styles.clockFace}>
          <Text style={styles.caption}>NETTOZEIT HEUTE</Text>
          <Text style={[styles.clockValue, layout.compact && styles.clockCompact]}>{formatClock(actual)}</Text>
          <Text style={styles.detail}>{active ? (selected?.label ?? 'Tätigkeit wird erfasst') : 'Stunden und Minuten'}</Text>
        </View>
        <View style={[styles.clockFacts, layout.compact && styles.clockFactsCompact]}>
          <View style={styles.clockFact}>
            <Text style={styles.factValue}>{formatClock(pause)}</Text>
            <Text style={styles.detail}>Pausenzeit</Text>
          </View>
          <View style={styles.clockFact}>
            <Text style={styles.factValue}>{snapshot?.blockCount ?? '—'}</Text>
            <Text style={styles.detail}>{layout.compact ? 'Blöcke' : snapshot?.blockCount === 1 ? 'Arbeitsblock' : 'Arbeitsblöcke'}</Text>
          </View>
        </View>
      </View>

      {active && !hasTotals ? <WorktimeNotice tone="error">Die Stempelungen reichen für die Berechnung der laufenden Nettozeit nicht aus.</WorktimeNotice> : null}
      {controlsReady && !paused ? (
        <>
          <Text accessibilityRole="header" aria-level={3} style={styles.subheading}>{active ? 'Tätigkeit wechseln' : 'Tätigkeit auswählen'}</Text>
          {collapseActivities ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Tätigkeit auswählen. ${nextActivityLabel}`}
              accessibilityState={{ expanded: activityExpanded, disabled: !pickerEnabled }} disabled={!pickerEnabled}
              onPress={() => setActivityExpanded(expanded => !expanded)}
              style={({ pressed, focused }: { pressed: boolean; focused?: boolean }) => [
                styles.activity, styles.activitySelect, !pickerEnabled && styles.dimmed,
                focused && agendaFocusRing, pressed && styles.pressed,
              ]}>
              <Text style={styles.activityLabel}>{nextActivityLabel}</Text>
              <Ionicons name={activityExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={c.accent} accessible={false} />
            </Pressable>
          ) : null}
          {!collapseActivities || activityExpanded ? <View style={styles.activities} accessibilityLabel="Tätigkeiten">
            {workTypes.map(item => {
              const chosen = item.key === nextActivity;
              return (
                <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={item.label}
                  accessibilityState={{ selected: chosen, disabled: !pickerEnabled }} disabled={!pickerEnabled}
                  onPress={() => { setActivity(item.key); setActivityExpanded(false); setFeedback(null); }}
                  style={({ pressed, focused, hovered }: { pressed: boolean; focused?: boolean; hovered?: boolean }) => [
                    styles.activity, layout.twoColumns && styles.activityWide, (chosen || (hovered && pickerEnabled)) && styles.activitySelected,
                    !pickerEnabled && !chosen && styles.dimmed, focused && agendaFocusRing, pressed && styles.pressed,
                  ]}>
                  <Ionicons name={activityIcons[item.key as ActivityKey]} size={16} color={chosen ? c.accent : c.muted} accessible={false} />
                  <Text style={styles.activityLabel}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View> : null}
        </>
      ) : null}
      {startBlockReason ? <WorktimeNotice tone={settingsError ? 'error' : 'info'}>{startBlockReason}</WorktimeNotice> : null}
      {controlsReady && !active && settings.loading ? <Text style={styles.detail}>Freigabe zur Zeiterfassung wird geprüft…</Text> : null}
      {paused && !stale ? <Text style={styles.detail}>Ihre Pause läuft. Zum Tätigkeitswechsel setzen Sie die Arbeit zuerst fort.</Text> : null}

      <View style={styles.actionRow}>
        {!active ? (
          <EmployeePortalAgendaAction label={session?.endedAt ? 'Weiteren Arbeitsblock starten' : 'Arbeitstag starten'} icon="play-outline" primary
            disabled={locked || !allowed.start} busy={busy === 'start'} onPress={() => void runAction('start')} />
        ) : (
          <>
            <EmployeePortalAgendaAction label={paused ? 'Arbeit fortsetzen' : 'Pause starten'} icon={paused ? 'play-outline' : 'pause-outline'} primary
              disabled={locked || !allowed[paused ? 'resume' : 'pause']} busy={busy === 'pause' || busy === 'resume'}
              onPress={() => void runAction(paused ? 'resume' : 'pause')} />
            {!paused ? (
              <EmployeePortalAgendaAction label="Wechsel speichern" icon="swap-horizontal-outline" disabled={locked || !allowed.switch}
                busy={busy === 'switch'} onPress={() => void runAction('switch')} />
            ) : null}
            <EmployeePortalAgendaAction label="Arbeitsblock beenden" icon="stop-outline" disabled={locked || !allowed.finish}
              busy={busy === 'finish'} onPress={() => void runAction('finish')} />
          </>
        )}
      </View>
      {feedbackAt(false)}
    </ClientRecordPanel>
  );
  const historyPanel = snapshot ? <WorktimeHistory events={snapshot.events} stale={stale} /> : null;
  const accountPanel = (
    <WorktimeAccount data={account.data} todayActual={actual} todayPause={pause} monthLabel={monthDate.format(new Date(now))}
      error={account.refreshError ?? account.error} loading={account.loading} refreshing={account.refreshing}
      refresh={offline ? undefined : () => void account.refresh()} />
  );
  const checkinPanel = canStart ? (
    <ClientRecordPanel title="Büro-Check-in" icon="location-outline">
      <Text style={styles.detail}>{active
        ? 'Ein Arbeitsblock läuft bereits. Pause und Ende steuern Sie über die Stempeluhr.'
        : 'Mit dem achtstelligen Code vom Empfang starten Sie einen Arbeitsblock im Büro.'}</Text>
      {!active && startEnabled ? (
        <View style={styles.checkinForm}>
          <TextInput accessibilityLabel="Achtstelliger Check-in-Code" style={styles.codeInput} placeholder="8-stelliger Code"
            placeholderTextColor={c.muted} value={code} autoCapitalize="characters" autoComplete="off" autoCorrect={false} maxLength={20}
            editable={!locked} returnKeyType="go" onSubmitEditing={() => void runAction('checkin')}
            onChangeText={value => setCode(value.replace(/\s/g, '').toUpperCase())} />
          <EmployeePortalAgendaAction label="Einchecken" icon="enter-outline" disabled={locked || !allowed.checkin}
            busy={busy === 'checkin'} onPress={() => void runAction('checkin')} />
        </View>
      ) : null}
      {feedbackAt(true)}
    </ClientRecordPanel>
  ) : null;
  const rulesPanel = snapshot ? <WorktimeRules data={rules.data} error={rules.refreshError ?? rules.error}
    loading={rules.loading} refreshing={rules.refreshing} refresh={offline ? undefined : () => void rules.refresh()} /> : null;

  return (
    <>
      <EmployeePortalAgendaHero layout={layout} artwork="time" kicker="MEIN ARBEITSTAG" title="Arbeitszeit" subtitle={date} condensed={layout.shortLandscape}>
        <View style={styles.heroTools}>
          <EmployeePortalAgendaStatus label={stateLabel} tone={paused && !stale ? 'orange' : active && !stale ? 'green' : 'muted'} />
          <EmployeePortalAgendaAction label={syncing ? 'Wird aktualisiert…' : 'Aktualisieren'} icon="refresh-outline"
            onPress={() => void refreshAll()} disabled={offline || busy != null} busy={syncing} />
        </View>
      </EmployeePortalAgendaHero>

      {offline ? <WorktimeNotice>Offline. Neue Stempelungen sind möglich, sobald die Verbindung wieder da ist.</WorktimeNotice> : null}
      {statusError ? <WorktimeNotice tone="error">{snapshot ? `Stempeluhr nicht aktuell. ${statusError}` : statusError}</WorktimeNotice> : null}
      {!snapshot && status.loading ? <ClientRecordLoading message="Stempeluhr wird geladen…" /> : null}

      {layout.twoColumns ? (
        <View style={styles.boardWide}>
          <View style={[styles.column, styles.mainColumn]}>{clockPanel}{historyPanel}</View>
          <View style={[styles.column, styles.sideColumn]}>{accountPanel}{checkinPanel}{rulesPanel}</View>
        </View>
      ) : (
        <View style={styles.column}>{clockPanel}{checkinPanel}{accountPanel}{historyPanel}{rulesPanel}</View>
      )}

      <WorktimeShortcuts wide={layout.readableWidth >= 780} canViewAbsences={can('portal.employee.absences.view')} navigate={route => router.push(route)} />

      {dialog ? (
        <Modal transparent visible animationType="fade" onRequestClose={() => setDialog(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modal} accessibilityViewIsModal>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalContents}>
                <Text accessibilityRole="header" style={styles.subheading}>{dialog === 'finish' ? 'Arbeitsblock beenden?' : 'Hinweis zur Zeiterfassung'}</Text>
                <Text style={styles.detail}>{dialog === 'finish'
                  ? 'Die erfassten Zeiten und Pausen werden gespeichert. Sie können später einen weiteren Arbeitsblock starten.'
                  : 'CareSuite speichert die Zeitstempel und die gewählte Tätigkeit, damit Sie und Ihre Verwaltung die Arbeitszeit nachvollziehen können.'}</Text>
                <View style={styles.actionRow}>
                  <EmployeePortalAgendaAction label="Abbrechen" icon="close-outline" onPress={() => setDialog(null)} />
                  <EmployeePortalAgendaAction label={dialog === 'finish' ? 'Arbeitsblock beenden'
                    : dialog === 'checkin' ? 'Verstanden und einchecken' : 'Verstanden und starten'}
                    primary icon="checkmark-outline" disabled={locked || !allowed[dialog]} onPress={() => {
                      setDialog(null);
                      if (dialog !== 'finish') setConsent(true);
                      void runAction(dialog, true);
                    }} />
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create(withCareSuiteTypography({
  heroTools: { minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9 },
  boardWide: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  column: { minWidth: 0, gap: 14 },
  mainColumn: { flex: 1.6 },
  sideColumn: { flex: 1 },
  clockPlate: { minWidth: 0, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 16, padding: 14,
    backgroundColor: c.control, borderWidth: 1, borderColor: c.line, borderRadius: 15, overflow: 'hidden' },
  clockFace: { flexGrow: 1, flexBasis: 155, minWidth: 0, gap: 2 },
  caption: { color: c.accent, fontWeight: '700', letterSpacing: 1.1, fontSize: font(11), lineHeight: font(17), ...clientRecordTextWrap },
  clockValue: { color: c.text, fontSize: font(51), lineHeight: font(61), fontWeight: '700', fontVariant: ['tabular-nums'], ...clientRecordTextWrap },
  clockCompact: { fontSize: font(36), lineHeight: font(44) },
  clockFacts: { minWidth: 0, maxWidth: '100%', flexBasis: 170, flexDirection: 'row', flexGrow: 1, flexWrap: 'wrap', gap: 9 },
  clockFactsCompact: { flexBasis: '100%' },
  clockFact: { flexGrow: 1, flexBasis: 66, minWidth: 0, paddingHorizontal: 7, paddingVertical: 7,
    backgroundColor: c.control, borderRadius: 10, borderWidth: 1, borderColor: c.line },
  factValue: { color: c.accent, fontWeight: '700', fontSize: font(17), lineHeight: font(23), fontVariant: ['tabular-nums'], ...clientRecordTextWrap },
  detail: { color: c.muted, fontSize: font(13), lineHeight: font(19), ...clientRecordTextWrap },
  subheading: { color: c.text, fontWeight: '700', fontSize: font(15), lineHeight: font(21), ...clientRecordTextWrap },
  activities: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  activity: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 9, paddingVertical: 6,
    gap: 6, backgroundColor: c.control, borderWidth: 1, borderColor: c.line, borderRadius: 10 },
  activityWide: { flexBasis: '22%', flexGrow: 1 },
  activitySelect: { justifyContent: 'space-between', paddingHorizontal: 12 },
  activitySelected: { backgroundColor: c.selected, borderColor: c.accent },
  activityLabel: { color: c.text, fontWeight: '700', flexShrink: 1, fontSize: font(12), lineHeight: font(18), ...clientRecordTextWrap },
  dimmed: { opacity: 0.58 },
  pressed: { opacity: 0.8 },
  actionRow: { minWidth: 0, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  checkinForm: { minWidth: 0, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  codeInput: { flexGrow: 1, flexBasis: 145, minWidth: 0, minHeight: 44, paddingHorizontal: 10, color: c.text,
    backgroundColor: c.control, borderRadius: 11, borderColor: c.line, borderWidth: 1, fontSize: font(14), letterSpacing: 1 },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 14, backgroundColor: 'rgba(5,17,31,0.82)' },
  modal: { width: '100%', maxWidth: 420, maxHeight: '96%', borderRadius: 18, borderWidth: 1, borderColor: c.line, backgroundColor: c.dialog },
  modalContents: { padding: 16, gap: 14 },
}));
