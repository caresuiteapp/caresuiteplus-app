import type { RoleKey, ServiceResult } from '@/types';
import type { WfmAbsence, WfmTimeEvent, WfmWorkSession } from '@/types/modules/wfm';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { readAllOfficeAccountRows } from './wfmOfficeAccountTotals';
import { readStoredOfficeEntry } from './wfmOfficeStoredEntry.web';
import { listSessionsForDate, fetchSessionEvents } from './wfmWorkSessionRepository';
import { listWfmAbsencesForTeam } from './wfmAbsenceService';
import { listPendingWfmApprovals } from './wfmApprovalService';
import { listReviewsForPeriod, listReviewActionsForReviews, type WfmTimeEntryReview, type WfmTimeReviewAction } from './wfmTimeReviewService';

type Row = Record<string, unknown>;
const nullableText = (value: unknown): string | null => typeof value === 'string' ? value : null;

export function mapOfficeReviewRow(row: Row): WfmTimeEntryReview {
  return {
    id: String(row.id), tenantId: String(row.tenant_id), employeeId: String(row.employee_id), workDate: String(row.work_date),
    entryKind: row.entry_kind as WfmTimeEntryReview['entryKind'], referenceId: String(row.reference_id), referenceKey: String(row.reference_key),
    reviewStatus: row.review_status as WfmTimeEntryReview['reviewStatus'], exportBlocking: Boolean(row.export_blocking),
    reviewNote: nullableText(row.review_note), officeComment: nullableText(row.office_comment), reviewedAt: nullableText(row.reviewed_at),
    reviewedBy: nullableText(row.reviewed_by), updatedAt: nullableText(row.updated_at), exportStatus: nullableText(row.export_status) ?? undefined,
    metadata: (row.metadata ?? {}) as Row,
    officeEntry: readStoredOfficeEntry((row.metadata as Row | null)?.office_time_entry, String(row.tenant_id), String(row.employee_id), String(row.work_date)),
  };
}

async function readRows(read: () => ReturnType<typeof readAllOfficeAccountRows>): Promise<ServiceResult<Row[]>> {
  try {
    const result = await read();
    if (result.error) return { ok: false, error: result.error instanceof Error ? result.error.message : toGermanSupabaseError(result.error as import('@supabase/supabase-js').PostgrestError) };
    return { ok: true, data: result.data };
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : 'Die Arbeitszeitdaten konnten nicht vollständig geladen werden.' };
  }
}

/** Strict, paginated Web reads. Missing tables and failed pages never masquerade as empty results. */
export async function readOfficeSessions(tenantId: string, workDate: string): Promise<ServiceResult<WfmWorkSession[]>> {
  if (getServiceMode() !== 'supabase') return listSessionsForDate(tenantId, workDate);
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Keine Datenbankverbindung.' };
  const result = await readRows(() => readAllOfficeAccountRows((from, to) => fromUnknownTable(client, 'workforce_work_sessions')
    .select('*').eq('tenant_id', tenantId).eq('work_date', workDate).order('id').range(from, to)));
  if (!result.ok) return result;
  return { ok: true, data: result.data.map(row => ({
    id: String(row.id), tenantId: String(row.tenant_id), employeeId: String(row.employee_id), userId: nullableText(row.user_id), workDate: String(row.work_date),
    status: row.status as WfmWorkSession['status'], workMode: row.work_mode as WfmWorkSession['workMode'], displayStatus: row.display_status as WfmWorkSession['displayStatus'],
    startedAt: nullableText(row.started_at), endedAt: nullableText(row.ended_at), lastEventAt: nullableText(row.last_event_at),
    grossMinutes: Number(row.gross_minutes ?? 0), netMinutes: Number(row.net_minutes ?? 0), pauseMinutes: Number(row.pause_minutes ?? 0),
    isOnline: Boolean(row.is_online), locationLabel: nullableText(row.location_label), currentVisitId: nullableText(row.current_visit_id),
  })) };
}

export async function readOfficeEvents(tenantId: string, sessionId: string): Promise<ServiceResult<WfmTimeEvent[]>> {
  if (getServiceMode() !== 'supabase') return fetchSessionEvents(tenantId, sessionId);
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Keine Datenbankverbindung.' };
  const result = await readRows(() => readAllOfficeAccountRows((from, to) => fromUnknownTable(client, 'workforce_time_events')
    .select('*').eq('tenant_id', tenantId).eq('session_id', sessionId).order('occurred_at').order('id').range(from, to)));
  if (!result.ok) return result;
  return { ok: true, data: result.data.map(row => ({
    id: String(row.id), tenantId: String(row.tenant_id), employeeId: String(row.employee_id), userId: nullableText(row.user_id),
    eventType: row.event_type as WfmTimeEvent['eventType'], workMode: row.work_mode as WfmTimeEvent['workMode'], source: row.source as WfmTimeEvent['source'],
    occurredAt: String(row.occurred_at), sessionId: nullableText(row.session_id), note: nullableText(row.note),
    referenceType: row.reference_type as WfmTimeEvent['referenceType'], referenceId: nullableText(row.reference_id),
  })) };
}

