import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { EmployeeDeferredTimeCard } from '@/components/portal/EmployeeDeferredTimeCard';
import { EmployeePortalAgendaAction } from '@/components/portal/employee/EmployeePortalAgendaAction';
import { EmployeePortalAgendaCard, EmployeePortalAgendaStatus } from '@/components/portal/employee/EmployeePortalAgendaCard';
import {
  EmployeePortalAgendaBoard,
  EmployeePortalAgendaHero,
  EmployeePortalAgendaSection,
  EmployeePortalAgendaToolbar,
  useEmployeePortalAgendaLayout,
} from '@/components/portal/employee/EmployeePortalAgendaLayout';
import { employeePortalDesign as c } from '@/components/portal/employee/employeePortalDesign';
import { resolveHealthOSStatusDisplay } from '@/components/healthos/status/healthosStatusMapping';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { useAsyncQuery } from '@/hooks/core';
import { usePortalActor } from '@/hooks/usePortalActor';
import { usePortalAppointments } from '@/hooks/usePortalAppointments';
import { employeePortalAssignmentSchedule } from '@/lib/portal/employee/employeePortalAssignmentDisplay';
import type { EmployeeDeferredTime } from '@/lib/portal/employeeDeferredTimeModel';
import { loadEmployeeDeferredTimes } from '@/lib/portal/employeeDeferredTimeService';
import { selectEmployeeOpenAssignments } from '@/lib/portal/employeePortalOpenAssignments';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';

const NO_DEFERRED_TIMES: EmployeeDeferredTime[] = [];
const filters = [
  { key: 'all', label: 'Alle' },
  { key: 'action', label: 'Nacharbeit', compactLabel: 'Zu tun' },
  { key: 'office', label: 'Verwaltung', compactLabel: 'Büro' },
] as const;

