import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import type { WfmRuleEvaluationResult } from '@/lib/wfm/wfmRuleEngine';
import type { WfmEmployeeTimeAccountOverview } from '@/lib/wfm/wfmTimeAccountService';
import type { WfmEventType, WfmTimeEvent } from '@/types/modules/wfm';
import { EmployeePortalAgendaAction, agendaFocusRing } from './EmployeePortalAgendaAction';
import { EmployeePortalAgendaStatus } from './EmployeePortalAgendaCard';
import { EmployeePortalArtwork } from './EmployeePortalArtwork';
import { ClientRecordLoading, ClientRecordPanel, clientRecordTextWrap } from './EmployeePortalClientRecordLayout';
import { employeePortalDesign as c } from './employeePortalDesign';

const eventLabels: Record<WfmEventType, string> = {
  clock_in: 'Arbeitsbeginn', clock_out: 'Arbeitsblock beendet',
  pause_start: 'Pause begonnen', pause_end: 'Arbeit fortgesetzt',
  homeoffice_start: 'Home Office', homeoffice_end: 'Home Office beendet',
  office_check_in: 'Büro', office_check_out: 'Büro-Check-out',
  visit_drive_start: 'Anfahrt begonnen', visit_arrived: 'Am Einsatzort angekommen',
  visit_started: 'Einsatz', visit_ended: 'Einsatz beendet', visit_paused: 'Einsatz pausiert',
  mode_switch: 'Tätigkeit gewechselt', correction: 'Zeit korrigiert', manual_booking: 'Zeit nachgetragen',
  standby_start: 'Bereitschaft', standby_end: 'Bereitschaft beendet',
  training_start: 'Fortbildung', training_end: 'Fortbildung beendet',
  meeting_start: 'Besprechung', meeting_end: 'Besprechung beendet',
  travel_start: 'Fahrt', travel_end: 'Fahrt beendet',
};

const berlinTime = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit',
});

