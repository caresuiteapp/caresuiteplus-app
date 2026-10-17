import type { RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { addAssistDays, assistBerlinTimestamp, assistText, validAssistDate, type AssistWorkspaceRow } from './assistClientsWorkspaceModel.web';
import { buildAssistTourPlanning, type AssistTourChecks, type AssistTourPlanningSnapshot } from './assistTourPlanningModel.web';
export type { AssistTourPlanningSnapshot, AssistTourVisit, AssistTourEmployee, AssistTour, AssistTourIssue, AssistReplacementCandidate } from './assistTourPlanningModel.web';
export { getAssistReplacementCandidates } from './assistTourPlanningModel.web';

type RawResult = { data: unknown; error: unknown };
const PAGE_SIZE = 500;
const VISIT_COLUMNS = 'id,tenant_id,client_id,employee_id,legacy_assignment_id,title,service_name,assignment_date,planned_start_at,planned_end_at,actual_start_at,actual_end_at,finished_at,address_snapshot,planning_status,execution_status,canonical_status,recurrence_json,updated_at,on_the_way_at,arrived_at,documentation_status,proof_status,billing_status';
function rows(value: unknown): value is AssistWorkspaceRow[] {
  return Array.isArray(value) && value.every(row => row !== null && typeof row === 'object' && !Array.isArray(row));
}
async function readPages(makePage: (from: number, to: number) => PromiseLike<RawResult>): Promise<AssistWorkspaceRow[]> {
  const result: AssistWorkspaceRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await makePage(offset, offset + PAGE_SIZE - 1);
    if (page.error) throw page.error;
    if (!rows(page.data)) throw new Error('Die Datenantwort ist unvollständig.');
    result.push(...page.data);
    if (page.data.length < PAGE_SIZE) return result;
  }
}
async function readChunks(ids: string[], makePage: (group: string[], from: number, to: number) => PromiseLike<RawResult>): Promise<AssistWorkspaceRow[]> {
  const unique = [...new Set(ids)], result: AssistWorkspaceRow[] = [];
  for (let offset = 0; offset < unique.length; offset += 100) result.push(...await readPages((from, to) => makePage(unique.slice(offset, offset + 100), from, to)));
  return result;
}

