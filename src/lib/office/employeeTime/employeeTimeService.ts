import type { RoleKey, ServiceResult } from '@/types';
import type {
  EmployeeAbsenceBlock,
  EmployeeTimeEntry,
  EmployeeTimePeriod,
  TimeCalculationInput,
  WorkTimeListView,
  WorkTimeStatus,
} from '@/types/modules/employeeTime';
import { CLIENT_PORTAL_ROLES } from '@/types/permissions/roleMatrix';
import { enforcePermission, hasPermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { loadAssignmentTimeContext } from './employeeTimeAssignmentBridge';
import {
  calculateAssignmentWorkTime,
  endOfDayIso,
  endOfWeekIso,
  isPeriodLocked,
  minutesBetween,
  startOfDayIso,
  startOfWeekIso,
} from './employeeTimeCalculationService';
import {
  appendTimeAudit,
  getPeriod,
  getTimeEntry,
  listAbsences,
  listCorrections,
  listPeriods,
  listTimeAudit,
  listTimeEntries,
  nextCorrectionId,
  nextPeriodId,
  nextTimeAuditId,
  nextTimeEntryId,
  saveCorrection,
  savePeriod,
  saveTimeEntry,
} from './employeeTimeStore';

const TERMINAL_ENTRY_STATUSES = new Set<WorkTimeStatus>(['approved', 'exported', 'locked']);

function auditTimeEvent(input: {
  tenantId: string;
  entityType: 'employee_time_entry' | 'employee_time_period' | 'employee_time_correction';
  entityId: string;
  action: string;
  actorId: string | null;
  summary: string;
  metadata?: Record<string, string>;
}): void {
  appendTimeAudit({
    id: nextTimeAuditId(),
    tenantId: input.tenantId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    actorId: input.actorId,
    summary: input.summary,
    metadata: input.metadata,
    createdAt: new Date().toISOString(),
  });
}

function assertAdminTimeAccess(roleKey: RoleKey | null): ServiceResult<never> | null {
  return enforcePermission<never>(roleKey, 'office.employee_time.view');
}

function assertManageAccess(roleKey: RoleKey | null): ServiceResult<never> | null {
  return enforcePermission<never>(roleKey, 'office.employee_time.manage');
}

function filterEntriesForRole(
  tenantId: string,
  roleKey: RoleKey | null,
  actorEmployeeId: string | null,
  employeeIdFilter?: string | null,
): ServiceResult<EmployeeTimeEntry[]> | EmployeeTimeEntry[] {
  const entries = listTimeEntries(tenantId, employeeIdFilter ?? undefined);

  if (roleKey === 'client_portal' || (roleKey && CLIENT_PORTAL_ROLES.has(roleKey as never))) {
    return { ok: false, error: 'Klient:innenportal hat keinen Zugriff auf interne Arbeitszeiten.' };
  }

  if (roleKey === 'employee_portal') {
    if (!actorEmployeeId) {
      return { ok: false, error: 'Mitarbeiterkontext fehlt.' };
    }
    if (!hasPermission(roleKey, 'portal.employee.timesheet.view')) {
      return { ok: false, error: 'Keine Berechtigung für Zeiterfassung.' };
    }
    return entries.filter((e) => e.employeeId === actorEmployeeId);
  }

  const denied = assertAdminTimeAccess(roleKey);
  if (denied) return denied;

  return entries;
}

export function calculateEmployeeTimeFromAssignment(
  tenantId: string,
  assignmentId: string,
  actorRoleKey: RoleKey | null,
  actorId?: string | null,
): ServiceResult<EmployeeTimeEntry> {
  const denied = assertManageAccess(actorRoleKey);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const context = loadAssignmentTimeContext(tenantId, assignmentId);
  if (!context) return { ok: false, error: 'Einsatz nicht gefunden.' };
  if (!context.assignment.employeeId) {
    return { ok: false, error: 'Einsatz ohne Mitarbeitende:n — keine Arbeitszeit berechenbar.' };
  }

  const calcInput: TimeCalculationInput = {
    tenantId,
    employeeId: context.assignment.employeeId,
    assignmentId,
    plannedStartAt: context.assignment.plannedStartAt,
    plannedEndAt: context.assignment.plannedEndAt,
    plannedDurationMinutes: context.assignment.plannedDurationMinutes,
    serviceType: context.assignment.serviceType,
    statusTimes: context.statusTimes,
    pauseEvents: context.pauseEvents,
    settings: context.settings,
  };

  const result = calculateAssignmentWorkTime(calcInput);
  const now = new Date().toISOString();
  const startedAt = context.statusTimes.startedAt;
  const endedAt = context.statusTimes.finishedAt ?? context.statusTimes.completedAt;

  const entry: EmployeeTimeEntry = {
    id: nextTimeEntryId(),
    tenantId,
    employeeId: context.assignment.employeeId,
    assignmentId,
    entryType: 'assignment_time',
    periodDate: (startedAt ?? context.assignment.plannedStartAt).slice(0, 10),
    startedAt,
    endedAt,
    grossMinutes: result.grossMinutes,
    pauseMinutes: result.pauseMinutes,
    netMinutes: result.netMinutes,
    travelMinutes: result.travelMinutes,
    paidMinutes: result.paidMinutes,
    unpaidMinutes: result.unpaidMinutes,
    plannedMinutes: result.plannedMinutes,
    deviationMinutes: result.deviationMinutes,
    status: result.billable ? 'calculated' : 'draft',
    plausibilityFlags: result.plausibilityFlags,
    traceReference: result.traceReference,
    createdAt: now,
    updatedAt: now,
  };

  saveTimeEntry(entry);
  auditTimeEvent({
    tenantId,
    entityType: 'employee_time_entry',
    entityId: entry.id,
    action: 'time.calculate',
    actorId: actorId ?? null,
    summary: `Arbeitszeit für Einsatz ${assignmentId} berechnet (${result.netMinutes} Min. netto).`,
    metadata: { assignmentId, flags: result.plausibilityFlags.join(',') },
  });

  return { ok: true, data: entry };
}

export function listEmployeeTimeEntries(
  tenantId: string,
  roleKey: RoleKey | null,
  options?: {
    employeeId?: string | null;
    actorEmployeeId?: string | null;
    view?: WorkTimeListView;
  },
): ServiceResult<EmployeeTimeEntry[]> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const filtered = filterEntriesForRole(
    tenantId,
    roleKey,
    options?.actorEmployeeId ?? null,
    options?.employeeId,
  );
  if ('ok' in filtered) return filtered;

  const view = options?.view ?? 'daily';
  switch (view) {
    case 'open':
      return {
        ok: true,
        data: filtered.filter((e) => !TERMINAL_ENTRY_STATUSES.has(e.status)),
      };
    case 'erroneous':
      return {
        ok: true,
        data: filtered.filter((e) => e.plausibilityFlags.length > 0),
      };
    case 'corrections':
      return {
        ok: true,
        data: filtered.filter((e) =>
          ['correction_requested', 'corrected'].includes(e.status),
        ),
      };
    case 'approval':
      return {
        ok: true,
        data: filtered.filter((e) =>
          ['employee_review', 'management_review', 'calculated'].includes(e.status),
        ),
      };
    default:
      return { ok: true, data: filtered };
  }
}

