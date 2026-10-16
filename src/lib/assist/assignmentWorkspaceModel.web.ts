import type { AssignmentListItem } from '@/types/modules/assist';
import { remoteStatusToAssignment } from './assignmentStatusBridge';
import { assignmentStatusToDimensions, deriveAssignmentStatusFromVisitDimensions } from './visitWorkflow';
import type { VisitDocumentationStatus, VisitExecutionStatus, VisitProofStatus } from './visitTypes';

export type AssignmentWorkspaceStatus = 'planned' | 'running' | 'follow_up' | 'completed' | 'cancelled' | 'draft' | 'no_show';
export type AssignmentWorkspaceStatusFilter = AssignmentWorkspaceStatus | 'all';
export type AssignmentWorkspaceDateRange = 'all' | 'today' | 'tomorrow' | 'week' | 'month' | 'custom';
export type AssignmentWorkspaceSort = 'time_asc' | 'time_desc' | 'client_asc';
export const ASSIGNMENT_WORKSPACE_STATUS_LABELS: Record<AssignmentWorkspaceStatus, string> = {
  planned: 'Geplant', running: 'Laufend', follow_up: 'Nachbearbeitung', completed: 'Abgeschlossen',
  cancelled: 'Abgesagt', draft: 'Entwurf', no_show: 'Nicht erschienen',
};
export const ASSIGNMENT_DATE_RANGE_OPTIONS: { key: AssignmentWorkspaceDateRange; label: string }[] = [
  { key: 'today', label: 'Heute' }, { key: 'tomorrow', label: 'Morgen' },
  { key: 'week', label: 'Diese Woche' }, { key: 'month', label: 'Dieser Monat' },
  { key: 'custom', label: 'Eigener Zeitraum' }, { key: 'all', label: 'Alle Zeiträume' },
];
export const ASSIGNMENT_WORKSPACE_STATUS_FILTERS: { key: AssignmentWorkspaceStatusFilter; label: string }[] = [
  { key: 'all', label: 'Alle Status' },
  ...Object.entries(ASSIGNMENT_WORKSPACE_STATUS_LABELS).map(([key, label]) => ({ key: key as AssignmentWorkspaceStatus, label })),
];

/** Conduct, follow-up and planning are different states; confirmed planning is not an open visit. */
export function resolveAssignmentWorkspaceStatus(item: AssignmentListItem): AssignmentWorkspaceStatus {
  const canonical = item.assignmentStatus ?? remoteStatusToAssignment(item.status);
  const fallback = assignmentStatusToDimensions(canonical);
  const execution = (item.executionStatus ?? fallback.execution) as VisitExecutionStatus;
  if (canonical === 'storniert' || execution === 'cancelled' || item.planningStatus === 'cancelled') return 'cancelled';
  if (canonical === 'nicht_erschienen' || execution === 'no_show') return 'no_show';
  const hasEnded = Boolean(item.actualEndAt && Number.isFinite(Date.parse(item.actualEndAt)))
    || execution === 'completed'
    || ['beendet', 'dokumentation_offen', 'unterschrift_offen', 'abgeschlossen'].includes(canonical);
  if (hasEnded) {
    const resolved = deriveAssignmentStatusFromVisitDimensions({
      canonicalStatus: canonical, executionStatus: 'completed',
      documentationStatus: (item.documentationStatus ?? fallback.documentation) as VisitDocumentationStatus,
      proofStatus: (item.proofStatus ?? fallback.proof) as VisitProofStatus,
    });
    return resolved === 'abgeschlossen' && item.isIncomplete !== true ? 'completed' : 'follow_up';
  }
  if (['on_way', 'arrived', 'in_progress', 'paused'].includes(execution)
    || ['unterwegs', 'angekommen', 'gestartet', 'pausiert'].includes(canonical)
    || Boolean(item.actualStartAt && Number.isFinite(Date.parse(item.actualStartAt)))) return 'running';
  if (item.planningStatus === 'draft' || (!item.assignmentStatus && item.status === 'entwurf')) return 'draft';
  return 'planned';
}

const businessDayFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' });
/** The planning calendar uses Germany's business date, including DST and midnight boundaries. */
export function assignmentBusinessDate(value: string | Date): string | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? businessDayFormatter.format(date) : null;
}
function validDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function addCalendarDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function assignmentDateRangeError(range: AssignmentWorkspaceDateRange, from: string, to: string): string | null {
  if (range !== 'custom') return null;
  if (!from && !to) return 'Bitte geben Sie ein Anfangs- oder Enddatum an.';
  if ((from && !validDateInput(from)) || (to && !validDateInput(to))) return 'Bitte geben Sie ein gültiges Datum an.';
  if (from && to && from > to) return 'Das Enddatum muss am oder nach dem Anfangsdatum liegen.';
  return null;
}
export function matchesAssignmentWorkspaceDate(item: Pick<AssignmentListItem, 'scheduledStart'>, range: AssignmentWorkspaceDateRange, from = '', to = '', now = new Date()): boolean {
  if (range === 'all') return true;
  if (assignmentDateRangeError(range, from, to)) return false;
  const day = assignmentBusinessDate(item.scheduledStart);
  const today = assignmentBusinessDate(now);
  if (!day || !today) return false;
  if (range === 'today') return day === today;
  if (range === 'tomorrow') return day === addCalendarDays(today, 1);
  if (range === 'month') return day.slice(0, 7) === today.slice(0, 7);
  if (range === 'week') {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
    const monday = addCalendarDays(today, -((weekday + 6) % 7));
    return day >= monday && day <= addCalendarDays(monday, 6);
  }
  return (!from || day >= from) && (!to || day <= to);
}

