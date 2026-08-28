import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { usePortalActor } from '@/hooks/usePortalActor';
import {
  flushLogbookPointQueue,
  resumeActiveEmployeeLogbookTracking,
} from '@/lib/employeeLogbook';
import { flushAssistLocationPointQueue } from '@/features/liveTracking/assistLocationPointQueue';
import { returnTripDestinationFromTrip } from '@/lib/portal/employeePortalReturnTrip';
import type { LogbookTrip } from '@/types/modules/employeeLogbook';

const ROUTE_LABELS: Record<string, string> = {
  home_to_client: 'Anfahrt zum Einsatz',
  office_to_client: 'Anfahrt vom Büro',
  client_to_client: 'Fahrt zwischen Einsätzen',
  with_client: 'Fahrt mit Klient:in',
  other_business: 'Dienstliche Fahrt',
  client_to_home: 'Rückfahrt nach Hause',
  client_to_office: 'Rückfahrt zum Büro',
};

/**
 * Portal-wide recovery for an active trip. The trip must remain visible and
 * resumable even when its original assignment screen is no longer mounted.
 */
export function EmployeeLogbookLifecycleGate() {
  const actor = usePortalActor();
  const pathname = usePathname();
  const router = useRouter();
  const [activeTrip, setActiveTrip] = useState<LogbookTrip | null>(null);
  const [offlinePending, setOfflinePending] = useState(0);

  const refresh = useCallback(async () => {
    if (!actor.tenantId || !actor.employeeId) {
      setActiveTrip(null);
      return;
    }
    const [trip, logbookFlush, assistFlush] = await Promise.all([
      resumeActiveEmployeeLogbookTracking(actor.tenantId, actor.employeeId),
      flushLogbookPointQueue().catch(() => ({ sent: 0, remaining: 0 })),
      flushAssistLocationPointQueue().catch(() => ({ sent: 0, remaining: 0 })),
    ]);
    setActiveTrip(trip);
    setOfflinePending(logbookFlush.remaining + assistFlush.remaining);
  }, [actor.tenantId, actor.employeeId]);

  useEffect(() => {
    if (!actor.isReady) return;
    void refresh().catch(() => undefined);
  }, [actor.isReady, pathname, refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void refresh().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [refresh]);

  const returnDestination = useMemo(
    () => activeTrip ? returnTripDestinationFromTrip(activeTrip) : null,
    [activeTrip],
  );
  const executionRouteOpen = Boolean(
    activeTrip?.assignmentId &&
    pathname.includes(`/assignments/${activeTrip.assignmentId}/execute`),
  );

  if (!activeTrip || executionRouteOpen) return null;

  const openTrip = () => {
    if (returnDestination && activeTrip.assignmentId) {
      router.push({
        pathname: '/portal/employee/assignments/[id]/execute',
        params: { id: activeTrip.assignmentId },
      } as never);
      return;
    }
    router.push('/portal/employee/fahrtenbuch' as never);
  };

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Aktive GPS-Fahrt öffnen"
        onPress={openTrip}
        style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
        testID="employee-active-logbook-banner"
      >
        <View style={styles.liveDot} />
        <View style={styles.copy}>
          <Text style={styles.kicker}>GPS · FAHRTENBUCH AKTIV</Text>
          <Text numberOfLines={1} style={styles.title}>
            {ROUTE_LABELS[activeTrip.routeType] ?? 'Dienstliche Fahrt'}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {offlinePending > 0
              ? `${offlinePending} GPS-Punkte sicher zwischengespeichert`
              : 'Aufzeichnung läuft auch im Hintergrund'}
          </Text>
        </View>
        <View style={styles.action}>
          <Text style={styles.actionText}>{returnDestination ? 'ANKOMMEN' : 'ÖFFNEN'}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 88,
    zIndex: 12000,
    alignItems: 'center',
  },
  banner: {
    width: '100%',
    maxWidth: 720,
    minHeight: 74,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(77, 226, 158, 0.75)',
    backgroundColor: 'rgba(3, 24, 38, 0.98)',
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    shadowColor: '#33E39B',
    shadowOpacity: 0.34,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  liveDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#45E6A1',
    shadowColor: '#45E6A1',
    shadowOpacity: 0.8,
    shadowRadius: 9,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  kicker: { color: '#6FF0B6', fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#FFFFFF', fontSize: 15, lineHeight: 20, fontWeight: '900' },
  meta: { color: '#BBD3E4', fontSize: 11, lineHeight: 15, fontWeight: '600' },
  action: {
    minWidth: 82,
    minHeight: 38,
    borderRadius: 14,
    backgroundColor: '#0878F9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  actionText: { color: '#FFFFFF', fontSize: 11, lineHeight: 14, fontWeight: '900' },
});
