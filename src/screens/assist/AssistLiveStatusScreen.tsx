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
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumCard,
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
import { SurfaceContrastProvider } from '@/design/tokens/surfaceContrast';
import { spacing, typography } from '@/theme';
import { decodeGooglePolyline } from '@/features/liveTracking/googleRouteReference';

type MetricTone = 'neutral' | 'blue' | 'cyan' | 'green' | 'orange';

const METRIC_TONES: Record<MetricTone, { border: string; surface: string; accent: string }> = {
  neutral: { border: 'rgba(166,205,236,0.26)', surface: 'rgba(10,39,70,0.76)', accent: '#D9EEFF' },
  blue: { border: 'rgba(38,144,255,0.42)', surface: 'rgba(7,67,128,0.54)', accent: '#62B8FF' },
  cyan: { border: 'rgba(70,220,255,0.42)', surface: 'rgba(4,83,107,0.46)', accent: '#71E8FF' },
  green: { border: 'rgba(53,224,174,0.4)', surface: 'rgba(2,91,73,0.42)', accent: '#5CE6B8' },
  orange: { border: 'rgba(255,178,68,0.42)', surface: 'rgba(111,63,2,0.42)', accent: '#FFBC59' },
};

function LiveMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number | string;
  detail: string;
  tone: MetricTone;
}) {
  const palette = METRIC_TONES[tone];
  return (
    <View style={[styles.metricCard, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      <View style={[styles.metricDot, { backgroundColor: palette.accent }]} />
      <Text style={[styles.metricValue, { color: palette.accent }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </View>
  );
}

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

function formatRouteDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safeSeconds / 3_600);
  const minutes = Math.floor((safeSeconds % 3_600) / 60);
  if (hours > 0) return `${hours} Std. ${minutes} Min.`;
  return `${minutes} Min.`;
}

function formatRouteDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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
  if (ageSeconds < 45) return `Live · vor ${ageSeconds} Sek.`;
  if (ageSeconds < 90) return `Signal verzögert · vor ${ageSeconds} Sek.`;
  return `GPS unterbrochen · vor ${Math.max(1, Math.round(ageSeconds / 60))} Min.`;
}

function isFresh(iso: string | null | undefined, nowMs: number, maxAgeMs = 45_000): boolean {
  if (!iso) return false;
  const timestamp = new Date(iso).getTime();
  return Number.isFinite(timestamp) && nowMs - timestamp < maxAgeMs;
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

  const mapSignalLive = Boolean(
    mapRow?.tracking?.trackingActive &&
    isFresh(mapRow.tracking.lastPosition?.capturedAt, clockMs) &&
    isFresh(mapRow.tracking.deviceHeartbeatAt, clockMs),
  );

  const plannedRoutePoints = useMemo(() => {
    const reference = mapRow?.tracking?.googleRouteReference;
    return decodeGooglePolyline(reference?.encodedPolyline).map((point) => ({
      ...point,
      capturedAt: reference?.requestedAt ?? '',
      accuracyMeters: null,
    }));
  }, [mapRow?.tracking?.googleRouteReference]);

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
    <View style={styles.commandPanel}>
      <View style={styles.panelHeader}>
        <View style={styles.panelTitleBlock}>
          <Text style={styles.panelEyebrow}>EINSATZSTEUERUNG</Text>
          <Text style={styles.panelTitle}>Heutige Einsätze</Text>
          <Text style={styles.panelSubtitle}>Status, Zeit und Route der laufenden Tagesplanung</Text>
        </View>
        <View style={styles.panelCount}><Text style={styles.panelCountText}>{rows.length}</Text></View>
      </View>
      {rows.length === 0 ? (
        <View style={styles.emptyOperation}>
          <View style={styles.radarStage}>
            <View style={styles.radarRingLarge} />
            <View style={styles.radarRingMedium} />
            <View style={styles.radarRingSmall} />
            <View style={styles.radarCore}><Text style={styles.radarCoreText}>✓</Text></View>
          </View>
          <View style={styles.emptyCopy}>
            <Text style={styles.emptyTitle}>Heute ist noch kein Einsatz geplant</Text>
            <Text style={styles.emptyMessage}>
              Sobald ein Einsatz beginnt, erscheinen hier Mitarbeitende, Live-Zeiten, GPS-Status und Routenfortschritt.
            </Text>
          </View>
          <Pressable onPress={refresh} style={({ pressed }) => [styles.refreshAction, pressed && styles.actionPressed]}>
            <Text style={styles.refreshActionText}>Tagesplanung aktualisieren</Text>
            <Text style={styles.refreshActionIcon}>↻</Text>
          </Pressable>
        </View>
      ) : (
        <SurfaceContrastProvider tone="light">
          <View
            style={styles.assignmentList}
            {...(Platform.OS === 'web'
              ? ({ dataSet: { csAssistReadableSurface: 'light' } } as object)
              : {})}
          >
            {rows.map((row) => {
              const isSelected = row.assignmentId === (selectedAssignmentId ?? mapRow?.assignmentId);
              return (
                <Pressable
                  key={row.assignmentId}
                  onPress={() => setSelectedAssignmentId(row.assignmentId)}
                  accessibilityRole="button"
                >
                  <PremiumCard
                    accentColor={row.statusColor}
                    style={[styles.assignmentCard, isSelected && styles.selectedCard]}
                  >
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
                        clockMs - new Date(row.tracking.lastPosition.capturedAt).getTime() > 45_000
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
                          isFresh(row.tracking.lastPosition.capturedAt, clockMs) &&
                          isFresh(row.tracking.deviceHeartbeatAt, clockMs)
                          ? ' · GPS und Gerät live'
                          : ' · Aufzeichnung unterbrochen'
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
                          <Text style={styles.routeMetricLabel}>Gefahrene Strecke</Text>
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
            })}
          </View>
        </SurfaceContrastProvider>
      )}
    </View>
  );

  const mapPanel = (
    <View style={styles.commandPanel}>
      <View style={styles.panelHeader}>
        <View style={styles.panelTitleBlock}>
          <Text style={styles.panelEyebrow}>POSITIONSMONITOR</Text>
          <Text style={styles.panelTitle}>
            {mapSignalLive ? 'Live-Karte' : mapRow?.route ? 'Streckenkarte & GPS-Verlauf' : 'Live-Karte'}
          </Text>
          <Text style={styles.panelSubtitle}>
            {mapProviderReady
              ? mapRow?.route
                ? 'Aufgezeichnete GPS-Spur mit Qualitäts- und Lückenprüfung'
                : 'Standorte und Routen aktiver Einsätze'
              : 'Kartendienst derzeit nicht verfügbar'}
          </Text>
        </View>
        <View style={[styles.mapState, mapSignalLive ? styles.mapStateLive : styles.mapStateWaiting]}>
          <View style={[styles.mapStateDot, mapSignalLive ? styles.mapStateDotLive : styles.mapStateDotWaiting]} />
          <Text style={styles.mapStateText}>
            {mapSignalLive ? 'LIVE' : mapRow?.tracking?.trackingActive ? 'UNTERBROCHEN' : mapRow?.route ? 'VERLAUF' : 'BEREIT'}
          </Text>
        </View>
      </View>
      {!mapProviderReady ? (
        <View style={styles.mapUnavailable}>
          <Text style={styles.mapUnavailableIcon}>!</Text>
          <Text style={styles.mapUnavailableText}>Standorte bleiben in der Einsatzliste sichtbar.</Text>
        </View>
      ) : (
        <AssistLiveMap
          position={mapPosition}
          markers={mapMarkers}
          routePoints={mapRow?.route?.points ?? []}
          routeSegments={mapRow?.route?.segments ?? []}
          plannedRoutePoints={plannedRoutePoints}
          routeIdentity={mapRow?.assignmentId ?? null}
          selectedMarkerId={selectedAssignmentId ?? mapRow?.assignmentId ?? null}
          onMarkerSelect={setSelectedAssignmentId}
          markerLabel={mapRow?.title ?? undefined}
          demoMode={demoMapPreview && !mapRow?.tracking?.lastPosition}
          fallbackMessage={GPS_TRACKING_BACKEND_EMPTY_MESSAGE}
          height={splitLayout ? 360 : 300}
          tenantId={tenantId}
        />
      )}
      {mapRow?.route ? (
        <View style={styles.routeAuditPanel}>
          <View style={styles.routeAuditHeader}>
            <View style={styles.routeAuditTitleBlock}>
              <Text style={styles.routeAuditEyebrow}>GPS-STRECKENPRÜFUNG</Text>
              <Text style={styles.routeAuditTitle}>Aufzeichnung im Detail</Text>
              <Text style={styles.routeAuditSubtitle}>
                {mapRow.employeeName ?? 'Mitarbeitende'} · {mapRow.title}
              </Text>
            </View>
            <View style={[styles.routeQualityBadge, mapRow.route.gapCount > 0 && styles.routeQualityBadgeWarning]}>
              <Text style={[styles.routeQualityText, mapRow.route.gapCount > 0 && styles.routeQualityTextWarning]}>
                {mapRow.route.gapCount > 0 ? `${mapRow.route.gapCount} GPS-Lücke${mapRow.route.gapCount === 1 ? '' : 'n'}` : 'Spur durchgängig'}
              </Text>
            </View>
          </View>

          <View style={styles.routeAuditGrid}>
            <View style={styles.routeAuditCell}>
              <Text style={styles.routeAuditLabel}>Beginn</Text>
              <Text style={styles.routeAuditValue}>{formatRouteDateTime(mapRow.route.startedAt)}</Text>
            </View>
            {mapRow.tracking?.googleRouteReference ? (
              <View style={styles.routeAuditCell}>
                <Text style={styles.routeAuditLabel}>Google-Sollroute</Text>
                <Text style={styles.routeAuditValue}>
                  {mapRow.tracking.googleRouteReference.distanceMeters != null
                    ? formatDistance(mapRow.tracking.googleRouteReference.distanceMeters / 1000)
                    : 'nicht verfügbar'}
                  {mapRow.tracking.googleRouteReference.durationMinutes != null
                    ? ` · ca. ${mapRow.tracking.googleRouteReference.durationMinutes} Min.`
                    : ''}
                </Text>
              </View>
            ) : null}
            <View style={styles.routeAuditCell}>
              <Text style={styles.routeAuditLabel}>Letzter GPS-Punkt</Text>
              <Text style={styles.routeAuditValue}>{formatRouteDateTime(mapRow.route.updatedAt)}</Text>
            </View>
            <View style={styles.routeAuditCell}>
              <Text style={styles.routeAuditLabel}>Messdauer / Bewegung</Text>
              <Text style={styles.routeAuditValue}>
                {formatRouteDuration(mapRow.route.durationSeconds)} / {formatRouteDuration(mapRow.route.movementDurationSeconds)}
              </Text>
            </View>
            <View style={styles.routeAuditCell}>
              <Text style={styles.routeAuditLabel}>GPS-Punkte</Text>
              <Text style={styles.routeAuditValue}>
                {mapRow.route.acceptedPointCount} verwendbar · {mapRow.route.discardedPointCount} verworfen
              </Text>
            </View>
            <View style={styles.routeAuditCell}>
              <Text style={styles.routeAuditLabel}>Bewegung / Stillstand</Text>
              <Text style={styles.routeAuditValue}>
                {mapRow.route.acceptedMovementCount} Abschnitte · {mapRow.route.stationaryPointCount} Stillstandspunkte
              </Text>
            </View>
            <View style={styles.routeAuditCell}>
              <Text style={styles.routeAuditLabel}>GPS-Spuren / längste Lücke</Text>
              <Text style={styles.routeAuditValue}>
                {mapRow.route.segments.length} Spuren · {mapRow.route.maxGapSeconds > 0 ? formatRouteDuration(mapRow.route.maxGapSeconds) : 'keine Lücke'}
              </Text>
            </View>
          </View>

          <View style={[styles.routeAuditNotice, mapRow.route.gapCount > 0 && styles.routeAuditNoticeWarning]}>
            <Text style={[styles.routeAuditNoticeText, mapRow.route.gapCount > 0 && styles.routeAuditNoticeTextWarning]}>
              {mapRow.route.gapCount > 0
                ? mapRow.tracking?.googleRouteReference?.source === 'google'
                  ? 'GPS-Unterbrechungen werden nicht mehr durch Luftlinien verbunden. Blau zeigt gemessene GPS-Abschnitte; die orange gestrichelte Google-Sollroute dient als klar gekennzeichneter Kilometer-Abgleich.'
                  : 'GPS-Unterbrechungen werden nicht mehr durch Luftlinien verbunden. Es liegt noch keine Google-Sollroute für einen automatischen Kilometer-Abgleich vor.'
                : 'Die blaue Linie zeigt die zeitlich zusammenhängende GPS-Spur. Manuelles Zoomen und Verschieben bleiben bei Live-Aktualisierungen erhalten.'}
            </Text>
          </View>
        </View>
      ) : null}
      {persistenceActive && rows.length > 0 && !mapRow?.tracking?.lastPosition && !demoMapPreview ? (
        <Text style={styles.gap}>{GPS_TRACKING_BACKEND_EMPTY_MESSAGE}</Text>
      ) : null}
    </View>
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
        <View
          style={styles.operationsHero}
          {...(Platform.OS === 'web'
            ? ({ dataSet: { healthosLiveStatusRevision: 'r7' } } as object)
            : {})}
        >
          <View style={styles.operationsHeroGlow} />
          <View style={styles.operationsHeroMain}>
            <View style={styles.operationsIcon}><Text style={styles.operationsIconText}>◎</Text></View>
            <View style={styles.operationsHeroCopy}>
              <Text style={styles.operationsEyebrow}>ASSIST · OPERATIVER LEITSTAND</Text>
              <Text style={styles.operationsTitle}>Einsätze in Echtzeit im Blick</Text>
              <Text style={styles.operationsDescription}>
                {overview?.readOnlyNotice ?? 'Status, Live-Zeiten und Standorte werden aus dem Mitarbeiterportal übernommen.'}
              </Text>
            </View>
          </View>
          <View style={styles.heroActions}>
            <View style={styles.syncStatus}>
              <View style={styles.syncDot} />
              <View>
                <Text style={styles.syncLabel}>MONITOR AKTIV</Text>
                <Text style={styles.syncTime}>
                  {overview?.generatedAt ? `Stand ${formatTime(overview.generatedAt)} Uhr` : 'Wartet auf Tagesdaten'}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={refresh}
              accessibilityRole="button"
              accessibilityLabel="Live-Status aktualisieren"
              style={({ pressed }) => [styles.heroRefresh, pressed && styles.actionPressed]}
            >
              <Text style={styles.heroRefreshIcon}>↻</Text>
              <Text style={styles.heroRefreshText}>Aktualisieren</Text>
            </Pressable>
          </View>
        </View>

        {!persistenceActive || error ? (
          <View style={[styles.systemNotice, error && styles.systemNoticeError]}>
            <View style={styles.systemNoticeIcon}><Text style={styles.systemNoticeIconText}>!</Text></View>
            <View style={styles.systemNoticeCopy}>
              <Text style={styles.systemNoticeTitle}>{error ? 'Daten teilweise nicht verfügbar' : 'Tracking-Persistenz'}</Text>
              <Text style={styles.systemNoticeText}>{error ?? GPS_TRACKING_DEMO_MESSAGE}</Text>
            </View>
          </View>
        ) : null}

        {overview ? (
          <View style={styles.kpiRow}>
            <LiveMetric label="Einsätze heute" value={overview.todayCount} detail="gesamte Tagesplanung" tone="neutral" />
            <LiveMetric label="Aktuell laufend" value={overview.runningCount} detail="Anfahrt oder Durchführung" tone="orange" />
            <LiveMetric label="Tracking aktiv" value={overview.activeTrackingCount} detail="Mitarbeiterportal verbunden" tone="cyan" />
            <LiveMetric label="GPS-Signale live" value={overview.freshGpsCount} detail="innerhalb des Live-Fensters" tone="green" />
            <LiveMetric
              label="Kartendienst"
              value={mapProviderReady ? 'Bereit' : 'Offline'}
              detail={isGoogleMapsConfigured() ? 'Google Maps verbunden' : 'Kartenansicht vorbereitet'}
              tone={mapProviderReady ? 'blue' : 'neutral'}
            />
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
  scroll: { paddingBottom: spacing.xxl, gap: 16 },
  operationsHero: {
    position: 'relative',
    overflow: 'hidden',
    minHeight: 134,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(102,216,255,0.4)',
    backgroundColor: '#071F3D',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 18,
    shadowColor: '#31C9FF',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  operationsHeroGlow: {
    position: 'absolute',
    width: 360,
    height: 190,
    borderRadius: 190,
    right: -90,
    top: -90,
    backgroundColor: 'rgba(35,153,226,0.16)',
  },
  operationsHeroMain: { flex: 1, minWidth: 320, flexDirection: 'row', alignItems: 'center', gap: 16 },
  operationsIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(107,231,255,0.5)',
    backgroundColor: 'rgba(25,137,197,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  operationsIconText: { color: '#79E7FF', fontSize: 34, lineHeight: 38, fontWeight: '500' },
  operationsHeroCopy: { flex: 1, minWidth: 0, gap: 4 },
  operationsEyebrow: { color: '#75E4FF', fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1.8 },
  operationsTitle: { color: '#FFFFFF', fontSize: 24, lineHeight: 30, fontWeight: '900', letterSpacing: -0.3 },
  operationsDescription: { color: '#B6CCE0', fontSize: 12, lineHeight: 18, maxWidth: 720 },
  heroActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  syncStatus: {
    minHeight: 52,
    paddingHorizontal: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(68,225,179,0.35)',
    backgroundColor: 'rgba(7,84,68,0.34)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  syncDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#4DE2B0', shadowColor: '#4DE2B0', shadowOpacity: 0.8, shadowRadius: 8 },
  syncLabel: { color: '#BDF9E6', fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1.1 },
  syncTime: { color: '#8EB7AD', fontSize: 10, lineHeight: 14, marginTop: 2 },
  heroRefresh: {
    minHeight: 52,
    paddingHorizontal: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(117,220,255,0.44)',
    backgroundColor: 'rgba(12,71,116,0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroRefreshIcon: { color: '#7BE5FF', fontSize: 20, lineHeight: 22 },
  heroRefreshText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  actionPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  systemNotice: {
    minHeight: 68,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,185,77,0.38)',
    backgroundColor: 'rgba(87,52,4,0.34)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  systemNoticeError: { borderColor: 'rgba(255,105,113,0.4)', backgroundColor: 'rgba(105,24,33,0.34)' },
  systemNoticeIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(255,184,70,0.18)', alignItems: 'center', justifyContent: 'center' },
  systemNoticeIconText: { color: '#FFC468', fontSize: 16, fontWeight: '900' },
  systemNoticeCopy: { flex: 1, minWidth: 0 },
  systemNoticeTitle: { color: '#FFFFFF', fontSize: 13, lineHeight: 17, fontWeight: '900' },
  systemNoticeText: { color: '#C9D7E5', fontSize: 11, lineHeight: 17, marginTop: 2 },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    flex: 1,
    minWidth: 165,
    minHeight: 106,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    position: 'relative',
  },
  metricDot: { position: 'absolute', top: 14, right: 14, width: 8, height: 8, borderRadius: 4 },
  metricValue: { fontSize: 23, lineHeight: 28, fontWeight: '900', fontVariant: ['tabular-nums'] },
  metricLabel: { color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontWeight: '900', marginTop: 4 },
  metricDetail: { color: '#93ADC4', fontSize: 9, lineHeight: 13, marginTop: 3 },
  splitRow: { flexDirection: 'row', gap: 16, alignItems: 'stretch' },
  listColumn: { flex: 1, minWidth: 360 },
  mapColumn: { flex: 1, minWidth: 360 },
  commandPanel: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(121,213,255,0.34)',
    backgroundColor: 'rgba(5,28,55,0.94)',
    padding: 16,
    gap: 14,
    overflow: 'hidden',
  },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 57 },
  panelTitleBlock: { flex: 1, minWidth: 0 },
  panelEyebrow: { color: '#6DDFFF', fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1.5 },
  panelTitle: { color: '#FFFFFF', fontSize: 19, lineHeight: 24, fontWeight: '900', marginTop: 2 },
  panelSubtitle: { color: '#91ADC5', fontSize: 10, lineHeight: 14, marginTop: 2 },
  panelCount: { minWidth: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(44,164,224,0.18)', borderWidth: 1, borderColor: 'rgba(102,220,255,0.34)', alignItems: 'center', justifyContent: 'center' },
  panelCountText: { color: '#7DE6FF', fontSize: 13, fontWeight: '900' },
  assignmentList: { gap: 10 },
  assignmentCard: { backgroundColor: '#F7FBFF', borderColor: '#C9E2F6' },
  selectedCard: { borderWidth: 2, borderColor: '#1DA7EA', backgroundColor: '#EFF9FF' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...typography.bodyStrong, color: '#0A223D', flex: 1, fontSize: 15, lineHeight: 20 },
  meta: { ...typography.caption, color: '#526B83', marginTop: spacing.xs },
  trackingBlock: { marginTop: spacing.sm, gap: 3 },
  trackingLine: { ...typography.caption, color: '#39546D' },
  timerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  timerCell: { minWidth: 145, flex: 1, padding: spacing.sm, borderRadius: 12, borderWidth: 1, borderColor: '#D8E8F5', backgroundColor: '#EDF5FC' },
  timerLabel: { ...typography.caption, color: '#607A92', fontSize: 9, textTransform: 'uppercase', fontWeight: '900', letterSpacing: 0.7 },
  timerValue: { ...typography.bodyStrong, color: '#0A223D', fontSize: 12, marginTop: 3, fontVariant: ['tabular-nums'] },
  routeMetrics: { marginTop: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  routeMetricPrimary: { minWidth: 145, flex: 1, padding: spacing.sm, borderRadius: 12, borderWidth: 1, borderColor: '#4BB9ED', backgroundColor: '#E5F6FF' },
  routeMetric: { minWidth: 105, flex: 1, padding: spacing.sm, borderRadius: 12, backgroundColor: '#EDF5FC' },
  routeMetricLabel: { ...typography.caption, color: '#607A92', fontSize: 9, fontWeight: '900' },
  routeMetricValue: { ...typography.bodyStrong, color: '#087DC1', fontSize: 17, marginTop: 2, fontVariant: ['tabular-nums'] },
  routeMetricSmall: { ...typography.bodyStrong, color: '#0A223D', fontSize: 13, marginTop: 2, fontVariant: ['tabular-nums'] },
  routeMeta: { ...typography.caption, width: '100%', color: '#607A92', marginTop: 2 },
  warning: { ...typography.caption, color: '#B76500', marginTop: spacing.xs, fontWeight: '700' },
  liveSignal: { color: '#008B68', fontWeight: '900' },
  emptyOperation: {
    flex: 1,
    minHeight: 360,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(112,202,244,0.18)',
    backgroundColor: 'rgba(2,17,36,0.62)',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  radarStage: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center' },
  radarRingLarge: { position: 'absolute', width: 112, height: 112, borderRadius: 56, borderWidth: 1, borderColor: 'rgba(93,221,255,0.15)' },
  radarRingMedium: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: 'rgba(93,221,255,0.23)' },
  radarRingSmall: { position: 'absolute', width: 50, height: 50, borderRadius: 25, borderWidth: 1, borderColor: 'rgba(93,221,255,0.34)' },
  radarCore: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#117EC1', borderWidth: 1, borderColor: '#73E2FF', alignItems: 'center', justifyContent: 'center', shadowColor: '#4FD9FF', shadowOpacity: 0.55, shadowRadius: 13 },
  radarCoreText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  emptyCopy: { alignItems: 'center', maxWidth: 500, gap: 6 },
  emptyTitle: { color: '#FFFFFF', fontSize: 18, lineHeight: 23, fontWeight: '900', textAlign: 'center' },
  emptyMessage: { color: '#9EB7CB', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  refreshAction: { minHeight: 44, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(100,219,255,0.42)', backgroundColor: 'rgba(13,91,145,0.64)', flexDirection: 'row', alignItems: 'center', gap: 9 },
  refreshActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  refreshActionIcon: { color: '#83E8FF', fontSize: 17 },
  mapState: { height: 32, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  mapStateLive: { borderColor: 'rgba(67,225,179,0.38)', backgroundColor: 'rgba(5,100,77,0.36)' },
  mapStateWaiting: { borderColor: 'rgba(104,211,255,0.32)', backgroundColor: 'rgba(9,71,108,0.42)' },
  mapStateDot: { width: 7, height: 7, borderRadius: 4 },
  mapStateDotLive: { backgroundColor: '#4BE1AE' },
  mapStateDotWaiting: { backgroundColor: '#72DFFF' },
  mapStateText: { color: '#DDF8FF', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  mapUnavailable: { minHeight: 300, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,185,77,0.3)', backgroundColor: 'rgba(83,52,8,0.28)', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20 },
  mapUnavailableIcon: { color: '#FFC15B', fontSize: 22, fontWeight: '900' },
  mapUnavailableText: { color: '#CBD8E4', fontSize: 12, textAlign: 'center' },
  routeAuditPanel: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#B8D7EE',
    backgroundColor: '#F7FBFF',
    padding: 14,
    gap: 12,
  },
  routeAuditHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  routeAuditTitleBlock: { flex: 1, minWidth: 220 },
  routeAuditEyebrow: { color: '#0879BD', fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1.2 },
  routeAuditTitle: { color: '#071F3D', fontSize: 17, lineHeight: 22, fontWeight: '900', marginTop: 2 },
  routeAuditSubtitle: { color: '#4B6680', fontSize: 11, lineHeight: 16, marginTop: 2 },
  routeQualityBadge: { borderRadius: 999, borderWidth: 1, borderColor: '#8DD9C1', backgroundColor: '#E6F8F2', paddingHorizontal: 10, paddingVertical: 6 },
  routeQualityBadgeWarning: { borderColor: '#E9B86E', backgroundColor: '#FFF5E5' },
  routeQualityText: { color: '#08775C', fontSize: 10, lineHeight: 13, fontWeight: '900' },
  routeQualityTextWarning: { color: '#945000' },
  routeAuditGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  routeAuditCell: { flex: 1, minWidth: 175, borderRadius: 11, borderWidth: 1, borderColor: '#D4E5F2', backgroundColor: '#FFFFFF', padding: 10 },
  routeAuditLabel: { color: '#5A7187', fontSize: 9, lineHeight: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeAuditValue: { color: '#102A43', fontSize: 11, lineHeight: 16, fontWeight: '800', marginTop: 3, fontVariant: ['tabular-nums'] },
  routeAuditNotice: { borderRadius: 10, backgroundColor: '#EAF8F4', borderWidth: 1, borderColor: '#B7E3D5', padding: 10 },
  routeAuditNoticeWarning: { backgroundColor: '#FFF6E8', borderColor: '#EDC98E' },
  routeAuditNoticeText: { color: '#225B4C', fontSize: 10, lineHeight: 16, fontWeight: '700' },
  routeAuditNoticeTextWarning: { color: '#7B4A09' },
  gap: { ...typography.caption, color: '#9BB4C9', marginTop: spacing.sm },
});
