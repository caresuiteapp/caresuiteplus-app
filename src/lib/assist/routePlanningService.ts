import type { RoleKey, ServiceResult } from '@/types';
import type {
  OpenAssignmentSummary,
  ReplacementSuggestion,
  RoutePlanningAuditEvent,
  RoutePlanningChangeInput,
  RoutePlanningConflict,
  TourViewResult,
  TravelTimeEstimate,
} from '@/types/modules/routePlanning';
import { MAX_DAILY_WORK_HOURS, TRAVEL_TIME_DISCLAIMER } from '@/types/modules/routePlanning';
import { enforcePermission } from '@/lib/permissions';
import { guardLiveDemoFeature, guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { isGeoLiveReady } from '@/lib/geo/geoModuleConfig';
import {
  assignEmployeeToWorkflow,
  listAssignmentWorkflows,
} from './assignmentWorkflowService';
import { createMonitorNotification } from './monitorNotificationService';
import {
  buildHeuristicTravelEstimate,
  checkMaxWorkingTimeWarning,
  checkRegionalProximity,
  detectRoutePlanningConflictsForAssignment,
  estimateHeuristicTravelMinutes,
  hasBlockingPlanningConflicts,
  sumDailyWorkMinutes,
} from './routePlanningConflictService';
import {
  ROUTE_PLANNING_STORE,
  filterRoutePlanningByTenant,
  nextPlanningConflictId,
  nextReplacementSuggestionId,
  nextRoutePlanId,
  nextRoutePlanItemId,
  nextRoutePlanningAuditId,
  nextTravelEstimateId,
  resetRoutePlanningStore,
} from './routePlanningStore';
import {
  getEmployeeAvailabilityBlocks,
  getPlanningBlockAbsences,
} from '@/lib/office/absenceStore';
import { detectAbsenceAssignmentConflicts } from '@/lib/office/absenceConflictService';
import { getEmployeePersonnelFileForAssignmentCheck } from './employeePersonnelFileService';
import { evaluateEmployeeDeployability, isEmployeeAssignable } from './employeeDeployabilityService';

const CANDIDATE_EMPLOYEES = [
  'employee-001',
  'employee-002',
  'employee-003',
  'employee-004',
  'employee-005',
  'employee-006',
];

function audit(input: Omit<RoutePlanningAuditEvent, 'id' | 'createdAt' | 'updatedAt'>): RoutePlanningAuditEvent {
  const now = new Date().toISOString();
  const event: RoutePlanningAuditEvent = {
    id: nextRoutePlanningAuditId(),
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  ROUTE_PLANNING_STORE.auditEvents.push(event);
  return event;
}

function persistTravelEstimate(
  estimate: Omit<TravelTimeEstimate, 'id' | 'createdAt' | 'updatedAt'>,
): TravelTimeEstimate {
  const now = new Date().toISOString();
  const row: TravelTimeEstimate = {
    id: nextTravelEstimateId(),
    createdAt: now,
    updatedAt: now,
    ...estimate,
  };
  ROUTE_PLANNING_STORE.travelTimeEstimates.push(row);
  return row;
}

function persistConflicts(
  tenantId: string,
  assignmentId: string,
  employeeId: string | null,
  conflicts: RoutePlanningConflict[],
): void {
  const now = new Date().toISOString();
  for (const conflict of conflicts) {
    ROUTE_PLANNING_STORE.assignmentConflicts.push({
      id: nextPlanningConflictId(),
      tenantId,
      assignmentId,
      employeeId,
      code: conflict.code,
      message: conflict.message,
      severity: conflict.severity,
      resolved: false,
      detectedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }
}

/** 1 — Offene Einsätze anzeigen */
export function listOpenAssignmentsForPlanning(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<OpenAssignmentSummary[]> {
  const denied = enforcePermission<OpenAssignmentSummary[]>(actorRoleKey, 'assist.assignments.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const liveBlock = guardLiveDemoFeature<OpenAssignmentSummary[]>(tenantId, 'Touren & Vertretung');
  if (liveBlock) return liveBlock;

  const assignments = listAssignmentWorkflows(tenantId).filter(
    (a) => !a.employeeId && a.canonicalStatus !== 'cancelled',
  );
  const existing = listAssignmentWorkflows(tenantId);
  const absences = getPlanningBlockAbsences(tenantId);

  const open: OpenAssignmentSummary[] = assignments.map((a) => {
    const conflicts = detectRoutePlanningConflictsForAssignment({
      assignment: a,
      existing,
      employeeAbsences: absences,
    });
    return {
      assignmentId: a.id,
      title: a.title,
      clientId: a.clientId,
      plannedStartAt: a.plannedStartAt,
      plannedEndAt: a.plannedEndAt,
      locationAddress: a.locationAddress,
      serviceType: a.serviceType,
      conflictCount: conflicts.length,
    };
  });

  audit({
    tenantId,
    action: 'open_assignments_viewed',
    actorId: null,
    actorRole: actorRoleKey ?? null,
    assignmentId: null,
    employeeId: null,
    summary: `${open.length} offene Einsätze angezeigt.`,
  });

  return { ok: true, data: open };
}

/** 2 — Vertretungsvorschläge */
export function buildReplacementSuggestions(
  tenantId: string,
  assignmentId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<ReplacementSuggestion[]> {
  const denied = enforcePermission<ReplacementSuggestion[]>(
    actorRoleKey,
    'office.employees.absences.manage',
  );
  if (denied) return denied;

  const liveBlock = guardLiveDemoFeature<ReplacementSuggestion[]>(tenantId, 'Vertretungsvorschläge');
  if (liveBlock) return liveBlock;

  const assignment = listAssignmentWorkflows(tenantId).find((a) => a.id === assignmentId);
  if (!assignment) return { ok: false, error: 'Einsatz nicht gefunden.' };

  const absences = getPlanningBlockAbsences(tenantId);
  const existing = listAssignmentWorkflows(tenantId);
  const availability = getEmployeeAvailabilityBlocks(tenantId);
  const suggestions: ReplacementSuggestion[] = [];
  const now = new Date().toISOString();

  for (const employeeId of CANDIDATE_EMPLOYEES) {
    if (employeeId === assignment.employeeId) continue;

    const absenceConflicts = detectAbsenceAssignmentConflicts({
      employeeId,
      startsAt: assignment.plannedStartAt,
      endsAt: assignment.plannedEndAt,
      absences,
    });
    if (absenceConflicts.length > 0) continue;

    const doubleBooked = existing.some(
      (a) =>
        a.id !== assignmentId &&
        a.employeeId === employeeId &&
        a.canonicalStatus !== 'cancelled' &&
        new Date(a.plannedStartAt) < new Date(assignment.plannedEndAt) &&
        new Date(assignment.plannedStartAt) < new Date(a.plannedEndAt),
    );
    if (doubleBooked) continue;

    const qualification = checkEmployeeQualificationForAssignment(
      tenantId,
      employeeId,
      assignment.serviceType,
      actorRoleKey,
    );
    if (!qualification.ok || !qualification.data?.assignable) continue;

    const availabilityResult = checkEmployeeAvailabilityForPlanning(
      tenantId,
      employeeId,
      assignment.plannedStartAt,
      assignment.plannedEndAt,
    );
    if (!availabilityResult.ok || !availabilityResult.data?.available) continue;

    const file = getEmployeePersonnelFileForAssignmentCheck(tenantId, employeeId);
    const homeAddress = file
      ? [file.masterData.street, file.masterData.postalCode, file.masterData.city]
          .filter(Boolean)
          .join(', ')
      : null;
    const proximity = checkRegionalProximity(homeAddress, assignment.locationAddress);
    const travelMinutes = estimateHeuristicTravelMinutes(
      homeAddress ?? 'Berlin',
      assignment.locationAddress,
    );

    let score = 0;
    if (qualification.data.qualificationOk) score += 40;
    if (availabilityResult.data.available) score += 30;
    if (proximity === 'same_region') score += 20;
    else if (proximity === 'adjacent') score += 10;
    if (travelMinutes <= 20) score += 10;

    const suggestion: ReplacementSuggestion = {
      id: nextReplacementSuggestionId(),
      tenantId,
      assignmentId,
      originalEmployeeId: assignment.employeeId ?? 'unknown',
      suggestedEmployeeId: employeeId,
      absenceId: null,
      status: 'suggested',
      qualificationMatch: qualification.data.qualificationOk,
      availabilityOk: availabilityResult.data.available,
      travelTimeMinutes: travelMinutes,
      travelPlausibility: travelMinutes <= 30 ? 'ok' : 'warning',
      regionalProximity: proximity,
      score,
      reason: `Qualifikation ${qualification.data.qualificationOk ? 'OK' : 'fehlt'}, Verfügbarkeit ${availabilityResult.data.available ? 'OK' : 'nein'}.`,
      createdAt: now,
      updatedAt: now,
    };

    ROUTE_PLANNING_STORE.replacementSuggestions.push(suggestion);
    suggestions.push(suggestion);
  }

  suggestions.sort((a, b) => b.score - a.score);

  audit({
    tenantId,
    action: 'replacement_suggested',
    actorId: null,
    actorRole: actorRoleKey ?? null,
    assignmentId,
    employeeId: assignment.employeeId,
    summary: `${suggestions.length} Vertretungsvorschläge für Einsatz ${assignmentId}.`,
    metadata: { count: String(suggestions.length) },
  });

  return { ok: true, data: suggestions };
}

/** 3 — Verfügbarkeit prüfen */
export function checkEmployeeAvailabilityForPlanning(
  tenantId: string,
  employeeId: string,
  startsAt: string,
  endsAt: string,
): ServiceResult<{ available: boolean; reason: string | null }> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const absences = getPlanningBlockAbsences(tenantId);
  const absenceConflicts = detectAbsenceAssignmentConflicts({
    employeeId,
    startsAt,
    endsAt,
    absences,
  });
  if (absenceConflicts.length > 0) {
    audit({
      tenantId,
      action: 'availability_checked',
      actorId: null,
      actorRole: null,
      assignmentId: null,
      employeeId,
      summary: 'Verfügbarkeit: abwesend.',
    });
    return { ok: true, data: { available: false, reason: absenceConflicts[0]!.message } };
  }

  const availability = getEmployeeAvailabilityBlocks(tenantId);
  if (availability.length === 0) {
    return { ok: true, data: { available: true, reason: null } };
  }

  const slotOk = availability.some(
    (slot) =>
      slot.employeeId === employeeId &&
      new Date(slot.startsAt) <= new Date(startsAt) &&
      new Date(slot.endsAt) >= new Date(endsAt),
  );

  audit({
    tenantId,
    action: 'availability_checked',
    actorId: null,
    actorRole: null,
    assignmentId: null,
    employeeId,
    summary: slotOk ? 'Verfügbarkeit: OK.' : 'Verfügbarkeit: außerhalb Fenster.',
  });

  return {
    ok: true,
    data: {
      available: slotOk,
      reason: slotOk ? null : 'Einsatz außerhalb hinterlegter Verfügbarkeit.',
    },
  };
}

/** 4 — Qualifikation prüfen */
export function checkEmployeeQualificationForAssignment(
  tenantId: string,
  employeeId: string,
  serviceType: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<{ assignable: boolean; qualificationOk: boolean; blockers: string[] }> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const file = getEmployeePersonnelFileForAssignmentCheck(tenantId, employeeId);
  if (!file) {
    return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };
  }

  const deployability = evaluateEmployeeDeployability({
    employment: file.employment,
    portalAccess: file.portalAccess,
    qualifications: file.qualifications,
    backgroundCheck: file.backgroundCheck,
    documents: file.documents,
    roleTitle: file.masterData.roleTitle,
    blocked: file.masterData.status === 'gesperrt',
    backgroundCheckRequired: true,
    portalRequired: false,
  });

  const assignable = isEmployeeAssignable(deployability);
  const blockers = deployability.blockers.map((b) => b.message);

  audit({
    tenantId,
    action: 'qualification_checked',
    actorId: null,
    actorRole: actorRoleKey ?? null,
    assignmentId: null,
    employeeId,
    summary: assignable
      ? `Qualifikation OK für ${serviceType}.`
      : `Qualifikation blockiert für ${serviceType}.`,
    metadata: { serviceType },
  });

  return {
    ok: true,
    data: {
      assignable,
      qualificationOk: deployability.qualificationOk,
      blockers,
    },
  };
}

/** 5 — Fahrzeit-Plausibilität (Heuristik, kein Provider ohne Freigabe) */
export function estimateTravelTimePlausibility(input: {
  tenantId: string;
  assignmentId?: string | null;
  fromAddress: string;
  toAddress: string;
  requireProvider?: boolean;
  actorRoleKey?: RoleKey | null;
}): ServiceResult<TravelTimeEstimate> {
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  if (input.requireProvider && !isGeoLiveReady()) {
    audit({
      tenantId: input.tenantId,
      action: 'travel_time_estimated',
      actorId: null,
      actorRole: input.actorRoleKey ?? null,
      assignmentId: input.assignmentId ?? null,
      employeeId: null,
      summary: 'Provider-Anfrage blockiert — nur Heuristik.',
    });
    return {
      ok: false,
      error: 'Kartenprovider nicht freigegeben — Fahrzeit nur als Heuristik verfügbar.',
    };
  }

  const estimate = persistTravelEstimate(
    buildHeuristicTravelEstimate({
      tenantId: input.tenantId,
      assignmentId: input.assignmentId,
      fromAddress: input.fromAddress,
      toAddress: input.toAddress,
    }),
  );

  audit({
    tenantId: input.tenantId,
    action: 'travel_time_estimated',
    actorId: null,
    actorRole: input.actorRoleKey ?? null,
    assignmentId: input.assignmentId ?? null,
    employeeId: null,
    summary: `Heuristik: ${estimate.durationMinutes} Min. (${TRAVEL_TIME_DISCLAIMER})`,
    metadata: { source: estimate.source },
  });

  return { ok: true, data: estimate };
}

/** 6 — Arbeitszeit prüfen */
export function checkEmployeeWorkTimeForDay(
  tenantId: string,
  employeeId: string,
  dateKey: string,
): ServiceResult<{ totalMinutes: number; warning: RoutePlanningConflict | null }> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const assignments = listAssignmentWorkflows(tenantId);
  const totalMinutes = sumDailyWorkMinutes(assignments, employeeId, dateKey);
  const warning = checkMaxWorkingTimeWarning(assignments, employeeId, dateKey, MAX_DAILY_WORK_HOURS);

  audit({
    tenantId,
    action: 'work_time_checked',
    actorId: null,
    actorRole: null,
    assignmentId: null,
    employeeId,
    summary: `Tagesarbeitszeit ${(totalMinutes / 60).toFixed(1)} h.`,
    metadata: { dateKey },
  });

  return { ok: true, data: { totalMinutes, warning } };
}

/** 7 — Regionale Nähe prüfen */
export function checkEmployeeRegionalProximity(
  tenantId: string,
  employeeId: string,
  assignmentAddress: string,
): ServiceResult<{ proximity: ReturnType<typeof checkRegionalProximity> }> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const file = getEmployeePersonnelFileForAssignmentCheck(tenantId, employeeId);
  const homeAddress = file
    ? [file.masterData.street, file.masterData.postalCode, file.masterData.city].filter(Boolean).join(', ')
    : null;
  const proximity = checkRegionalProximity(homeAddress, assignmentAddress);

  audit({
    tenantId,
    action: 'proximity_checked',
    actorId: null,
    actorRole: null,
    assignmentId: null,
    employeeId,
    summary: `Regionale Nähe: ${proximity}.`,
  });

  return { ok: true, data: { proximity } };
}

/** 8 — Tourenansicht */
export function fetchTourView(
  tenantId: string,
  employeeId: string,
  dateKey: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<TourViewResult> {
  const denied = enforcePermission<TourViewResult>(actorRoleKey, 'assist.assignments.view');
  if (denied) return denied;

  const liveBlock = guardLiveDemoFeature<TourViewResult>(tenantId, 'Tourenansicht');
  if (liveBlock) return liveBlock;

  const dayAssignments = listAssignmentWorkflows(tenantId)
    .filter(
      (a) =>
        a.employeeId === employeeId &&
        a.canonicalStatus !== 'cancelled' &&
        a.plannedStartAt.slice(0, 10) === dateKey,
    )
    .sort((a, b) => a.plannedStartAt.localeCompare(b.plannedStartAt));

  const existing = listAssignmentWorkflows(tenantId);
  const absences = getPlanningBlockAbsences(tenantId);
  const availability = getEmployeeAvailabilityBlocks(tenantId);
  const conflicts: RoutePlanningConflict[] = [];
  const travelEstimates: TravelTimeEstimate[] = [];
  const now = new Date().toISOString();

  let previousAddress: string | null = null;
  let previousEndAt: string | null = null;
  const items = dayAssignments.map((assignment, index) => {
    const assignmentConflicts = detectRoutePlanningConflictsForAssignment({
      assignment,
      existing,
      employeeAbsences: absences,
      employeeAvailability: availability,
      actorRoleKey,
      previousAssignmentAddress: previousAddress,
      previousAssignmentEndAt: previousEndAt,
    });
    conflicts.push(...assignmentConflicts);

    let travelMinutes: number | null = null;
    let travelPlausibility: 'ok' | 'warning' | 'unknown' = 'unknown';
    if (previousAddress && assignment.locationAddress?.trim()) {
      const estimate = buildHeuristicTravelEstimate({
        tenantId,
        assignmentId: assignment.id,
        fromAddress: previousAddress,
        toAddress: assignment.locationAddress,
      });
      travelMinutes = estimate.durationMinutes;
      travelPlausibility = assignmentConflicts.some((c) => c.code === 'travel_time_unrealistic')
        ? 'warning'
        : 'ok';
      travelEstimates.push(
        persistTravelEstimate(estimate),
      );
    }

    previousAddress = assignment.locationAddress;
    previousEndAt = assignment.plannedEndAt;

    return {
      id: nextRoutePlanItemId(),
      tenantId,
      routePlanId: '',
      assignmentId: assignment.id,
      sortOrder: index,
      plannedArrivalAt: assignment.plannedStartAt,
      plannedDepartureAt: assignment.plannedEndAt,
      address: assignment.locationAddress,
      travelMinutesFromPrevious: travelMinutes,
      travelPlausibility,
      createdAt: now,
      updatedAt: now,
    };
  });

  const totalPlannedMinutes = dayAssignments.reduce(
    (sum, a) =>
      sum + (new Date(a.plannedEndAt).getTime() - new Date(a.plannedStartAt).getTime()) / 60_000,
    0,
  );

  const routePlan = {
    id: nextRoutePlanId(),
    tenantId,
    employeeId,
    planDate: dateKey,
    status: 'draft' as const,
    title: `Tour ${dateKey}`,
    totalStops: items.length,
    totalPlannedMinutes: Math.round(totalPlannedMinutes),
    confirmedAt: null,
    confirmedBy: null,
    createdAt: now,
    updatedAt: now,
  };

  for (const item of items) {
    item.routePlanId = routePlan.id;
  }

  ROUTE_PLANNING_STORE.routePlans.push(routePlan);
  ROUTE_PLANNING_STORE.routePlanItems.push(...items);

  const workTimeWarning = checkMaxWorkingTimeWarning(existing, employeeId, dateKey, MAX_DAILY_WORK_HOURS);
  if (workTimeWarning) conflicts.push(workTimeWarning);

  audit({
    tenantId,
    action: 'tour_view_built',
    actorId: null,
    actorRole: actorRoleKey ?? null,
    assignmentId: null,
    employeeId,
    summary: `Tour ${dateKey}: ${items.length} Stopps.`,
    metadata: { dateKey, stops: String(items.length) },
  });

  return {
    ok: true,
    data: {
      routePlan,
      items,
      conflicts,
      travelEstimates,
    },
  };
}

/** 9 — Konfliktwarnungen */
export function detectRoutePlanningConflicts(
  tenantId: string,
  assignmentId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<RoutePlanningConflict[]> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const assignment = listAssignmentWorkflows(tenantId).find((a) => a.id === assignmentId);
  if (!assignment) return { ok: false, error: 'Einsatz nicht gefunden.' };

  const existing = listAssignmentWorkflows(tenantId);
  const absences = getPlanningBlockAbsences(tenantId);
  const availability = getEmployeeAvailabilityBlocks(tenantId);

  const conflicts = detectRoutePlanningConflictsForAssignment({
    assignment,
    existing,
    employeeAbsences: absences,
    employeeAvailability: availability,
    actorRoleKey,
    requireProvider: false,
  });

  persistConflicts(tenantId, assignmentId, assignment.employeeId, conflicts);

  audit({
    tenantId,
    action: 'conflicts_detected',
    actorId: null,
    actorRole: actorRoleKey ?? null,
    assignmentId,
    employeeId: assignment.employeeId,
    summary: `${conflicts.length} Konflikt(e) erkannt.`,
    metadata: { count: String(conflicts.length) },
  });

  return { ok: true, data: conflicts };
}

/** 10 — Änderung bestätigen (keine automatische Umplanung ohne confirmed) */
export function confirmRoutePlanningChange(
  tenantId: string,
  input: RoutePlanningChangeInput,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): ServiceResult<{ assignmentId: string; notified: boolean }> {
  const denied = enforcePermission<{ assignmentId: string; notified: boolean }>(
    actorRoleKey,
    'assist.assignments.manage',
  );
  if (denied) return denied;

  const liveBlock = guardLiveDemoFeature<{ assignmentId: string; notified: boolean }>(
    tenantId,
    'Planungsänderung',
  );
  if (liveBlock) return liveBlock;

  if (!input.confirmed) {
    return {
      ok: false,
      error: 'Änderung erfordert explizite Bestätigung — keine automatische Umplanung.',
    };
  }

  const assignment = listAssignmentWorkflows(tenantId).find((a) => a.id === input.assignmentId);
  if (!assignment) return { ok: false, error: 'Einsatz nicht gefunden.' };

  if (input.newEmployeeId) {
    const qualification = checkEmployeeQualificationForAssignment(
      tenantId,
      input.newEmployeeId,
      assignment.serviceType,
      actorRoleKey,
    );
    if (!qualification.ok) {
      return { ok: false, error: qualification.error };
    }
    const qualificationResult = qualification.data;
    if (!qualificationResult.assignable) {
      return {
        ok: false,
        error: qualificationResult.blockers[0] ?? 'Mitarbeitende:r nicht qualifiziert oder verfügbar.',
      };
    }

    const availability = checkEmployeeAvailabilityForPlanning(
      tenantId,
      input.newEmployeeId,
      input.newStartAt ?? assignment.plannedStartAt,
      input.newEndAt ?? assignment.plannedEndAt,
    );
    if (!availability.ok) {
      return { ok: false, error: availability.error };
    }
    const availabilityResult = availability.data;
    if (!availabilityResult.available) {
      return {
        ok: false,
        error: availabilityResult.reason ?? 'Mitarbeitende:r nicht verfügbar.',
      };
    }

    const assignResult = assignEmployeeToWorkflow(
      tenantId,
      input.assignmentId,
      input.newEmployeeId,
      actorRoleKey,
      actorProfileId,
    );
    if (!assignResult.ok) return { ok: false, error: assignResult.error };
  }

  audit({
    tenantId,
    action: 'change_confirmed',
    actorId: actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    assignmentId: input.assignmentId,
    employeeId: input.newEmployeeId ?? assignment.employeeId,
    summary: input.reason ?? 'Planungsänderung bestätigt.',
    metadata: {
      confirmed: 'true',
      newEmployeeId: input.newEmployeeId ?? '',
    },
  });

  const notifyResult = notifyEmployeeOfPlanningChange(
    tenantId,
    {
      assignmentId: input.assignmentId,
      employeeId: input.newEmployeeId ?? assignment.employeeId ?? '',
      title: 'Planungsänderung',
      body: input.reason ?? 'Ihr Einsatzplan wurde geändert.',
    },
    actorRoleKey,
  );

  return {
    ok: true,
    data: {
      assignmentId: input.assignmentId,
      notified: notifyResult.ok,
    },
  };
}

/** 11 — Mitarbeitende:n benachrichtigen */
export function notifyEmployeeOfPlanningChange(
  tenantId: string,
  input: {
    assignmentId: string;
    employeeId: string;
    title: string;
    body: string;
  },
  actorRoleKey?: RoleKey | null,
): ServiceResult<{ notificationCount: number }> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (!input.employeeId?.trim()) {
    return { ok: false, error: 'Kein Mitarbeitende:r für Benachrichtigung.' };
  }

  const notifications = createMonitorNotification({
    tenantId,
    assignmentId: input.assignmentId,
    recipientType: 'employee',
    recipientId: input.employeeId,
    eventType: 'planning_change',
    title: input.title,
    body: input.body,
  });

  audit({
    tenantId,
    action: 'employee_notified',
    actorId: null,
    actorRole: actorRoleKey ?? null,
    assignmentId: input.assignmentId,
    employeeId: input.employeeId,
    summary: `Benachrichtigung an ${input.employeeId}: ${input.title}`,
  });

  return { ok: true, data: { notificationCount: notifications.length } };
}

export function listRoutePlanningAuditTrail(tenantId: string): RoutePlanningAuditEvent[] {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return [];
  return filterRoutePlanningByTenant(ROUTE_PLANNING_STORE.auditEvents, tenantId);
}

export function listPersistedPlanningConflicts(
  tenantId: string,
  assignmentId?: string,
): RoutePlanningConflict[] {
  const rows = filterRoutePlanningByTenant(ROUTE_PLANNING_STORE.assignmentConflicts, tenantId);
  return rows
    .filter((r) => !assignmentId || r.assignmentId === assignmentId)
    .map((r) => ({
      code: r.code,
      message: r.message,
      severity: r.severity,
      assignmentId: r.assignmentId,
      employeeId: r.employeeId ?? undefined,
    }));
}

export { resetRoutePlanningStore, hasBlockingPlanningConflicts };
