import type { RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { runService } from '@/lib/services/serviceRunner';
import { activeAssistAssignments, addAssistDays, assistBerlinTimestamp, assistText, assistWorkspaceCoverage,
  buildAssistClientsWorkspace, type AssistClientsWorkspaceSnapshot, type AssistWorkspaceRow } from './assistClientsWorkspaceModel.web';
export type { AssistWorkspaceClient, AssistWorkspaceVisit, AssistClientsWorkspaceSnapshot } from './assistClientsWorkspaceModel.web';

type ReadResult = { data: AssistWorkspaceRow[] | null; error: unknown };
type RawReadResult = { data: unknown; error: unknown };
const PAGE_SIZE = 500;
const PERSON_COLUMNS = 'id,tenant_id,client_number,first_name,last_name,full_name,date_of_birth,care_level,status,phone,mobile,email,street,house_number,postal_code,city,cost_bearer,insurance_name,insurance_number,billing_party,deleted_at';
const VISIT_COLUMNS = 'id,tenant_id,client_id,employee_id,legacy_assignment_id,title,service_name,assignment_date,planned_start_at,planned_end_at,actual_start_at,actual_end_at,finished_at,planning_status,execution_status,canonical_status,recurrence_json,updated_at,on_the_way_at,arrived_at,documentation_status,proof_status';
function isWorkspaceRows(value: unknown): value is AssistWorkspaceRow[] {
  return Array.isArray(value) && value.every(row => row !== null && typeof row === 'object' && !Array.isArray(row));
}
async function readPages(makePage: (from: number, to: number) => PromiseLike<RawReadResult>): Promise<ReadResult> {
  const data: AssistWorkspaceRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await makePage(offset, offset + PAGE_SIZE - 1);
    if (page.error) return { data: null, error: page.error };
    if (!isWorkspaceRows(page.data)) return { data: null, error: { message: 'Die Datenantwort ist unvollständig.' } };
    data.push(...page.data);
    if (page.data.length < PAGE_SIZE) return { data, error: null };
  }
}
function chunks(ids: string[]): string[][] {
  const result: string[][] = [];
  for (let index = 0; index < ids.length; index += 100) result.push(ids.slice(index, index + 100));
  return result;
}
async function readChunks(ids: string[], makePage: (ids: string[], from: number, to: number) => PromiseLike<RawReadResult>): Promise<ReadResult> {
  const data: AssistWorkspaceRow[] = [];
  for (const group of chunks([...new Set(ids)])) {
    const result = await readPages((from, to) => makePage(group, from, to));
    if (result.error) return result;
    data.push(...(result.data ?? []));
  }
  return { data, error: null };
}
function errorMessage(context: string, error: unknown): string { return `${context} ${toGermanSupabaseError(error)}`; }

