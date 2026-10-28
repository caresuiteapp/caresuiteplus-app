// Generated native presentation from src/hooks/useCalendarEvents.web.ts. Update through scripts/port-native-workspaces.mjs.
import { useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { buildModuleCalendarConfig, buildOfficeCalendarConfig, filterEventsByVisibleTypes } from '@/lib/calendar/calendarEventService';
import { getWorkspaceCalendarEvents } from '@/lib/calendar/calendarWorkspaceService';
import { subscribeCalendarWorkspaceChanges } from "../lib/calendar/calendarWorkspaceRefresh.native.ts";
import type { CalendarViewConfig } from '@/types/calendar';
import type { CalendarModuleScope } from '@/types/modules/calendarEvent';
import { useTenantCalendarSettings } from "./useTenantCalendarSettings.native.ts";
export function useCalendarEvents(rangeStart?: string, rangeEnd?: string, config?: CalendarViewConfig, scope?: CalendarModuleScope) {
    const { profile } = useAuth();
    const tenantId = useServiceTenantId();
    const resolvedConfig = useMemo(() => config ?? (!scope || scope === 'office' ? buildOfficeCalendarConfig() : buildModuleCalendarConfig(scope)), [config, scope]);
    const { settings } = useTenantCalendarSettings(resolvedConfig.moduleKey === 'assist' ? 'assist' : 'office');
    const queryKey = JSON.stringify([tenantId, profile?.id, profile?.roleKey, rangeStart, rangeEnd, resolvedConfig]);
    const query = useAsyncQuery(() => tenantId ? getWorkspaceCalendarEvents({ tenantId, actorRoleKey: profile?.roleKey, rangeStart, rangeEnd, config: resolvedConfig }) : Promise.resolve({ ok: false as const, error: 'Kein Unternehmen ausgewählt.' }), [tenantId, profile?.id, profile?.roleKey, rangeStart, rangeEnd, resolvedConfig], { enabled: !!tenantId, queryKey });
    const events = useMemo(() => settings ? filterEventsByVisibleTypes(query.data ?? [], settings.visibleTypes) : query.data ?? [], [query.data, settings]);
    const reload = query.refresh;
    useEffect(() => tenantId ? subscribeCalendarWorkspaceChanges(tenantId, () => { void reload(); }) : undefined, [tenantId, reload]);
    return { ...query, events, allEvents: query.data ?? [], settings, config: resolvedConfig,
        calendarReady: !!tenantId && query.data !== null && !query.loading && !query.refreshing && !query.error && !query.refreshError };
}
