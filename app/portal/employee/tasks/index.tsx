import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useEmployeePortalDashboard } from '@/hooks/useEmployeePortalDashboard';
import { buildEmployeePortalTodayModel } from '@/lib/portal/employee/employeePortalTodayModel';
import { PortalEmptyState } from '@/product-workflows/components/portal/PortalEmptyState';
import { PortalTabScreen } from '@/product-workflows/screens/portal/PortalTabScreen';
import { ErrorState, LoadingState, PremiumListRow } from '@/components/ui';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';

export default function EmployeePortalTasksRoute() {
  const router = useRouter();
  const auth = useAuth();
  const text = useAuroraAdaptiveText();
  const {
    dashboard,
    error,
    loading,
    refresh,
  } = useEmployeePortalDashboard();
  const displayName =
    auth.profile?.displayName || auth.portalSession?.displayName || auth.user?.displayName || 'Portal';
  const tasks = useMemo(
    () => dashboard
      ? buildEmployeePortalTodayModel({ dashboard, displayName }).offeneAufgaben
      : [],
    [dashboard, displayName],
  );

  if (loading && !dashboard) {
    return (
      <PortalTabScreen title="Aufgaben">
        <LoadingState message="Offene Aufgaben werden aktualisiert…" />
      </PortalTabScreen>
    );
  }

  if (error && !dashboard) {
    return (
      <PortalTabScreen title="Aufgaben">
        <ErrorState title="Aufgaben nicht verfügbar" message={error} onRetry={refresh} />
      </PortalTabScreen>
    );
  }

  return (
    <PortalTabScreen
      title="Aufgaben"
      subtitle="Dokumentation, Einsatz- und Unterschriftsaufgaben"
    >
      {!tasks.length ? (
        <PortalEmptyState
          icon="✓"
          title="Keine offenen Aufgaben"
          message="Alle aktuell freigegebenen Aufgaben sind erledigt."
        />
      ) : (
        <GlassCard>
          {tasks.map((task, index) => (
            <PremiumListRow
              key={task.id}
              title={task.label}
              subtitle={`${task.count} ${task.count === 1 ? 'Aufgabe' : 'Aufgaben'} offen`}
              leading={<Text style={[styles.icon, { color: text.link }]}>✓</Text>}
              trailing={<Text style={[styles.count, { color: text.primary }]}>{task.count}</Text>}
              showChevron={Boolean(task.route)}
              showDivider={index < tasks.length - 1}
              onPress={task.route ? () => router.push(task.route as never) : undefined}
            />
          ))}
        </GlassCard>
      )}
      <View style={styles.refreshHint}>
        <Text style={[styles.hint, { color: text.muted }]}>
          Die Liste aktualisiert sich automatisch mit Ihren Einsätzen.
        </Text>
      </View>
    </PortalTabScreen>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 19,
    fontWeight: '800',
  },
  count: {
    minWidth: 24,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'right',
  },
  refreshHint: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  hint: {
    fontSize: 12,
    textAlign: 'center',
  },
});