export async function readOfficeReviews(tenantId: string, fromDate: string, toDate: string): Promise<ServiceResult<WfmTimeEntryReview[]>> {
  if (getServiceMode() !== 'supabase') return listReviewsForPeriod(tenantId, fromDate, toDate);
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Keine Datenbankverbindung.' };
  const result = await readRows(() => readAllOfficeAccountRows((from, to) => fromUnknownTable(client, 'workforce_time_entry_reviews')
    .select('*').eq('tenant_id', tenantId).gte('work_date', fromDate).lte('work_date', toDate).order('id').range(from, to)));
  return result.ok ? { ok: true, data: result.data.map(mapOfficeReviewRow) } : result;
}

export async function readOfficeReviewActions(tenantId: string, reviewIds: string[]): Promise<ServiceResult<WfmTimeReviewAction[]>> {
  if (getServiceMode() !== 'supabase') return listReviewActionsForReviews(tenantId, reviewIds);
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Keine Datenbankverbindung.' };
  const actions: WfmTimeReviewAction[] = [];
  const ids = [...new Set(reviewIds)];
  for (let index = 0; index < ids.length; index += 100) {
    const result = await readRows(() => readAllOfficeAccountRows((from, to) => fromUnknownTable(client, 'workforce_time_review_actions')
      .select('*').eq('tenant_id', tenantId).in('entry_review_id', ids.slice(index, index + 100)).order('created_at', { ascending: false }).order('id').range(from, to)));
    if (!result.ok) return result;
    actions.push(...result.data.map(row => ({
      id: String(row.id), tenantId: String(row.tenant_id), entryReviewId: String(row.entry_review_id),
      action: row.action as WfmTimeReviewAction['action'], prevStatus: row.prev_status as WfmTimeReviewAction['prevStatus'], newStatus: row.new_status as WfmTimeReviewAction['newStatus'],
      comment: nullableText(row.comment), actorId: nullableText(row.actor_id), createdAt: String(row.created_at), reason: nullableText(row.reason), oldValue: row.old_value, newValue: row.new_value,
    })));
  }
  actions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { ok: true, data: actions };
}

export async function readOfficeEmployees(tenantId: string): Promise<ServiceResult<Row[]>> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Keine Datenbankverbindung.' };
  return readRows(() => readAllOfficeAccountRows((from, to) => fromUnknownTable(client, 'employees')
    .select('id, tenant_id, first_name, last_name, status').eq('tenant_id', tenantId).order('id').range(from, to)));
}

export async function readOfficeAbsences(tenantId: string, role: RoleKey | null, fromDate: string, toDate: string): Promise<ServiceResult<WfmAbsence[]>> {
  const denied = enforcePermission(role, 'office.employees.absences.view');
  if (denied) return denied;
  if (getServiceMode() !== 'supabase') return listWfmAbsencesForTeam(tenantId, role);
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Keine Datenbankverbindung.' };
  const result = await readRows(() => readAllOfficeAccountRows((from, to) => fromUnknownTable(client, 'workforce_absences')
    .select('*').eq('tenant_id', tenantId).lte('starts_at', `${toDate}T23:59:59.999Z`).gte('ends_at', `${fromDate}T00:00:00+02:00`).order('id').range(from, to)));
  if (!result.ok) return result;
  return { ok: true, data: result.data.map(row => ({
    id: String(row.id), tenantId: String(row.tenant_id), employeeId: String(row.employee_id), absenceType: row.absence_type as WfmAbsence['absenceType'], status: row.status as WfmAbsence['status'],
    startsAt: String(row.starts_at), endsAt: String(row.ends_at), allDay: Boolean(row.all_day), requestedDays: row.requested_days == null ? null : Number(row.requested_days),
    employeeNote: String(row.employee_note ?? ''), internalNote: String(row.internal_note ?? ''), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  })) };
}

export async function readOfficePendingRequestCount(tenantId: string, role: RoleKey | null, employeeIds?: string[]): Promise<ServiceResult<number>> {
  const denied = enforcePermission(role, 'office.employees.absences.approve');
  if (denied) return { ok: true, data: 0 }; // This optional management KPI must not grant access to approval records.
  if (getServiceMode() !== 'supabase') {
    const result = await listPendingWfmApprovals(tenantId, role);
    return result.ok ? { ok: true, data: result.data.filter(row => ['vacation', 'absence'].includes(row.approvalType) && (!employeeIds?.length || employeeIds.includes(row.employeeId))).length } : result;
  }
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Keine Datenbankverbindung.' };
  const result = await readRows(() => readAllOfficeAccountRows((from, to) => {
    let query = fromUnknownTable(client, 'workforce_approvals').select('id, employee_id').eq('tenant_id', tenantId).eq('status', 'pending').in('approval_type', ['vacation', 'absence']);
    if (employeeIds?.length) query = query.in('employee_id', employeeIds);
    return query.order('id').range(from, to);
  }));
  return result.ok ? { ok: true, data: result.data.length } : result;
}