export function EmployeeOpenAssignmentsScreen() {
  const router = useRouter();
  const layout = useEmployeePortalAgendaLayout();
  const [filter, setFilter] = useState<(typeof filters)[number]['key']>('all');
  const [feedback, setFeedback] = useState<{ scope: string; message: string } | null>(null);
  const narrowSummary = layout.readableWidth < 260;
  const { employeeId, tenantId, roleKey } = usePortalActor();
  const { items, loading, error, refreshError, refresh, refreshing, fromCache, isLinkedReady } = usePortalAppointments('employee');
  const open = useMemo(() => selectEmployeeOpenAssignments(items, employeeId ?? ''), [items, employeeId]);
  const scope = JSON.stringify(['deferred-times', tenantId, employeeId, roleKey]);
  const deferred = useAsyncQuery(() => loadEmployeeDeferredTimes(tenantId ?? '', employeeId ?? '', roleKey),
    [tenantId, employeeId, roleKey], { enabled: Boolean(isLinkedReady && tenantId && employeeId && roleKey === 'employee_portal'), queryKey: scope });
  const deferredItems = deferred.data ?? NO_DEFERRED_TIMES;
  const { visitsByTask, visibleOpen } = useMemo(() => {
    const byId = new Map(open.map(item => [item.id, item]));
    const visitsByTask = new Map<string, (typeof open)[number]>(), linked = new Set<string>();
    for (const task of deferredItems) {
      const item = [task.visitRouteId, task.entry?.assignmentId, task.entry?.visitId].flatMap(id => id && byId.has(id) ? [byId.get(id)!] : [])[0];
      if (item) { visitsByTask.set(task.id, item); linked.add(item.id); }
    }
    return { visitsByTask, visibleOpen: open.filter(item => !linked.has(item.id)) };
  }, [open, deferredItems]);
  const refreshAll = async () => { await Promise.all([refresh(), deferred.refreshWithResult()]); };
  const openVisit = (id: string) => router.push(`/portal/employee/assignments/${id}${fromCache ? '' : '/execute'}` as never);
  // Also remove a just-completed visit after returning from execution.
  const refreshRef = useRef(refreshAll);
  refreshRef.current = refreshAll;
  useFocusEffect(useCallback(() => { void refreshRef.current(); }, []));

  const corrections = deferredItems.filter(task => task.state === 'correction_needed');
  const office = deferredItems.filter(task => task.state !== 'correction_needed');
  const counts = { all: visibleOpen.length + deferredItems.length, action: visibleOpen.length + corrections.length, office: office.length };
  const countsReady = isLinkedReady && !loading && !error && !deferred.loading && !deferred.error;
  const isRefreshing = refreshing || deferred.refreshing;
  const visitError = error ?? refreshError;
  const timeError = deferred.error ?? deferred.refreshError;
  const showEmpty = countsReady && !visitError && !timeError && counts[filter] === 0;

  const renderTime = (task: EmployeeDeferredTime) => {
    const visit = visitsByTask.get(task.id);
    return <EmployeeDeferredTimeCard key={`${scope}:${task.id}`} task={task} compact={layout.compact}
      onSaved={deferred.refreshWithResult} onSubmitted={message => setFeedback({ scope, message })}
      onOpenVisit={visit ? () => openVisit(visit.id) : undefined} />;
  };

  return (
    <PortalTabScreen title="Offene Einsätze" scroll={false}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled" nestedScrollEnabled testID="employee-open-assignments-scroll"
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refreshAll} />}>
        <EmployeePortalAgendaBoard layout={layout}>
          <EmployeePortalAgendaHero layout={layout} artwork="open-assignments" kicker="Nachbearbeitung" title="Offene Einsätze"
            subtitle="Nacharbeiten und zurückgestellte Arbeitszeiten" testID="employee-open-assignments-hero">
            {countsReady ? (
              <View style={styles.summary}>
                <View style={[styles.metric, narrowSummary && styles.metricNarrow]}>
                  <Text style={styles.metricCount}>{visibleOpen.length}</Text>
                  <Text style={styles.metricLabel}>Weitere offene Einsätze</Text>
                </View>
                <View style={[styles.metric, narrowSummary && styles.metricNarrow]}>
                  <Text style={styles.metricCount}>{deferredItems.length}</Text>
                  <Text style={styles.metricLabel}>Zurückgestellte Zeiten</Text>
                </View>
              </View>
            ) : null}
          </EmployeePortalAgendaHero>

          <EmployeePortalAgendaToolbar layout={layout} active={filter} onSelect={setFilter}
            filters={filters.map(option => ({ ...option, count: countsReady ? counts[option.key] : null }))}
            refresh={refreshAll} refreshing={isRefreshing} unit={['Eintrag', 'Einträge']} />

          {feedback?.scope === scope ? (
            <InfoBanner variant="success" presentation="inline" onDarkSurface message={feedback.message}
              dismissible onDismiss={() => setFeedback(null)} />
          ) : null}
          {fromCache ? (
            <InfoBanner variant="info" presentation="inline" onDarkSurface title="Zwischengespeicherte Einsätze"
              message="Zum Speichern von Änderungen an Einsätzen bitte eine Verbindung herstellen." />
          ) : null}
          {loading || deferred.loading ? (
            <View style={styles.notice} accessibilityRole="progressbar" accessibilityLabel="Einträge werden geladen">
              <ActivityIndicator color={c.accent} />
              <Text style={styles.copy}>Einträge werden geladen…</Text>
            </View>
          ) : null}
          {visitError ? (
            <InfoBanner variant="error" presentation="inline" onDarkSurface title="Einsätze konnten nicht geladen werden"
              message={visitError} actionLabel="Erneut versuchen" onAction={refresh} />
          ) : null}
          {timeError ? (
            <InfoBanner variant="error" presentation="inline" onDarkSurface title="Zurückgestellte Zeiten konnten nicht geladen werden"
              message={timeError} actionLabel="Erneut versuchen" onAction={deferred.refresh} />
          ) : null}
          {!loading && !error && !isLinkedReady ? (
            <InfoBanner variant="info" presentation="inline" onDarkSurface
              message="Ihr Mitarbeitendenkonto wird noch zugeordnet. Bitte erneut laden." />
          ) : null}

          {filter !== 'office' && corrections.length ? (
            <EmployeePortalAgendaSection layout={layout} icon="create-outline" title="Zeiten zur Korrektur"
              count={corrections.length} warning subtitle="Die Verwaltung prüft eingereichte Korrekturen.">
              {corrections.map(renderTime)}
            </EmployeePortalAgendaSection>
          ) : null}

          {filter !== 'office' && visibleOpen.length ? (
            <EmployeePortalAgendaSection layout={layout} icon="briefcase-outline" title="Weitere offene Einsätze"
              count={visibleOpen.length} subtitle="Ergänzen Sie bei Bedarf Zeiten, Kilometer, Dokumentation oder Unterschrift.">
              {visibleOpen.map(item => {
                const schedule = employeePortalAssignmentSchedule(item);
                const status = item.assignmentStatus ? resolveHealthOSStatusDisplay('assignment', item.assignmentStatus) : null;
                return (
                  <EmployeePortalAgendaCard key={item.id} testID={`open-assignment-${item.id}`}
                    date={schedule} title={item.clientName ?? item.title} compact={layout.compact}
                    status={<EmployeePortalAgendaStatus label={status?.label ?? 'Offen'} tone={status?.tone} />}
                    actions={<EmployeePortalAgendaAction label={fromCache ? 'Einsatz ansehen' : 'Einsatz bearbeiten'}
                      icon={fromCache ? 'eye-outline' : 'arrow-forward-outline'} primary={!fromCache} onPress={() => openVisit(item.id)} />}>
                    <Text style={styles.visitTime}>{schedule.time}</Text>
                    {schedule.endDay ? <Text style={styles.copy}>Ende am {schedule.endDay}</Text> : null}
                  </EmployeePortalAgendaCard>
                );
              })}
            </EmployeePortalAgendaSection>
          ) : null}

          {filter !== 'action' && office.length ? (
            <EmployeePortalAgendaSection layout={layout} icon="time-outline" title="Bei der Verwaltung"
              count={office.length} muted subtitle="Diese Zeiten warten auf Freigabe oder Klärung.">
              {office.map(renderTime)}
            </EmployeePortalAgendaSection>
          ) : null}

          {showEmpty ? (
            <View style={styles.notice}>
              <Ionicons name="checkmark-circle-outline" size={25} color={c.accent} accessible={false} />
              <Text accessibilityRole="header" aria-level={2} style={styles.emptyTitle}>
                {filter === 'all' ? 'Alles erledigt' : filter === 'action' ? 'Aktuell nichts nachzuarbeiten' : 'Keine Zeiten bei der Verwaltung'}
              </Text>
              {filter === 'all'
                ? <Text style={styles.copy}>Sie haben keine offenen Einsätze oder zurückgestellten Zeiten.</Text>
                : <EmployeePortalAgendaAction label="Alle Einträge anzeigen" icon="list-outline" onPress={() => setFilter('all')} />}
            </View>
          ) : null}
        </EmployeePortalAgendaBoard>
      </ScrollView>
    </PortalTabScreen>
  );
}

