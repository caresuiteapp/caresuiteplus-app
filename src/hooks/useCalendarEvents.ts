import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import {
  getCalendarEvents,
  filterEventsByVisibleTypes,
  buildModuleCalendarConfig,
  buildOfficeCalendarConfig,
} from '@/lib/calendar/calendarEventService';
import type { CalendarViewConfig } from '@/types/calendar';
import type { CalendarEvent, CalendarModuleScope } from '@/types/modules/calendarEvent';
import { useTenantCalendarSettings } from './useTenantCalendarSettings';

function resolveConfig(
  config?: CalendarViewConfig,
  scope?: CalendarModuleScope,
): CalendarViewConfig {
  if (config) return config;
  if (scope === 'office' || !scope) return buildOfficeCalendarConfig();
  return buildModuleCalendarConfig(scope);
}

function resolveSettingsScope(config: CalendarViewConfig): 'office' | 'assist' {
  if (config.moduleKey === 'assist') return 'assist';
  return 'office';
}

export function useCalendarEvents(
  rangeStart?: string,
  rangeEnd?: string,
  config?: CalendarViewConfig,
  scope?: CalendarModuleScope,
) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const resolvedConfig = useMemo(() => resolveConfig(config, scope), [config, scope]);
  const settingsScope = resolveSettingsScope(resolvedConfig);
  const { settings } = useTenantCalendarSettings(settingsScope);

  const requestKey = `${tenantId}:${rangeStart}:${rangeEnd}:${JSON.stringify(resolvedConfig)}`;
  const [loadedRange, setLoadedRange] = useState<{ key: string; ok: boolean } | null>(null);
  const query = useAsyncQuery(
    async () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      try {
        const result = await getCalendarEvents({
          tenantId,
          actorRoleKey: profile?.roleKey,
          rangeStart,
          rangeEnd,
          config: resolvedConfig,
        });
        setLoadedRange({ key: requestKey, ok: result.ok });
        return result;
      } catch (cause) {
        setLoadedRange({ key: requestKey, ok: false });
        throw cause;
      }
    },
    [tenantId, profile?.roleKey, rangeStart, rangeEnd, resolvedConfig],
    { enabled: !!tenantId },
  );

  const events: CalendarEvent[] = useMemo(() => {
    if (!query.data) return [];
    if (!settings) return query.data;
    return filterEventsByVisibleTypes(query.data, settings.visibleTypes);
  }, [query.data, settings]);

  return { ...query, events, allEvents: query.data ?? [], calendarReady: loadedRange?.key === requestKey && loadedRange.ok, settings, config: resolvedConfig };
}
