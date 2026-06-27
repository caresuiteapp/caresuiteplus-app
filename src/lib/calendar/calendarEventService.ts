import type { RoleKey, ServiceResult } from '@/types';
import type {
  CalendarEventRecord,
  CalendarSourceType,
  CalendarViewConfig,
  GetCalendarEventsParams,
  PortalCalendarContext,
} from '@/types/calendar';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode, isDemoMode } from '@/lib/services/mode';
import { recordsToUiEvents } from '@/lib/calendar/calendarFilters';
import { enrichCalendarEventWithAssignment } from '@/lib/calendar/calendarEventDisplay';
import { mapCalendarEventRecordToUi } from '@/lib/calendar/calendarEventMapper';
import { calendarEventRepository } from '@/lib/calendar/calendarEventRepository';
import {
  syncCalendarEventFromSource,
  syncLegacySourcesBatch,
  type CalendarSyncPayload,
  syncCalendarEvent,
} from '@/lib/calendar/calendarSyncService';
import { resolveCalendarPermission } from '@/lib/calendar/calendarPermissions';
import { isStationaerCalendarSourceType } from '@/lib/calendar/calendarSourceRegistry';
import {
  fetchCalendarEvents as fetchLegacyCalendarEvents,
  fetchAssistCalendarEvents as fetchLegacyAssistCalendarEvents,
  filterEventsByVisibleTypes,
  type FetchCalendarEventsOptions,
} from '@/lib/office/calendarEventService.legacy';

export type { FetchCalendarEventsOptions };

let legacyBootstrapAttempted = false;
let stationaerBootstrapAttempted = false;

import { MODULE_CALENDAR_COLORS, MODULE_EVENT_TYPES } from '@/lib/calendar/calendarColors';
import { CALENDAR_MODULE_ROUTES } from '@/lib/calendar/calendarRouteRegistry';

const MODULE_SUBTITLES: Record<CalendarViewConfig['moduleKey'], string> = {
  all: 'Office Hauptkalender',
  office: 'Office Kalender',
  assist: 'Assist Kalender',
  pflege: 'Pflege Kalender',
  stationaer: 'Stationär Kalender',
  beratung: 'Beratung Kalender',
  akademie: 'Akademie Kalender',
  portal: 'Portal Kalender',
  global: 'Globaler Kalender',
};

const MODULE_EMPTY_STATES: Record<CalendarViewConfig['moduleKey'], string> = {
  all: 'Für diesen Zeitraum sind keine Kalendereinträge sichtbar.',
  office: 'Für diesen Zeitraum sind keine Office-Einträge sichtbar.',
  assist: 'Für diesen Zeitraum sind keine Assist-Einsätze oder Termine sichtbar.',
  pflege: 'Keine Pflege-Termine im gewählten Zeitraum. Visiten und Dienstplan-Einträge erscheinen nach Synchronisation.',
  stationaer: 'Keine Stationär-Termine im gewählten Zeitraum. Aktivitäten, Besuche und Termine erscheinen nach Synchronisation.',
  beratung: 'Keine Beratungs-Termine im gewählten Zeitraum. Wiedervorlagen und Beratungstermine werden synchronisiert.',
  akademie: 'Keine Schulungen im gewählten Zeitraum. Kurse und Prüfungstermine erscheinen nach Synchronisation.',
  portal: 'Keine Portal-Termine im gewählten Zeitraum.',
  global: 'Keine globalen Termine im gewählten Zeitraum.',
};

function buildModuleBreadcrumbs(moduleKey: CalendarViewConfig['moduleKey']) {
  const route = CALENDAR_MODULE_ROUTES[moduleKey === 'all' ? 'office' : moduleKey];
  const moduleLabel = MODULE_SUBTITLES[moduleKey]?.replace(' Kalender', '') ?? moduleKey;
  return [{ label: moduleLabel, href: route }, { label: 'Kalender' }];
}

export function buildOfficeCalendarConfig(): CalendarViewConfig {
  return {
    calendarScope: 'office',
    moduleKey: 'all',
    showAllModules: true,
    subtitle: MODULE_SUBTITLES.all,
    emptyStateMessage: MODULE_EMPTY_STATES.all,
    moduleColor: MODULE_CALENDAR_COLORS.all,
    breadcrumbs: buildModuleBreadcrumbs('all'),
    allowedEventTypes: undefined,
  };
}

