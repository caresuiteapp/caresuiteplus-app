import type { ServiceResult } from '@/types';
import type { CalendarEventRecord, GetCalendarEventsParams } from '@/types/calendar';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { isDemoMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { CALENDAR_EVENT_SELECT_COLUMNS, mapCalendarEventRow } from './calendarEventMapper';
import { filterCalendarRecords, filterCalendarRecordsByRange, recordsToUiEvents } from './calendarFilters';
import { getCalendarEvents } from './calendarEventService';
import { resolveCalendarPermission } from './calendarPermissions';
import { visitSupabaseRepository } from '@/lib/assist/repositories/visitRepository.supabase';
import { mergeExpandedAssistVisitCalendarEvents } from './assistVisitCalendarRecurrence';
import { buildAbsenceEvents, buildBirthdayEvents, buildPublicHolidayEvents } from './assistCalendarOperationalEvents';
import { toTimezoneDateKey } from '@/lib/office/calendarDateUtils';

type WorkspaceResult = ServiceResult<CalendarEvent[]> & { refreshError?: string };
type BirthdayRow = Parameters<typeof buildBirthdayEvents>[0][number];
type AbsenceRow = Parameters<typeof buildAbsenceEvents>[0][number];
const PAGE_SIZE = 500;

/** A stable second order key avoids dropping events with identical start times. */
async function readCentralEvents(params: GetCalendarEventsParams): Promise<ServiceResult<CalendarEventRecord[]>> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Der Kalender kann ohne Datenbankverbindung nicht geladen werden.' };
  const rows: CalendarEventRecord[] = [];
  for (let page = 0; ; page++) {
    let query = fromUnknownTable(client, 'calendar_events').select(CALENDAR_EVENT_SELECT_COLUMNS)
      .eq('tenant_id', params.tenantId).is('archived_at', null)
      .order('start_at').order('id').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (params.rangeStart) query = query.gte('end_at', params.rangeStart);
    if (params.rangeEnd) query = query.lte('start_at', params.rangeEnd);
    const { data, error } = await query;
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    rows.push(...(data ?? []).map((row) => mapCalendarEventRow(row as never)));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return { ok: true, data: filterCalendarRecordsByRange(filterCalendarRecords(rows, params.config), params.rangeStart, params.rangeEnd) };
}

async function readPeople(table: 'employees' | 'clients', tenantId: string): Promise<BirthdayRow[]> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Keine Datenbankverbindung.');
  const rows: BirthdayRow[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await fromUnknownTable(client, table).select('id,first_name,last_name,date_of_birth')
      .eq('tenant_id', tenantId).is('deleted_at', null).order('id').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw new Error(toGermanSupabaseError(error));
    rows.push(...(data ?? []) as BirthdayRow[]);
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function readAbsences(params: GetCalendarEventsParams): Promise<AbsenceRow[]> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Keine Datenbankverbindung.');
  const rows: AbsenceRow[] = [];
  for (let page = 0; ; page++) {
    let query = fromUnknownTable(client, 'workforce_absences')
      .select('id,employee_id,absence_type,status,starts_at,ends_at,all_day')
      .eq('tenant_id', params.tenantId).in('status', ['requested', 'approved', 'active', 'completed'])
      .order('starts_at').order('id').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (params.rangeStart) query = query.gte('ends_at', params.rangeStart);
    if (params.rangeEnd) query = query.lte('starts_at', params.rangeEnd);
    const { data, error } = await query;
    if (error) throw new Error(toGermanSupabaseError(error));
    rows.push(...(data ?? []) as AbsenceRow[]);
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

/** Sources replace their own stale mirrors, but birthdays remain distinct in each year. */
export function mergeWorkspaceOperationalEvents(base: CalendarEvent[], operational: CalendarEvent[]): CalendarEvent[] {
  const liveAbsenceIds = new Set(operational.filter((event) => event.sourceType === 'workforce_absence').map((event) => event.sourceId));
  const seen = new Set<string>();
  return [...base.filter((event) => !(['absence', 'vacation', 'sick_leave', 'workforce_absence'].includes(event.sourceType ?? '') && liveAbsenceIds.has(event.sourceId))), ...operational]
    .filter((event) => {
      const key = event.sourceId && event.sourceType
        ? `${event.sourceType}:${event.sourceId}${event.type === 'geburtstag' ? `:${event.start.slice(0, 10)}` : ''}`
        : event.id;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).sort((a, b) => a.start.localeCompare(b.start));
}

/** Web workspace reader: failed sources never masquerade as complete planning data. */
export async function getWorkspaceCalendarEvents(params: GetCalendarEventsParams): Promise<WorkspaceResult> {
  const denied = enforcePermission<CalendarEvent[]>(params.actorRoleKey, resolveCalendarPermission(params.config));
  if (denied) return denied;
  const blocked = guardServiceTenant(params.tenantId);
  if (blocked) return blocked;
  if (isDemoMode() || !['all', 'office', 'assist'].includes(params.config.moduleKey)) return getCalendarEvents(params);
  try {
    const central = await readCentralEvents(params);
    if (!central.ok) return central;
    let events = recordsToUiEvents(central.data);
    const canVisits = !enforcePermission(params.actorRoleKey, 'assist.assignments.view');
    const canEmployees = !enforcePermission(params.actorRoleKey, 'office.employees.view');
    const canClients = !enforcePermission(params.actorRoleKey, 'office.clients.view');
    const canAbsences = !enforcePermission(params.actorRoleKey, 'office.employees.absences.view');
    const [visitResult, employeesResult, clientsResult, absencesResult] = await Promise.allSettled([
      canVisits ? visitSupabaseRepository.list(params.tenantId, { dateFrom: params.rangeStart, dateTo: params.rangeEnd }) : Promise.resolve(null),
      canEmployees ? readPeople('employees', params.tenantId) : Promise.resolve([]),
      canClients ? readPeople('clients', params.tenantId) : Promise.resolve([]),
      canAbsences ? readAbsences(params) : Promise.resolve([]),
    ]);
    const warnings: string[] = [];
    if (visitResult.status === 'fulfilled' && visitResult.value?.ok) events = mergeExpandedAssistVisitCalendarEvents(events, visitResult.value.data);
    else if (canVisits) warnings.push('Einsätze konnten nicht vollständig aktualisiert werden.');
    const employees = employeesResult.status === 'fulfilled' ? employeesResult.value : [];
    const clients = clientsResult.status === 'fulfilled' ? clientsResult.value : [];
    const absences = absencesResult.status === 'fulfilled' ? absencesResult.value : [];
    if (employeesResult.status === 'rejected') warnings.push('Mitarbeitende und Geburtstage konnten nicht aktualisiert werden.');
    if (clientsResult.status === 'rejected') warnings.push('Klient:innen und Geburtstage konnten nicht aktualisiert werden.');
    if (absencesResult.status === 'rejected') warnings.push('Abwesenheiten konnten nicht sicher geprüft werden.');
    const names = (rows: BirthdayRow[]) => new Map(rows.map((row) => [row.id, `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim()]));
    const employeeNames = names(employees), clientNames = names(clients);
    events = events.map((event) => ({ ...event,
      employeeName: event.employeeName?.trim() || employeeNames.get(event.employeeId ?? event.record?.relatedEmployeeId ?? ''),
      clientName: event.clientName?.trim() || clientNames.get(event.record?.relatedClientId ?? ''),
    }));
    // Birthday/holiday builders expect floating dates. Convert true range instants first.
    const dayStart = params.rangeStart ? `${toTimezoneDateKey(params.rangeStart)}T00:00:00.000Z` : undefined;
    const dayEnd = params.rangeEnd ? `${toTimezoneDateKey(params.rangeEnd)}T23:59:59.999Z` : undefined;
    events = mergeWorkspaceOperationalEvents(events, [
      ...buildAbsenceEvents(absences, employeeNames),
      ...buildBirthdayEvents(employees, 'employee', dayStart, dayEnd),
      ...buildBirthdayEvents(clients, 'client', dayStart, dayEnd),
      ...buildPublicHolidayEvents(dayStart, dayEnd),
    ]);
    return { ok: true, data: events, ...(warnings.length ? { refreshError: warnings.join(' ') } : {}) };
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : 'Der Kalender konnte nicht geladen werden.' };
  }
}
