import { useMemo } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { fetchCalendarEvents, filterEventsByVisibleTypes } from '@/lib/office/calendarEventService';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { useTenantCalendarSettings } from './useTenantCalendarSettings';

export function useOfficeCalendar(rangeStart?: string, rangeEnd?: string) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { settings } = useTenantCalendarSettings();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchCalendarEvents(tenantId, profile?.roleKey, { rangeStart, rangeEnd });
    },
    [tenantId, profile?.roleKey, rangeStart, rangeEnd],
    { enabled: !!tenantId },
  );

  const events: CalendarEvent[] = useMemo(() => {
    if (!query.data) return [];
    if (!settings) return query.data;
    return filterEventsByVisibleTypes(query.data, settings.visibleTypes);
  }, [query.data, settings]);

  return { ...query, events, settings };
}