export type AssignmentWorkspaceStats = Record<AssignmentWorkspaceStatus, number> & { total: number; today: number; unassigned: number };
export function summarizeAssignmentWorkspace(items: AssignmentListItem[], now = new Date()): AssignmentWorkspaceStats {
  const stats: AssignmentWorkspaceStats = { total: items.length, today: 0, unassigned: 0, planned: 0, running: 0, follow_up: 0, completed: 0, cancelled: 0, draft: 0, no_show: 0 };
  for (const item of items) {
    stats[resolveAssignmentWorkspaceStatus(item)] += 1;
    if (matchesAssignmentWorkspaceDate(item, 'today', '', '', now)) stats.today += 1;
    if (!item.employeeId) stats.unassigned += 1;
  }
  return stats;
}

export type AssignmentWorkspaceFilters = {
  search: string; statusFilter: AssignmentWorkspaceStatusFilter; dateRange: AssignmentWorkspaceDateRange;
  dateFrom: string; dateTo: string; employeeFilter: string; serviceFilter: string;
};
const normalizeSearch = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').toLocaleLowerCase('de');
export const UNASSIGNED_EMPLOYEE_FILTER = '__unassigned__';
export function filterAssignmentWorkspace(items: AssignmentListItem[], filters: AssignmentWorkspaceFilters, now = new Date()): AssignmentListItem[] {
  const terms = normalizeSearch(filters.search.trim()).split(/\s+/).filter(Boolean);
  return items.filter(item => {
    const status = resolveAssignmentWorkspaceStatus(item);
    if (filters.statusFilter !== 'all' && status !== filters.statusFilter) return false;
    if (!matchesAssignmentWorkspaceDate(item, filters.dateRange, filters.dateFrom, filters.dateTo, now)) return false;
    if (filters.employeeFilter === UNASSIGNED_EMPLOYEE_FILTER ? Boolean(item.employeeId)
      : filters.employeeFilter !== 'all' && item.employeeId !== filters.employeeFilter) return false;
    if (filters.serviceFilter !== 'all' && (item.serviceName || item.title) !== filters.serviceFilter) return false;
    const date = assignmentBusinessDate(item.scheduledStart);
    const searchable = normalizeSearch([item.id, item.title, item.clientName, item.employeeName, item.location, item.serviceName,
      ASSIGNMENT_WORKSPACE_STATUS_LABELS[status], date, date?.split('-').reverse().join('.')].filter(Boolean).join(' '));
    return terms.every(term => searchable.includes(term));
  });
}
export function sortAssignmentWorkspace(items: AssignmentListItem[], sort: AssignmentWorkspaceSort): AssignmentListItem[] {
  return [...items].sort((a, b) => {
    if (sort === 'client_asc') {
      const name = a.clientName.localeCompare(b.clientName, 'de', { sensitivity: 'base', numeric: true });
      if (name) return name;
    }
    const aTime = Date.parse(a.scheduledStart), bTime = Date.parse(b.scheduledStart);
    // An unreadable date stays reachable, but never displaces today's real appointments.
    if (Number.isFinite(aTime) !== Number.isFinite(bTime)) return Number.isFinite(aTime) ? -1 : 1;
    if (Number.isFinite(aTime) && aTime !== bTime) return (aTime - bTime) * (sort === 'time_desc' ? -1 : 1);
    return a.clientName.localeCompare(b.clientName, 'de', { sensitivity: 'base' }) || a.id.localeCompare(b.id);
  });
}
export function buildAssignmentEmployeeOptions(items: AssignmentListItem[]): { key: string; label: string }[] {
  const employees = new Map<string, string>();
  for (const item of items) if (item.employeeId) employees.set(item.employeeId, item.employeeName.trim() || 'Name fehlt');
  const counts = new Map<string, number>();
  for (const name of employees.values()) counts.set(name, (counts.get(name) ?? 0) + 1);
  const options = [...employees].map(([key, name]) => ({ key, label: (counts.get(name) ?? 0) > 1 ? `${name} · ${key.slice(-6)}` : name }))
    .sort((a, b) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base', numeric: true }) || a.key.localeCompare(b.key));
  return [{ key: 'all', label: 'Alle Mitarbeitenden' }, ...(items.some(item => !item.employeeId) ? [{ key: UNASSIGNED_EMPLOYEE_FILTER, label: 'Noch nicht zugeordnet' }] : []), ...options];
}
