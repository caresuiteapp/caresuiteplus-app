import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { usePortalActor } from '@/hooks/usePortalActor';
import {
  flushLogbookPointQueue,
  resumeActiveEmployeeLogbookTracking,
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
  const [activeTrip, setActiveTrip] = useState<LogbookTrip | null>(null);
  const [offlinePending, setOfflinePending] = useState<number | null>(null);
  const mounted = useRef(false);
  const scope = `${actor.tenantId ?? ''}:${actor.employeeId ?? ''}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const inFlight = useRef<string | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setActiveTrip(null); setOfflinePending(null); }, [scope]);

  const refresh = useCallback(async () => {
    if (!actor.tenantId || !actor.employeeId) {
      setActiveTrip(null);
      return;
    }
    const requestScope = `${actor.tenantId}:${actor.employeeId}`;
    if (inFlight.current === requestScope) return;
    inFlight.current = requestScope;
    try {
      const [trip, logbookFlush, assistFlush] = await Promise.all([
        resumeActiveEmployeeLogbookTracking(actor.tenantId, actor.employeeId),
        flushLogbookPointQueue().catch(() => null),
        flushAssistLocationPointQueue().catch(() => null),
      ]);
      if (!mounted.current || scopeRef.current !== requestScope) return;
      setActiveTrip(trip);
      setOfflinePending(logbookFlush && assistFlush ? logbookFlush.remaining + assistFlush.remaining : null);
    } catch {
      if (mounted.current && scopeRef.current === requestScope) setOfflinePending(null);
    } finally { if (inFlight.current === requestScope) inFlight.current = null; }
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

  useEffect(() => {
    const foreground = () => { if (document.visibilityState === 'visible') void refresh().catch(() => undefined); };
    document.addEventListener('visibilitychange', foreground);
    window.addEventListener('online', foreground);
    return () => { document.removeEventListener('visibilitychange', foreground); window.removeEventListener('online', foreground); };
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
            {offlinePending === null ? 'Synchronisierung noch nicht bestätigt' : offlinePending > 0
              ? `${offlinePending} GPS-Punkte sicher zwischengespeichert`
              : 'Portal geöffnet lassen: Browser können GPS im Hintergrund unterbrechen.'}
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
  kicker: { color: '#6FF0B6', fontSize: font(13), lineHeight: font(18), lineHeight: 13, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#FFFFFF', fontSize: 15, lineHeight: 20, fontWeight: '900' },
  meta: { color: '#BBD3E4', fontSize: font(13), lineHeight: font(18), lineHeight: 15, fontWeight: '600' },
  action: {
    minWidth: 82,
    minHeight: 38,
    borderRadius: 14,
    backgroundColor: '#0878F9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  actionText: { color: '#FFFFFF', fontSize: font(13), lineHeight: font(18), lineHeight: 14, fontWeight: '900' },
});
