import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumCard,
  PremiumInput,
  PremiumKpiCard,
  SegmentedTabs,
  SuccessState,
  type TabOption,
} from '@/components/ui';
import { useTripLogList } from '@/hooks/useTripLogList';
import { useTrackingDashboard } from '@/hooks/useTrackingDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { PURPOSE_LABELS } from '@/lib/assist';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

const MOBILITY_TABS: TabOption[] = [
  { key: 'fahrten', label: 'Fahrtenbuch' },
  { key: 'tracking', label: 'Live-Tracking' },
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MobilityScreen() {
  const [activeTab, setActiveTab] = useState('fahrten');
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();

  const trips = useTripLogList();
  const tracking = useTrackingDashboard();

  const canTrips = can('assist.trips.view');
  const canTracking = can('assist.tracking.view');

  if (!canTrips && !canTracking) {
    return (
      <ScreenShell title="Mobilität" subtitle="Kein Zugriff" showBack={false}>
        <LockedActionBanner message="Fahrtenbuch und Tracking nicht freigegeben." roleLabel={roleLabel} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Mobilität" subtitle="Fahrtenbuch & Tracking" showBack={false} scroll={false}>
      <SegmentedTabs tabs={MOBILITY_TABS} activeKey={activeTab} onSelect={setActiveTab} />

      {activeTab === 'fahrten' && canTrips ? (
        <View style={styles.panel}>
          {trips.showSuccess ? <SuccessState message="Fahrten aktualisiert." /> : null}
          {trips.loading ? <LoadingState message="Fahrten werden geladen…" /> : null}
          {trips.error ? <ErrorState message={trips.error} onRetry={trips.refresh} /> : null}
          <FlatList
            data={trips.items}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              <PremiumInput
                label="Suche"
                value={trips.search}
                onChangeText={trips.setSearch}
                placeholder="Mitarbeitende:r, Fahrzeug, Route…"
              />
            }
            ListEmptyComponent={
              !trips.loading ? (
                <EmptyState title="Keine Fahrten" message="Noch keine Fahrten erfasst." />
              ) : null
            }
            renderItem={({ item }) => (
              <PremiumCard
                accentColor={item.endedAt ? colors.cyan : colors.amber}
                onPress={() => router.push(`/assist/fahrten/${item.id}` as never)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.title}>{item.employeeName}</Text>
                  <PremiumBadge
                    label={WORKFLOW_STATUS_LABELS[item.status]}
                    variant={item.endedAt ? 'muted' : 'orange'}
                    dot
                  />
                </View>
                <Text style={styles.meta}>{PURPOSE_LABELS[item.purpose]} · {item.vehicleLabel}</Text>
                <Text style={styles.route}>{item.routeSummary}</Text>
                <Text style={styles.meta}>
                  {formatTime(item.startedAt)}
                  {item.distanceKm != null ? ` · ${item.distanceKm} km` : ' · läuft'}
                </Text>
              </PremiumCard>
            )}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={trips.refreshing}
                onRefresh={trips.refresh}
                tintColor={colors.primary}
              />
            }
          />
        </View>
      ) : null}

      {activeTab === 'tracking' && canTracking ? (
        <ScrollView contentContainerStyle={styles.trackingScroll}>
          {tracking.loading ? <LoadingState message="Tracking wird geladen…" /> : null}
          {tracking.error ? <ErrorState message={tracking.error} onRetry={tracking.refresh} /> : null}
          {tracking.data ? (
            <>
              <View style={styles.kpis}>
                <PremiumKpiCard
                  label="Aktive Fahrten"
                  value={tracking.data.activeTrips}
                  accentColor={colors.amber}
                />
                <PremiumKpiCard
                  label="Unterwegs"
                  value={tracking.data.employeesOnRoute}
                  accentColor={colors.cyan}
                />
                <PremiumKpiCard
                  label="Geofence heute"
                  value={tracking.data.geofenceAlertsToday}
                  accentColor={colors.danger}
                />
              </View>

              <Text style={styles.sectionTitle}>Live-Positionen (Demo)</Text>
              {tracking.data.positions.map((pos) => (
                <PremiumCard
                  key={pos.employeeId}
                  accentColor={pos.insideGeofence ? colors.success : colors.amber}
                >
                  <Text style={styles.title}>{pos.employeeName}</Text>
                  <Text style={styles.meta}>
                    {pos.assignmentTitle ?? 'Kein Einsatz'} · {pos.speedKmh} km/h {pos.heading}
                  </Text>
                  <Text style={styles.coords}>
                    {pos.latitude.toFixed(4)}, {pos.longitude.toFixed(4)}
                  </Text>
                  <PremiumBadge
                    label={pos.insideGeofence ? 'Im Einsatzgebiet' : 'Außerhalb'}
                    variant={pos.insideGeofence ? 'green' : 'orange'}
                    dot
                  />
                </PremiumCard>
              ))}

              <Text style={styles.sectionTitle}>Geofence-Ereignisse</Text>
              {tracking.data.recentEvents.map((event) => (
                <PremiumCard key={event.id} accentColor={colors.cyan}>
                  <Text style={styles.title}>
                    {event.type === 'enter' ? 'Eintritt' : 'Austritt'}: {event.label}
                  </Text>
                  <Text style={styles.meta}>
                    {event.employeeName} · {formatTime(event.timestamp)}
                  </Text>
                </PremiumCard>
              ))}
            </>
          ) : null}
        </ScrollView>
      ) : null}

      {activeTab === 'fahrten' && !canTrips ? (
        <LockedActionBanner
          message={check('assist.trips.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      ) : null}
      {activeTab === 'tracking' && !canTracking ? (
        <LockedActionBanner
          message={check('assist.tracking.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, marginTop: spacing.sm },
  list: { paddingBottom: spacing.xxl, gap: spacing.sm },
  trackingScroll: { paddingBottom: spacing.xxl, gap: spacing.sm, marginTop: spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  title: { ...typography.bodyStrong, flex: 1 },
  meta: { ...typography.caption, marginTop: 4 },
  route: { ...typography.body, marginTop: spacing.xs },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sectionTitle: { ...typography.h3, marginTop: spacing.md, marginBottom: spacing.xs },
  coords: { ...typography.caption, color: colors.cyan, marginTop: 4 },
});
