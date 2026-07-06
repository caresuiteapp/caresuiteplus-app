import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PortalTabHero } from '@/components/portal/PortalTabHero';
import { ClientPortalAssignmentCard } from '@/components/portal/ClientPortalAssignmentCard';
import { ClientPortalAssignmentPreviewSheet } from '@/components/portal/ClientPortalAssignmentPreviewSheet';
import { EmployeePortalAssignmentCard } from '@/components/portal/EmployeePortalAssignmentCard';
import { EmployeePortalAssignmentPreviewSheet } from '@/components/portal/EmployeePortalAssignmentPreviewSheet';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { groupPortalAppointmentsByTime } from '@/lib/portal/groupPortalAppointmentsByTime';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SuccessState,
  CachedDataBanner,
} from '@/components/ui';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePortalAppointments } from '@/hooks/usePortalAppointments';
import type { CachedPortalAppointmentItem } from '@/lib/offline/types';
import { useAuth } from '@/lib/auth/context';
import { resolvePortalScope } from '@/lib/portal/portalVisibility';
import { spacing } from '@/theme';

type PortalAppointmentsTabProps = {
  appointmentsLabel?: string;
  detailBasePath?: string;
};

export function PortalAppointmentsTab({
  appointmentsLabel = 'Einsätze',
  detailBasePath,
}: PortalAppointmentsTabProps) {
  const router = useRouter();
  const { isPhone, width } = useDeviceClass();
  const { profile } = useAuth();
  const scope = resolvePortalScope(profile?.roleKey ?? null);
  const isEmployeePortal = scope === 'portal_employee';
  const text = useAuroraAdaptiveText();
  const type = resolveGalaxyTypography(width);
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
    isResolvingClientLink,
    missingClientLink,
    supabaseSessionReady,
  } = usePortalAppointments();

  const appointmentGroups = useMemo(() => groupPortalAppointmentsByTime(items), [items]);

  if ((loading || isResolvingClientLink || !supabaseSessionReady) && items.length === 0) {
    return (
      <LoadingState
        message={
          isResolvingClientLink
            ? 'Klient:innenprofil wird verknüpft…'
            : !supabaseSessionReady
              ? 'Portal-Sitzung wird hergestellt…'
              : `${appointmentsLabel} werden geladen…`
        }
      />
    );
  }

  if (missingClientLink && items.length === 0) {
    return (
      <ErrorState
        title="Einsätze nicht verfügbar"
        message="Ihr Klient:innenprofil konnte nicht verknüpft werden. Bitte melden Sie sich erneut an oder wenden Sie sich an Ihr Pflegebüro."
        onRetry={refresh}
      />
    );
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
              : 'Aktuell sind keine Einsätze für Sie sichtbar. Wenn Sie Einsätze erwarten, wenden Sie sich an Ihr Pflegebüro.'
          }
          actionLabel="Erneut laden"
          onAction={refresh}
        />
      ) : isEmployeePortal ? (
        appointmentGroups.map((group) => (
          <View key={group.key}>
            <Text style={[type.label, { color: text.primary, marginBottom: careSpacing.sm }]}>
              {group.label}
            </Text>
            {group.items.map((appt) => {
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
            })}
          </View>
        ))
      ) : (
        appointmentGroups.map((group) => (
          <View key={group.key}>
            <Text style={[type.label, { color: text.primary, marginBottom: careSpacing.sm }]}>
              {group.label}
            </Text>
            {group.items.map((appt) => {
              const cachedItem = appt as CachedPortalAppointmentItem;
              return (
                <ClientPortalAssignmentCard
                  key={appt.id}
                  appointment={appt}
                  cacheStale={cachedItem.cacheStale}
                  onPreview={() => setPreviewId(appt.id)}
                />
              );
            })}
          </View>
        ))
      )}

      {isEmployeePortal ? (
        <EmployeePortalAssignmentPreviewSheet
          assignmentId={previewId}
          visible={previewId != null}
          onClose={() => setPreviewId(null)}
        />
      ) : (
        <ClientPortalAssignmentPreviewSheet
          assignmentId={previewId}
          visible={previewId != null}
          onClose={() => setPreviewId(null)}
          detailBasePath={detailBasePath}
        />
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
});
