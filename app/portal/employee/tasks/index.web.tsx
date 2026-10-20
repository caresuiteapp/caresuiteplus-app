import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useEmployeePortalDashboard } from '@/hooks/useEmployeePortalDashboard';
import { buildEmployeePortalTodayModel } from '@/lib/portal/employee/employeePortalTodayModel';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { ErrorState, LoadingState, PremiumListRow } from '@/components/ui';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { EmployeeInternalNotes } from '@/components/portal/EmployeeInternalNotes.web';
import type { InternalNoteActor } from '@/lib/office/notes/internalTypes.web';

/** Web receiving workflow; the native tasks route remains unchanged. */
export default function EmployeePortalTasksWebRoute() {
  const auth = useAuth();
  const portal = usePortalActor();
  const userId = auth.user?.id;
  const actor = useMemo<InternalNoteActor | null>(() => portal.isLinkedReady && portal.tenantId && portal.employeeId && userId
    ? { tenantId: portal.tenantId, userId, roleKey: portal.roleKey, employeeId: portal.employeeId, readOnly: !!portal.employeeLinkReadOnly }
    : null, [portal.isLinkedReady, portal.tenantId, portal.employeeId, portal.roleKey, portal.employeeLinkReadOnly, userId]);
  return <PortalTabScreen title="Aufgaben & Notizen" subtitle="Rückrufe, Anliegen und Aufgaben aus dem Büro – mit Ihrem aktuellen Bearbeitungsstand.">
    {actor ? <EmployeeInternalNotes actor={actor} /> : portal.isResolvingEmployeeLink || !portal.isReady
      ? <LoadingState message="Ihr Mitarbeiterzugang wird geprüft…" />
      : <ErrorState title="Mitarbeiterzugang nicht zugeordnet" message="Für diesen Zugang konnte keine bestätigte Mitarbeiterzuordnung geladen werden. Bitte melden Sie sich erneut an oder wenden Sie sich an Ihr Büro." />}
    <AssignmentTasks />
  </PortalTabScreen>;
}

/** Preserve all existing assignment/documentation/signature task categories. */
function AssignmentTasks() {
  const router = useRouter();
  const auth = useAuth();
  const text = useAuroraAdaptiveText();
  const { dashboard, error, loading, refresh } = useEmployeePortalDashboard();
  const displayName = auth.profile?.displayName || auth.portalSession?.displayName || auth.user?.displayName || 'Portal';
  const tasks = useMemo(() => dashboard ? buildEmployeePortalTodayModel({ dashboard, displayName }).offeneAufgaben : [], [dashboard, displayName]);
  return <GlassCard>
    <Text accessibilityRole="header" style={[styles.heading, { color: text.primary }]}>Aus Ihren Einsätzen</Text>
    <Text style={[styles.hint, { color: text.secondary }]}>Dokumentation, Nachweise und Unterschriften</Text>
    {loading && !dashboard ? <LoadingState message="Einsatzaufgaben werden aktualisiert…" /> : error && !dashboard
      ? <ErrorState title="Einsatzaufgaben nicht verfügbar" message={error} onRetry={refresh} />
      : tasks.length ? tasks.map((task, index) => <PremiumListRow key={task.id} title={task.label}
        subtitle={`${task.count} ${task.count === 1 ? 'Aufgabe' : 'Aufgaben'} offen`}
        leading={<Text style={[styles.icon, { color: text.secondary }]}>✓</Text>}
        trailing={<Text style={[styles.count, { color: text.primary }]}>{task.count}</Text>}
        showChevron={Boolean(task.route)} showDivider={index < tasks.length - 1}
        onPress={task.route ? () => router.push(task.route as never) : undefined} />)
        : <Text style={[styles.empty, { color: text.secondary }]}>Keine offenen Einsatzaufgaben. Die Liste aktualisiert sich automatisch mit Ihren Einsätzen.</Text>}
    {error && dashboard ? <ErrorState title="Aktualisierung fehlgeschlagen" message={error} onRetry={refresh} /> : null}
  </GlassCard>;
}

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: '800', marginBottom: 5 },
  hint: { fontSize: 13, marginBottom: 12 },
  empty: { fontSize: 14, lineHeight: 22, paddingVertical: 14 },
  icon: { fontSize: 19, fontWeight: '800' },
  count: { minWidth: 24, fontSize: 16, fontWeight: '800', textAlign: 'right' },
});
