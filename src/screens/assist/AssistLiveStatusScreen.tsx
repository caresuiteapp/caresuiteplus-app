import { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AssistLiveMap } from '@/components/maps/AssistLiveMap';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { useAssistLiveMonitoring } from '@/features/assistLive/useAssistLiveMonitoring';
import type { AssistLiveMonitoringRow } from '@/features/assistLive/getAssistLiveMonitoring';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { formatTimerSeconds } from '@/lib/assist/assistLiveTrackingViewService';
import { getAssistMapDemoPosition, isGoogleMapsConfigured } from '@/lib/assist/assistMapProvider';
import {
  GPS_TRACKING_DEMO_MESSAGE,
  GPS_TRACKING_BACKEND_EMPTY_MESSAGE,
  isAssistMapProviderConfigured,
  isAssistTrackingPersistenceActive,
} from '@/lib/assist/gpsTrackingConfig';
import { getServiceMode } from '@/lib/services/mode';
import { isDemoMode } from '@/lib/supabase/config';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';
import { colors, spacing, typography } from '@/theme';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function pickMapRow(
  rows: AssistLiveMonitoringRow[],
  selectedId: string | null,
): AssistLiveMonitoringRow | null {
  if (selectedId) {
    const selected = rows.find((row) => row.assignmentId === selectedId);
    if (selected?.tracking?.lastPosition) return selected;
  }
  return (
    rows.find((row) => row.tracking?.trackingActive && row.tracking.lastPosition) ??
    rows.find((row) => row.tracking?.lastPosition) ??
    rows.find((row) => row.tracking?.trackingActive) ??
    rows[0] ??
    null
  );
}

