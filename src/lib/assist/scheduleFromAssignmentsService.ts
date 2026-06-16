import type {
  AssignmentConflict,
  AssignmentWorkflowRecord,
  CalendarEntry,
  CalendarFilters,
  CalendarViewMode,
} from '@/types/modules/assignmentWorkflow';
import { detectAssignmentConflicts } from './assignmentConflictService';

export function buildScheduleEntryFromAssignment(assignment: AssignmentWorkflowRecord) {
  return {
    id: `sched-${assignment.id}`,
    tenantId: assignment.tenantId,
    assignmentId: assignment.id,
    employeeId: assignment.employeeId,
    clientId: assignment.clientId,
    startsAt: assignment.plannedStartAt,
    endsAt: assignment.plannedEndAt,
    entryType: 'assignment' as const,
    title: assignment.title,
    source: 'assignment_sync' as const,
    updatedAt: assignment.updatedAt,
  };
}

export function syncScheduleFromAssignments(assignments: AssignmentWorkflowRecord[]) {
  return assignments
    .filter((a) => a.canonicalStatus !== 'cancelled')
    .map(buildScheduleEntryFromAssignment);
}

const CLIENT_NAMES: Record<string, string> = {
  'client-001': 'Frau Müller',
  'client-002': 'Herr Schmidt',
  'client-003': 'Frau Weber',
};

const EMPLOYEE_NAMES: Record<string, string> = {
  'employee-001': 'Anna Pflege',
  'employee-002': 'Tom Betreuung',
  'employee-003': 'Lisa Assist',
};

export function resolveClientDisplayName(clientId: string): string {
  return CLIENT_NAMES[clientId] ?? clientId;
}

export function resolveEmployeeDisplayName(employeeId: string | null): string | null {
  if (!employeeId) return null;
  return EMPLOYEE_NAMES[employeeId] ?? employeeId;
}

function resolveDocStatus(assignment: AssignmentWorkflowRecord): CalendarEntry['docStatus'] {
  if (!assignment.requiresDocumentation) return 'na';
  if (
    assignment.status === 'dokumentation_offen' ||
    (assignment.status === 'beendet' && !assignment.completedAt)
  ) {
    return 'missing';
  }
  return 'ok';
}

function resolveSignatureStatus(assignment: AssignmentWorkflowRecord): CalendarEntry['signatureStatus'] {
  if (!assignment.requiresSignature) return 'na';
  if (assignment.status === 'unterschrift_offen') return 'missing';
  return 'ok';
}

function resolveBillingStatus(assignment: AssignmentWorkflowRecord): CalendarEntry['billingStatus'] {
  if (!assignment.billingRelevant) return 'na';
  if (assignment.status === 'abgeschlossen' && assignment.completedAt) return 'ready';
  return 'pending';
}

export function buildCalendarEntryFromAssignment(
  assignment: AssignmentWorkflowRecord,
  existing: AssignmentWorkflowRecord[],
): CalendarEntry {
  const conflicts = detectAssignmentConflicts({ assignment, existing });
  return {
    id: `cal-${assignment.id}`,
    tenantId: assignment.tenantId,
    assignmentId: assignment.id,
    startsAt: assignment.plannedStartAt,
    endsAt: assignment.plannedEndAt,
    durationMinutes: assignment.plannedDurationMinutes,
    clientId: assignment.clientId,
    clientName: resolveClientDisplayName(assignment.clientId),
    employeeId: assignment.employeeId,
    employeeName: resolveEmployeeDisplayName(assignment.employeeId),
    serviceType: assignment.serviceType,
    status: assignment.status,
    canonicalStatus: assignment.canonicalStatus,
    address: assignment.locationAddress?.trim() ? assignment.locationAddress : null,
    taskCount: assignment.tasks.length,
    docStatus: resolveDocStatus(assignment),
    signatureStatus: resolveSignatureStatus(assignment),
    conflictWarning: conflicts.length > 0,
    billingStatus: resolveBillingStatus(assignment),
    title: assignment.title,
    source: 'assignment_sync',
  };
}

export function buildCalendarEntriesFromAssignments(
  assignments: AssignmentWorkflowRecord[],
): CalendarEntry[] {
  const active = assignments.filter((a) => a.canonicalStatus !== 'cancelled');
  return active
    .map((a) => buildCalendarEntryFromAssignment(a, active))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function getDateRangeForView(
  view: CalendarViewMode,
  anchorDateKey: string,
): { start: string; end: string } {
  const anchor = new Date(`${anchorDateKey}T12:00:00`);

  if (view === 'day') {
    return { start: anchorDateKey, end: anchorDateKey };
  }

  if (view === 'week' || view === 'employee' || view === 'client' || view === 'tour') {
    const day = anchor.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(anchor);
    monday.setDate(anchor.getDate() + diff);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      start: monday.toISOString().slice(0, 10),
      end: sunday.toISOString().slice(0, 10),
    };
  }

  if (view === 'month') {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }

  if (view === 'quarter') {
    const quarter = Math.floor(anchor.getMonth() / 3);
    const start = new Date(anchor.getFullYear(), quarter * 3, 1);
    const end = new Date(anchor.getFullYear(), quarter * 3 + 3, 0);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }

  if (view === 'year') {
    return {
      start: `${anchor.getFullYear()}-01-01`,
      end: `${anchor.getFullYear()}-12-31`,
    };
  }

  return { start: anchorDateKey, end: anchorDateKey };
}