const styles = StyleSheet.create(withCareSuiteTypography({
  root: {
    flex: 1, minHeight: 0, width: '100%',
    ...(Platform.OS === 'web' ? ({
      overflowY: 'auto', overflowX: 'hidden', touchAction: 'pan-y',
      overscrollBehaviorY: 'contain', scrollbarWidth: 'thin', scrollbarColor: 'rgba(188,238,255,0.38) transparent',
    } as never) : {}),
  },
  content: { paddingBottom: 28 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, maxWidth: 550 },
  metric: {
    flexGrow: 1, flexShrink: 1, flexBasis: 128, minWidth: 0, paddingHorizontal: 12, paddingVertical: 8, gap: 2,
    borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.control,
  },
  metricNarrow: { flexBasis: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  metricCount: { color: c.accent, fontSize: font(21), lineHeight: font(27), fontWeight: '800', fontVariant: ['tabular-nums'] },
  metricLabel: { flexShrink: 1, color: c.muted, fontSize: font(12), lineHeight: font(17), fontWeight: '700' },
  notice: { gap: 10, alignItems: 'flex-start', padding: 16, borderRadius: 17, borderWidth: 1, borderColor: c.line, backgroundColor: c.panel },
  copy: { color: c.muted, fontSize: font(13), lineHeight: font(19) },
  emptyTitle: { color: c.text, fontSize: font(18), lineHeight: font(24), fontWeight: '800' },
  visitTime: { color: c.text, fontSize: font(15), lineHeight: font(20), fontWeight: '800', fontVariant: ['tabular-nums'] },
}));