function duration(minutes: number | null) {
  if (minutes == null) return '—';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours} Std.${rest ? ` ${rest} Min.` : ''}` : `${rest} Min.`;
}

export function WorktimeNotice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'success' | 'error' }) {
  const ink = tone === 'error' ? c.danger : tone === 'success' ? '#C1F3DE' : c.muted;
  return (
    <View style={[styles.notice, tone === 'error' && styles.noticeError]} accessibilityLiveRegion="polite">
      <Ionicons name={tone === 'error' ? 'alert-circle-outline' : tone === 'success' ? 'checkmark-circle-outline' : 'information-circle-outline'}
        size={18} color={ink} accessible={false} />
      <Text style={[styles.noticeCopy, { color: ink }]}>{children}</Text>
    </View>
  );
}

function AccountMetric({ label, minutes, accent = false }: { label: string; minutes: number | null; accent?: boolean }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.caption}>{label}</Text>
      <Text style={[styles.value, accent && styles.valueAccent]} accessibilityLabel={minutes == null ? 'Nicht verfügbar' : undefined}>
        {duration(minutes)}
      </Text>
    </View>
  );
}

export function WorktimeAccount({ data, todayActual, todayPause, monthLabel, error, loading, refreshing, refresh }: {
  data: WfmEmployeeTimeAccountOverview | null; todayActual: number | null; todayPause: number | null;
  monthLabel: string; error: string | null; loading: boolean; refreshing: boolean; refresh?: () => void;
}) {
  const monthActual = !data ? null : data.closedMonth ? data.monthActualMinutes
    : todayActual == null ? null : data.monthActualMinutes + todayActual;
  const monthPause = !data ? null : data.closedMonth ? data.monthPauseMinutes
    : todayPause == null ? null : data.monthPauseMinutes + todayPause;
  const monthTarget = data?.monthTargetMinutes ?? null;
  const todayTarget = data?.todayTargetMinutes ?? null;
  const balance = data?.monthBalanceMinutes ?? null;
  const missingSchedule = data && (todayTarget == null || monthTarget == null);
  const progress = monthActual != null && monthTarget != null && monthTarget > 0
    ? Math.min(1, monthActual / monthTarget) : null;
  const accountError = error ?? data?.scheduleError;

  return (
    <ClientRecordPanel title="Zeitkonto" icon="stats-chart-outline">
      <View style={styles.accountGroup}>
        <Text style={styles.groupTitle}>Heute</Text>
        <View style={styles.metrics}>
          <AccountMetric label="Ist" minutes={todayActual} accent />
          <AccountMetric label="Soll" minutes={todayTarget} />
          <AccountMetric label="Pause" minutes={todayPause} />
        </View>
      </View>
      <View style={styles.accountGroup}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.groupTitle}>{monthLabel}</Text>
          {data?.closedMonth ? <EmployeePortalAgendaStatus label="Abgeschlossen" tone="muted" /> : null}
        </View>
        {loading && !data ? <ClientRecordLoading message="Monatszeiten werden geladen…" /> : (
          <>
            <View style={styles.metrics}>
              <AccountMetric label="Ist" minutes={monthActual} accent />
              <AccountMetric label="Monatssoll" minutes={monthTarget} />
              <AccountMetric label="Pause" minutes={monthPause} />
              {balance != null && Number.isFinite(balance) ? (
                <View style={styles.metric}>
                  <Text style={styles.caption}>Saldo</Text>
                  <Text style={styles.value}>{balance > 0 ? '+' : balance < 0 ? '−' : ''}{duration(Math.abs(balance))}</Text>
                </View>
              ) : null}
            </View>
            {progress != null ? (
              <View style={styles.progress} accessibilityRole="progressbar" accessibilityLabel="Anteil am Monatssoll"
                accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              </View>
            ) : null}
          </>
        )}
      </View>
      {data?.priorOpenBlocks ? <WorktimeNotice>Frühere offene Arbeitsblöcke fließen nach Abschluss in die Monatssumme ein.</WorktimeNotice> : null}
      {accountError ? (
        <>
          <WorktimeNotice tone="error">{error && data ? `Stand der letzten Abfrage. ${error}` : accountError}</WorktimeNotice>
          {refresh ? <EmployeePortalAgendaAction label="Zeitkonto neu laden" icon="refresh-outline" busy={refreshing} onPress={refresh} /> : null}
        </>
      ) : missingSchedule ? (
        <WorktimeNotice>{monthTarget == null
          ? 'Die Sollzeit ist hier nicht verfügbar. Für die Prüfung der vertraglichen Stunden wenden Sie sich an die Verwaltung.'
          : 'Die tägliche Sollzeit ist hier nicht verfügbar. Das Monatssoll wird separat angezeigt.'}</WorktimeNotice>
      ) : null}
    </ClientRecordPanel>
  );
}

export function WorktimeHistory({ events, stale }: { events: WfmTimeEvent[]; stale: boolean }) {
  const latest = [...events].reverse();
  return (
    <ClientRecordPanel title="Tagesverlauf" icon="list-outline">
      {stale ? <Text style={styles.caption}>Zuletzt geladene Stempelungen</Text> : null}
      {latest.length ? latest.map((event, index) => {
        const paused = event.eventType === 'pause_start' || event.eventType === 'pause_end';
        const label = event.eventType === 'office_check_in' && event.note?.startsWith('Büro-Check-in:')
          ? 'Büro-Check-in' : eventLabels[event.eventType] ?? 'Zeitereignis';
        return (
          <View key={event.id} style={styles.event}>
            <View style={styles.eventMarker}>
              {index < latest.length - 1 ? <View style={styles.eventLine} /> : null}
              <Ionicons name={paused ? 'pause-circle-outline' : 'ellipse'} size={paused ? 19 : 10}
                color={paused ? c.warning : c.accent} accessible={false} />
            </View>
            <View style={styles.eventBody}>
              <Text style={styles.eventLabel}>{label}</Text>
              <Text style={styles.eventTime}>{berlinTime.format(new Date(event.occurredAt))} Uhr</Text>
            </View>
          </View>
        );
      }) : (
        <View style={styles.empty}>
          <Ionicons name="timer-outline" size={25} color={c.accent} accessible={false} />
          <Text style={styles.groupTitle}>Noch keine Stempelungen</Text>
          <Text style={styles.caption}>Sobald Sie Ihre Arbeit starten, erscheint hier der erste Eintrag.</Text>
        </View>
      )}
    </ClientRecordPanel>
  );
}

export function WorktimeRules({ data, error, loading, refreshing, refresh }: {
  data: WfmRuleEvaluationResult | null; error: string | null; loading: boolean; refreshing: boolean; refresh?: () => void;
}) {
  return (
    <ClientRecordPanel title="Arbeitszeithinweise" icon="shield-checkmark-outline">
      {loading && !data ? <ClientRecordLoading message="Hinweise werden geladen…" />
        : error ? (
          <>
            <WorktimeNotice tone="error">{error}</WorktimeNotice>
            {refresh ? <EmployeePortalAgendaAction label="Hinweise neu laden" icon="refresh-outline" busy={refreshing} onPress={refresh} /> : null}
          </>
        ) : data?.violations.length ? data.violations.map(violation => (
          <WorktimeNotice key={violation.ruleKey} tone={violation.severity === 'violation' ? 'error' : 'info'}>
            {violation.message}
          </WorktimeNotice>
        )) : data ? <Text style={styles.caption}>Für heute liegen keine automatischen Hinweise vor.</Text> : null}
    </ClientRecordPanel>
  );
}

const shortcuts = [
  { id: 'logbook', title: 'Fahrten & Zeiten', detail: 'Einsatzzeiten und Strecken', route: '/portal/employee/times' },
  { id: 'leave', title: 'Urlaub', detail: 'Anträge und Übersicht', route: '/portal/employee/arbeitszeit/urlaub' },
  { id: 'absence', title: 'Abwesenheiten', detail: 'Meldungen und Status', route: '/portal/employee/arbeitszeit/abwesenheiten' },
] as const;

export function WorktimeShortcuts({ wide, canViewAbsences, navigate }: {
  wide: boolean; canViewAbsences: boolean; navigate: (route: typeof shortcuts[number]['route']) => void;
}) {
  return (
    <ClientRecordPanel title="Weitere Bereiche" icon="grid-outline">
      <View style={[styles.shortcuts, wide && styles.shortcutsWide]}>
        {shortcuts.filter(item => item.id === 'logbook' || canViewAbsences).map(item => (
          <Pressable key={item.id} accessibilityRole="link" accessibilityLabel={item.title} onPress={() => navigate(item.route)}
            style={({ pressed, focused, hovered }: { pressed: boolean; focused?: boolean; hovered?: boolean }) => [
              styles.shortcut, wide && styles.shortcutWide, hovered && styles.shortcutHover,
              focused && agendaFocusRing, pressed && styles.pressed,
            ]}>
            <EmployeePortalArtwork id={item.id} label="" size={43} />
            <View style={styles.shortcutCopy}>
              <Text style={styles.eventLabel}>{item.title}</Text>
              <Text style={styles.caption}>{item.detail}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.accent} accessible={false} />
          </Pressable>
        ))}
      </View>
    </ClientRecordPanel>
  );
}

const styles = StyleSheet.create(withCareSuiteTypography({
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 11, backgroundColor: c.control,
    borderRadius: 11, borderWidth: 1, borderColor: c.line, minWidth: 0 },
  noticeError: { borderColor: 'rgba(255,189,203,0.44)', backgroundColor: 'rgba(108,36,60,0.24)' },
  noticeCopy: { flex: 1, minWidth: 0, fontSize: font(13), lineHeight: font(19), ...clientRecordTextWrap },
  accountGroup: { minWidth: 0, backgroundColor: c.control, borderWidth: 1, borderColor: c.line,
    borderRadius: 13, padding: 12, gap: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  groupTitle: { color: c.text, fontSize: font(15), lineHeight: font(21), fontWeight: '700' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { flexGrow: 1, flexBasis: 70, minWidth: 0, gap: 2 },
  caption: { color: c.muted, fontSize: font(12), lineHeight: font(18), ...clientRecordTextWrap },
  value: { color: c.text, fontVariant: ['tabular-nums'], fontSize: font(15), lineHeight: font(22), fontWeight: '700', ...clientRecordTextWrap },
  valueAccent: { color: c.accent },
  progress: { height: 4, borderRadius: 3, overflow: 'hidden', backgroundColor: c.line },
  progressFill: { backgroundColor: c.accent, height: '100%', borderRadius: 3 },
  empty: { alignItems: 'flex-start', padding: 14, gap: 6, backgroundColor: c.control, borderRadius: 12 },
  event: { minWidth: 0, minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventMarker: { width: 22, alignSelf: 'stretch', alignItems: 'center', paddingTop: 12 },
  eventLine: { position: 'absolute', width: 1, top: 26, bottom: -18, backgroundColor: c.line },
  eventBody: { minWidth: 0, flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
    justifyContent: 'space-between', columnGap: 12, rowGap: 2, paddingVertical: 5 },
  eventLabel: { color: c.text, fontSize: font(14), lineHeight: font(20), fontWeight: '700', flexShrink: 1, ...clientRecordTextWrap },
  eventTime: { color: c.accent, fontVariant: ['tabular-nums'], fontSize: font(13), lineHeight: font(19) },
  shortcuts: { gap: 8 },
  shortcutsWide: { flexDirection: 'row', flexWrap: 'wrap' },
  shortcut: { minHeight: 58, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8,
    backgroundColor: c.control, borderRadius: 12, borderWidth: 1, borderColor: c.line },
  shortcutWide: { flex: 1 },
  shortcutCopy: { flex: 1, minWidth: 0 },
  shortcutHover: { backgroundColor: c.selected, borderColor: c.accent },
  pressed: { opacity: 0.8 },
}));
