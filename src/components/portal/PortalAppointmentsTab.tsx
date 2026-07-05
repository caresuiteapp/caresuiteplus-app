import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PortalTabHero } from '@/components/portal/PortalTabHero';
import { EmployeePortalAssignmentCard } from '@/components/portal/EmployeePortalAssignmentCard';
import { EmployeePortalAssignmentPreviewSheet } from '@/components/portal/EmployeePortalAssignmentPreviewSheet';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumCard,
  SuccessState,
  CachedDataBanner,
} from '@/components/ui';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePortalAppointments } from '@/hooks/usePortalAppointments';
import type { CachedPortalAppointmentItem } from '@/lib/offline/types';
import { useAuth } from '@/lib/auth/context';
import { resolvePortalScope } from '@/lib/portal/portalVisibility';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type PortalAppointmentsTabProps = {
  appointmentsLabel?: string;
  detailBasePath?: string;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
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
  const isEmployeePortal = scope === 'portal_employee';
  const [previewId, setPreviewId] = useState<string | null>(null);

  const {
    items,
    loading,
    error,
    refreshing,
    showSuccess,
    refresh,
    isEmpty,
    fromCache,
    cachedAt,
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

      <CachedDataBanner visible={fromCache} cachedAt={cachedAt} />

      {isEmpty ? (
        <EmptyState
          title="Keine Einsätze geplant"
          message={
            isEmployeePortal
              ? 'Aktuell sind keine Einsätze für Sie eingetragen.'
              : 'Aktuell sind keine Einsätze für Sie geplant.'
          }
          actionLabel="Erneut laden"
          onAction={refresh}
        />
      ) : isEmployeePortal ? (
        items.map((appt) => {
          const cachedItem = appt as CachedPortalAppointmentItem;
          return (
            <EmployeePortalAssignmentCard
              key={appt.id}
              appointment={appt}
              cacheStale={cachedItem.cacheStale}
              onPreview={() => setPreviewId(appt.id)}
              onStartTrip={
                detailBasePath
                  ? () => router.push(`${detailBasePath}/${appt.id}/execute` as never)
                  : undefined
              }
              startBlockedReason="Start erst kurz vor Einsatzbeginn möglich."
            />
          );
        })
      ) : (
        items.map((appt) => {
          const cachedItem = appt as CachedPortalAppointmentItem;
          return (
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
                <View style={styles.badgeRow}>
                  {cachedItem.cacheStale ? (
                    <PremiumBadge label="Veraltet" variant="muted" />
                  ) : null}
                  <PremiumBadge
                    label={WORKFLOW_STATUS_LABELS[appt.status]}
                    variant={appt.status === 'aktiv' ? 'green' : 'muted'}
                  />
                </View>
              </View>
              <Text style={styles.meta}>{formatDateTime(appt.startsAt)}</Text>
              {appt.clientName ? (
                <Text style={styles.meta}>Klient:in: {appt.clientName}</Text>
              ) : null}
              {appt.location ? <Text style={styles.location}>{appt.location}</Text> : null}
            </PremiumCard>
          );
        })
      )}

      {isEmployeePortal ? (
        <EmployeePortalAssignmentPreviewSheet
          assignmentId={previewId}
          visible={previewId != null}
          onClose={() => setPreviewId(null)}
        />
      ) : null}
    </>
  );

  if (isPhone) {
    return <View style={styles.scroll}>{listBody}</View>;
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} />
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
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexShrink: 0,
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