export function aggregateEmployeeTimePeriod(
  tenantId: string,
  employeeId: string,
  periodKind: EmployeeTimePeriod['periodKind'],
  anchorDate: string,
  actorRoleKey: RoleKey | null,
  actorId?: string | null,
): ServiceResult<EmployeeTimePeriod> {
  const denied = assertManageAccess(actorRoleKey);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const entries = listTimeEntries(tenantId, employeeId);
  let periodStart = startOfDayIso(anchorDate);
  let periodEnd = endOfDayIso(anchorDate);

  if (periodKind === 'weekly') {
    periodStart = startOfDayIso(startOfWeekIso(anchorDate));
    periodEnd = endOfDayIso(endOfWeekIso(anchorDate));
  } else if (periodKind === 'monthly') {
    const month = anchorDate.slice(0, 7);
    periodStart = `${month}-01T00:00:00.000Z`;
    const lastDay = new Date(`${month}-01T12:00:00.000Z`);
    lastDay.setUTCMonth(lastDay.getUTCMonth() + 1);
    lastDay.setUTCDate(0);
    periodEnd = `${lastDay.toISOString().slice(0, 10)}T23:59:59.999Z`;
  }

  const inRange = entries.filter(
    (e) => e.periodDate >= periodStart.slice(0, 10) && e.periodDate <= periodEnd.slice(0, 10),
  );

  const existing = listPeriods(tenantId, employeeId).find(
    (p) =>
      p.periodKind === periodKind &&
      p.periodStart === periodStart &&
      p.periodEnd === periodEnd &&
      isPeriodLocked(p.status),
  );
  if (existing) {
    return {
      ok: false,
      error: 'Freigegebene Periode kann nicht direkt überschrieben werden.',
    };
  }

  const now = new Date().toISOString();
  const period: EmployeeTimePeriod = {
    id: nextPeriodId(),
    tenantId,
    employeeId,
    periodKind,
    periodStart,
    periodEnd,
    totalAssignmentMinutes: inRange.reduce((s, e) => s + e.netMinutes, 0),
    totalTravelMinutes: inRange.reduce((s, e) => s + e.travelMinutes, 0),
    totalBreakMinutes: inRange.reduce((s, e) => s + e.pauseMinutes, 0),
    totalPaidMinutes: inRange.reduce((s, e) => s + e.paidMinutes, 0),
    totalUnpaidMinutes: inRange.reduce((s, e) => s + e.unpaidMinutes, 0),
    status: 'calculated',
    approvedBy: null,
    approvedAt: null,
    exportedAt: null,
    lockedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  savePeriod(period);
  auditTimeEvent({
    tenantId,
    entityType: 'employee_time_period',
    entityId: period.id,
    action: 'period.aggregate',
    actorId: actorId ?? null,
    summary: `Periode ${periodKind} aggregiert (${period.totalPaidMinutes} Min. bezahlt).`,
  });

  return { ok: true, data: period };
}

export function requestEmployeeTimeCorrection(
  tenantId: string,
  timeEntryId: string,
  actorRoleKey: RoleKey | null,
  actorEmployeeId?: string | null,
): ServiceResult<EmployeeTimeEntry> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const entry = getTimeEntry(tenantId, timeEntryId);
  if (!entry) return { ok: false, error: 'Zeiteintrag nicht gefunden.' };

  if (actorRoleKey === 'employee_portal') {
    if (entry.employeeId !== actorEmployeeId) {
      return { ok: false, error: 'Nur eigene Zeiten können zur Korrektur angefragt werden.' };
    }
  } else {
    const denied = assertManageAccess(actorRoleKey);
    if (denied) return denied;
  }

  if (TERMINAL_ENTRY_STATUSES.has(entry.status)) {
    return { ok: false, error: 'Freigegebene Zeiten können nicht direkt geändert werden.' };
  }

  const updated: EmployeeTimeEntry = {
    ...entry,
    status: 'correction_requested',
    updatedAt: new Date().toISOString(),
  };
  saveTimeEntry(updated);
  return { ok: true, data: updated };
}