export function filterEntriesByDateRange(
  entries: CalendarEntry[],
  startDateKey: string,
  endDateKey: string,
): CalendarEntry[] {
  return entries.filter((e) => {
    const key = e.startsAt.slice(0, 10);
    return key >= startDateKey && key <= endDateKey;
  });
}

export function applyCalendarFilters(
  entries: CalendarEntry[],
  filters?: CalendarFilters,
): CalendarEntry[] {
  if (!filters) return entries;

  let filtered = entries;

  if (filters.openOnly || filters.employeeId === '__open__') {
    filtered = filtered.filter((e) => !e.employeeId);
  } else if (filters.employeeId) {
    filtered = filtered.filter((e) => e.employeeId === filters.employeeId);
  }

  if (filters.clientId) {
    filtered = filtered.filter((e) => e.clientId === filters.clientId);
  }

  if (filters.status) {
    filtered = filtered.filter(
      (e) => e.status === filters.status || e.canonicalStatus === filters.status,
    );
  }

  if (filters.serviceType) {
    filtered = filtered.filter((e) => e.serviceType === filters.serviceType);
  }

  if (filters.location) {
    const loc = filters.location.toLowerCase();
    filtered = filtered.filter((e) => e.address?.toLowerCase().includes(loc));
  }

  if (filters.conflictsOnly) {
    filtered = filtered.filter((e) => e.conflictWarning);
  }

  if (filters.missingDoc) {
    filtered = filtered.filter((e) => e.docStatus === 'missing');
  }

  if (filters.missingSignature) {
    filtered = filtered.filter((e) => e.signatureStatus === 'missing');
  }

  if (filters.billingReady) {
    filtered = filtered.filter((e) => e.billingStatus === 'ready');
  }

  if (filters.tourId) {
    filtered = filtered.filter((e) => e.employeeId === filters.tourId);
  }

  return filtered;
}

export function filterScheduleByView(
  entries: CalendarEntry[],
  view: CalendarViewMode,
  options?: { dateKey?: string; employeeId?: string; clientId?: string; filters?: CalendarFilters },
): CalendarEntry[] {
  const anchor = options?.dateKey ?? new Date().toISOString().slice(0, 10);

  if (view === 'open_assignments') {
    return applyCalendarFilters(
      entries.filter((e) => !e.employeeId),
      options?.filters,
    );
  }

  if (view === 'conflicts') {
    return applyCalendarFilters(
      entries.filter((e) => e.conflictWarning),
      options?.filters,
    );
  }

  const rangeViews: CalendarViewMode[] = ['day', 'week', 'month', 'quarter', 'year', 'employee', 'client', 'tour'];
  let filtered = entries;

  if (rangeViews.includes(view)) {
    const range = getDateRangeForView(view, anchor);
    filtered = filterEntriesByDateRange(filtered, range.start, range.end);
  }

  if (view === 'employee' && options?.employeeId) {
    filtered = filtered.filter((e) => e.employeeId === options.employeeId);
  }

  if (view === 'client' && options?.clientId) {
    filtered = filtered.filter((e) => e.clientId === options.clientId);
  }

  if (view === 'tour' && options?.employeeId) {
    filtered = filtered.filter((e) => e.employeeId === options.employeeId);
  }

  return applyCalendarFilters(filtered, options?.filters).sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt),
  );
}

export function groupCalendarEntriesByDate(
  entries: CalendarEntry[],
): Array<{ dateKey: string; entries: CalendarEntry[] }> {
  const map = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    const key = entry.startsAt.slice(0, 10);
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, dayEntries]) => ({ dateKey, entries: dayEntries }));
}

/** Performance guard for quarter/year — returns summary counts only when entry count exceeds threshold */
export function summarizeCalendarEntriesForPeriod(
  entries: CalendarEntry[],
  maxDetailEntries = 500,
): { mode: 'detail' | 'summary'; entries: CalendarEntry[]; totalCount: number; dayCount: number } {
  const totalCount = entries.length;
  const dayCount = new Set(entries.map((e) => e.startsAt.slice(0, 10))).size;
  if (totalCount <= maxDetailEntries) {
    return { mode: 'detail', entries, totalCount, dayCount };
  }
  return { mode: 'summary', entries: entries.slice(0, maxDetailEntries), totalCount, dayCount };
}

export function detectEntryConflicts(
  assignment: AssignmentWorkflowRecord,
  existing: AssignmentWorkflowRecord[],
): AssignmentConflict[] {
  return detectAssignmentConflicts({ assignment, existing });
}
