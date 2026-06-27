import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PortalTabHero } from '@/components/portal/PortalTabHero';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumCard,
  SuccessState,
} from '@/components/ui';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePortalAppointments } from '@/hooks/usePortalAppointments';
import { useAuth } from '@/lib/auth/context';
import { resolvePortalScope } from '@/lib/portal/portalVisibility';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type PortalAppointmentsTabProps = {
  appointmentsLabel?: string;
  /** Deep-Link-Basis für Detailansicht, z. B. /portal/employee/assignments */
  detailBasePath?: string;
};

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PortalAppointmentsTab({
  appointmentsLabel = 'Einsätze',
  detailBasePath,
}: PortalAppointmentsTabProps) {
  const router = useRouter();
  const { isPhone } = useDeviceClass();
  const { profile } = useAuth();
  const scope = resolvePortalScope(profile?.roleKey ?? null);
  const {
    items,
    loading,
    error,
    refreshing,
    showSuccess,
    refresh,
    isEmpty,
  } = usePortalAppointments();

  if (loading && items.length === 0) {
    return <LoadingState message={`${appointmentsLabel} werden geladen…`} />;
  }

  if (error && items.length === 0) {
    return (
      <ErrorState
        title={`${appointmentsLabel} konnten nicht geladen werden`}
        message={error}
        onRetry={refresh}
      />
    );
  }

  const listBody = (
    <>
      <PortalTabHero
        tab="appointments"
        scope={scope}
        totalCount={items.length}
        activeCount={items.filter((a) => a.status === 'aktiv').length}
        titleOverride={appointmentsLabel}
      />

      {showSuccess ? (
        <SuccessState message={`${appointmentsLabel} aktualisiert.`} />
      ) : null}

      {isEmpty ? (
        <EmptyState
          title={
            scope === 'portal_employee'
              ? 'Keine Einsätze geplant'
              : 'Keine Einsätze geplant'
          }
          message={
            scope === 'portal_employee'
              ? 'Aktuell sind keine Einsätze für Sie eingetragen.'
              : 'Aktuell sind keine Einsätze für Sie geplant.'
          }
          actionLabel="Erneut laden"
          onAction={refresh}
        />
      ) : (
        items.map((appt) => (
          <PremiumCard
            key={appt.id}
            accentColor={colors.cyan}
            onPress={
              detailBasePath
                ? () => router.push(`${detailBasePath}/${appt.id}` as never)
                : undefined
            }
          >
            <View style={styles.cardHeader}>
              <Text style={styles.title}>{appt.title}</Text>
              <PremiumBadge
                label={WORKFLOW_STATUS_LABELS[appt.status]}
                variant={appt.status === 'aktiv' ? 'green' : 'muted'}
              />
            </View>
            <Text style={styles.meta}>{formatDateTime(appt.startsAt)}</Text>
            {appt.clientName ? (
              <Text style={styles.meta}>Klient:in: {appt.clientName}</Text>
            ) : null}
            {appt.location ? (
              <Text style={styles.location}>{appt.location}</Text>
            ) : null}
          </PremiumCard>
        ))
      )}
    </>
  );

  if (isPhone) {
    return <View style={styles.scroll}>{listBody}</View>;
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
      }
      contentContainerStyle={styles.scroll}
    >
      {listBody}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.bodyStrong,
    flex: 1,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  location: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
});
