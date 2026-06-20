import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { useTripDetail } from '@/hooks/useTripDetail';
import { PURPOSE_LABELS } from '@/lib/assist';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

export function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: trip, loading, error, actionLoading, successMessage, refresh, completeTrip, notFound } =
    useTripDetail(id);

  if (loading) {
    return (
      <ScreenShell title="Fahrt" subtitle="Wird geladen…">
        <LoadingState message="Fahrtdetails werden geladen…" />
      </ScreenShell>
    );
  }

  if (notFound || error) {
    return (
      <ScreenShell title="Fahrt" subtitle="Fehler">
        <ErrorState message={error ?? 'Fahrt nicht gefunden.'} onRetry={refresh} />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  if (!trip) return null;

  const isActive = !trip.endedAt;

  return (
    <ScreenShell title="Fahrt" subtitle={trip.employeeName}>
      {successMessage ? <SuccessState message={successMessage} /> : null}

      <ScrollView contentContainerStyle={styles.scroll}>
        <PremiumCard accentColor={isActive ? colors.amber : colors.cyan}>
          <PremiumBadge label={WORKFLOW_STATUS_LABELS[trip.status]} variant="muted" dot />
          <Text style={styles.vehicle}>{trip.vehicleLabel}</Text>
          <Text style={styles.purpose}>{PURPOSE_LABELS[trip.purpose]}</Text>
        </PremiumCard>

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
            {trip.geofenceEvents.map((e) => (
              <Text key={e.id} style={styles.geo}>
                {e.type === 'enter' ? '▶' : '◀'} {e.label} — {new Date(e.timestamp).toLocaleTimeString('de-DE')}
              </Text>
            ))}
          </SectionPanel>
        ) : null}

        {isActive ? (
          <PremiumButton
            title="Fahrt abschließen (Demo)"
            fullWidth
            loading={actionLoading}
            onPress={() =>
              completeTrip({ endAddress: 'Ziel erreicht (Demo)', distanceKm: 6.5 })
            }
          />
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  vehicle: { ...typography.h3, marginTop: spacing.sm },
  purpose: { ...typography.caption },
  geo: { ...typography.caption, marginBottom: 4 },
});