/** Only reads the active Assist roster and its own planning. No financial bulk fetches or mutations. */
export async function fetchAssistClientsWorkspace(input: {
  tenantId: string; roleKey: RoleKey | null; effectivePermissions: readonly PermissionKey[]; now?: Date;
}): Promise<ServiceResult<AssistClientsWorkspaceSnapshot>> {
  return runService(async () => {
    const blocked = guardServiceTenant(input.tenantId); if (blocked) return blocked;
    const { tenantId, roleKey, effectivePermissions } = input;
    if (!roleKey || roleKey.endsWith('_portal') || !['assist.access', 'office.access', 'office.clients.view'].every(key => effectivePermissions.includes(key as PermissionKey))) {
      return { ok: false, error: 'Für diese Übersicht fehlen die Freigaben für Assist und die Klientenakten.' };
    }
    const now = input.now ?? new Date();
    if (!Number.isFinite(now.getTime())) return { ok: false, error: 'Der Planungszeitpunkt ist ungültig.' };
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'Die Datenverbindung ist nicht verfügbar. Bitte erneut versuchen.' };
    const coverage = assistWorkspaceCoverage(now);
    const query = (table: string, columns: string) => fromUnknownTable(supabase, table).select(columns).eq('tenant_id', tenantId);
    const assignmentsResult = await readPages((from, to) => query('client_module_assignments', 'id,tenant_id,client_id,module_key,assigned_at,status,primary_employee_id,is_active,updated_at')
      .eq('module_key', 'assist').eq('is_active', true).lte('assigned_at', now.toISOString()).order('id').range(from, to));
    if (assignmentsResult.error) return { ok: false, error: errorMessage('Assist-Zuordnungen konnten nicht geladen werden.', assignmentsResult.error) };
    const assignments = activeAssistAssignments(assignmentsResult.data ?? [], tenantId, now);
    const clientIds = assignments.map(row => String(row.client_id));
    const empty = { tenantId, now, assignments, people: [], entitlements: [], careLevels: [], insurance: [], employees: [], visits: [], employeesAvailable: false,
      visitsAvailable: effectivePermissions.includes('assist.assignments.view'), visitsError: effectivePermissions.includes('assist.assignments.view') ? null : 'Für die Einsatzplanung fehlt die Leseberechtigung.' };
    if (!clientIds.length) return { ok: true, data: buildAssistClientsWorkspace(empty) };
    const byClients = (table: string, columns: string, idColumn = 'client_id') => readChunks(clientIds, (ids, from, to) => query(table, columns).in(idColumn, ids).order('id').range(from, to));
    const [people, entitlements, careLevels, insurance] = await Promise.all([
      byClients('clients', PERSON_COLUMNS, 'id'),
      byClients('client_care_entitlement', 'id,tenant_id,client_id,care_grade,valid_from,valid_until,care_fund_name,care_fund_member_id,updated_at'),
      byClients('client_care_levels', 'id,tenant_id,client_id,grade,valid_from,valid_until,care_fund_name,care_fund_member_id,updated_at'),
      byClients('client_insurance_profiles', 'id,tenant_id,client_id,care_level,care_level_valid_from,care_fund_name,health_insurance,insurance_number,self_pay,is_primary,updated_at'),
    ]);
    for (const result of [people, entitlements, careLevels, insurance]) {
      if (result.error) return { ok: false, error: errorMessage('Die Klientenangaben konnten nicht vollständig geladen werden.', result.error) };
    }
    const allowedClients = new Set((people.data ?? []).filter(row => row.tenant_id === tenantId && !row.deleted_at && !['deleted', 'archived', 'archiviert'].includes(String(row.status))).map(row => String(row.id)));
    const planningIds = clientIds.filter(id => allowedClients.has(id));
    let visitsAvailable = effectivePermissions.includes('assist.assignments.view');
    let visitsError: string | null = visitsAvailable ? null : 'Für die Einsatzplanung fehlt die Leseberechtigung.';
    let visits: AssistWorkspaceRow[] = [], legacyAssignments: AssistWorkspaceRow[] = [], executionStates: AssistWorkspaceRow[] = [];
    if (visitsAvailable && planningIds.length) {
      try {
        const start = assistBerlinTimestamp(addAssistDays(coverage.fromDate, -1));
        const end = assistBerlinTimestamp(addAssistDays(coverage.toDate, 1));
        const [concrete, recurring, ongoing] = await Promise.all([
          readChunks(planningIds, (ids, from, to) => query('assist_visits', VISIT_COLUMNS).in('client_id', ids).gte('planned_end_at', start).lt('planned_start_at', end).order('id').range(from, to)),
          readChunks(planningIds, (ids, from, to) => query('assist_visits', VISIT_COLUMNS).in('client_id', ids).neq('recurrence_json->>pattern', 'none').lte('assignment_date', coverage.toDate).order('id').range(from, to)),
          readChunks(planningIds, (ids, from, to) => query('assist_visits', VISIT_COLUMNS).in('client_id', ids).lt('planned_start_at', end).is('actual_end_at', null).is('finished_at', null)
            .or('canonical_status.in.(on_the_way,arrived,started,paused),execution_status.in.(on_way,arrived,in_progress,paused),actual_start_at.not.is.null').order('id').range(from, to)),
        ]);
        if (concrete.error || recurring.error || ongoing.error) throw concrete.error ?? recurring.error ?? ongoing.error;
        visits = [...new Map([...(concrete.data ?? []), ...(recurring.data ?? []), ...(ongoing.data ?? [])].filter(row => row.tenant_id === tenantId && allowedClients.has(String(row.client_id))).map(row => [String(row.id), row])).values()];
        const legacyIds = visits.map(row => assistText(row.legacy_assignment_id)).filter((id): id is string => Boolean(id));
        const visitIds = visits.map(row => String(row.id));
        const [legacy, execution] = await Promise.all([
          readChunks(legacyIds, (ids, from, to) => query('assignments', 'id,tenant_id,status,actual_start_at,actual_end_at,finished_at').in('id', ids).order('id').range(from, to)),
          readChunks([...visitIds, ...legacyIds], (ids, from, to) => query('assist_visit_execution_state', 'id,tenant_id,visit_id,assignment_status,service_ended_at,service_started_at,travel_started_at,travel_ended_at,documentation_complete,signature_complete').in('visit_id', ids).order('id').range(from, to)),
        ]);
        if (legacy.error || execution.error) throw legacy.error ?? execution.error;
        legacyAssignments = legacy.data ?? []; executionStates = execution.data ?? [];
      } catch (error) {
        visitsAvailable = false; visits = [];
        visitsError = errorMessage('Die Einsatzplanung konnte nicht vollständig geladen werden.', error);
      }
    }
    const canReadEmployees = effectivePermissions.includes('office.employees.view') || effectivePermissions.includes('assist.assignments.manage');
    let employeesAvailable = canReadEmployees;
    let employees: AssistWorkspaceRow[] = [];
    let employeeWarning: string | null = null;
    if (canReadEmployees) {
      const employeeIds = [...assignments.map(row => assistText(row.primary_employee_id)), ...visits.map(row => assistText(row.employee_id))].filter((id): id is string => Boolean(id));
      try {
        const result = await readChunks(employeeIds, (ids, from, to) => query('employees', 'id,tenant_id,first_name,last_name,full_name,status,entry_date,exit_date,deleted_at').in('id', ids).order('id').range(from, to));
        if (result.error) throw result.error;
        employees = result.data ?? [];
      } catch {
        employeesAvailable = false; employeeWarning = 'Die Namen der zuständigen und eingeplanten Mitarbeitenden konnten nicht geladen werden. Die Zuordnungen bleiben erhalten.';
      }
    } else {
      employeeWarning = 'Mitarbeitendennamen sind für diesen Zugang nicht freigegeben. Die Zuordnungen bleiben erhalten.';
    }
    const snapshot = buildAssistClientsWorkspace({ tenantId, now, assignments, people: people.data ?? [], entitlements: entitlements.data ?? [], careLevels: careLevels.data ?? [], insurance: insurance.data ?? [],
      visits, legacyAssignments, executionStates, employees, employeesAvailable, visitsAvailable, visitsError });
    if (employeeWarning) snapshot.warnings.push(employeeWarning);
    return { ok: true, data: snapshot };
  });
}
