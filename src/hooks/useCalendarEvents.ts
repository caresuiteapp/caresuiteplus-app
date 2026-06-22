import { useMemo } from 'react';
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

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return getCalendarEvents({
        tenantId,
        actorRoleKey: profile?.roleKey,
        rangeStart,
        rangeEnd,
        config: resolvedConfig,
      });
    },
    [tenantId, profile?.roleKey, rangeStart, rangeEnd, resolvedConfig],
    { enabled: !!tenantId },
  );

  const events: CalendarEvent[] = useMemo(() => {
    if (!query.data) return [];
    if (!settings) return query.data;
    return filterEventsByVisibleTypes(query.data, settings.visibleTypes);
  }, [query.data, settings]);

  return { ...query, events, settings, config: resolvedConfig };
}
