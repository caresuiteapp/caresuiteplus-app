import type { RoleKey, ServiceResult } from '@/types';
import type {
  CalendarEntry,
  CalendarFilters,
  CalendarViewMode,
  CalendarViewPreferences,
  ScheduleChangeAuditEvent,
  SeriesEditScope,
} from '@/types/modules/assignmentWorkflow';
import { enforcePermission } from '@/lib/permissions';
import { guardLiveDemoFeature, guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import {
  assignEmployeeToWorkflow,
  detectAssignmentConflicts,
  getAssignmentWorkflow,
  hasBlockingConflicts,
  listAssignmentWorkflows,
  updateAssignmentWorkflow,
} from './assignmentWorkflowService';
import {
  applyCalendarFilters,
  buildCalendarEntriesFromAssignments,
  filterScheduleByView,
  groupCalendarEntriesByDate,
  summarizeCalendarEntriesForPeriod,
} from './scheduleFromAssignmentsService';

export type ScheduleCalendarViewResult = {
  view: CalendarViewMode;
  anchorDateKey: string;
  entries: CalendarEntry[];
  groups: Array<{ dateKey: string; entries: CalendarEntry[] }>;
  mode: 'detail' | 'summary';
  totalCount: number;
};

const SCHEDULE_AUDIT: ScheduleChangeAuditEvent[] = [];
const VIEW_PREFS = new Map<string, CalendarViewPreferences>();
let auditCounter = 0;

function prefsKey(tenantId: string, userId: string): string {
  return `${tenantId}:${userId}`;
}

function recordScheduleAudit(
  input: Omit<ScheduleChangeAuditEvent, 'id' | 'createdAt'>,
): ScheduleChangeAuditEvent {
  auditCounter += 1;
  const event: ScheduleChangeAuditEvent = {
    id: `sched-audit-${auditCounter}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
  SCHEDULE_AUDIT.push(event);
  return event;
}

function assertCalendarWriteRole(actorRoleKey?: RoleKey | null): ServiceResult<never> | null {
  const denied = enforcePermission<never>(actorRoleKey, 'assist.assignments.manage');
  if (denied) return denied;

  if (actorRoleKey === 'client_portal' || actorRoleKey === 'family_portal') {
    return { ok: false, error: 'Klient:innenportal darf den Kalender nicht direkt ändern.' };
  }

  if (actorRoleKey === 'employee_portal' || actorRoleKey === 'caregiver' || actorRoleKey === 'nurse') {
    return { ok: false, error: 'Mitarbeitende dürfen Einsätze nicht frei verschieben.' };
  }

  return null;
}

export function fetchScheduleCalendarView(
  tenantId: string,
  view: CalendarViewMode,
  options?: {
    anchorDateKey?: string;
    employeeId?: string;
    clientId?: string;
    filters?: CalendarFilters;
  },
  actorRoleKey?: RoleKey | null,
): ServiceResult<ScheduleCalendarViewResult> {
  const denied = enforcePermission<ScheduleCalendarViewResult>(actorRoleKey, 'assist.assignments.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return {
      ok: false,
      error: 'Dienstplan/Kalender im Live-Modus noch nicht vollständig angebunden.',
    };
  }

  const anchorDateKey = options?.anchorDateKey ?? new Date().toISOString().slice(0, 10);
  const allEntries = buildCalendarEntriesFromAssignments(listAssignmentWorkflows(tenantId));
  const filtered = filterScheduleByView(allEntries, view, {
    dateKey: anchorDateKey,
    employeeId: options?.employeeId,
    clientId: options?.clientId,
    filters: options?.filters,
  });

  const summary = summarizeCalendarEntriesForPeriod(filtered);

  return {
    ok: true,
    data: {
      view,
      anchorDateKey,
      entries: summary.entries,
      groups: groupCalendarEntriesByDate(summary.entries),
      mode: summary.mode,
      totalCount: summary.totalCount,
    },
  };
}

export function applyScheduleCalendarFilters(
  tenantId: string,
  entries: CalendarEntry[],
  filters: CalendarFilters,
): CalendarEntry[] {
  return applyCalendarFilters(
    entries.filter((e) => e.tenantId === tenantId),
    filters,
  );
}

export function moveScheduleEntryViaDragDrop(input: {
  tenantId: string;
  assignmentId: string;
  newStartAt: string;
  newEndAt: string;
  newEmployeeId?: string | null;
  actorRoleKey?: RoleKey | null;
  actorId?: string | null;
  confirmed?: boolean;
}): ServiceResult<{ entry: CalendarEntry; audit: ScheduleChangeAuditEvent }> {
  const roleBlock = assertCalendarWriteRole(input.actorRoleKey);
  if (roleBlock) return roleBlock;

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const current = getAssignmentWorkflow(input.tenantId, input.assignmentId);
  if (!current) return { ok: false, error: 'Einsatz nicht gefunden.' };
  if (current.lockedAt) return { ok: false, error: 'Gesperrter Einsatz kann nicht verschoben werden.' };

  const nextEmployeeId =
    input.newEmployeeId !== undefined ? input.newEmployeeId : current.employeeId;

  const draft = {
    ...current,
    plannedStartAt: input.newStartAt,
    plannedEndAt: input.newEndAt,
    employeeId: nextEmployeeId,
  };

  const conflicts = detectAssignmentConflicts({
    assignment: draft,
    existing: listAssignmentWorkflows(input.tenantId),
  });
  const passed = !hasBlockingConflicts(conflicts);

  if (!passed) {
    return {
      ok: false,
      error: conflicts.find((c) => c.severity === 'error')?.message ?? 'Konflikt — Verschiebung blockiert.',
    };
  }

  if (!input.confirmed) {
    return {
      ok: false,
      error: 'Konfliktprüfung bestanden — Bestätigung erforderlich (confirmed: true).',
    };
  }

  const updated = updateAssignmentWorkflow(
    input.tenantId,
    input.assignmentId,
    {
      plannedStartAt: input.newStartAt,
      plannedEndAt: input.newEndAt,
    },
    input.actorRoleKey,
    input.actorId,
  );
  if (!updated.ok) return updated;

  if (nextEmployeeId && nextEmployeeId !== current.employeeId) {
    const reassigned = assignEmployeeToWorkflow(
      input.tenantId,
      input.assignmentId,
      nextEmployeeId,
      input.actorRoleKey,
      input.actorId,
    );
    if (!reassigned.ok) return reassigned;
  }

  const audit = recordScheduleAudit({
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    changeType: 'drag_drop',
    actorId: input.actorId ?? null,
    actorRole: input.actorRoleKey ?? null,
    previousStartAt: current.plannedStartAt,
    previousEndAt: current.plannedEndAt,
    previousEmployeeId: current.employeeId,
    newStartAt: input.newStartAt,
    newEndAt: input.newEndAt,
    newEmployeeId: nextEmployeeId,
    conflictCheckPassed: true,
    summary: 'Einsatz per Drag-and-Drop verschoben.',
  });

  const entry = buildCalendarEntriesFromAssignments([updated.data]).find(
    (e) => e.assignmentId === input.assignmentId,
  );
  if (!entry) return { ok: false, error: 'Kalendereintrag konnte nicht aufgebaut werden.' };

  return { ok: true, data: { entry, audit } };
}

export function prepareDragDropScheduleChange(input: {
  tenantId: string;
  assignmentId: string;
  newStartAt: string;
  newEndAt: string;
  newEmployeeId?: string | null;
}): ServiceResult<{ conflicts: ReturnType<typeof detectAssignmentConflicts>; canApply: boolean }> {
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const current = getAssignmentWorkflow(input.tenantId, input.assignmentId);
  if (!current) return { ok: false, error: 'Einsatz nicht gefunden.' };

  const draft = {
    ...current,
    plannedStartAt: input.newStartAt,
    plannedEndAt: input.newEndAt,
    employeeId: input.newEmployeeId !== undefined ? input.newEmployeeId : current.employeeId,
  };

  const conflicts = detectAssignmentConflicts({
    assignment: draft,
    existing: listAssignmentWorkflows(input.tenantId),
  });

  return {
    ok: true,
    data: {
      conflicts,
      canApply: !hasBlockingConflicts(conflicts),
    },
  };
}

export function rescheduleAssignmentViaCalendar(input: {
  tenantId: string;
  assignmentId: string;
  plannedStartAt: string;
  plannedEndAt: string;
  actorRoleKey?: RoleKey | null;
  actorId?: string | null;
}): ServiceResult<CalendarEntry> {
  const roleBlock = assertCalendarWriteRole(input.actorRoleKey);
  if (roleBlock) return roleBlock;

  const current = getAssignmentWorkflow(input.tenantId, input.assignmentId);
  if (!current) return { ok: false, error: 'Einsatz nicht gefunden.' };

  const updated = updateAssignmentWorkflow(
    input.tenantId,
    input.assignmentId,
    {
      plannedStartAt: input.plannedStartAt,
      plannedEndAt: input.plannedEndAt,
    },
    input.actorRoleKey,
    input.actorId,
  );
  if (!updated.ok) return updated;

  recordScheduleAudit({
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    changeType: 'reschedule',
    actorId: input.actorId ?? null,
    actorRole: input.actorRoleKey ?? null,
    previousStartAt: current.plannedStartAt,
    previousEndAt: current.plannedEndAt,
    previousEmployeeId: current.employeeId,
    newStartAt: input.plannedStartAt,
    newEndAt: input.plannedEndAt,
    newEmployeeId: current.employeeId,
    conflictCheckPassed: true,
    summary: 'Einsatz über Kalenderformular verschoben.',
  });

  const entry = buildCalendarEntriesFromAssignments([updated.data])[0];
  return { ok: true, data: entry };
}

export function saveCalendarViewPreferences(
  prefs: CalendarViewPreferences,
  actorRoleKey?: RoleKey | null,
): ServiceResult<CalendarViewPreferences> {
  const denied = enforcePermission<CalendarViewPreferences>(actorRoleKey, 'assist.assignments.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(prefs.tenantId);
  if (tenantBlock) return tenantBlock;

  const saved = { ...prefs, updatedAt: new Date().toISOString() };
  VIEW_PREFS.set(prefsKey(prefs.tenantId, prefs.userId), saved);
  return { ok: true, data: saved };
}

export function getCalendarViewPreferences(
  tenantId: string,
  userId: string,
): CalendarViewPreferences | undefined {
  const prefs = VIEW_PREFS.get(prefsKey(tenantId, userId));
  if (!prefs || prefs.tenantId !== tenantId) return undefined;
  return prefs;
}

export function getScheduleChangeAuditEvents(
  tenantId: string,
  assignmentId?: string,
): ScheduleChangeAuditEvent[] {
  return SCHEDULE_AUDIT.filter(
    (e) => e.tenantId === tenantId && (!assignmentId || e.assignmentId === assignmentId),
  );
}

export function assertNoDetachedCalendarEntries(entries: CalendarEntry[]): boolean {
  return entries.every((e) => e.source === 'assignment_sync' && e.assignmentId.length > 0);
}

export async function fetchScheduleCalendarProductionSafe(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ScheduleCalendarViewResult>> {
  const liveBlock = guardLiveDemoFeature<ScheduleCalendarViewResult>(tenantId, 'Dienstplan/Kalender');
  if (liveBlock) return liveBlock;

  return fetchScheduleCalendarView(tenantId, 'week', {}, actorRoleKey);
}

export function editSeriesScopeLabel(scope: SeriesEditScope): string {
  const labels: Record<SeriesEditScope, string> = {
    this_only: 'Nur dieser Termin',
    this_and_following: 'Dieser und folgende',
    entire_series: 'Gesamte Serie',
  };
  return labels[scope];
}

export function resetScheduleCalendarStore(): void {
  SCHEDULE_AUDIT.length = 0;
  VIEW_PREFS.clear();
  auditCounter = 0;
}

export {
  buildCalendarEntriesFromAssignments,
  filterScheduleByView,
  groupCalendarEntriesByDate,
  summarizeCalendarEntriesForPeriod,
} from './scheduleFromAssignmentsService';
