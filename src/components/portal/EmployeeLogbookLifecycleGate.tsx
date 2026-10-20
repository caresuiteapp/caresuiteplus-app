import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { usePortalActor } from '@/hooks/usePortalActor';
import {
  flushLogbookPointQueue,
  resumeActiveEmployeeLogbookTracking,
  stopEmployeeLogbookTrackingForScope,
} from '@/lib/employeeLogbook';
import { flushAssistLocationPointQueue } from '@/features/liveTracking/assistLocationPointQueue';
import { returnTripDestinationFromTrip } from '@/lib/portal/employeePortalReturnTripRules';
import type { LogbookTrip } from '@/types/modules/employeeLogbook';
import { isEmployeeVisitExecutionRoute } from '@/lib/portal/portalResponsiveLayout';

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
  const [storedTrip, setActiveTrip] = useState<LogbookTrip | null>(null);
  const [offlinePending, setOfflinePending] = useState<number | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const mounted = useRef(false);
  const scope = `${actor.tenantId ?? ''}:${actor.employeeId ?? ''}`;
  const [tripScope, setTripScope] = useState(scope);
  const activeTrip = tripScope === scope ? storedTrip : null;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const readyRef = useRef(actor.isReady);
  readyRef.current = actor.isReady;
  const generation = useRef(0);
  const inFlight = useRef<{ scope: string; generation: number } | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const trackingTenant = actor.tenantId; const trackingEmployee = actor.employeeId;
    setActiveTrip(null); setOfflinePending(null); setTrackingError(null);
    return () => {
      generation.current += 1; inFlight.current = null;
      if (trackingTenant && trackingEmployee) void stopEmployeeLogbookTrackingForScope(trackingTenant, trackingEmployee).catch(() => undefined);
    };
  }, [scope, actor.tenantId, actor.employeeId, actor.isReady]);

  const refresh = useCallback(async () => {
    if (!actor.isReady || !actor.tenantId || !actor.employeeId) {
      setActiveTrip(null);
      return;
    }
    const requestScope = `${actor.tenantId}:${actor.employeeId}`;
    const requestGeneration = generation.current;
    if (inFlight.current?.scope === requestScope && inFlight.current.generation === requestGeneration) return;
    const request = { scope: requestScope, generation: requestGeneration };
    const shouldContinue = () => mounted.current && readyRef.current && scopeRef.current === requestScope && generation.current === requestGeneration;
    inFlight.current = request;
    try {
      const [trip, logbookFlush, assistFlush] = await Promise.all([
        resumeActiveEmployeeLogbookTracking(actor.tenantId, actor.employeeId, { shouldContinue, onError: error => {
          if (shouldContinue()) { setOfflinePending(null); setTrackingError(`GPS-Punkt konnte nicht sicher gespeichert werden: ${error.message}`); }
        }, onPointPersisted: () => {
          if (shouldContinue()) setTrackingError(null);
        } }),
        flushLogbookPointQueue().catch(() => null),
        flushAssistLocationPointQueue().catch(() => null),
      ]);
      if (!shouldContinue()) return;
      setTripScope(requestScope);
      setActiveTrip(trip);
      setOfflinePending(logbookFlush && assistFlush ? logbookFlush.remaining + assistFlush.remaining : null);
    } catch {
      if (shouldContinue()) setOfflinePending(null);
    } finally { if (inFlight.current === request) inFlight.current = null; }
  }, [actor.isReady, actor.tenantId, actor.employeeId]);
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
  const executionRouteOpen = isEmployeeVisitExecutionRoute(pathname);

  if (!activeTrip || executionRouteOpen) return null;

  const openTrip = () => {
    if (activeTrip.assignmentId) {
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
        accessibilityLabel="Offene Fahrt und Aufzeichnungsstatus öffnen"
        onPress={openTrip}
        style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
        testID="employee-active-logbook-banner"
      >
        <View style={styles.liveDot} />
        <View style={styles.copy}>
          <Text style={styles.kicker}>FAHRTENBUCH · FAHRT OFFEN</Text>
          <Text numberOfLines={1} style={styles.title}>
            {ROUTE_LABELS[activeTrip.routeType] ?? 'Dienstliche Fahrt'}
          </Text>
          <Text style={styles.meta}>
            {trackingError ?? (offlinePending === null ? 'Synchronisierung noch nicht bestätigt' : offlinePending > 0
              ? `${offlinePending} GPS-Punkte sicher zwischengespeichert`
              : 'GPS-Hintergrunddienst angefordert; Standortberechtigung und Gerät prüfen')}
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
    // The portal footer reserves this row above its navigation. No overlay.
    width: '100%',
    flexShrink: 0,
    alignItems: 'center',
  },
  banner: {
    width: '100%',
    maxWidth: 720,
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(77, 226, 158, 0.75)',
    backgroundColor: 'rgba(3, 24, 38, 0.98)',
    paddingHorizontal: 14,
    paddingVertical: 8,
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
