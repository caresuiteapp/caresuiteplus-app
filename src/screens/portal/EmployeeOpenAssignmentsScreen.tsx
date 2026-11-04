import { useCallback, useMemo, useRef } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { usePortalAppointments } from '@/hooks/usePortalAppointments';
import { usePortalActor } from '@/hooks/usePortalActor';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { ErrorState, LoadingState } from '@/components/ui';
import { selectEmployeeOpenAssignments } from '@/lib/portal/employeePortalOpenAssignments';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';
import { useAsyncQuery } from '@/hooks/core';
import { loadEmployeeDeferredTimes } from '@/lib/portal/employeeDeferredTimeService';
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
  // Also remove a just-completed visit after returning from execution.
  const refreshRef = useRef(refreshAll);
  refreshRef.current = refreshAll;
  useFocusEffect(useCallback(() => { void refreshRef.current(); }, []));
  return (
    <PortalTabScreen title="Offene Einsätze" hideHeaderOnPhone scroll={false}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing || deferred.refreshing} onRefresh={refreshAll} />}>
        <Text style={styles.heading}>Offene Einsätze</Text>
        <Text style={styles.copy}>Hier finden Sie offene Einsätze und zurückgestellte Arbeitszeiten, auch aus früheren Monaten. Zeiten, Kilometer, Aufgaben, Dokumentation und Unterschrift können Sie im jeweiligen Einsatz bearbeiten.</Text>
        <Text style={styles.hint}>Aufgaben sind freiwillig. Zum Abschluss gehören Dokumentation und Unterschrift vor Ort oder eine versandte Unterschriftsanfrage ans Klientenportal.</Text>
        <Text style={styles.hint}>Zurückgestellte Arbeitszeiten bleiben hier auch aus früheren Monaten sichtbar. Nach Korrektur und Freigabe können sie in einem Folgemonat berücksichtigt werden.</Text>
        {fromCache ? <Text style={styles.hint}>Zwischengespeicherter Stand. Zum Speichern bitte eine Verbindung herstellen.</Text> : null}
        {loading ? <LoadingState presentation="inline" message="Offene Einsätze werden geladen…" /> : null}
        {error ? <ErrorState presentation="inline" message={error} onRetry={refresh} /> : null}
        {Platform.OS === 'web' && !error && refreshError ? <ErrorState presentation="inline" message={refreshError} onRetry={refresh} /> : null}
        {!loading && !error && !isLinkedReady ? <Text style={styles.copy}>Ihr Mitarbeitendenkonto wird noch zugeordnet. Bitte erneut laden.</Text> : null}
        {deferred.loading ? <LoadingState presentation="inline" message="Zurückgestellte Zeiten werden geladen…" /> : null}
        {deferred.error || deferred.refreshError ? <ErrorState presentation="inline" message={deferred.error ?? deferred.refreshError!} onRetry={deferred.refresh} /> : null}
        {deferredItems.length ? <Text style={styles.subheading}>Zurückgestellte Zeiten · {deferredItems.length}</Text> : null}
        {deferredItems.map(task => <EmployeeDeferredTimeCard key={`${tenantId}:${employeeId}:${task.id}`} task={task}
          onSaved={deferred.refreshWithResult} onOpenVisit={visitsByTask.has(task.id) ? () => router.push(`/portal/employee/assignments/${visitsByTask.get(task.id)!.id}/execute` as never) : undefined} />)}
        {!loading && !error && !refreshError && !deferred.loading && !deferred.error && !deferred.refreshError && isLinkedReady && open.length === 0 && deferredItems.length === 0 ? <Text style={styles.empty}>Alles erledigt. Sie haben keine offenen Einsätze oder zurückgestellten Zeiten.</Text> : null}
        {visibleOpen.length > 0 && deferredItems.length > 0 ? <Text style={styles.subheading}>Weitere offene Einsätze</Text> : null}
        {visibleOpen.map((item) => (
          <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.clientName ?? item.title}: Einsatz bearbeiten`}
            onPress={() => router.push(`/portal/employee/assignments/${item.id}/execute` as never)} style={styles.card}>
            <Text style={styles.date}>{new Date(item.startsAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} · {new Date(item.startsAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</Text>
            <Text style={styles.name}>{item.clientName ?? item.title}</Text>
            <Text style={styles.copy}>{item.assignmentStatus ? ASSIGNMENT_STATUS_LABELS[item.assignmentStatus] : 'Offen'}</Text>
            <Text style={styles.action}>Einsatz bearbeiten →</Text>
          </Pressable>
        ))}
      </ScrollView>
    </PortalTabScreen>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 }, content: { padding: 16, gap: 14, paddingBottom: 28 },
  heading: { color: '#123251', fontSize: 25, fontWeight: '800' },
  subheading: { color: '#123251', fontSize: 20, fontWeight: '700', paddingTop: 8 },
  copy: { color: '#355573', fontSize: 16, lineHeight: 23 },
  hint: { color: '#456480', fontSize: 14, lineHeight: 21 },
  empty: { color: '#176847', fontSize: 18, lineHeight: 26, paddingVertical: 18 },
  card: { borderWidth: 1, borderColor: '#BCD6F3', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, gap: 8 },
  date: { color: '#76500E', fontSize: 14, fontWeight: '600' }, name: { color: '#123251', fontSize: 20, fontWeight: '700' },
  action: { color: '#0766C9', fontSize: 16, fontWeight: '700', paddingTop: 8 },
});
