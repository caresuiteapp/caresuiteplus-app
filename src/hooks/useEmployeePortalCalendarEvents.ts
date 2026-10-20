import { useMemo } from 'react';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import {
  buildEmployeePortalCalendarConfig,
  getEmployeePortalTeamCalendarEvents,
} from '@/lib/calendar/calendarEventService';

export function useEmployeePortalCalendarEvents(rangeStart?: string, rangeEnd?: string) {
  const { tenantId, employeeId, actorId, roleKey, isReady, isResolvingEmployeeLink } = usePortalActor();

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
    { enabled: isReady && !!tenantId && !!employeeId && !isResolvingEmployeeLink,
      queryKey: JSON.stringify([tenantId, employeeId, actorId, roleKey, rangeStart, rangeEnd]) },
  );

  return {
    ...query,
    loading: !isReady || Boolean(isResolvingEmployeeLink) || query.loading,
    error: isReady && !isResolvingEmployeeLink && !employeeId
      ? 'Ihr Mitarbeitendenprofil konnte nicht verknüpft werden. Bitte melden Sie sich erneut an.' : query.error,
    events: query.data ?? [],
    config,
  };
}
