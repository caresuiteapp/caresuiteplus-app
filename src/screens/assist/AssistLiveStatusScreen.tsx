import { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AssistExecutionProblemInboxPanel } from '@/components/assist/AssistExecutionProblemInboxPanel';
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
import { getAssistMapDemoPosition, isGoogleMapsConfigured } from '@/lib/assist/assistMapProvider';
import {
  GPS_TRACKING_DEMO_MESSAGE,
  GPS_TRACKING_BACKEND_EMPTY_MESSAGE,
  isAssistMapProviderConfigured,
  isAssistTrackingPersistenceActive,
} from '@/lib/assist/gpsTrackingConfig';
import { getServiceMode } from '@/lib/services/mode';
import { isDemoMode } from '@/lib/supabase/config';
import { HealthOSStatusBadge } from '@/components/healthos';
import { colors, spacing, typography } from '@/theme';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatPreciseDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3_600);
  const minutes = Math.floor((safeSeconds % 3_600) / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${hours} Std. ${String(minutes).padStart(2, '0')} Min. ${String(remainingSeconds).padStart(2, '0')} Sek.`;
}

function resolveLiveTimerSeconds(
  seconds: number | null,
  activeTimer: 'drive' | 'service' | 'pause' | null,
  timer: 'drive' | 'service' | 'pause',
  generatedAt: string | null | undefined,
  nowMs: number,
): number | null {
  if (seconds == null || activeTimer !== timer || !generatedAt) return seconds;
  const generatedMs = new Date(generatedAt).getTime();
  if (!Number.isFinite(generatedMs)) return seconds;
  return seconds + Math.max(0, Math.floor((nowMs - generatedMs) / 1000));
}

function formatDistance(kilometres: number): string {
  return `${kilometres.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`;
}

function formatGpsPermission(value: string): string {
  if (value === 'granted') return 'Freigegeben und verwendet';
  if (value === 'denied') return 'Vom Mitarbeitendengerät blockiert';
  if (value === 'unavailable') return 'Auf dem Mitarbeitendengerät nicht verfügbar';
  return 'Noch nicht durch einen GPS-Punkt bestätigt';
}

function formatPositionFreshness(capturedAt: string | null | undefined): string {
  if (!capturedAt) return 'Noch keine Position';
  const ageSeconds = Math.max(0, Math.round((Date.now() - new Date(capturedAt).getTime()) / 1000));
  if (ageSeconds < 15) return 'Live · gerade aktualisiert';
  // One position is expected every 60 seconds. Two complete missed heartbeats
  // plus network tolerance are required before warning the dispatcher.
  if (ageSeconds < 150) {
    return ageSeconds < 60
      ? `Live · vor ${ageSeconds} Sek.`
      : `Live · vor ${Math.round(ageSeconds / 60)} Min.`;
  }
  return `Signal veraltet · vor ${Math.round(ageSeconds / 60)} Min.`;
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
  const [clockMs, setClockMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setClockMs(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const rows = useMemo(() => overview?.rows ?? [], [overview?.rows]);
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
                  <HealthOSStatusBadge domain="assignment" technicalValue={row.status} dot />
                </View>
                {row.employeeName ? (
                  <Text style={styles.meta}>{row.employeeName}</Text>
                ) : null}
                <Text style={styles.meta}>
                  {formatTime(row.plannedStartAt)} – {formatTime(row.plannedEndAt)}
                </Text>
                {row.tracking ? (
                  <View style={styles.trackingBlock}>
                    <View style={styles.timerGrid}>
                      <View style={styles.timerCell}>
                        <Text style={styles.timerLabel}>Anfahrt</Text>
                        <Text style={styles.timerValue}>
                          {formatPreciseDuration(resolveLiveTimerSeconds(
                            row.tracking.timers.driveSeconds,
                            row.tracking.timers.activeTimer,
                            'drive',
                            overview?.generatedAt,
                            clockMs,
                          ))}
                        </Text>
                      </View>
                      <View style={styles.timerCell}>
                        <Text style={styles.timerLabel}>Einsatz</Text>
                        <Text style={styles.timerValue}>
                          {formatPreciseDuration(resolveLiveTimerSeconds(
                            row.tracking.timers.serviceSeconds,
                            row.tracking.timers.activeTimer,
                            'service',
                            overview?.generatedAt,
                            clockMs,
                          ))}
                        </Text>
                      </View>
                      <View style={styles.timerCell}>
                        <Text style={styles.timerLabel}>Pause</Text>
                        <Text style={styles.timerValue}>
                          {formatPreciseDuration(resolveLiveTimerSeconds(
                            row.tracking.timers.pauseSeconds,
                            row.tracking.timers.activeTimer,
                            'pause',
                            overview?.generatedAt,
                            clockMs,
                          ))}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.trackingLine,
                        row.tracking.lastPosition &&
                        Date.now() - new Date(row.tracking.lastPosition.capturedAt).getTime() > 150_000
                          ? styles.warning
                          : styles.liveSignal,
                      ]}
                    >
                      {formatPositionFreshness(row.tracking.lastPosition?.capturedAt)}
                    </Text>
                    <Text style={styles.trackingLine}>
                      GPS: {formatGpsPermission(row.tracking.gpsPermission)}
                      {row.tracking.trackingActive
                        ? row.tracking.lastPosition &&
                          clockMs - new Date(row.tracking.lastPosition.capturedAt).getTime() < 150_000
                          ? ' · Live'
                          : ' · Sitzung aktiv, Signal nicht live'
                        : ''}
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
                    {row.route ? (
                      <View style={styles.routeMetrics}>
                        <View style={styles.routeMetricPrimary}>
                          <Text style={styles.routeMetricLabel}>Route gesamt</Text>
                          <Text style={styles.routeMetricValue}>{formatDistance(row.route.totalDistanceKm)}</Text>
                        </View>
                        <View style={styles.routeMetric}>
                          <Text style={styles.routeMetricLabel}>Gefahren</Text>
                          <Text style={styles.routeMetricSmall}>{formatDistance(row.route.drivingDistanceKm)}</Text>
                        </View>
                        <View style={styles.routeMetric}>
                          <Text style={styles.routeMetricLabel}>Zu Fuß</Text>
                          <Text style={styles.routeMetricSmall}>{formatDistance(row.route.walkingDistanceKm)}</Text>
                        </View>
                        <View style={styles.routeMetric}>
                          <Text style={styles.routeMetricLabel}>Fahrrad/sonstig</Text>
                          <Text style={styles.routeMetricSmall}>{formatDistance(row.route.cyclingDistanceKm)}</Text>
                        </View>
                        <Text style={styles.routeMeta}>
                          {row.route.pointCount} GPS-Punkte · Ø {row.route.averageSpeedKmh?.toFixed(1) ?? '0,0'} km/h
                          {row.route.currentSpeedKmh != null ? ` · zuletzt ${row.route.currentSpeedKmh.toFixed(1)} km/h` : ''}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.warning}>Noch keine GPS-Route aufgezeichnet.</Text>
                    )}
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
          routePoints={mapRow?.route?.points ?? []}
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
        style={styles.scrollViewport}
        contentContainerStyle={styles.scroll}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        testID="assist-live-status-scroll"
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
            <PremiumBadge label={`${overview.freshGpsCount} GPS-Signale live`} variant="green" />
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

        {getServiceMode() === 'supabase' ? <AssistExecutionProblemInboxPanel /> : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scrollViewport: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    width: '100%',
    ...(Platform.OS === 'web'
      ? ({
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
          overscrollBehavior: 'contain',
          scrollbarGutter: 'stable',
        } as unknown as ViewStyle)
      : null),
  },
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
  timerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  timerCell: { minWidth: 150, flex: 1, padding: spacing.sm, borderRadius: 10, backgroundColor: 'rgba(15, 23, 42, 0.06)' },
  timerLabel: { ...typography.caption, color: colors.textMuted, fontSize: 10, textTransform: 'uppercase', fontWeight: '800' },
  timerValue: { ...typography.bodyStrong, color: colors.textPrimary, fontSize: 12, marginTop: 3, fontVariant: ['tabular-nums'] },
  routeMetrics: { marginTop: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  routeMetricPrimary: { minWidth: 150, flex: 1, padding: spacing.sm, borderRadius: 10, borderWidth: 1, borderColor: colors.cyan, backgroundColor: 'rgba(11, 99, 243, 0.08)' },
  routeMetric: { minWidth: 105, flex: 1, padding: spacing.sm, borderRadius: 10, backgroundColor: 'rgba(15, 23, 42, 0.05)' },
  routeMetricLabel: { ...typography.caption, color: colors.textMuted, fontSize: 10, fontWeight: '800' },
  routeMetricValue: { ...typography.bodyStrong, color: colors.cyan, fontSize: 17, marginTop: 2, fontVariant: ['tabular-nums'] },
  routeMetricSmall: { ...typography.bodyStrong, color: colors.textPrimary, fontSize: 13, marginTop: 2, fontVariant: ['tabular-nums'] },
  routeMeta: { ...typography.caption, width: '100%', color: colors.textMuted, marginTop: 2 },
  warning: { ...typography.caption, color: colors.amber, marginTop: spacing.xs },
  liveSignal: { color: colors.success, fontWeight: '700' },
  gap: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
});