export function applyManualTimeCorrection(input: {
  tenantId: string;
  timeEntryId: string;
  correctedStartAt: string;
  correctedEndAt: string;
  correctionReason: string;
  correctedBy: string;
  actorRoleKey: RoleKey | null;
}): ServiceResult<{ entry: EmployeeTimeEntry; correctionId: string }> {
  const denied = assertManageAccess(input.actorRoleKey);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  if (!input.correctionReason.trim()) {
    return { ok: false, error: 'Korrektur erfordert eine Begründung.' };
  }

  const entry = getTimeEntry(input.tenantId, input.timeEntryId);
  if (!entry) return { ok: false, error: 'Zeiteintrag nicht gefunden.' };

  if (TERMINAL_ENTRY_STATUSES.has(entry.status)) {
    return { ok: false, error: 'Freigegebene Zeiten können nicht direkt überschrieben werden.' };
  }

  const grossMinutes = minutesBetween(input.correctedStartAt, input.correctedEndAt);
  const netMinutes = Math.max(0, grossMinutes - entry.pauseMinutes);
  const auditEventId = nextTimeAuditId();
  const correctionId = nextCorrectionId();
  const now = new Date().toISOString();

  saveCorrection({
    id: correctionId,
    tenantId: input.tenantId,
    employeeId: entry.employeeId,
    timeEntryId: entry.id,
    correctedStartAt: input.correctedStartAt,
    correctedEndAt: input.correctedEndAt,
    correctionReason: input.correctionReason.trim(),
    correctedBy: input.correctedBy,
    correctedAt: now,
    previousStatus: entry.status,
    auditEventId,
  });

  const updated: EmployeeTimeEntry = {
    ...entry,
    startedAt: input.correctedStartAt,
    endedAt: input.correctedEndAt,
    grossMinutes,
    netMinutes,
    paidMinutes: netMinutes + entry.travelMinutes,
    entryType: 'correction_time',
    status: 'corrected',
    traceReference: `${entry.traceReference ?? ''}|correction:${correctionId}`,
    updatedAt: now,
  };
  saveTimeEntry(updated);

  auditTimeEvent({
    tenantId: input.tenantId,
    entityType: 'employee_time_correction',
    entityId: correctionId,
    action: 'time.manual_correction',
    actorId: input.correctedBy,
    summary: `Manuelle Korrektur: ${input.correctionReason.trim()}`,
    metadata: { timeEntryId: entry.id },
  });

  return { ok: true, data: { entry: updated, correctionId } };
}

