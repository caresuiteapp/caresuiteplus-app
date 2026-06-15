import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import {
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { useTripDetail } from '@/hooks/useTripDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { PURPOSE_LABELS } from '@/lib/assist';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type TripDetailSummaryPanelProps = {
  tripId: string;
};

function statusVariant(status: string) {
  switch (status) {
    case 'in_bearbeitung':
      return 'green' as const;
    case 'abgeschlossen':
      return 'cyan' as const;
    case 'fehlerhaft':
    case 'gesperrt':
      return 'red' as const;
    default:
      return 'muted' as const;
  }
}

export function TripDetailSummaryPanel({ tripId }: TripDetailSummaryPanelProps) {
  const router = useRouter();
  const { can, isReadOnly, roleLabel } = usePermissions();
  const canManage = can('assist.trips.manage');
  const { data: trip, loading, error, refresh, notFound } = useTripDetail(tripId);

  if (loading) {
    return <LoadingState message="Fahrt wird geladen…" />;
  }

  if (notFound || error) {
    return (
      <View style={styles.panel}>
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Die Fahrt existiert nicht.'}
          onRetry={refresh}
        />
      </View>
    );
  }

  if (!trip) return null;

  const isActive = !trip.endedAt;

  return (
    <View style={styles.panel}>
      <PremiumCard accentColor={isActive ? colors.amber : colors.cyan}>
        <Text style={styles.title}>{trip.employeeName}</Text>
        <Text style={styles.vehicle}>{trip.vehicleLabel}</Text>
        <View style={styles.badges}>
          <PremiumBadge
            label={WORKFLOW_STATUS_LABELS[trip.status]}
            variant={statusVariant(trip.status)}
            dot
          />
          <PremiumBadge label={PURPOSE_LABELS[trip.purpose]} variant="muted" />
        </View>
      </PremiumCard>

      {isReadOnly ? (
        <LockedActionBanner
          title="Lesemodus"
          message="Sie können Fahrten einsehen, aber nicht abschließen."
          roleLabel={roleLabel}
        />
      ) : null}

      <SectionPanel title="Route">
        <DetailInfoRow label="Start" value={trip.startAddress} />
        <DetailInfoRow label="Ziel" value={trip.endAddress ?? 'Noch unterwegs'} />
        <DetailInfoRow
          label="Distanz"
          value={trip.distanceKm != null ? `${trip.distanceKm} km` : '—'}
        />
        {trip.notes ? <DetailInfoRow label="Notizen" value={trip.notes} /> : null}
      </SectionPanel>

      {trip.geofenceEvents.length > 0 ? (
        <SectionPanel title="Geofence">
          {trip.geofenceEvents.map((event) => (
            <Text key={event.id} style={styles.geo}>
              {event.type === 'enter' ? '▶' : '◀'} {event.label} —{' '}
              {new Date(event.timestamp).toLocaleTimeString('de-DE')}
            </Text>
          ))}
        </SectionPanel>
      ) : null}

      <PremiumButton
        title="Vollständige Fahrt öffnen"
        fullWidth
        onPress={() => router.push(`/assist/fahrten/${tripId}` as never)}
      />

      {isActive && canManage ? (
        <PremiumButton
          title="Fahrt abschließen"
          variant="secondary"
          fullWidth
          onPress={() => router.push(`/assist/fahrten/${tripId}` as never)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, padding: spacing.md, gap: spacing.md },
  title: { ...typography.h2, marginBottom: spacing.xs },
  vehicle: { ...typography.caption, marginBottom: spacing.sm },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  geo: { ...typography.caption, marginBottom: 4 },
});
