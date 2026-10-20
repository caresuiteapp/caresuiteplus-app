import type { ServiceResult } from '@/types';
import type { WfmOfficePlannedVisit } from '@/types/modules/wfmOfficeTimekeeping';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { addAssistDays, assistBerlinDate, assistBerlinTimestamp, assistText, validAssistDate, type AssistWorkspaceRow } from '@/lib/assist/assistClientsWorkspaceModel.web';
import { expandAssistTourPlanningRows } from '@/lib/assist/assistTourPlanningModel.web';
// Explicit extension prevents the Web adapter resolving itself in demo mode.
import { listPlannedVisitsForPeriod as listDemoVisits, fetchActiveEmployeeIds as listDemoEmployees } from './wfmOfficePlannedVisitRepository.ts';
export { mapCanonicalVisitToPlannedVisit, resetWfmOfficePlannedVisitDemoStore, seedWfmOfficePlannedVisits } from './wfmOfficePlannedVisitRepository.ts';

const PAGE_SIZE = 200;
const COLUMNS = 'id,tenant_id,client_id,employee_id,legacy_assignment_id,title,service_name,assignment_date,planned_start_at,planned_end_at,actual_start_at,actual_end_at,on_the_way_at,arrived_at,finished_at,planning_status,execution_status,canonical_status,recurrence_json,updated_at';
const CANCELLED = new Set(['cancelled', 'canceled', 'storniert', 'no_show', 'nicht_erschienen']);
type Page = { data: unknown; error: unknown };
const object = (value: unknown): AssistWorkspaceRow => value && typeof value === 'object' && !Array.isArray(value) ? value as AssistWorkspaceRow : {};
async function pages(read: (from: number, to: number) => PromiseLike<Page>): Promise<AssistWorkspaceRow[]> {
  const rows: AssistWorkspaceRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await read(from, from + PAGE_SIZE - 1);
    if (result.error) throw result.error;
    if (!Array.isArray(result.data) || result.data.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('Unvollständige Datenantwort für die Einsatzzeiten.');
    rows.push(...result.data as AssistWorkspaceRow[]);
    if (result.data.length < PAGE_SIZE) return rows;
  }
}
async function chunks(ids: string[], read: (ids: string[], from: number, to: number) => PromiseLike<Page>) {
  const unique = [...new Set(ids)], result: AssistWorkspaceRow[] = [];
  for (let offset = 0; offset < unique.length; offset += 100) result.push(...await pages((from, to) => read(unique.slice(offset, offset + 100), from, to)));
  return result;
}

export function projectWorktimePlannedVisits(input: {
  tenantId: string; fromDate: string; toDate: string; visits: AssistWorkspaceRow[];
  clients: AssistWorkspaceRow[]; assignments: AssistWorkspaceRow[]; execution: AssistWorkspaceRow[];
}): WfmOfficePlannedVisit[] {
  const own = (rows: AssistWorkspaceRow[]) => rows.filter(row => row.tenant_id === input.tenantId);
  const visits = own(input.visits), byId = new Map(visits.map(row => [String(row.id), row]));
  const clients = new Map(own(input.clients).map(row => [String(row.id), row]));
  const assignments = new Map(own(input.assignments).map(row => [String(row.id), row]));
  const execution = new Map(own(input.execution).map(row => [String(row.visit_id), row]));
  const result = new Map<string, WfmOfficePlannedVisit>();
  for (let date = input.fromDate; date <= input.toDate; date = addAssistDays(date, 1)) {
    for (const row of expandAssistTourPlanningRows({ tenantId: input.tenantId, date, visits })) {
      const start = new Date(String(row.planned_start_at)), end = new Date(String(row.planned_end_at));
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) throw new Error('Ein Einsatz enthält ungültige Planzeiten.');
      const workDate = assistBerlinDate(start), employeeId = assistText(row.employee_id);
      if (workDate !== date || !employeeId || row.planning_status === 'draft') continue;
      const recurrence = object(row.recurrence_json), parent = byId.get(String(recurrence.parentSeriesId));
      // A copied master mirror is never evidence for a different occurrence.
      const sharedMirror = Boolean(recurrence.parentSeriesId && (!parent || parent.legacy_assignment_id === row.legacy_assignment_id));
      const virtual = row.is_virtual === true;
      const mirror = !virtual && !sharedMirror ? assignments.get(String(row.legacy_assignment_id)) : undefined;
      const state = !virtual ? execution.get(String(row.id)) ?? (!sharedMirror ? execution.get(String(row.legacy_assignment_id)) : undefined) : undefined;
      const statuses = [row.planning_status, row.canonical_status, row.execution_status, mirror?.status, state?.assignment_status].map(value => String(value ?? ''));
      if (statuses.some(status => CANCELLED.has(status))) continue;
      const client = clients.get(String(row.client_id));
      const actualStart = virtual ? null : assistText(state?.service_started_at) ?? assistText(row.actual_start_at) ?? assistText(mirror?.actual_start_at);
      const actualEnd = virtual ? null : assistText(state?.service_ended_at) ?? assistText(row.actual_end_at) ?? assistText(row.finished_at) ?? assistText(mirror?.actual_end_at) ?? assistText(mirror?.finished_at);
      result.set(String(row.id), {
        assignmentId: String(row.id), visitId: String(row.id), tenantId: input.tenantId, employeeId, workDate,
        plannedStartAt: start.toISOString(), plannedEndAt: end.toISOString(), plannedDurationMinutes: Math.round((end.getTime() - start.getTime()) / 60000),
        assignmentActualStartAt: actualStart, assignmentActualEndAt: actualEnd,
        assignmentOnTheWayAt: virtual ? null : assistText(state?.travel_started_at) ?? assistText(row.on_the_way_at),
        assignmentArrivedAt: virtual ? null : assistText(state?.travel_ended_at) ?? assistText(row.arrived_at),
        assignmentFinishedAt: actualEnd,
        clientLabel: client ? assistText([client.first_name, client.last_name].filter(Boolean).join(' ')) ?? assistText(client.full_name) : null,
        assignmentTitle: assistText(row.service_name) ?? assistText(row.title) ?? 'Einsatz',
        assignmentStatus: actualEnd ? 'beendet' : actualStart ? 'gestartet' : virtual ? 'bestaetigt' : assistText(state?.assignment_status) ?? assistText(row.canonical_status) ?? 'geplant',
      });
    }
  }
  return [...result.values()].sort((a, b) => (a.plannedStartAt ?? '').localeCompare(b.plannedStartAt ?? '') || a.assignmentId.localeCompare(b.assignmentId));
}

