import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo, useState } from 'react';
import { LockedActionBanner } from '@/components/permissions';
import { TrackingEventCard } from './TrackingEventCard';
import { TrackingListHero } from './TrackingListHero';
import { TrackingPositionCard } from './TrackingPositionCard';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  InfoBanner,
  LoadingState,
  PremiumInput,
  SuccessState,
} from '@/components/ui';
import { GPS_TRACKING_PREPARED_MESSAGE, isGpsTrackingLiveReady } from '@/lib/assist/gpsTrackingConfig';
import { buildTrackingKpis } from '@/data/demo/trackingStats';
import { useTrackingDashboard } from '@/hooks/useTrackingDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { colors, spacing, typography } from '@/theme';

type GeofenceFilter = 'all' | 'inside' | 'outside';

const GEOFENCE_FILTERS: { key: GeofenceFilter; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'inside', label: 'Im Gebiet' },
  { key: 'outside', label: 'Außerhalb' },
];

type TrackingListViewProps = {
  embedded?: boolean;
};

export function TrackingListView({ embedded = false }: TrackingListViewProps) {
  const { profile } = useAuth();
  const { can, isReadOnly, roleLabel, check } = usePermissions();
  const { shellVariant } = usePlatformLayout();
  const canView = can('assist.tracking.view');
  const roleKey = profile?.roleKey ?? 'caregiver';

  const { data, loading, error, refreshing, refresh } = useTrackingDashboard();
  const [search, setSearch] = useState('');
  const [geofenceFilter, setGeofenceFilter] = useState<GeofenceFilter>('all');
  const [showSuccess, setShowSuccess] = useState(false);

  const kpis = useMemo(() => (data ? buildTrackingKpis(data) : []), [data]);

  const filteredPositions = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.positions.filter((pos) => {
      if (geofenceFilter === 'inside' && !pos.insideGeofence) return false;
      if (geofenceFilter === 'outside' && pos.insideGeofence) return false;
      if (!q) return true;
      const haystack = [
        pos.employeeName,
        pos.assignmentTitle ?? '',
        pos.heading,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [data, search, geofenceFilter]);

  const filteredEvents = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.recentEvents;
    return data.recentEvents.filter((event) => {
      const haystack = [event.employeeName, event.label, event.type].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [data, search]);

  const handleRefresh = async () => {
    await refresh();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2500);
  };

  if (!canView) {
    return (
      <LockedActionBanner
        message={check('assist.tracking.view').reason ?? 'Keine Berechtigung.'}
        roleLabel={roleLabel}
      />
    );
  }

  const compactHero = embedded || shellVariant === 'desktop';
  const positionCount = data?.positions.length ?? 0;
  const eventCount = data?.recentEvents.length ?? 0;
  const gpsPreparedOnly = !isGpsTrackingLiveReady();

  const toolbar = (
    <View style={styles.toolbar}>
      {embedded ? (
        <View style={styles.embeddedHeader}>
          <Text style={styles.embeddedTitle}>Live-Tracking</Text>
          <Text style={styles.embeddedMeta}>
            {filteredPositions.length} Positionen · {filteredEvents.length} Ereignisse
          </Text>
        </View>
      ) : (
        <TrackingListHero
          kpis={kpis}
          roleKey={roleKey}
          positionCount={positionCount}
          eventCount={eventCount}
          isReadOnly={isReadOnly}
          compact={compactHero}
        />
      )}

      {showSuccess ? <SuccessState message="Tracking-Daten aktualisiert." /> : null}

      {gpsPreparedOnly ? (
        <InfoBanner
          variant="warning"
          title="GPS extern"
          message={GPS_TRACKING_PREPARED_MESSAGE}
        />
      ) : null}

      <PremiumInput
        label="Suche"
        placeholder="Mitarbeitende:r, Einsatz, Geofence…"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="words"
        autoCorrect={false}
        hint={`${filteredPositions.length} Positionen · ${filteredEvents.length} Ereignisse`}
      />

      <Text style={styles.filterLabel}>Geofence-Status</Text>
      <FilterChipGroup
        options={GEOFENCE_FILTERS}
        value={geofenceFilter}
        onChange={(value) => setGeofenceFilter(value as GeofenceFilter)}
      />
    </View>
  );

  if (loading && !data) {
    return (
      <View style={styles.container}>
        {!embedded ? toolbar : null}
        <LoadingState message="Tracking-Daten werden geladen…" />
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.container}>
        <ErrorState message={error} onRetry={refresh} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.container}>
        {toolbar}
        <EmptyState title="Keine Tracking-Daten" message="Tracking-Dashboard nicht verfügbar." />
      </View>
    );
  }

  const hasActiveFilters = geofenceFilter !== 'all' || search.trim().length > 0;
  const isEmpty = filteredPositions.length === 0 && filteredEvents.length === 0;

  const listContent = (
    <>
      {toolbar}
      {isEmpty ? (
        <EmptyState
          title={hasActiveFilters ? 'Keine Treffer' : 'Keine Tracking-Daten'}
          message={
            hasActiveFilters
              ? 'Für Ihre Suche oder Filter wurden keine Positionen oder Ereignisse gefunden.'
              : 'Derzeit keine Live-Positionen oder Geofence-Ereignisse.'
          }
        />
      ) : (
        <>
          <Text style={styles.sectionTitle}>Live-Positionen</Text>
          {filteredPositions.map((pos) => (
            <TrackingPositionCard key={pos.employeeId} position={pos} />
          ))}

          <Text style={styles.sectionTitle}>Geofence-Ereignisse</Text>
          {filteredEvents.length === 0 ? (
            <Text style={styles.emptyEvents}>Keine Ereignisse für den aktuellen Filter.</Text>
          ) : (
            filteredEvents.map((event) => <TrackingEventCard key={event.id} event={event} />)
          )}
        </>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {listContent}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  toolbar: { gap: spacing.sm, marginBottom: spacing.md },
  filterLabel: { ...typography.label, marginTop: spacing.xs },
  list: { paddingBottom: spacing.xxl, gap: spacing.sm },
  sectionTitle: { ...typography.h3, marginTop: spacing.md, marginBottom: spacing.xs },
  emptyEvents: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  embeddedHeader: {
    marginBottom: spacing.xs,
    paddingRight: spacing.xxl,
  },
  embeddedTitle: { ...typography.h3 },
  embeddedMeta: { ...typography.caption, color: colors.textMuted },
});