export function buildModuleCalendarConfig(moduleKey: CalendarViewConfig['moduleKey']): CalendarViewConfig {
  const allowed =
    MODULE_EVENT_TYPES[moduleKey === 'all' ? 'office' : moduleKey] ??
    MODULE_EVENT_TYPES.office ??
    ['termin', 'besprechung', 'frist'];
  return {
    calendarScope: moduleKey === 'all' || moduleKey === 'office' ? 'office' : 'module',
    moduleKey,
    showAllModules: moduleKey === 'all',
    subtitle: MODULE_SUBTITLES[moduleKey],
    emptyStateMessage: MODULE_EMPTY_STATES[moduleKey],
    moduleColor: MODULE_CALENDAR_COLORS[moduleKey],
    breadcrumbs: buildModuleBreadcrumbs(moduleKey),
    allowedEventTypes: [...allowed],
  };
}

async function fetchFromCentralStore(
  params: GetCalendarEventsParams,
): Promise<ServiceResult<CalendarEvent[]>> {
  const result = await calendarEventRepository.list(params);
  if (!result.ok) return result;
  return { ok: true, data: recordsToUiEvents(result.data) };
}

/** LEGACY: Demo-only fallback — never parallel to central store display */
async function fetchLegacyFallbackOnce(
  params: GetCalendarEventsParams,
  legacyFetcher: (
    tenantId: string,
    role: RoleKey | null | undefined,
    options?: FetchCalendarEventsOptions,
  ) => Promise<ServiceResult<CalendarEvent[]>>,
): Promise<ServiceResult<CalendarEvent[]>> {
  if (!isDemoMode()) {
    return { ok: true, data: [] };
  }

  const legacy = await legacyFetcher(params.tenantId, params.actorRoleKey, {
    rangeStart: params.rangeStart,
    rangeEnd: params.rangeEnd,
    includeDemoStubs: true,
  });

  if (!legacy.ok) return legacy;

  // One-time bootstrap sync when supabase client exists (no parallel display)
  if (getServiceMode() === 'supabase' && legacy.data.length > 0 && !legacyBootstrapAttempted) {
    legacyBootstrapAttempted = true;
    const { fetchAppointmentList } = await import('@/lib/office/appointmentListService');
    const { fetchAssignmentList } = await import('@/lib/assist/assignmentListService');
    const [appointments, assignments] = await Promise.all([
      fetchAppointmentList(params.tenantId, params.actorRoleKey),
      fetchAssignmentList(params.tenantId, params.actorRoleKey),
    ]);
    if (appointments.ok && assignments.ok) {
      void syncLegacySourcesBatch(params.tenantId, appointments.data, assignments.data);
    }
  }

  return legacy;
}

async function enrichAssistCalendarEvents(
  tenantId: string,
  events: CalendarEvent[],
  actorRoleKey?: RoleKey | null,
): Promise<CalendarEvent[]> {
  const needsEnrichment = events.some(
    (event) =>
      event.type === 'einsatz'
      && event.sourceId
      && (!event.clientName?.trim() || !event.employeeName?.trim()),
  );
  if (!needsEnrichment) return events;

  const { fetchAssignmentList } = await import('@/lib/assist/assignmentListService');
  const assignmentsResult = await fetchAssignmentList(tenantId, actorRoleKey);
  if (!assignmentsResult.ok) return events;

  const byId = new Map(assignmentsResult.data.map((item) => [item.id, item]));

  return events.map((event) => {
    if (event.type !== 'einsatz' || !event.sourceId) return event;
    const assignment = byId.get(event.sourceId);
    if (!assignment) return event;
    return enrichCalendarEventWithAssignment(event, assignment);
  });
}

