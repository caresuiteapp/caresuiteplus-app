import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import {
  berlinDateKey,
  berlinToday,
  loadEmployeeLogbook,
  resolveEmployeeLogbookEligibility,
} from '@/lib/employeeLogbook';
import type { EmployeeLogbookBundle } from '@/types/modules/employeeLogbook';
import { TRAVEL_ROUTE_TYPE_LABELS } from '@/types/modules/travelCompensation';
import {
  LiquidButton,
  LiquidMetric,
  LiquidStatus,
  LiquidSurface,
  LiquidText,
} from './LiquidPrimitives';
import { liquidSpace } from '../foundation/tokens';

type LogbookWidgetData = {
  eligible: boolean;
  reason: 'eligible' | 'no_car_mode' | 'no_active_vehicle';
  bundle: EmployeeLogbookBundle | null;
};

/** One canonical dashboard entry point for the complete employee logbook module. */
export function EmployeeLogbookWidget() {
  const actor = usePortalActor();
  const router = useRouter();
  const query = useAsyncQuery<LogbookWidgetData>(
    useCallback(async () => {
      if (!actor.tenantId || !actor.employeeId) {
        return { ok: false as const, error: 'Mitarbeitendenkonto ist nicht vollständig verknüpft.' };
      }
      const eligibility = await resolveEmployeeLogbookEligibility(
        actor.tenantId,
        actor.employeeId,
      );
      if (!eligibility.eligible) {
        return {
          ok: true as const,
          data: { eligible: false, reason: eligibility.reason, bundle: null },
        };
      }
      const bundle = await loadEmployeeLogbook(actor.tenantId, actor.employeeId);
      return {
        ok: true as const,
        data: { eligible: true, reason: 'eligible' as const, bundle },
      };
    }, [actor.tenantId, actor.employeeId]),
    [actor.tenantId, actor.employeeId],
    { enabled: actor.isReady && Boolean(actor.tenantId && actor.employeeId) },
  );

  if (!actor.isReady) return null;
  if (query.error) {
    return (
      <LiquidSurface active accessibilityLabel="Fahrtenbuch nicht verfügbar" contentStyle={styles.card}>
        <LiquidText variant="kicker">EIGENES MODUL · FAHRTENBUCH</LiquidText>
        <LiquidText variant="section">Fahrtenbuch momentan nicht verfügbar</LiquidText>
        <LiquidText variant="body">{query.error}</LiquidText>
        <LiquidButton compact label="Fahrtenbuch öffnen" icon="›" onPress={() => router.push('/portal/employee/fahrtenbuch' as never)} />
      </LiquidSurface>
    );
  }
  if (query.loading || !query.data) {
    return (
      <LiquidSurface active accessibilityLabel="Fahrtenbuch wird geladen" contentStyle={styles.card}>
        <LiquidText variant="kicker">EIGENES MODUL · FAHRTENBUCH</LiquidText>
        <LiquidText variant="section">Fahrtenbuch wird vorbereitet</LiquidText>
      </LiquidSurface>
    );
  }
  if (!query.data.eligible || !query.data.bundle) {
    const reason = query.data.reason === 'no_car_mode'
      ? 'Für dieses Konto ist noch kein PKW-Verkehrsmittel hinterlegt.'
      : 'Für dieses Konto ist noch kein aktives Fahrzeug zugeordnet.';
    return (
      <LiquidSurface active accessibilityLabel="Fahrtenbuch einrichten" contentStyle={styles.card}>
        <View style={styles.header}>
          <View style={styles.copy}>
            <LiquidText variant="kicker">EIGENES MODUL · FAHRTENBUCH</LiquidText>
            <LiquidText variant="title">Fahrtenbuch einrichten</LiquidText>
            <LiquidText variant="body">{reason}</LiquidText>
          </View>
          <LiquidStatus label="Einrichtung nötig" tone="warning" />
        </View>
        <LiquidButton
          compact
          label="Fahrtenbuch öffnen"
          icon="›"
          onPress={() => router.push('/portal/employee/fahrtenbuch' as never)}
        />
      </LiquidSurface>
    );
  }

  const bundle = query.data.bundle;
  const currentMonth = berlinToday().slice(0, 7);
  const active = bundle.trips.find((trip) => trip.status === 'recording') ?? null;
  const monthTrips = bundle.trips.filter(
    (trip) => trip.status !== 'cancelled' && berlinDateKey(trip.startedAt).startsWith(currentMonth),
  );
  const distanceKm = monthTrips.reduce((sum, trip) => sum + trip.distanceFinalKm, 0);
  const mileageCents = monthTrips.reduce((sum, trip) => sum + trip.mileageAmountCents, 0);

  return (
    <LiquidSurface active accessibilityLabel="Fahrtenbuch Widget" contentStyle={styles.card}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <LiquidText variant="kicker">EIGENES MODUL · FAHRTENBUCH</LiquidText>
          <LiquidText variant="title">
            {active ? 'Fahrt wird aufgezeichnet' : 'Digitales Fahrtenbuch'}
          </LiquidText>
          <LiquidText variant="body">
            {active
              ? `${TRAVEL_ROUTE_TYPE_LABELS[active.routeType]} · ${active.purpose}`
              : 'Fahrten aufzeichnen, Kilometer prüfen, Belege verwalten und Tagesabschlüsse bestätigen.'}
          </LiquidText>
        </View>
        <LiquidStatus label={active ? 'GPS aktiv' : 'Bereit'} tone={active ? 'live' : 'success'} />
      </View>
      <View style={styles.metrics}>
        <LiquidMetric label="Fahrten" value={monthTrips.length} detail="dieser Monat" />
        <LiquidMetric label="Kilometer" value={distanceKm.toFixed(1).replace('.', ',')} detail="dieser Monat" />
        <LiquidMetric
          label="Vergütung"
          value={`${(mileageCents / 100).toFixed(2).replace('.', ',')} €`}
          detail="berechnet"
        />
      </View>
      <LiquidButton
        compact
        label={active ? 'Laufende Fahrt öffnen' : 'Fahrtenbuch vollständig öffnen'}
        icon="›"
        onPress={() => router.push('/portal/employee/fahrtenbuch' as never)}
      />
    </LiquidSurface>
  );
}

const styles = StyleSheet.create({
  card: { gap: liquidSpace.md },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: liquidSpace.md,
  },
  copy: { flex: 1, minWidth: 240, gap: liquidSpace.xs },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: liquidSpace.sm },
});
