import { useCallback, useEffect, useState } from 'react';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import {
  getClientLiveVisitLocation,
  sanitizeClientLiveVisitLocation,
} from '@/features/liveTracking/getClientLiveVisitLocation';
import type { ClientPortalAssistLiveVisitProjection } from '@/lib/portal/clientPortalAssistLiveVisitService';
import { fetchActiveLivePortalAssignmentForClient } from '@/lib/portal/portalAppointmentsLiveService';
import { usePortalActor } from '@/hooks/usePortalActor';
import { subscribeToAssistLiveTrackingChanges } from '@/lib/realtime/presets';
import { LIVE_TRACKING_POLL_MS, useAsyncQuery } from './core';
import { useVisibilityAwarePolling } from '@/lib/polling/useVisibilityAwarePolling';
import { useDevicePerformance, livePollIntervalMs } from '@/lib/performance';

export type PortalClientLiveTrackingState = {
  assignmentId: string | null;
  title: string | null;
  caregiverName: string | null;
  status: AssignmentStatus | null;
  liveVisit: ClientPortalAssistLiveVisitProjection | null;
};

async function resolveActiveLiveTracking(
  tenantId: string,
  clientId: string,
): Promise<PortalClientLiveTrackingState> {
  const empty: PortalClientLiveTrackingState = {
    assignmentId: null,
    title: null,
    caregiverName: null,
    status: null,
    liveVisit: null,
  };

  const activeResult = await fetchActiveLivePortalAssignmentForClient(tenantId, clientId);
  if (!activeResult.ok) {
    throw new Error(activeResult.error);
  }
  const active = activeResult.data;
  if (!active) return empty;

  const liveVisit = sanitizeClientLiveVisitLocation(
    await getClientLiveVisitLocation({
      tenantId,
      clientId,
      assignmentId: active.id,
      status: active.status,
      plannedStartAt: active.startsAt,
      plannedEndAt: active.endsAt,
      portalReleaseEnabled: true,
    }),
  ) as ClientPortalAssistLiveVisitProjection;

  return {
    assignmentId: active.id,
    title: active.title,
    caregiverName: active.caregiverName,
    status: active.status,
    liveVisit,
  };
}

export function usePortalClientLiveTracking() {
  const { tenantId, clientId, isReady } = usePortalActor();
  const perf = useDevicePerformance();
  const [tick, setTick] = useState(0);

  const bump = useCallback(() => setTick((t) => t + 1), []);

  useVisibilityAwarePolling({
    enabled: Boolean(tenantId && clientId),
    intervalMs: livePollIntervalMs(perf.profile, LIVE_TRACKING_POLL_MS),
    onPoll: bump,
  });

  useEffect(() => {
    if (!tenantId) return;
    const unsubscribe = subscribeToAssistLiveTrackingChanges(tenantId, bump);
    return unsubscribe;
  }, [tenantId, bump]);

  const query = useAsyncQuery(
    async () => {
      if (!tenantId || !clientId) {
        return { ok: false as const, error: 'Kein Mandant.' };
      }
      void tick;
      try {
        const data = await resolveActiveLiveTracking(tenantId, clientId);
        return { ok: true as const, data };
      } catch (err) {
        return {
          ok: false as const,
          error: err instanceof Error ? err.message : 'Live-Tracking nicht verfügbar.',
        };
      }
    },
    [tenantId, clientId, tick],
    { enabled: isReady && !!tenantId && !!clientId },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  return {
    state: query.data as PortalClientLiveTrackingState | undefined,
    loading: query.loading,
    error: query.error,
    refresh,
  };
}
