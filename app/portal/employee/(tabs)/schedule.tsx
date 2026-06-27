import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText, useAuroraGlassCardStyle } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePortalActor } from '@/hooks/usePortalActor';
import { usePortalAppointments } from '@/hooks/usePortalAppointments';
import { buildEmployeePortalOverviewFromAppointments } from '@/lib/portal/employeePortalLiveOverviewService';
import { EmptyState, ErrorState, LoadingState, PremiumBadge } from '@/components/ui';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function EmployeeScheduleRoute() {
  const router = useRouter();
  const { isReady } = usePortalActor();
  const { items, loading, error, refresh } = usePortalAppointments();
  const text = useAuroraAdaptiveText();
  const cardStyle = useAuroraGlassCardStyle();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  const weeklyItems = buildEmployeePortalOverviewFromAppointments(items).weeklyPlan;

  if (!isReady || (loading && items.length === 0)) {
    return (
      <PortalTabScreen title="Dienstplan">
        <LoadingState message="Dienstplan wird geladen…" />
      </PortalTabScreen>
    );
  }

  if (error && items.length === 0) {
    return (
      <PortalTabScreen title="Dienstplan">
        <ErrorState
          title="Dienstplan nicht geladen"
          message={error}
          onRetry={() => void refresh()}
        />
      </PortalTabScreen>
    );
  }

  return (
    <PortalTabScreen title="Dienstplan">
      <View style={styles.container}>
        <Text style={[type.label, { color: text.primary }]}>Wochenplan</Text>
        {weeklyItems.length === 0 ? (
          <EmptyState
            title="Keine Einsätze geplant"
            message="In dieser Woche sind keine Einsätze eingetragen."
            actionLabel="Erneut laden"
            onAction={() => void refresh()}
          />
        ) : (
          weeklyItems.map((item) => (
            <GlassCard
              key={item.assignmentId}
              style={cardStyle}
              onPress={() =>
                router.push(`/portal/employee/assignments/${item.assignmentId}` as never)
              }
            >
              <View style={styles.row}>
                <Text style={[type.cardTitle, { color: text.primary, flex: 1 }]}>{item.title}</Text>
                <PremiumBadge
                  label={ASSIGNMENT_STATUS_LABELS[item.status] ?? item.status}
                  variant="orange"
                />
              </View>
              <Text style={[type.body, { color: text.secondary }]}>{item.clientName}</Text>
              <Text style={[type.caption, { color: text.muted }]}>
                {formatDateTime(item.plannedStartAt)}
              </Text>
            </GlassCard>
          ))
        )}
      </View>
    </PortalTabScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: careSpacing.md,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: careSpacing.sm,
    marginBottom: careSpacing.xs,
  },
});
