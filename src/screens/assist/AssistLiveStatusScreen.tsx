import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
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
import { useAssistLiveStatus } from '@/hooks/useAssistLiveStatus';
import { usePermissions } from '@/hooks/usePermissions';
import { formatTimerSeconds } from '@/lib/assist/assistLiveTrackingViewService';
import {
  GPS_TRACKING_DEMO_MESSAGE,
  GPS_TRACKING_MAP_PROVIDER_MESSAGE,
  GPS_TRACKING_BACKEND_EMPTY_MESSAGE,
  isAssistMapProviderConfigured,
  isAssistTrackingPersistenceActive,
} from '@/lib/assist/gpsTrackingConfig';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';
import { colors, spacing, typography } from '@/theme';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function AssistLiveStatusScreen() {
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const canView = can('assist.assignments.view');
  const { overview, loading, error, refresh } = useAssistLiveStatus();

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

  const rows = overview?.rows ?? [];
  const persistenceActive = isAssistTrackingPersistenceActive();
  const mapProviderReady = isAssistMapProviderConfigured();
  const hasAnyPosition = rows.some((row) => Boolean(row.tracking?.lastPosition));

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

        {overview ? (
          <View style={styles.kpiRow}>
            <PremiumBadge label={`${rows.length} Einsätze`} variant="muted" />
            <PremiumBadge label={`${overview.activeTrackingCount} Tracking aktiv`} variant="cyan" />
            <PremiumBadge label={`${overview.consentPendingCount} Einwilligung offen`} variant="orange" />
          </View>
        ) : null}

        {rows.length === 0 ? (
          <EmptyState
            title="Keine Einsätze heute"
            message="Für heute sind keine Einsätze im Live-Monitor — Tracking startet im Mitarbeiterportal."
          />
        ) : (
          rows.map((row) => (
            <PremiumCard key={row.assignmentId} accentColor={row.statusColor}>
              <View style={styles.cardHeader}>
                <Text style={styles.title}>{row.title}</Text>
                <PremiumBadge label={ASSIGNMENT_STATUS_LABELS[row.status]} variant="orange" dot />
              </View>
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
          ))
        )}

        <SectionPanel title="Kartenansicht" subtitle="Optional bei hinterlegtem Kartenanbieter">
          {!mapProviderReady ? (
            <Text style={styles.gap}>{GPS_TRACKING_MAP_PROVIDER_MESSAGE}</Text>
          ) : null}
          {persistenceActive && !hasAnyPosition ? (
            <Text style={styles.gap}>{GPS_TRACKING_BACKEND_EMPTY_MESSAGE}</Text>
          ) : null}
          {hasAnyPosition ? (
            <Text style={styles.gap}>
              Standortdaten vorhanden — eingebettete Karte folgt nach Freigabe eines Kartenanbieters.
            </Text>
          ) : null}
        </SectionPanel>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...typography.bodyStrong, flex: 1 },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  trackingBlock: { marginTop: spacing.sm, gap: 2 },
  trackingLine: { ...typography.caption, color: colors.textSecondary },
  warning: { ...typography.caption, color: colors.amber, marginTop: spacing.xs },
  gap: { ...typography.caption, color: colors.textMuted },
});