export function AssistLiveStatusScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const splitLayout = width >= 1024;
  const { can, check, roleLabel } = usePermissions();
  const canView = can('assist.assignments.view');
  const tenantId = useServiceTenantId();
  const { overview, loading, error, refresh } = useAssistLiveMonitoring();
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  const rows = overview?.rows ?? [];
  const persistenceActive = isAssistTrackingPersistenceActive();
  const mapProviderReady = isAssistMapProviderConfigured();
  const demoMapPreview = getServiceMode() !== 'supabase' || isDemoMode();

  const mapMarkers = overview?.mapMarkers ?? [];

  const mapRow = useMemo(
    () => pickMapRow(rows, selectedAssignmentId),
    [rows, selectedAssignmentId],
  );

  const mapPosition = useMemo(() => {
    const pos = mapRow?.tracking?.lastPosition;
    if (pos) {
      return {
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracyMeters: pos.accuracyMeters,
        capturedAt: pos.capturedAt,
      };
    }
    if (demoMapPreview && mapProviderReady && rows.length > 0) {
      return getAssistMapDemoPosition();
    }
    return null;
  }, [mapRow, demoMapPreview, mapProviderReady, rows.length]);

  if (!canView) {
    return (
      <ScreenShell title="Live-Status" subtitle="Kein Zugriff" showBack={false}>
        <LockedActionBanner
          message={check('assist.assignments.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (loading && !overview) {
    return (
      <ScreenShell title="Live-Status" subtitle="Wird geladen…" showBack={false}>
        <LoadingState message="Tagesmonitor wird geladen…" />
      </ScreenShell>
    );
  }

  if (error && !overview) {
    return (
      <ScreenShell title="Live-Status" subtitle="Fehler" showBack={false}>
        <ErrorState message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  const listPanel = (
    <>
      {rows.length === 0 ? (
        <EmptyState
          title="Keine Einsätze heute"
          message="Für heute sind keine Einsätze im Live-Monitor — Tracking startet im Mitarbeiterportal."
        />
      ) : (
        rows.map((row) => {
          const isSelected = row.assignmentId === (selectedAssignmentId ?? mapRow?.assignmentId);
          return (
            <Pressable
              key={row.assignmentId}
              onPress={() => setSelectedAssignmentId(row.assignmentId)}
              accessibilityRole="button"
            >
              <PremiumCard accentColor={row.statusColor} style={isSelected ? styles.selectedCard : undefined}>
                <View style={styles.cardHeader}>
                  <Text style={styles.title}>{row.title}</Text>
                  <PremiumBadge label={ASSIGNMENT_STATUS_LABELS[row.status]} variant="orange" dot />
                </View>
                {row.employeeName ? (
                  <Text style={styles.meta}>{row.employeeName}</Text>
                ) : null}
                <Text style={styles.meta}>
                  {formatTime(row.plannedStartAt)} – {formatTime(row.plannedEndAt)}
                </Text>
                {row.tracking ? (
                  <View style={styles.trackingBlock}>
                    <Text style={styles.trackingLine}>
                      Anfahrt: {formatTimerSeconds(row.tracking.timers.driveSeconds)} · Einsatz:{' '}
                      {formatTimerSeconds(row.tracking.timers.serviceSeconds)}
                    </Text>
                    <Text style={styles.trackingLine}>
                      GPS: {row.tracking.gpsPermission}
                      {row.tracking.trackingActive ? ' · Live' : ''}
                      {row.tracking.lastPosition
                        ? ` · ${row.tracking.lastPosition.latitude.toFixed(4)}, ${row.tracking.lastPosition.longitude.toFixed(4)}`
                        : ' · Keine Position'}
                      {row.tracking.arrivalProof === 'without_gps'
                        ? ' · Ankunft ohne GPS'
                        : row.tracking.arrivalProof === 'manual'
                          ? ' · Ankunft manuell'
                          : ''}
                    </Text>
                    {row.tracking.warnings[0] ? (
                      <Text style={styles.warning}>{row.tracking.warnings[0]}</Text>
                    ) : null}
                  </View>
                ) : null}
                <PremiumButton
                  title="Einsatzdetails"
                  variant="ghost"
                  size="sm"
                  onPress={() => router.push(`/assist/assignments/${row.assignmentId}` as never)}
                />
              </PremiumCard>
            </Pressable>
          );
        })
      )}
    </>
  );

  const mapPanel = (
    <SectionPanel
      title="Kartenansicht"
      subtitle={mapProviderReady ? 'Live-Standort während aktiver Einsätze' : 'Liste als Fallback'}
    >
      {!mapProviderReady ? (
        <Text style={styles.gap}>
          Kartenansicht nicht verfügbar — Standorte werden als Liste angezeigt.
        </Text>
      ) : (
        <AssistLiveMap
          position={mapPosition}
          markers={mapMarkers}
          selectedMarkerId={selectedAssignmentId ?? mapRow?.assignmentId ?? null}
          onMarkerSelect={setSelectedAssignmentId}
          markerLabel={mapRow?.title ?? undefined}
          demoMode={demoMapPreview && !mapRow?.tracking?.lastPosition}
          fallbackMessage={GPS_TRACKING_BACKEND_EMPTY_MESSAGE}
          height={splitLayout ? 420 : 280}
          tenantId={tenantId}
        />
      )}
      {persistenceActive && rows.length > 0 && !mapRow?.tracking?.lastPosition && !demoMapPreview ? (
        <Text style={styles.gap}>{GPS_TRACKING_BACKEND_EMPTY_MESSAGE}</Text>
      ) : null}
    </SectionPanel>
  );

  return (
    <ScreenShell
      title="Live-Status"
      subtitle={`Einsätze heute · ${roleLabel ?? 'Assist'}`}
      showBack={false}
      scroll={false}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        <InfoBanner variant="info" title="Nur Anzeige" message={overview?.readOnlyNotice ?? ''} />

        {!persistenceActive ? (
          <InfoBanner variant="warning" title="Tracking-Persistenz" message={GPS_TRACKING_DEMO_MESSAGE} />
        ) : null}

        {error ? (
          <InfoBanner variant="warning" title="Daten teilweise nicht verfügbar" message={error} />
        ) : null}

        {overview ? (
          <View style={styles.kpiRow}>
            <PremiumBadge label={`${overview.todayCount} Einsätze`} variant="muted" />
            <PremiumBadge label={`${overview.runningCount} laufend`} variant="orange" />
            <PremiumBadge label={`${overview.activeTrackingCount} Tracking aktiv`} variant="cyan" />
            <PremiumBadge label={`${overview.consentPendingCount} Einwilligung offen`} variant="orange" />
            {mapProviderReady ? (
              <PremiumBadge
                label={isGoogleMapsConfigured() ? 'Google Maps aktiv' : 'Kartenansicht aktiv'}
                variant="green"
              />
            ) : null}
          </View>
        ) : null}

        {splitLayout ? (
          <View style={styles.splitRow}>
            <View style={styles.listColumn}>{listPanel}</View>
            <View style={styles.mapColumn}>{mapPanel}</View>
          </View>
        ) : (
          <>
            {listPanel}
            {mapPanel}
          </>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  splitRow: { flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  listColumn: { flex: 1, minWidth: 320, gap: spacing.md },
  mapColumn: { flex: 1, minWidth: 320 },
  selectedCard: { borderWidth: 1, borderColor: colors.cyan },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...typography.bodyStrong, flex: 1 },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  trackingBlock: { marginTop: spacing.sm, gap: 2 },
  trackingLine: { ...typography.caption, color: colors.textSecondary },
  warning: { ...typography.caption, color: colors.amber, marginTop: spacing.xs },
  gap: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
});
