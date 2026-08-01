import { useMemo } from 'react';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import {
  buildEmployeePortalCalendarConfig,
  getEmployeePortalTeamCalendarEvents,
} from '@/lib/calendar/calendarEventService';

export function useEmployeePortalCalendarEvents(rangeStart?: string, rangeEnd?: string) {
  const { tenantId, employeeId, isReady } = usePortalActor();

  const config = useMemo(
    () => (employeeId ? buildEmployeePortalCalendarConfig(employeeId) : undefined),
    [employeeId],
  );

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !employeeId) {
        return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      }
      return getEmployeePortalTeamCalendarEvents(tenantId, { rangeStart, rangeEnd });
    },
    [tenantId, employeeId, rangeStart, rangeEnd],
    { enabled: isReady && !!tenantId && !!employeeId },
  );

  return {
    ...query,
    events: query.data ?? [],
    config,
  };
}