export async function getCalendarEvents(
  params: GetCalendarEventsParams,
): Promise<ServiceResult<CalendarEvent[]>> {
  const permission = resolveCalendarPermission(params.config);
  const denied = enforcePermission<CalendarEvent[]>(params.actorRoleKey, permission);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(params.tenantId);
  if (tenantBlock) return tenantBlock;

  const isAssistModule =
    params.config.calendarScope === 'module' && params.config.moduleKey === 'assist';

  const central = await fetchFromCentralStore(params);
  if (central.ok && central.data.length > 0) {
    if (isAssistModule) {
      const enriched = await enrichAssistCalendarEvents(
        params.tenantId,
        central.data,
        params.actorRoleKey,
      );
      return { ok: true, data: enriched };
    }
    return central;
  }

  const isStationaerModule =
    params.config.calendarScope === 'module' && params.config.moduleKey === 'stationaer';

  if (isStationaerModule && getServiceMode() === 'supabase' && !stationaerBootstrapAttempted) {
    stationaerBootstrapAttempted = true;
    const { syncStationaerCalendarBootstrap } = await import(
      '@/lib/stationaer/stationaerCalendarService'
    );
    await syncStationaerCalendarBootstrap(params.tenantId);
    const retry = await fetchFromCentralStore(params);
    if (retry.ok && retry.data.length > 0) {
      if (isAssistModule) {
        const enriched = await enrichAssistCalendarEvents(
          params.tenantId,
          retry.data,
          params.actorRoleKey,
        );
        return { ok: true, data: enriched };
      }
      return retry;
    }
  }

  const isOfficeMain =
    params.config.calendarScope === 'office' || params.config.showAllModules;

  if (isAssistModule) {
    const legacy = await fetchLegacyFallbackOnce(params, fetchLegacyAssistCalendarEvents);
    if (legacy.ok) {
      const enriched = await enrichAssistCalendarEvents(
        params.tenantId,
        legacy.data,
        params.actorRoleKey,
      );
      return { ok: true, data: enriched };
    }
    return legacy;
  }
  if (isOfficeMain) {
    return fetchLegacyFallbackOnce(params, fetchLegacyCalendarEvents);
  }

  return central.ok ? central : { ok: true, data: [] };
}

export async function getOfficeCalendarEvents(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  options?: FetchCalendarEventsOptions,
): Promise<ServiceResult<CalendarEvent[]>> {
  return getCalendarEvents({
    tenantId,
    actorRoleKey,
    rangeStart: options?.rangeStart,
    rangeEnd: options?.rangeEnd,
    config: buildOfficeCalendarConfig(),
  });
}

export async function getModuleCalendarEvents(
  moduleKey: CalendarViewConfig['moduleKey'],
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  options?: FetchCalendarEventsOptions,
): Promise<ServiceResult<CalendarEvent[]>> {
  return getCalendarEvents({
    tenantId,
    actorRoleKey,
    rangeStart: options?.rangeStart,
    rangeEnd: options?.rangeEnd,
    config: buildModuleCalendarConfig(moduleKey),
  });
}

function portalEventsToAppointmentItems(
  events: CalendarEvent[],
): Array<{
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  location: string | null;
  clientId: string | null;
  employeeId: string | null;
}> {
  return events.map((event) => ({
    id: event.sourceId ?? event.id,
    title: event.title,
    startsAt: event.start,
    endsAt: event.end,
    status: event.status ?? 'aktiv',
    location: event.record?.locationName ?? null,
    clientId: event.record?.relatedClientId ?? null,
    employeeId: event.record?.relatedEmployeeId ?? null,
  }));
}

export async function getPortalCalendarEvents(
  tenantId: string,
  context: PortalCalendarContext,
  options?: FetchCalendarEventsOptions,
): Promise<ServiceResult<CalendarEvent[]>> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const result = await calendarEventRepository.listForPortal(
    tenantId,
    context,
    options?.rangeStart,
    options?.rangeEnd,
  );
  if (result.ok && result.data.length > 0) {
    return { ok: true, data: recordsToUiEvents(result.data) };
  }

  // LEGACY capped fallback: assignments-only reads when central store empty
  if (getServiceMode() === 'supabase') {
    const { fetchLivePortalAppointmentsForClient, fetchLivePortalAppointmentsForEmployee } =
      await import('@/lib/portal/portalAppointmentsLiveService');

    const live =
      context.portalType === 'client' && context.clientId
        ? await fetchLivePortalAppointmentsForClient(tenantId, context.clientId)
        : context.portalType === 'employee' && context.employeeId
          ? await fetchLivePortalAppointmentsForEmployee(tenantId, context.employeeId)
          : { ok: true as const, data: [] };

    if (!live.ok) return live;

    const events: CalendarEvent[] = live.data.slice(0, 50).map((item) => ({
      id: item.id,
      title: item.title,
      start: item.startsAt,
      end: item.endsAt,
      type: 'einsatz',
      color: '#FFB020',
      sourceId: item.id,
      sourceType: 'assist_visit',
      moduleKey: 'assist',
      href: context.portalType === 'client'
        ? `/portal/client/appointments/${item.id}`
        : `/portal/employee/assignments/${item.id}`,
    }));

    return { ok: true, data: events };
  }

  return { ok: true, data: [] };
}

