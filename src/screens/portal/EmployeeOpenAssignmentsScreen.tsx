import { useCallback, useMemo, useRef } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { usePortalAppointments } from '@/hooks/usePortalAppointments';
import { usePortalActor } from '@/hooks/usePortalActor';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { ErrorState, LoadingState } from '@/components/ui';
import { selectEmployeeOpenAssignments } from '@/lib/portal/employeePortalOpenAssignments';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';

export function EmployeeOpenAssignmentsScreen() {
  const router = useRouter();
  const { employeeId } = usePortalActor();
  const { items, loading, error, refresh, refreshing, fromCache, isLinkedReady } = usePortalAppointments('employee');
  const open = useMemo(() => selectEmployeeOpenAssignments(items, employeeId ?? ''), [items, employeeId]);
  // Also remove a just-completed visit after returning from execution.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useFocusEffect(useCallback(() => { void refreshRef.current(); }, []));
  return (
    <PortalTabScreen title="Offene Einsätze" hideHeaderOnPhone scroll={false}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text style={styles.heading}>Offene Einsätze</Text>
        <Text style={styles.copy}>Ihre noch nicht abgeschlossenen Einsätze – auch aus früheren Tagen. Zeiten, Kilometer, Aufgaben, Dokumentation und Unterschrift können Sie im Einsatz bearbeiten.</Text>
        <Text style={styles.hint}>Aufgaben sind freiwillig. Zum Abschluss gehören Dokumentation und Unterschrift vor Ort oder eine versandte Unterschriftsanfrage ans Klientenportal.</Text>
        {fromCache ? <Text style={styles.hint}>Zwischengespeicherter Stand. Zum Speichern bitte eine Verbindung herstellen.</Text> : null}
        {loading ? <LoadingState presentation="inline" message="Offene Einsätze werden geladen…" /> : null}
        {error ? <ErrorState presentation="inline" message={error} onRetry={refresh} /> : null}
        {!loading && !error && !isLinkedReady ? <Text style={styles.copy}>Ihr Mitarbeitendenkonto wird noch zugeordnet. Bitte erneut laden.</Text> : null}
        {!loading && !error && isLinkedReady && open.length === 0 ? <Text style={styles.empty}>Alles erledigt. Sie haben keine offenen Einsätze.</Text> : null}
        {open.map((item) => (
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
  copy: { color: '#355573', fontSize: 16, lineHeight: 23 },
  hint: { color: '#456480', fontSize: 14, lineHeight: 21 },
  empty: { color: '#176847', fontSize: 18, lineHeight: 26, paddingVertical: 18 },
  card: { borderWidth: 1, borderColor: '#BCD6F3', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, gap: 8 },
  date: { color: '#76500E', fontSize: 14, fontWeight: '600' }, name: { color: '#123251', fontSize: 20, fontWeight: '700' },
  action: { color: '#0766C9', fontSize: 16, fontWeight: '700', paddingTop: 8 },
});