export async function listPlannedVisitsForPeriod(tenantId: string, fromDate: string, toDate: string): Promise<ServiceResult<WfmOfficePlannedVisit[]>> {
  const denied = guardServiceTenant(tenantId); if (denied) return denied;
  if (!validAssistDate(fromDate) || !validAssistDate(toDate) || toDate < fromDate || Date.parse(toDate) - Date.parse(fromDate) > 366 * 86400000) return { ok: false, error: 'Bitte einen gültigen Zeitraum von höchstens einem Jahr wählen.' };
  if (getServiceMode() !== 'supabase') return listDemoVisits(tenantId, fromDate, toDate);
  const db = getSupabaseClient(); if (!db) return { ok: false, error: 'Die Datenverbindung ist nicht verfügbar.' };
  const query = (table: string, select: string) => fromUnknownTable(db, table).select(select).eq('tenant_id', tenantId);
  try {
    const [concrete, recurring, displaced] = await Promise.all([
      pages((from, to) => query('assist_visits', COLUMNS).gte('planned_start_at', assistBerlinTimestamp(fromDate)).lt('planned_start_at', assistBerlinTimestamp(addAssistDays(toDate, 1))).order('id').range(from, to)),
      pages((from, to) => query('assist_visits', COLUMNS).neq('recurrence_json->>pattern', 'none').lte('assignment_date', toDate).order('id').range(from, to)),
      pages((from, to) => query('assist_visits', COLUMNS).gte('recurrence_json->>sourceOccurrenceDate', fromDate).lte('recurrence_json->>sourceOccurrenceDate', toDate).order('id').range(from, to)),
    ]);
    const visits = [...new Map([...concrete, ...recurring, ...displaced].filter(row => row.tenant_id === tenantId).map(row => [String(row.id), row])).values()];
    const ids = (field: string) => visits.map(row => assistText(row[field])).filter((id): id is string => Boolean(id));
    const [clients, assignments, execution] = await Promise.all([
      chunks(ids('client_id'), (group, from, to) => query('clients', 'id,tenant_id,first_name,last_name,full_name').in('id', group).order('id').range(from, to)),
      chunks(ids('legacy_assignment_id'), (group, from, to) => query('assignments', 'id,tenant_id,status,actual_start_at,actual_end_at,finished_at').in('id', group).order('id').range(from, to)),
      chunks([...ids('id'), ...ids('legacy_assignment_id')], (group, from, to) => query('assist_visit_execution_state', 'id,tenant_id,visit_id,assignment_status,service_started_at,service_ended_at,travel_started_at,travel_ended_at').in('visit_id', group).order('id').range(from, to)),
    ]);
    return { ok: true, data: projectWorktimePlannedVisits({ tenantId, fromDate, toDate, visits, clients, assignments, execution }) };
  } catch (error) { return { ok: false, error: `Einsatzzeiten konnten nicht vollständig geladen werden. ${error instanceof Error ? error.message : toGermanSupabaseError(error)}` }; }
}

export async function fetchActiveEmployeeIds(tenantId: string): Promise<ServiceResult<string[]>> {
  const denied = guardServiceTenant(tenantId); if (denied) return denied;
  if (getServiceMode() !== 'supabase') return listDemoEmployees(tenantId);
  const db = getSupabaseClient(); if (!db) return { ok: false, error: 'Die Datenverbindung ist nicht verfügbar.' };
  try {
    const rows = await pages((from, to) => fromUnknownTable(db, 'employees').select('id,tenant_id,status,deleted_at').eq('tenant_id', tenantId).is('deleted_at', null).order('id').range(from, to));
    return { ok: true, data: rows.filter(row => row.tenant_id === tenantId && String(row.status).toLowerCase() === 'active').map(row => String(row.id)) };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : toGermanSupabaseError(error) }; }
}
