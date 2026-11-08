import { useMemo, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PortalTabHero } from '@/components/portal/PortalTabHero';
import { ClientPortalAssignmentCard } from '@/components/portal/ClientPortalAssignmentCard';
import { ClientPortalAssignmentPreviewSheet } from '@/components/portal/ClientPortalAssignmentPreviewSheet';
import { ClientPortalLiveTrackingSection } from '@/components/portal/ClientPortalLiveTrackingSection';
import { EmployeePortalAssignmentAgenda } from '@/components/portal/employee/EmployeePortalAssignmentAgenda';
import { EmployeePortalAssignmentPreviewSheet } from '@/components/portal/EmployeePortalAssignmentPreviewSheet';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { groupPortalAppointmentsByTime, groupPortalPastAppointmentsByMonth } from '@/lib/portal/groupPortalAppointmentsByTime';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SuccessState,
  CachedDataBanner,
  ListFilterSelect,
} from '@/components/ui';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePortalAppointments } from '@/hooks/usePortalAppointments';
import type { CachedPortalAppointmentItem } from '@/lib/offline/types';
import {
  portalScopeForAudience,
  type OperationalPortalAudience,
} from '@/lib/portal/portalAudience';
import { employeePortalAssignmentStatus } from '@/lib/portal/employee/employeePortalAssignmentDisplay';
import {
  resolveEmployeePortalAssignmentPendingFlags,
  shouldNavigateEmployeePortalAssignmentToExecution,
} from '@/lib/portal/employeePortalAssignmentCompletion';
import { spacing } from '@/theme';
import { ClientPortalGuide } from '@/components/portal/ClientPortalGuide';
import { liquidRadius } from '@/liquid-command/foundation/tokens';
import { portalPremium } from '@/design/tokens/portalPremium';

type PortalAppointmentsTabProps = {
  audience: OperationalPortalAudience;
  appointmentsLabel?: string;
  detailBasePath?: string;
};

