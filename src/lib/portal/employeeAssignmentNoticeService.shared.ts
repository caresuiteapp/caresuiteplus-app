import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { resolvePortalEmployeeLinkForAuthUser } from './resolvePortalEmployeeLink';

export type EmployeeAssignmentNoticeScope = { tenantId: string; employeeId: string; authUserId: string };
export type EmployeeAssignmentNotice = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  visitId: string | null;
  changeKind: string;
};
export type EmployeeAssignmentNoticeInbox = { notices: EmployeeAssignmentNotice[]; total: number };
const TABLE = 'office_notifications';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SCOPE_ERROR = 'Ihre Mitarbeitenden-Zuordnung konnte nicht bestätigt werden. Bitte erneut anmelden.';

export function assignmentNoticeChangeLabel(kind: string): string {
  return ({ created: 'Neuer Einsatz', changed: 'Einsatz geändert', cancelled: 'Einsatz abgesagt',
    removed: 'Einsatz nicht mehr zugeordnet', current_plan: 'Aktuelle Einsatzplanung' } as Record<string, string>)[kind]
    ?? 'Einsatz aktualisiert';
}

function noticeBody(metadata: Record<string, unknown>, preview: unknown): string {
  if (typeof preview === 'string' && preview.trim()) return preview.trim();
  const start = typeof metadata.plannedStartAt === 'string' ? new Date(metadata.plannedStartAt) : null;
  const end = typeof metadata.plannedEndAt === 'string' ? new Date(metadata.plannedEndAt) : null;
  if (start && Number.isFinite(start.getTime())) {
    const date = start.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit',
      year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const until = end && Number.isFinite(end.getTime()) ? ` bis ${end.toLocaleString('de-DE', {
      timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : '';
    return `Einsatz am ${date}${until} Uhr (Berliner Zeit).`;
  }
  return 'Bitte prüfen Sie Ihre aktuelle Einsatzplanung im Kalender.';
}

async function verifyScope(scope: EmployeeAssignmentNoticeScope): Promise<ServiceResult<void>> {
  const blocked = guardServiceTenant(scope.tenantId);
  if (blocked) return blocked;
  if (!scope.employeeId || !scope.authUserId) return { ok: false, error: SCOPE_ERROR };
  const link = await resolvePortalEmployeeLinkForAuthUser(scope.tenantId);
  return link.status === 'verified' && link.employeeId === scope.employeeId && link.authUserId === scope.authUserId
    ? { ok: true, data: undefined } : { ok: false, error: SCOPE_ERROR };
}

function isOwnRow(row: Record<string, unknown>, scope: EmployeeAssignmentNoticeScope): boolean {
  return row.tenant_id === scope.tenantId && row.recipient_employee_id === scope.employeeId;
}

/** Durable notices are separate from assignment acceptance and execution status. */
export async function fetchEmployeeAssignmentNotices(
  scope: EmployeeAssignmentNoticeScope,
): Promise<ServiceResult<EmployeeAssignmentNoticeInbox>> {
  const verified = await verifyScope(scope);
  if (!verified.ok) return verified;
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Benachrichtigungen sind derzeit nicht erreichbar.' };
  const { data, error, count } = await fromUnknownTable(client, TABLE)
    .select('id,tenant_id,recipient_employee_id,notification_type,title,body_preview,metadata,is_read,created_at', { count: 'exact' })
    .eq('tenant_id', scope.tenantId).eq('recipient_employee_id', scope.employeeId)
    .eq('notification_type', 'appointment').eq('is_read', false)
    .contains('metadata', { kind: 'assignment_change' })
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50);
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const notices: EmployeeAssignmentNotice[] = [];
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const metadata = row.metadata as Record<string, unknown> | null;
    // Defence in depth: never display a row outside the verified recipient scope.
    if (!isOwnRow(row, scope) || row.notification_type !== 'appointment' || row.is_read !== false
      || metadata?.kind !== 'assignment_change') continue;
    if (typeof row.id !== 'string' || !UUID.test(row.id)) continue;
    const changeKind = typeof metadata.changeKind === 'string' ? metadata.changeKind : 'changed';
    notices.push({ id: row.id, title: typeof row.title === 'string' && row.title.trim()
      ? row.title.trim() : assignmentNoticeChangeLabel(changeKind),
      body: noticeBody(metadata, row.body_preview), createdAt: String(row.created_at ?? ''),
      visitId: typeof metadata.visitId === 'string' && UUID.test(metadata.visitId) ? metadata.visitId : null,
      changeKind });
  }
  return { ok: true, data: { notices, total: Math.max(notices.length, count ?? 0) } };
}

export async function acknowledgeEmployeeAssignmentNotices(
  scope: EmployeeAssignmentNoticeScope, noticeIds: readonly string[],
): Promise<ServiceResult<void>> {
  const ids = [...new Set(noticeIds)];
  if (!ids.length || ids.length > 50 || ids.some(id => !UUID.test(id))) {
    return { ok: false, error: 'Bitte die angezeigten Einsatzinfos erneut laden.' };
  }
  const verified = await verifyScope(scope);
  if (!verified.ok) return verified;
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Lesebestätigung ist derzeit nicht erreichbar.' };
  const { data, error } = await fromUnknownTable(client, TABLE)
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('tenant_id', scope.tenantId).eq('recipient_employee_id', scope.employeeId)
    .eq('notification_type', 'appointment').contains('metadata', { kind: 'assignment_change' })
    .in('id', ids).select('id,tenant_id,recipient_employee_id,is_read');
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const confirmed = new Set(((data ?? []) as Record<string, unknown>[])
    .filter(row => isOwnRow(row, scope) && row.is_read === true).map(row => String(row.id)));
  if (ids.some(id => !confirmed.has(id))) {
    return { ok: false, error: 'Die Lesebestätigung wurde nicht vollständig gespeichert. Bitte erneut versuchen.' };
  }
  return { ok: true, data: undefined };
}

/** A historic notice is not proof that this employee still owns the visit. */
export async function resolveEmployeeAssignmentNoticeRoute(
  scope: EmployeeAssignmentNoticeScope, notice: EmployeeAssignmentNotice,
): Promise<ServiceResult<string>> {
  if (notice.changeKind !== 'current_plan'
    && (!notice.visitId || !UUID.test(notice.visitId) || !['created', 'changed'].includes(notice.changeKind))) {
    return { ok: false, error: 'Dieser Einsatz ist nicht mehr zum Öffnen verfügbar.' };
  }
  const verified = await verifyScope(scope);
  if (!verified.ok) return verified;
  if (notice.changeKind === 'current_plan') return { ok: true, data: '/portal/employee/calendar' };
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Einsatz ist derzeit nicht erreichbar.' };
  const { data, error } = await fromUnknownTable(client, 'assist_visits')
    .select('id,tenant_id,employee_id,planning_status,canonical_status,recurrence_json')
    .eq('tenant_id', scope.tenantId).eq('employee_id', scope.employeeId).eq('id', notice.visitId).maybeSingle();
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  if (!data || data.tenant_id !== scope.tenantId || data.employee_id !== scope.employeeId
    || ['draft', 'cancelled'].includes(String(data.planning_status))
    || ['cancelled', 'no_show'].includes(String(data.canonical_status))) {
    return { ok: false, error: 'Der Einsatz wurde inzwischen geändert oder ist Ihnen nicht mehr zugeordnet. Bitte den aktuellen Kalender prüfen.' };
  }
  const recurrence = data.recurrence_json;
  const pattern = recurrence && typeof recurrence === 'object' && !Array.isArray(recurrence)
    ? (recurrence as Record<string, unknown>).pattern : null;
  // A series notice concerns its current occurrences, even if the original
  // master visit is already completed. Concrete children retain pattern=none.
  if (typeof pattern === 'string' && pattern.trim() && pattern !== 'none') {
    return { ok: true, data: '/portal/employee/calendar' };
  }
  return { ok: true, data: `/portal/employee/assignments/${notice.visitId}/execute` };
}