/** A read-only projection of saved visits. Tour order is the real planned time, never a local demo route. */
export async function fetchAssistTourPlanning(input: {
  tenantId: string; roleKey: RoleKey | null; effectivePermissions: readonly PermissionKey[]; date: string; now?: Date;
}): Promise<ServiceResult<AssistTourPlanningSnapshot>> {
  const denied = guardServiceTenant(input.tenantId);
  if (denied) return denied;
  const can = (key: PermissionKey) => input.effectivePermissions.includes(key);
  if (!input.roleKey || input.roleKey.endsWith('_portal') || !can('assist.access') || !can('assist.assignments.view')) return { ok: false, error: 'Keine Leseberechtigung für die Tourenplanung.' };
  const now = input.now ?? new Date();
  if (!validAssistDate(input.date) || !Number.isFinite(now.getTime())) return { ok: false, error: 'Bitte einen gültigen Planungstag wählen.' };
  const db = getSupabaseClient();
  if (!db) return { ok: false, error: 'Die Datenverbindung ist nicht verfügbar. Bitte erneut versuchen.' };
  const tenantId = input.tenantId, date = input.date;
  const query = (table: string, columns: string) => fromUnknownTable(db, table).select(columns).eq('tenant_id', tenantId);
  const warnings: string[] = [];
  const checks: AssistTourChecks = { employees: 'unknown', availability: 'unknown', absences: 'unknown', qualifications: 'unknown' };
  const optional = async (key: keyof AssistTourChecks, enabled: boolean, load: () => Promise<AssistWorkspaceRow[]>, message: string) => {
    if (!enabled) { warnings.push(message); return []; }
    try { const result = await load(); checks[key] = 'ready'; return result; }
    catch { warnings.push(message); return []; }
  };
  try {
    const start = assistBerlinTimestamp(date), end = assistBerlinTimestamp(addAssistDays(date, 1));
    const [concrete, recurring, displaced] = await Promise.all([
      readPages((from, to) => query('assist_visits', VISIT_COLUMNS).lt('planned_start_at', end).gt('planned_end_at', start).order('id').range(from, to)),
      readPages((from, to) => query('assist_visits', VISIT_COLUMNS).neq('recurrence_json->>pattern', 'none').lte('assignment_date', date).order('id').range(from, to)),
      readPages((from, to) => query('assist_visits', VISIT_COLUMNS).in('recurrence_json->>sourceOccurrenceDate', [addAssistDays(date, -1), date]).order('id').range(from, to)),
    ]);
    const visits = [...new Map([...concrete, ...recurring, ...displaced].filter(row => row.tenant_id === tenantId).map(row => [String(row.id), row])).values()];
    const clientIds = visits.map(row => assistText(row.client_id)).filter((id): id is string => Boolean(id));
    const legacyIds = visits.map(row => assistText(row.legacy_assignment_id)).filter((id): id is string => Boolean(id));
    const canEmployees = can('office.employees.view') || can('assist.assignments.manage');
    const canPlanning = can('assist.assignments.manage') || can('office.employees.absences.view') || can('office.employees.absences.manage');
    const canAbsences = can('office.employees.absences.view') || can('office.employees.absences.manage') || can('office.employees.absences.approve');
    const [clients, employees, legacyAssignments, executionStates, plans, absences, qualifications] = await Promise.all([
      readChunks(clientIds, (ids, from, to) => query('clients', 'id,tenant_id,first_name,last_name,full_name,street,house_number,postal_code,city').in('id', ids).order('id').range(from, to)),
      optional('employees', canEmployees, () => readPages((from, to) => query('employees', 'id,tenant_id,first_name,last_name,full_name,role_title,status,entry_date,exit_date,deleted_at').is('deleted_at', null).order('id').range(from, to)), 'Personalangaben können für diesen Zugang nicht vollständig geprüft werden.'),
      readChunks(legacyIds, (ids, from, to) => query('assignments', 'id,tenant_id,status,actual_start_at,actual_end_at,finished_at').in('id', ids).order('id').range(from, to)),
      readChunks([...visits.map(row => String(row.id)), ...legacyIds], (ids, from, to) => query('assist_visit_execution_state', 'id,tenant_id,visit_id,assignment_status,service_ended_at,service_started_at,travel_started_at,travel_ended_at,documentation_complete,signature_complete').in('visit_id', ids).order('id').range(from, to)),
      optional('availability', canPlanning, () => readPages((from, to) => query('calendar_employee_month_plans', 'tenant_id,employee_id,month,revision,slots').gte('month', addAssistDays(date, -1).slice(0, 7) + '-01').lte('month', addAssistDays(date, 1).slice(0, 7) + '-01').order('month').order('employee_id').range(from, to)), 'Verfügbarkeiten konnten nicht geprüft werden. Unbekannte Zeiträume gelten nicht als frei.'),
      optional('absences', canAbsences, () => readPages((from, to) => query('workforce_absences', 'id,tenant_id,employee_id,starts_at,ends_at,all_day,status').in('status', ['requested', 'approved', 'active', 'completed']).gte('ends_at', assistBerlinTimestamp(addAssistDays(date, -1))).lt('starts_at', assistBerlinTimestamp(addAssistDays(date, 2))).order('id').range(from, to)), 'Abwesenheiten konnten nicht geprüft werden.'),
      optional('qualifications', can('office.employees.view'), () => readPages((from, to) => query('employee_qualifications', 'id,tenant_id,employee_id,qualification_type,title,issued_at,valid_until,verified_at,status').order('id').range(from, to)), 'Qualifikationsnachweise konnten nicht geprüft werden.'),
    ]);
    return { ok: true, data: buildAssistTourPlanning({ tenantId, date, now, visits, clients, employees, legacyAssignments, executionStates, plans, absences, qualifications, checks, warnings }) };
  } catch (error) {
    return { ok: false, error: `Die Tourenplanung konnte nicht vollständig geladen werden. ${error instanceof Error ? error.message : toGermanSupabaseError(error)}` };
  }
}