export async function getEmployeeCalendarEvents(
  tenantId: string,
  employeeId: string,
  options?: FetchCalendarEventsOptions,
): Promise<ServiceResult<CalendarEvent[]>> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const result = await calendarEventRepository.listForEmployee(
    tenantId,
    employeeId,
    options?.rangeStart,
    options?.rangeEnd,
  );
  if (!result.ok) return result;
  return { ok: true, data: recordsToUiEvents(result.data) };
}

export async function getClientCalendarEvents(
  tenantId: string,
  clientId: string,
  options?: FetchCalendarEventsOptions,
): Promise<ServiceResult<CalendarEvent[]>> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const result = await calendarEventRepository.listForClient(
    tenantId,
    clientId,
    options?.rangeStart,
    options?.rangeEnd,
  );
  if (!result.ok) return result;
  return { ok: true, data: recordsToUiEvents(result.data) };
}

export async function createCalendarEventFromSource(
  tenantId: string,
  sourceType: CalendarSourceType,
  sourceId: string,
): Promise<ServiceResult<CalendarEventRecord | null>> {
  return syncCalendarEventFromSource(tenantId, sourceType, sourceId);
}

export { syncCalendarEventFromSource };

export async function archiveCalendarEvent(
  tenantId: string,
  eventId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<void>> {
  const denied = enforcePermission<void>(actorRoleKey, 'office.appointments.edit');
  if (denied) return denied;
  return calendarEventRepository.archive(tenantId, eventId);
}

export async function updateCalendarEvent(
  tenantId: string,
  eventId: string,
  _data: Record<string, unknown>,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CalendarEvent>> {
  const denied = enforcePermission<CalendarEvent>(actorRoleKey, 'office.appointments.edit');
  if (denied) return denied;
  const list = await calendarEventRepository.list({
    tenantId,
    config: buildOfficeCalendarConfig(),
  });
  if (!list.ok) return list;
  const record = list.data.find((entry) => entry.id === eventId);
  if (!record) return { ok: false, error: 'Kalenderereignis nicht gefunden.' };
  return { ok: true, data: mapCalendarEventRecordToUi(record) };
}

export function detectCalendarConflicts(params: {
  tenantId: string;
  employeeId?: string | null;
  clientId?: string | null;
  wardId?: string | null;
  moduleKey?: string | null;
  sourceType?: string | null;
  startAt: string;
  endAt: string;
}): { level: 'hint' | 'warning' | 'blocking'; message: string }[] {
  const conflicts: { level: 'hint' | 'warning' | 'blocking'; message: string }[] = [];

  if (params.moduleKey === 'stationaer' || isStationaerCalendarSourceType(params.sourceType as never)) {
    if (params.wardId) {
      conflicts.push({
        level: 'hint',
        message: 'Wohnbereich: mögliche Überschneidung mit anderen Stationär-Terminen.',
      });
    }
    if (params.sourceType === 'resident_visit' || params.sourceType === 'family_meeting') {
      conflicts.push({
        level: 'hint',
        message: 'Besuch/Angehörigentermin: Besuchszeiten der Einrichtung prüfen.',
      });
    }
    if (params.sourceType === 'physician_visit' || params.sourceType === 'therapy_appointment') {
      conflicts.push({
        level: 'warning',
        message: 'Medizinischer Termin: Therapie- oder Arztvisite könnte kollidieren.',
      });
    }
    if (params.sourceType === 'admission_appointment') {
      conflicts.push({
        level: 'hint',
        message: 'Aufnahmetermin: Zimmerbelegung und Übergabezeitfenster abstimmen.',
      });
    }
  }

  return conflicts;
}

export {
  filterEventsByVisibleTypes,
  filterEventsForAssistModule,
} from '@/lib/office/calendarEventService.legacy';

/** @deprecated Use getOfficeCalendarEvents */
export const fetchCalendarEvents = getOfficeCalendarEvents;

/** @deprecated Use getModuleCalendarEvents('assist', ...) */
export async function fetchAssistCalendarEvents(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  options?: FetchCalendarEventsOptions,
): Promise<ServiceResult<CalendarEvent[]>> {
  return getModuleCalendarEvents('assist', tenantId, actorRoleKey, options);
}

export { portalEventsToAppointmentItems, syncCalendarEvent, type CalendarSyncPayload };