export function PortalAppointmentsTab({
  audience,
  appointmentsLabel = 'Einsätze',
  detailBasePath,
}: PortalAppointmentsTabProps) {
  const router = useRouter();
  const { width } = useDeviceClass();
  const scope = portalScopeForAudience(audience);
  const isEmployeePortal = audience === 'employee';
  const text = useAuroraAdaptiveText();
  const type = resolveGalaxyTypography(width);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [clientView, setClientView] = useState<'upcoming' | 'past'>('upcoming');
  const [historyMonth, setHistoryMonth] = useState('all');

  const appointmentState = usePortalAppointments(audience);
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
    refreshError,
  } = appointmentState;

  const appointmentGroups = useMemo(() => groupPortalAppointmentsByTime(items), [items]);
  const clientUpcoming = appointmentGroups.find((group) => group.key === 'upcoming')?.items ?? [];
  const clientPast = appointmentGroups.find((group) => group.key === 'past')?.items ?? [];
  const historyMonths = !isEmployeePortal && clientView === 'past' ? groupPortalPastAppointmentsByMonth(clientPast) : [];
  const selectedHistoryMonth = historyMonths.find((group) => group.key === historyMonth);
  const clientVisibleItems = clientView === 'upcoming' ? clientUpcoming : selectedHistoryMonth?.items ?? clientPast;

  const waitingForAppointments = (loading || isResolvingClientLink || !supabaseSessionReady) && items.length === 0;
  const loadingMessage = isResolvingClientLink
    ? 'Klient:innenprofil wird verknüpft…'
    : !supabaseSessionReady
      ? 'Portal-Sitzung wird hergestellt…'
      : `${appointmentsLabel} werden geladen…`;

  if (!isEmployeePortal && waitingForAppointments) {
    return <LoadingState message={loadingMessage} />;
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

  if (!isEmployeePortal && error && items.length === 0) {
    return (
      <ErrorState
        title={`${appointmentsLabel} konnten nicht geladen werden`}
        message={error}
        onRetry={refresh}
      />
    );
  }

  const continuationAction = (appt: (typeof items)[number]) => {
    if (audience !== 'employee') return undefined;
    if (!detailBasePath || appt.id.startsWith('calendar:') || fromCache || (appt as CachedPortalAppointmentItem).cacheStale) return undefined;
    const status = employeePortalAssignmentStatus(appt);
    if (status === 'geplant' || status === 'bestaetigt' || status === 'storniert' || status === 'nicht_erschienen') return undefined;
    const pending = resolveEmployeePortalAssignmentPendingFlags({
      status,
      assignmentIncomplete: appt.assignmentIncomplete,
      documentationPending: appt.documentationPending,
      signaturePending: appt.signaturePending,
    });
    return shouldNavigateEmployeePortalAssignmentToExecution({
        status,
        documentationPending: pending.documentationPending,
        signaturePending: pending.signaturePending,
      })
      ? () => router.push(`${detailBasePath}/${appt.id}/execute` as never) : undefined;
  };

  const listBody = isEmployeePortal ? (
    <>
      <EmployeePortalAssignmentAgenda groups={appointmentGroups} state={appointmentState}
        loadingMessage={waitingForAppointments ? loadingMessage : undefined}
        onPreview={setPreviewId} continuationAction={continuationAction} />
      <EmployeePortalAssignmentPreviewSheet
        assignmentId={previewId}
        visible={previewId != null}
        onClose={() => setPreviewId(null)}
      />
    </>
  ) : (
    <>
      <PortalTabHero
        tab="appointments"
        scope={scope}
        totalCount={items.length}
        activeCount={clientUpcoming.length}
        titleOverride={appointmentsLabel}
      />

      {showSuccess ? (
        <SuccessState message={`${appointmentsLabel} aktualisiert.`} />
      ) : null}

      {refreshError ? <ErrorState title="Aktualisieren nicht möglich" message={refreshError} onRetry={refresh} /> : null}

      <CachedDataBanner visible={fromCache} cachedAt={cachedAt} />

      <ClientPortalLiveTrackingSection />

      {!isEmpty ? (
        <View style={styles.clientSwitcher} accessibilityRole="tablist">
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: clientView === 'upcoming' }}
            onPress={() => setClientView('upcoming')}
            style={({ pressed }) => [
              styles.clientSwitch,
              clientView === 'upcoming' && styles.clientSwitchActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[type.bodyStrong, styles.clientSwitchText, clientView === 'upcoming' && styles.clientSwitchTextActive]}>
              Kommend ({clientUpcoming.length})
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: clientView === 'past' }}
            onPress={() => setClientView('past')}
            style={({ pressed }) => [
              styles.clientSwitch,
              clientView === 'past' && styles.clientSwitchActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[type.bodyStrong, styles.clientSwitchText, clientView === 'past' && styles.clientSwitchTextActive]}>
              Vergangen ({clientPast.length})
            </Text>
          </Pressable>
        </View>
      ) : null}

      {historyMonths.length > 0 ? (
        <ListFilterSelect
          label="Monat der Einsatzhistorie"
          value={selectedHistoryMonth?.key ?? 'all'}
          options={[{ key: 'all', label: 'Alle Monate' }, ...historyMonths.map(({ key, label }) => ({ key, label }))]}
          onChange={setHistoryMonth}
          style={{ width: '100%', minWidth: 0 }}
        />
      ) : null}

      {isEmpty ? (
        <EmptyState
          title="Keine Einsätze geplant"
          message="Aktuell sind keine Einsätze für Sie sichtbar. Wenn Sie Einsätze erwarten, wenden Sie sich an Ihr Pflegebüro."
          actionLabel="Erneut laden"
          onAction={refresh}
        />
      ) : clientVisibleItems.length === 0 ? (
        <ClientPortalGuide
          compact
          title={clientView === 'upcoming' ? 'Alles ruhig im Moment' : 'Noch keine vergangenen Einsätze'}
          message={
            clientView === 'upcoming'
              ? 'Sobald ein neuer Einsatz geplant ist, sehen Sie ihn hier. Vergangene Einsätze bleiben getrennt im Bereich „Vergangen“.'
              : 'Abgeschlossene Einsätze werden später automatisch in diesem Bereich angezeigt.'
          }
        />
      ) : (
        <View>
          <Text style={[type.label, { color: text.primary, marginBottom: careSpacing.sm }]}>
            {clientView === 'upcoming' ? 'Kommende Einsätze' : selectedHistoryMonth?.label ?? 'Vergangene Einsätze'}
          </Text>
          {clientVisibleItems.map((appt) => {
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
      )}

      <ClientPortalAssignmentPreviewSheet
        assignmentId={previewId}
        visible={previewId != null}
        onClose={() => setPreviewId(null)}
        detailBasePath={detailBasePath}
      />
    </>
  );

  return (
    <ScrollView
      style={[styles.scrollViewport, isEmployeePortal && styles.employeeScrollViewport]}
      showsVerticalScrollIndicator={isEmployeePortal}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} />
      }
      contentContainerStyle={styles.scroll}
      testID={isEmployeePortal ? 'employee-assignments-scroll' : 'client-appointments-scroll'}
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
  scrollViewport: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    ...(Platform.OS === 'web'
      ? ({
          overflowY: 'auto',
          overflowX: 'hidden',
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
        } as never)
      : {}),
  },
  employeeScrollViewport: Platform.OS === 'web'
    ? ({ scrollbarWidth: 'thin', scrollbarColor: 'rgba(188,238,255,0.38) transparent' } as never)
    : {},
  clientSwitcher: {
    width: '100%',
    padding: 4,
    borderWidth: 1,
    borderColor: portalPremium.borderSoft,
    borderRadius: liquidRadius.card,
    backgroundColor: portalPremium.surfaceRaised,
    flexDirection: 'row',
    gap: 4,
  },
  clientSwitch: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: liquidRadius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientSwitchActive: {
    borderWidth: 1,
    borderColor: portalPremium.borderStrong,
    backgroundColor: portalPremium.surfaceMuted,
  },
  clientSwitchText: { color: portalPremium.text.secondary, textAlign: 'center' },
  clientSwitchTextActive: { color: portalPremium.accent.blueDark },
  pressed: { opacity: 0.74 },
});
