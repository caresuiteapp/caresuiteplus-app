import { useCallback, useEffect, useState } from 'react';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import {
  projectClientPortalAssistLiveVisit,
  sanitizeClientPortalLiveVisitPayload,
  type ClientPortalAssistLiveVisitProjection,
} from '@/lib/portal/clientPortalAssistLiveVisitService';
import { fetchActiveLivePortalAssignmentForClient } from '@/lib/portal/portalAppointmentsLiveService';
import { usePortalActor } from '@/hooks/usePortalActor';
import { subscribeToPortalAssistChanges } from '@/lib/realtime';
import { useAsyncQuery } from './core';

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

  const liveVisit = sanitizeClientPortalLiveVisitPayload(
    await projectClientPortalAssistLiveVisit({
      tenantId,
      clientId,
      assignmentId: active.id,
      status: active.status,
      plannedStartAt: active.startsAt,
      plannedEndAt: active.endsAt,
      portalReleaseEnabled: true,
    }),
  );

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
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!tenantId || !clientId) return;
    const unsubscribe = subscribeToPortalAssistChanges(tenantId, clientId, () => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, [tenantId, clientId]);

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
