import { useCallback, useMemo, useRef } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { usePortalAppointments } from '@/hooks/usePortalAppointments';
import { usePortalActor } from '@/hooks/usePortalActor';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { selectEmployeeOpenAssignments } from '@/lib/portal/employeePortalOpenAssignments';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';
import { useAsyncQuery } from '@/hooks/core';
import { loadEmployeeDeferredTimes } from '@/lib/portal/employeeDeferredTimeService';
import { EmployeePortalFacts } from '@/components/portal/employee/EmployeePortalPageHeader';
import { employeePortalWorkspace as c } from '@/components/portal/employee/employeePortalDesign';
import { EmployeeDeferredTimeCard } from '@/components/portal/EmployeeDeferredTimeCard';
import type { EmployeeDeferredTime } from '@/lib/portal/employeeDeferredTimeModel';

const NO_DEFERRED_TIMES: EmployeeDeferredTime[] = [];

export function EmployeeOpenAssignmentsScreen() {
  const router = useRouter();
  const { employeeId, tenantId, roleKey } = usePortalActor();
  const { items, loading, error, refreshError, refresh, refreshing, fromCache, isLinkedReady } = usePortalAppointments('employee');
  const open = useMemo(() => selectEmployeeOpenAssignments(items, employeeId ?? ''), [items, employeeId]);
  const deferred = useAsyncQuery(() => loadEmployeeDeferredTimes(tenantId ?? '', employeeId ?? '', roleKey),
    [tenantId, employeeId, roleKey], { enabled: Boolean(isLinkedReady && tenantId && employeeId && roleKey === 'employee_portal'), queryKey: JSON.stringify(['deferred-times', tenantId, employeeId, roleKey]) });
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
  return (
    <PortalTabScreen title="Offene Einsätze" subtitle="Nacharbeiten und zurückgestellte Arbeitszeiten" scroll={false}
      actionsSlot={<PremiumButton title="Aktualisieren" variant="secondary" size="sm" disabled={refreshing || deferred.refreshing} onPress={() => void refreshAll()} />}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator
        refreshControl={<RefreshControl refreshing={refreshing || deferred.refreshing} onRefresh={refreshAll} />}>
        {isLinkedReady && !loading && !error && !deferred.loading && !deferred.error ? <EmployeePortalFacts items={[
          { id: 'visits', label: 'Weitere offene Einsätze', value: visibleOpen.length },
          { id: 'times', label: 'Zurückgestellte Zeiten', value: deferredItems.length },
        ]} /> : null}
        <Text style={styles.hint}>Öffnen Sie den Einsatz, um Zeiten, Kilometer, Dokumentation oder Unterschrift zu ergänzen. Zurückgestellte Zeiten können nach Korrektur und Freigabe abgerechnet werden.</Text>
        {fromCache ? <Text style={styles.hint}>Zwischengespeicherter Stand. Zum Speichern bitte eine Verbindung herstellen.</Text> : null}
        {loading ? <LoadingState presentation="inline" message="Offene Einsätze werden geladen…" /> : null}
        {error ? <ErrorState presentation="inline" message={error} onRetry={refresh} /> : null}
        {!error && refreshError ? <ErrorState presentation="inline" message={refreshError} onRetry={refresh} /> : null}
        {!loading && !error && !isLinkedReady ? <Text style={styles.copy}>Ihr Mitarbeitendenkonto wird noch zugeordnet. Bitte erneut laden.</Text> : null}
        {deferred.loading ? <LoadingState presentation="inline" message="Zurückgestellte Zeiten werden geladen…" /> : null}
        {deferred.error || deferred.refreshError ? <ErrorState presentation="inline" message={deferred.error ?? deferred.refreshError!} onRetry={deferred.refresh} /> : null}
        {deferredItems.length ? <Text style={styles.subheading}>Zurückgestellte Zeiten · {deferredItems.length}</Text> : null}
        {deferredItems.map(task => <EmployeeDeferredTimeCard key={`${tenantId}:${employeeId}:${task.id}`} task={task}
          onSaved={deferred.refreshWithResult} onOpenVisit={visitsByTask.has(task.id) ? () => openVisit(visitsByTask.get(task.id)!.id) : undefined} />)}
        {!loading && !error && !refreshError && !deferred.loading && !deferred.error && !deferred.refreshError && isLinkedReady && open.length === 0 && deferredItems.length === 0 ? <Text style={styles.empty}>Alles erledigt. Sie haben keine offenen Einsätze oder zurückgestellten Zeiten.</Text> : null}
        {visibleOpen.length > 0 && deferredItems.length > 0 ? <Text style={styles.subheading}>Weitere offene Einsätze</Text> : null}
        {visibleOpen.map((item) => (
          <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.clientName ?? item.title}: ${fromCache ? 'Einsatz ansehen' : 'Einsatz bearbeiten'}`}
            onPress={() => openVisit(item.id)} style={styles.card}>
            <Text style={styles.date}>{new Date(item.startsAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} · {new Date(item.startsAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</Text>
            <Text style={styles.name}>{item.clientName ?? item.title}</Text>
            <Text style={styles.copy}>{item.assignmentStatus ? ASSIGNMENT_STATUS_LABELS[item.assignmentStatus] : 'Offen'}</Text>
            <Text style={styles.action}>{fromCache ? 'Einsatz ansehen' : 'Einsatz bearbeiten'} →</Text>
          </Pressable>
        ))}
      </ScrollView>
    </PortalTabScreen>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 }, content: { gap: 12, paddingBottom: 24 },
  subheading: { color: '#123251', fontSize: 20, fontWeight: '700', paddingTop: 8 },
  copy: { color: '#355573', fontSize: 16, lineHeight: 23 },
  hint: { color: '#456480', fontSize: 14, lineHeight: 21 },
  empty: { color: '#176847', fontSize: 18, lineHeight: 26, paddingVertical: 18 },
  card: { borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, borderRadius: c.radius, padding: 14, gap: 8 },
  date: { color: '#76500E', fontSize: 14, fontWeight: '600' }, name: { color: '#123251', fontSize: 20, fontWeight: '700' },
  action: { color: '#0766C9', fontSize: 16, fontWeight: '700', paddingTop: 8 },
});