export function approveEmployeeTimePeriod(
  tenantId: string,
  periodId: string,
  actorRoleKey: RoleKey | null,
  approvedBy: string,
): ServiceResult<EmployeeTimePeriod> {
  const denied = assertManageAccess(actorRoleKey);
  if (denied) return denied;

  const period = getPeriod(tenantId, periodId);
  if (!period) return { ok: false, error: 'Periode nicht gefunden.' };

  if (isPeriodLocked(period.status)) {
    return { ok: false, error: 'Periode ist bereits freigegeben oder gesperrt.' };
  }

  const now = new Date().toISOString();
  const updated: EmployeeTimePeriod = {
    ...period,
    status: 'approved',
    approvedBy,
    approvedAt: now,
    updatedAt: now,
  };
  savePeriod(updated);

  auditTimeEvent({
    tenantId,
    entityType: 'employee_time_period',
    entityId: period.id,
    action: 'period.approve',
    actorId: approvedBy,
    summary: `Periode freigegeben (${period.totalPaidMinutes} Min.).`,
  });

  return { ok: true, data: updated };
}

export function lockEmployeeTimePeriod(
  tenantId: string,
  periodId: string,
  actorRoleKey: RoleKey | null,
  actorId?: string | null,
): ServiceResult<EmployeeTimePeriod> {
  const denied = assertManageAccess(actorRoleKey);
  if (denied) return denied;

  const period = getPeriod(tenantId, periodId);
  if (!period) return { ok: false, error: 'Periode nicht gefunden.' };

  const now = new Date().toISOString();
  const updated: EmployeeTimePeriod = {
    ...period,
    status: 'locked',
    lockedAt: now,
    updatedAt: now,
  };
  savePeriod(updated);

  auditTimeEvent({
    tenantId,
    entityType: 'employee_time_period',
    entityId: period.id,
    action: 'period.lock',
    actorId: actorId ?? null,
    summary: 'Periode gesperrt.',
  });

  return { ok: true, data: updated };
}

export function createAbsenceTimeEntries(
  tenantId: string,
  absence: Omit<EmployeeAbsenceBlock, 'id'>,
  actorRoleKey: RoleKey | null,
): ServiceResult<EmployeeTimeEntry> {
  const denied = assertManageAccess(actorRoleKey);
  if (denied) return denied;

  const typeMap = {
    vacation: 'vacation_time',
    sick: 'sick_time',
    training: 'training_time',
    blocked: 'admin_time',
  } as const;

  const minutes = minutesBetween(absence.startsAt, absence.endsAt);
  const now = new Date().toISOString();
  const entry: EmployeeTimeEntry = {
    id: nextTimeEntryId(),
    tenantId,
    employeeId: absence.employeeId,
    assignmentId: null,
    entryType: typeMap[absence.absenceType],
    periodDate: absence.startsAt.slice(0, 10),
    startedAt: absence.startsAt,
    endedAt: absence.endsAt,
    grossMinutes: minutes,
    pauseMinutes: 0,
    netMinutes: minutes,
    travelMinutes: 0,
    paidMinutes: absence.absenceType === 'sick' || absence.absenceType === 'vacation' ? minutes : 0,
    unpaidMinutes: absence.absenceType === 'blocked' ? minutes : 0,
    plannedMinutes: null,
    deviationMinutes: null,
    status: 'calculated',
    plausibilityFlags: [],
    traceReference: `absence:${absence.absenceType}`,
    createdAt: now,
    updatedAt: now,
  };

  saveTimeEntry(entry);
  return { ok: true, data: entry };
}

export function fetchEmployeeTimeAuditTrail(
  tenantId: string,
  roleKey: RoleKey | null,
): ServiceResult<ReturnType<typeof listTimeAudit>> {
  const denied = assertAdminTimeAccess(roleKey);
  if (denied) return denied;
  return { ok: true, data: listTimeAudit(tenantId) };
}

export function fetchEmployeeTimeCorrections(
  tenantId: string,
  roleKey: RoleKey | null,
): ServiceResult<ReturnType<typeof listCorrections>> {
  const denied = assertAdminTimeAccess(roleKey);
  if (denied) return denied;
  return { ok: true, data: listCorrections(tenantId) };
}

export function listEmployeeAbsencesForTime(
  tenantId: string,
  employeeId?: string,
): EmployeeAbsenceBlock[] {
  return listAbsences(tenantId, employeeId);
}
