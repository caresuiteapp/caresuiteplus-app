import type { RoleKey, ServiceResult } from '@/types';
import type { AssignmentListItem } from '@/types/modules/assist';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import {
  getDemoAssignmentListItems,
  getDemoAssignmentSeedById,
  isAssignmentToday,
  isAssignmentUpcoming,
  removeDemoAssignmentSeed,
  updateDemoAssignmentFields,
  updateDemoAssignmentSeedStatus,
} from '@/data/demo/assistAssignments';
import { demoClients } from '@/data/demo/clients';
import { demoEmployees } from '@/data/demo/employees';
import { assignmentSupabaseRepository } from '@/lib/assist/repositories/assignmentRepository.supabase';
import {
  visitDispositionKpiLabels,
  visitSupabaseRepository,
  type VisitStatusHistoryEntry,
} from '@/lib/assist/repositories/visitRepository.supabase';
import { validateVisitStatusTransition } from '@/lib/assist/visitWorkflow';
import type {
  VisitCreateInput,
  VisitCreateWizardData,
  VisitDispositionDetail,
  VisitDispositionListItem,
  VisitProofStatus,
} from '@/lib/assist/visitTypes';
import { buildVisitRecurrenceJson } from '@/lib/assist/visitTypes';
import { remoteStatusToAssignment } from '@/lib/assist/assignmentStatusBridge';
import { getAllowedAssignmentTransitions } from '@/lib/assist/assignmentStatusMachine';
import { dedupeStatusTransitionButtons } from '@/lib/assist/visitTransitionButtons';
import { assignmentStatusToDimensions, isVisitIncomplete } from '@/lib/assist/visitWorkflow';
import { buildPlannedTimestamps } from '@/lib/assist/assignmentProductionValidation';
import {
  hasAssignmentProductionErrors,
  validateAssignmentCreateForm,
} from '@/lib/assist/assignmentProductionValidation';
import { detectAssignmentConflicts } from '@/lib/assist/assignmentConflictService';
import {
  expandVisitRecurrenceDates,
} from '@/lib/assist/assignmentBudgetAllocationService';
import {
  calculateAssistBudgetAllocationFromProfile,
  calculateSeriesBudgetAllocations,
  resolveHourlyRateCents,
} from '@/lib/assist/calculateAssistBudgetAllocation';
import { getClientAssistBillingProfile } from '@/lib/assist/clientAssistBillingProfileService';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { overlayVisitDispositionDetailFromAssignment } from '@/lib/assist/overlayVisitDispositionFromAssignment';
import {
  applyOccurrenceDateToVisitDetail,
  isResolvableVisitId,
  parseVisitOccurrenceId,
  parseVisitRecurrenceJson,
  resolveVisitMasterId,
} from '@/lib/assist/visitRecurrenceExpansion';
import {
  getMaterializedOccurrenceId,
  isVirtualRecurringOccurrenceId,
  resetVirtualOccurrenceExecutionState,
} from '@/lib/assist/visitRecurrenceExecution';
import {
  buildVisitUpdateInputFromEditForm,
  mapVisitDetailToEditForm,
  type VisitEditFormData,
} from '@/lib/assist/visitEditMappers';

const CANCELLED_EXECUTION_ERROR =
  'Dieser Einsatz wurde abgesagt und kann nicht mehr durchgeführt oder dokumentiert werden.';

function isCancelledVisit(visit: VisitDispositionDetail): boolean {
  return visit.assignmentStatus === 'storniert' || visit.executionStatus === 'cancelled';
}

async function rejectCancelledVisit(
  tenantId: string,
  visitId: string,
): Promise<ServiceResult<null>> {
  const visit = await visitSupabaseRepository.getById(tenantId, visitId);
  if (!visit.ok) return visit;
  if (visit.data && isCancelledVisit(visit.data)) {
    return { ok: false, error: CANCELLED_EXECUTION_ERROR };
  }
  return { ok: true, data: null };
}

/**
 * Ensure a recurring-series occurrence has its own visit row before execution mutations.
 * Virtual occurrence ids (uuid::YYYY-MM-DD) are materialized; master ids pass through.
 */
export async function resolveExecutableVisitId(
  tenantId: string,
  rawVisitId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ visitId: string; materialized: boolean }>> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (!isResolvableVisitId(rawVisitId)) {
    return { ok: false, error: 'Einsatz nicht gefunden.' };
  }

  const { visitId: routeMasterId, occurrenceDate } = parseVisitOccurrenceId(rawVisitId);
  if (!occurrenceDate) {
    if (getServiceMode() === 'supabase') {
      const resolvedVisitId =
        (await visitSupabaseRepository.resolveVisitId(tenantId, routeMasterId)) ?? routeMasterId;
      const active = await rejectCancelledVisit(tenantId, resolvedVisitId);
      if (!active.ok) return active;
      return { ok: true, data: { visitId: resolvedVisitId, materialized: false } };
    }
    return { ok: true, data: { visitId: routeMasterId, materialized: false } };
  }

  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: { visitId: rawVisitId, materialized: false } };
  }

  const masterVisitId =
    (await visitSupabaseRepository.resolveVisitId(tenantId, routeMasterId)) ?? routeMasterId;
  const master = await visitSupabaseRepository.getById(tenantId, masterVisitId);
  if (!master.ok) return master;
  if (!master.data) return { ok: false, error: 'Einsatz nicht gefunden.' };

  const materializedId = getMaterializedOccurrenceId(master.data.recurrenceJson, occurrenceDate);
  if (materializedId) {
    const active = await rejectCancelledVisit(tenantId, materializedId);
    if (!active.ok) return active;
    return { ok: true, data: { visitId: materializedId, materialized: false } };
  }

  if (isCancelledVisit(master.data)) {
    return { ok: false, error: CANCELLED_EXECUTION_ERROR };
  }

  const materialized = await visitSupabaseRepository.materializeOccurrence(
    tenantId,
    masterVisitId,
    occurrenceDate,
  );
  if (!materialized.ok) return materialized;
  return {
    ok: true,
    data: { visitId: materialized.data.id, materialized: materialized.data.materialized },
  };
}

export type VisitDispositionKpi = {
  id: string;
  label: string;
  value: number;
  subValue?: string;
  icon: string;
  accentColor: string;
};

function demoClientName(clientId: string): string {
  const client = demoClients.find((c) => c.id === clientId);
  return client ? `${client.firstName} ${client.lastName}` : 'Unbekannt';
}

function demoEmployeeName(employeeId: string): string {
  const employee = demoEmployees.find((e) => e.id === employeeId);
  return employee ? `${employee.firstName} ${employee.lastName}` : 'Unbekannt';
}

function assignmentListItemToDisposition(item: AssignmentListItem): VisitDispositionListItem {
  const assignmentStatus =
    item.assignmentStatus ?? remoteStatusToAssignment(item.status === 'entwurf' ? 'planned' : item.status);
  const dims = assignmentStatusToDimensions(assignmentStatus);
  const proofStatus = (item.proofStatus as VisitProofStatus | undefined) ?? dims.proof;
  const isIncomplete =
    item.isIncomplete ??
    isVisitIncomplete({
      documentationStatus: dims.documentation,
      proofStatus,
      executionStatus: dims.execution,
    });

  return {
    id: item.id,
    tenantId: item.tenantId,
    title: item.title,
    serviceName: item.title,
    scheduledStart: item.scheduledStart,
    scheduledEnd: item.scheduledEnd,
    durationMinutes: Math.round(
      (new Date(item.scheduledEnd).getTime() - new Date(item.scheduledStart).getTime()) / 60000,
    ),
    status: item.status,
    assignmentStatus,
    planningStatus: (item.planningStatus as VisitDispositionListItem['planningStatus']) ?? dims.planning,
    onTheWayAt: item.onTheWayAt,
    arrivedAt: item.arrivedAt,
    actualStartAt: item.actualStartAt,
    actualEndAt: item.actualEndAt,
    proofStatus,
    billingStatus: (item.billingStatus as VisitDispositionListItem['billingStatus']) ?? dims.billing,
    location: item.location,
    clientName: item.clientName,
    employeeId: item.employeeId ?? null,
    employeeName: item.employeeName,
    isAtRisk: item.isAtRisk ?? item.status === 'fehlerhaft',
    isIncomplete,
    updatedAt: item.updatedAt,
  };
}

export function buildVisitDispositionKpis(items: VisitDispositionListItem[]): VisitDispositionKpi[] {
  const today = items.filter((item) => isAssignmentToday(item.scheduledStart)).length;
  const open = items.filter(
    (item) =>
      item.planningStatus === 'scheduled' ||
      item.planningStatus === 'confirmed' ||
      item.planningStatus === 'draft',
  ).length;
  const atRisk = items.filter((item) => item.isAtRisk).length;
  const incomplete = items.filter((item) => item.isIncomplete).length;

  return [
    {
      id: 'visit-kpi-today',
      label: 'Heute',
      value: today,
      subValue: today > 0 ? 'Einsätze heute' : 'Keine heute',
      icon: '📅',
      accentColor: '#FF9500',
    },
    {
      id: 'visit-kpi-open',
      label: 'Offen',
      value: open,
      subValue: `${items.length} gesamt`,
      icon: '📋',
      accentColor: '#62F3FF',
    },
    {
      id: 'visit-kpi-risk',
      label: 'Gefährdet',
      value: atRisk,
      subValue: incomplete > 0 ? `${incomplete} unvollständig` : 'Disposition',
      icon: '⚠️',
      accentColor: atRisk > 0 ? '#FF6B6B' : '#4ADE80',
    },
    {
      id: 'visit-kpi-incomplete',
      label: 'Unvollständig',
      value: incomplete,
      subValue: isAssignmentUpcoming(items[0]?.scheduledStart ?? '') ? 'Anstehend' : 'Prüfen',
      icon: '📝',
      accentColor: '#C084FC',
    },
  ];
}

export async function fetchVisitDispositionList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<VisitDispositionListItem[]>> {
  const denied = enforcePermission<VisitDispositionListItem[]>(
    actorRoleKey,
    'assist.assignments.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const visitResult = await visitSupabaseRepository.list(tenantId);
    // assist_visits is the authoritative planning source. An empty successful
    // result means there are no visits. Falling back to legacy assignments in
    // that case resurrects an already deleted mirror as a visible card.
    if (visitResult.ok) {
      return visitResult;
    }
    const fallback = await assignmentSupabaseRepository.list(tenantId);
    if (!fallback.ok) return fallback;
    return {
      ok: true,
      data: fallback.data.map(assignmentListItemToDisposition),
    };
  }

  await new Promise((r) => setTimeout(r, 260));
  return {
    ok: true,
    data: getDemoAssignmentListItems().map(assignmentListItemToDisposition),
  };
}

export async function fetchVisitDispositionDetail(
  visitId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<VisitDispositionDetail>> {
  const assistDenied = enforcePermission<VisitDispositionDetail>(
    actorRoleKey,
    'assist.assignments.view',
  );
  const portalDenied = enforcePermission<VisitDispositionDetail>(
    actorRoleKey,
    'portal.client.appointments.view',
  );
  if (assistDenied && portalDenied) return assistDenied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    if (!isResolvableVisitId(visitId)) return { ok: false, error: 'Einsatz nicht gefunden.' };

    const { visitId: masterVisitId, occurrenceDate } = parseVisitOccurrenceId(visitId);

    const visitResult = await visitSupabaseRepository.getById(tenantId, masterVisitId);
    if (visitResult.ok && visitResult.data) {
      if (occurrenceDate) {
        const materializedId = getMaterializedOccurrenceId(
          visitResult.data.recurrenceJson,
          occurrenceDate,
        );
        if (materializedId && materializedId !== visitId) {
          return fetchVisitDispositionDetail(materializedId, tenantId, actorRoleKey);
        }
      }

      let baseDetail =
        occurrenceDate != null
          ? applyOccurrenceDateToVisitDetail(visitResult.data, occurrenceDate, visitId)
          : visitResult.data;

      if (isVirtualRecurringOccurrenceId(visitId)) {
        baseDetail = resetVirtualOccurrenceExecutionState(baseDetail);
      }

      const overlaid = await overlayVisitDispositionDetailFromAssignment(tenantId, baseDetail);
      const detail =
        occurrenceDate != null && isVirtualRecurringOccurrenceId(visitId)
          ? applyOccurrenceDateToVisitDetail(overlaid, occurrenceDate, visitId)
          : overlaid;
      return { ok: true, data: detail };
    }

    const assignmentResult = await assignmentSupabaseRepository.getById(tenantId, masterVisitId);
    if (!assignmentResult.ok) return assignmentResult;
    if (!assignmentResult.data) return { ok: false, error: 'Einsatz nicht gefunden.' };

    const detail = assignmentResult.data;
    const dims = assignmentStatusToDimensions(detail.assignmentStatus);
    const allowed = dedupeStatusTransitionButtons(
      getAllowedAssignmentTransitions(detail.assignmentStatus),
    );

    let legacyDetail: VisitDispositionDetail = {
      id: occurrenceDate != null ? visitId : detail.id,
      tenantId: detail.tenantId,
      title: detail.title,
      serviceName: detail.title,
      scheduledStart: detail.scheduledStart,
      scheduledEnd: detail.scheduledEnd,
      durationMinutes: Math.round(
        (new Date(detail.scheduledEnd).getTime() - new Date(detail.scheduledStart).getTime()) /
          60000,
      ),
      status: detail.status,
      planningStatus: dims.planning,
      proofStatus: dims.proof,
      billingStatus: dims.billing,
      location: detail.location,
      clientName: detail.clientName,
      employeeName: detail.employeeName,
      isAtRisk: detail.status === 'fehlerhaft',
      isIncomplete: detail.status === 'in_bearbeitung',
      updatedAt: detail.updatedAt,
      clientId: detail.clientId,
      employeeId: detail.employeeId,
      serviceKey: null,
      description: null,
      notes: detail.notes,
      employeeNotes: null,
      executionStatus: dims.execution,
      documentationStatus: dims.documentation,
      portalStatus: dims.portal,
      assignmentStatus: detail.assignmentStatus,
      allowedStatusTransitions: allowed,
      tasks: detail.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status as VisitDispositionDetail['tasks'][0]['status'],
        isRequired: t.isRequired,
        notDoneReason: t.notDoneReason,
      })),
      budget: null,
      portalReleaseEnabled: false,
      employeePortalVisible: true,
      errorCode: detail.status === 'fehlerhaft' ? 'legacy_error' : null,
      errorMessage: detail.status === 'fehlerhaft' ? 'Einsatz fehlerhaft — bitte prüfen.' : null,
      onTheWayAt: detail.onTheWayAt,
      arrivedAt: detail.arrivedAt,
      finishedAt: detail.finishedAt,
      actualStartAt: detail.actualStartAt,
      actualEndAt: detail.actualEndAt,
      createdAt: detail.createdAt,
    };

    if (occurrenceDate != null) {
      legacyDetail = applyOccurrenceDateToVisitDetail(legacyDetail, occurrenceDate, visitId);
      if (isVirtualRecurringOccurrenceId(visitId)) {
        legacyDetail = resetVirtualOccurrenceExecutionState(legacyDetail);
      }
    }

    const overlaidLegacy = await overlayVisitDispositionDetailFromAssignment(
      tenantId,
      legacyDetail,
    );

    return {
      ok: true,
      data: overlaidLegacy,
    };
  }

  await new Promise((r) => setTimeout(r, 240));
  const seed = getDemoAssignmentSeedById(visitId);
  if (!seed) return { ok: false, error: 'Einsatz nicht gefunden.' };

  const assignmentStatus = remoteStatusToAssignment(seed.status);
  const dims = assignmentStatusToDimensions(assignmentStatus);
  const allowed = dedupeStatusTransitionButtons(getAllowedAssignmentTransitions(assignmentStatus));

  return {
    ok: true,
    data: {
      id: seed.id,
      tenantId: seed.tenantId,
      title: seed.title,
      serviceName: seed.title,
      scheduledStart: seed.scheduledStart,
      scheduledEnd: seed.scheduledEnd,
      durationMinutes: 60,
      status: seed.status,
      planningStatus: dims.planning,
      proofStatus: dims.proof,
      billingStatus: dims.billing,
      location: seed.location,
      clientName: demoClientName(seed.clientId),
      employeeName: demoEmployeeName(seed.employeeId),
      isAtRisk: seed.status === 'fehlerhaft',
      isIncomplete: seed.status === 'in_bearbeitung',
      updatedAt: seed.updatedAt,
      clientId: seed.clientId,
      employeeId: seed.employeeId,
      serviceKey: null,
      description: null,
      notes: seed.notes,
      employeeNotes: null,
      executionStatus: dims.execution,
      documentationStatus: dims.documentation,
      portalStatus: dims.portal,
      assignmentStatus,
      allowedStatusTransitions: allowed,
      tasks: [],
      budget: null,
      portalReleaseEnabled: false,
      employeePortalVisible: true,
      errorCode: null,
      errorMessage: null,
      onTheWayAt: null,
      arrivedAt: null,
      finishedAt: null,
      actualStartAt: null,
      actualEndAt: null,
      createdAt: seed.createdAt,
    },
  };
}

export async function updateVisitDispositionStatus(
  visitId: string,
  tenantId: string,
  toStatus: AssignmentStatus,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<VisitDispositionDetail>> {
  const denied = enforcePermission<VisitDispositionDetail>(
    actorRoleKey,
    'assist.assignments.manage',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    if (!isResolvableVisitId(visitId)) return { ok: false, error: 'Einsatz nicht gefunden.' };

    const executable = await resolveExecutableVisitId(tenantId, visitId, actorRoleKey);
    if (!executable.ok) return executable;
    const executableVisitId = executable.data.visitId;

    const existing = await fetchVisitDispositionDetail(executableVisitId, tenantId, actorRoleKey);
    if (!existing.ok) return existing;
    if (!existing.data) return { ok: false, error: 'Einsatz nicht gefunden.' };

    const validation = validateVisitStatusTransition(
      existing.data.assignmentStatus,
      toStatus,
    );
    if (!validation.valid) {
      return { ok: false, error: validation.error ?? 'Statuswechsel nicht erlaubt.' };
    }

    const resolvedId = await visitSupabaseRepository.resolveVisitId(tenantId, executableVisitId);
    if (resolvedId) {
      const updated = await visitSupabaseRepository.updateAssignmentStatus(
        tenantId,
        resolvedId,
        toStatus,
      );
      if (!updated.ok) return updated;
      return fetchVisitDispositionDetail(executableVisitId, tenantId, actorRoleKey);
    }

    const masterVisitId = resolveVisitMasterId(executableVisitId);
    const updated = await assignmentSupabaseRepository.updateStatus(tenantId, masterVisitId, toStatus);
    if (!updated.ok) return updated;
    return fetchVisitDispositionDetail(executableVisitId, tenantId, actorRoleKey);
  }

  const current = getDemoAssignmentSeedById(visitId);
  if (!current) return { ok: false, error: 'Einsatz nicht gefunden.' };

  const fromStatus = remoteStatusToAssignment(current.status);
  const validation = validateVisitStatusTransition(fromStatus, toStatus);
  if (!validation.valid) {
    return { ok: false, error: validation.error ?? 'Statuswechsel nicht erlaubt.' };
  }

  await new Promise((r) => setTimeout(r, 300));
  const workflowMap: Partial<
    Record<AssignmentStatus, import('@/types/core/base').WorkflowStatus>
  > = {
    geplant: 'entwurf',
    bestaetigt: 'aktiv',
    unterwegs: 'aktiv',
    angekommen: 'in_bearbeitung',
    gestartet: 'in_bearbeitung',
    pausiert: 'in_bearbeitung',
    beendet: 'in_bearbeitung',
    dokumentation_offen: 'in_bearbeitung',
    unterschrift_offen: 'in_bearbeitung',
    abgeschlossen: 'abgeschlossen',
    storniert: 'fehlerhaft',
    nicht_erschienen: 'fehlerhaft',
  };
  updateDemoAssignmentSeedStatus(visitId, workflowMap[toStatus] ?? 'aktiv');
  return fetchVisitDispositionDetail(visitId, tenantId, actorRoleKey);
}

export type { VisitStatusHistoryEntry } from '@/lib/assist/repositories/visitRepository.supabase';

export type VisitSeriesMutationScope = 'this_only' | 'this_and_following';

function visitOccurrenceDate(visit: VisitDispositionDetail): string {
  const recurrence = parseVisitRecurrenceJson(visit.recurrenceJson);
  return (
    recurrence.sourceOccurrenceDate
    ?? recurrence.masterOccurrenceDate
    ?? visit.assignmentDate
    ?? visit.scheduledStart.slice(0, 10)
  );
}

function isProtectedSeriesHistory(visit: VisitDispositionDetail): boolean {
  return Boolean(
    visit.onTheWayAt
    || visit.arrivedAt
    || visit.actualStartAt
    || visit.actualEndAt
    || visit.finishedAt
    || visit.documentationStatus === 'complete'
    || visit.documentationStatus === 'review'
    || visit.proofStatus === 'signed'
    || visit.proofStatus === 'verified'
    || visit.billingStatus === 'invoiced'
    || visit.billingStatus === 'paid'
  );
}

function shiftDateKey(dateKey: string, dayDelta: number): string {
  const [year, month, day] = dateKey.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day! + dayDelta, 12));
  return date.toISOString().slice(0, 10);
}

function dateKeyDelta(from: string, to: string): number {
  const read = (value: string) => {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    return Date.UTC(year!, month! - 1, day!, 12);
  };
  return Math.round((read(to) - read(from)) / 86_400_000);
}

function preserveMasterSeriesAnchor(
  visit: VisitDispositionDetail,
  input: VisitCreateInput,
): VisitCreateInput {
  const recurrence = parseVisitRecurrenceJson(visit.recurrenceJson);
  if (recurrence.pattern === 'none' || recurrence.parentSeriesId) return input;

  const oldOccurrenceDate = visitOccurrenceDate(visit);
  const moved = input.assignmentDate !== oldOccurrenceDate;
  return {
    ...input,
    recurrenceJson: {
      ...parseVisitRecurrenceJson(input.recurrenceJson),
      anchorDate:
        recurrence.anchorDate
        ?? visit.assignmentDate
        ?? visit.scheduledStart.slice(0, 10),
      masterOccurrenceDate: moved
        ? input.assignmentDate
        : recurrence.masterOccurrenceDate ?? oldOccurrenceDate,
      detachedOccurrenceDates: moved
        ? Array.from(new Set([
            ...(recurrence.detachedOccurrenceDates ?? []),
            oldOccurrenceDate,
          ]))
        : recurrence.detachedOccurrenceDates,
      materializedOccurrences: recurrence.materializedOccurrences,
    },
  };
}

export async function fetchVisitStatusHistory(
  visitId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<VisitStatusHistoryEntry[]>> {
  const denied = enforcePermission<VisitStatusHistoryEntry[]>(
    actorRoleKey,
    'assist.assignments.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    if (!isResolvableVisitId(visitId)) return { ok: true, data: [] };

    const resolvedId = await visitSupabaseRepository.resolveVisitId(tenantId, visitId);
    const targetId = resolvedId ?? resolveVisitMasterId(visitId);
    return visitSupabaseRepository.fetchStatusHistory(tenantId, targetId);
  }

  return { ok: true, data: [] };
}

export async function deleteVisitDisposition(
  visitId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  scope: VisitSeriesMutationScope = 'this_only',
): Promise<ServiceResult<void>> {
  const denied = enforcePermission<void>(actorRoleKey, 'assist.assignments.manage');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    if (!isResolvableVisitId(visitId)) return { ok: false, error: 'Einsatz nicht gefunden.' };

    if (scope === 'this_and_following') {
      const currentResult = await fetchVisitDispositionDetail(
        visitId,
        tenantId,
        actorRoleKey,
      );
      if (!currentResult.ok) return currentResult;
      if (!currentResult.data) return { ok: false, error: 'Einsatz nicht gefunden.' };

      const current = currentResult.data;
      const currentRecurrence = parseVisitRecurrenceJson(current.recurrenceJson);
      const masterId = currentRecurrence.parentSeriesId
        ?? (currentRecurrence.pattern !== 'none' ? current.id : null);
      if (!masterId) {
        return deleteVisitDisposition(visitId, tenantId, actorRoleKey, 'this_only');
      }

      const series = await visitSupabaseRepository.listSeriesOccurrences(tenantId, masterId);
      if (!series.ok) return series;

      const currentKey = visitOccurrenceDate(current);
      const deletable = series.data
        .filter((candidate) => visitOccurrenceDate(candidate) >= currentKey)
        .sort((a, b) => {
          const masterOrder = Number(a.id === masterId) - Number(b.id === masterId);
          return masterOrder || b.scheduledStart.localeCompare(a.scheduledStart);
        });

      for (const candidate of deletable) {
        const deleted = candidate.id === masterId
          ? await visitSupabaseRepository.deleteSeriesMasterOccurrenceOnly(
              tenantId,
              masterId,
            )
          : await visitSupabaseRepository.delete(tenantId, candidate.id);
        if (!deleted.ok) return deleted;
      }
      return { ok: true, data: undefined };
    }

    const { visitId: routeMasterId, occurrenceDate } = parseVisitOccurrenceId(visitId);
    if (occurrenceDate) {
      const masterVisitId =
        (await visitSupabaseRepository.resolveVisitId(tenantId, routeMasterId)) ?? routeMasterId;
      return visitSupabaseRepository.deleteOccurrence(tenantId, masterVisitId, occurrenceDate);
    }

    const resolvedId = await visitSupabaseRepository.resolveVisitId(tenantId, visitId);
    if (resolvedId) {
      const direct = await visitSupabaseRepository.getById(tenantId, resolvedId);
      if (!direct.ok) return direct;
      const recurrence = parseVisitRecurrenceJson(direct.data?.recurrenceJson);
      if (direct.data && recurrence.pattern !== 'none' && !recurrence.parentSeriesId) {
        return visitSupabaseRepository.deleteSeriesMasterOccurrenceOnly(
          tenantId,
          resolvedId,
        );
      }
      return visitSupabaseRepository.delete(tenantId, resolvedId);
    }

    return assignmentSupabaseRepository.delete(tenantId, resolveVisitMasterId(visitId));
  }

  await new Promise((r) => setTimeout(r, 240));
  if (!removeDemoAssignmentSeed(visitId)) {
    return { ok: false, error: 'Einsatz nicht gefunden.' };
  }
  return { ok: true, data: undefined };
}

export async function createVisitFromWizard(
  tenantId: string,
  wizard: VisitCreateWizardData,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ id: string; conflicts: string[] }>> {
  const denied = enforcePermission<{ id: string; conflicts: string[] }>(
    actorRoleKey,
    'assist.assignments.manage',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const validationErrors = validateAssignmentCreateForm({
    clientId: wizard.clientId,
    employeeId: wizard.employeeId,
    assignmentDate: wizard.assignmentDate,
    plannedStartTime: wizard.plannedStartTime,
    plannedEndTime: wizard.plannedEndTime,
    title: wizard.title,
    tasks:
      wizard.taskDrafts.length > 0
        ? wizard.taskDrafts.map((task) => task.title)
        : wizard.tasks,
  });
  if (wizard.saveAsDraft) {
    delete validationErrors.employeeId;
    delete validationErrors.title;
    delete validationErrors.tasks;
  }
  if (hasAssignmentProductionErrors(validationErrors)) {
    return { ok: false, error: Object.values(validationErrors)[0] ?? 'Bitte Pflichtfelder prüfen.' };
  }

  const { plannedStartAt, plannedEndAt } = buildPlannedTimestamps({
    clientId: wizard.clientId,
    employeeId: wizard.employeeId,
    assignmentDate: wizard.assignmentDate,
    plannedStartTime: wizard.plannedStartTime,
    plannedEndTime: wizard.plannedEndTime,
    title: wizard.title,
    tasks: wizard.tasks,
  });

  const taskTitles =
    wizard.taskDrafts.length > 0
      ? wizard.taskDrafts.map((t) => t.title)
      : wizard.tasks.map((t) => t.trim()).filter(Boolean);

  const durationMinutes = Math.max(
    0,
    Math.round(
      (new Date(plannedEndAt).getTime() - new Date(plannedStartAt).getTime()) / 60000,
    ),
  );

  let budgetAllocation = wizard.budgetAllocation ?? null;
  if (wizard.clientId && !wizard.saveAsDraft) {
    if (budgetAllocation) {
      if (!budgetAllocation.canSave) {
        return { ok: false, error: budgetAllocation.warnings[0] ?? 'Budget nicht speicherbar.' };
      }
    } else {
      const profileResult = await getClientAssistBillingProfile({
        tenantId,
        clientId: wizard.clientId,
        date: wizard.assignmentDate,
      });
      if (profileResult.ok) {
        const hourlyRateCents = resolveHourlyRateCents(profileResult.data, wizard.serviceKey);
        const minutes = durationMinutes;

        if (wizard.recurrencePattern !== 'none') {
          const dates = expandVisitRecurrenceDates({
            assignmentDate: wizard.assignmentDate,
            recurrencePattern: wizard.recurrencePattern,
            recurrenceWeekdays: wizard.recurrenceWeekdays,
            recurrenceEndDate: wizard.recurrenceEndDate || null,
            recurrenceOccurrenceCount: wizard.recurrenceOccurrenceCount,
            maxOccurrences: 12,
          });
          const series = calculateSeriesBudgetAllocations(
            profileResult.data,
            {
              assignmentDate: wizard.assignmentDate,
              plannedStart: wizard.plannedStartTime,
              plannedEnd: wizard.plannedEndTime,
              plannedMinutes: minutes,
              hourlyRateCents,
              serviceType: wizard.serviceKey,
              manualOverride: wizard.budgetManualOverride,
              actorRoleKey,
            },
            dates,
          );
          if (!series.seriesCanSave) {
            return {
              ok: false,
              error: series.cumulativeWarnings[0] ?? 'Serien-Budget nicht ausreichend.',
            };
          }
          budgetAllocation = series.perOccurrence[0] ?? null;
        } else {
          budgetAllocation = calculateAssistBudgetAllocationFromProfile(profileResult.data, {
            plannedStart: wizard.plannedStartTime,
            plannedEnd: wizard.plannedEndTime,
            plannedMinutes: minutes,
            hourlyRateCents,
            serviceType: wizard.serviceKey,
            manualOverride: wizard.budgetManualOverride,
            actorRoleKey,
            assignmentDate: wizard.assignmentDate,
          });
        }

        if (budgetAllocation && !budgetAllocation.canSave) {
          return {
            ok: false,
            error: budgetAllocation.warnings[0] ?? 'Budgetverteilung nicht speicherbar.',
          };
        }
      }
    }
  }

  const budgetAmountCents =
    budgetAllocation?.statutoryAmountCents && budgetAllocation.statutoryAmountCents > 0
      ? budgetAllocation.statutoryAmountCents + (budgetAllocation.selfPayerAmountCents ?? 0)
      : wizard.budgetAmountCents;

  const conflicts = detectAssignmentConflicts({
    assignment: {
      id: 'new',
      tenantId,
      clientId: wizard.clientId,
      employeeId: wizard.employeeId,
      plannedStartAt,
      plannedEndAt,
      locationAddress: wizard.addressSnapshot,
      tasks: taskTitles.map((title, index) => ({
        id: `new-task-${index}`,
        tenantId,
        assignmentId: 'new',
        taskTitle: title,
        taskDescription: '',
        taskCategory: 'service',
        required: true,
        sortOrder: index,
        status: 'open' as const,
        completionNote: null,
        completedBy: null,
        completedAt: null,
      })),
      serviceType: wizard.serviceKey,
    },
    existing: [],
    actorRoleKey,
  }).map((c) => c.message);

  const input: VisitCreateInput = {
    clientId: wizard.clientId,
    employeeId: wizard.employeeId || null,
    serviceKey: wizard.serviceKey,
    serviceName: wizard.serviceName || wizard.title,
    title: wizard.title,
    description: wizard.description,
    assignmentDate: wizard.assignmentDate,
    plannedStartAt,
    plannedEndAt,
    addressSnapshot: wizard.addressSnapshot || null,
    locationNotes: wizard.locationNotes || null,
    tasks: taskTitles,
    budgetAmountCents: budgetAmountCents ?? wizard.budgetAmountCents,
    internalNotes: wizard.internalNotes,
    employeeNotes: wizard.employeeNotes || null,
    clientVisibleNotes: wizard.clientVisibleNotes || null,
    notifyEmployee: wizard.notifyEmployee,
    notifyClient: wizard.notifyClient,
    portalReleaseEnabled: wizard.portalReleaseEnabled,
    saveAsDraft: wizard.saveAsDraft,
    subjectKey: wizard.subjectKey || null,
    assignmentTypeKey: wizard.assignmentTypeKey || null,
    serviceCategoryKey: wizard.serviceCategoryKey || null,
    taskPackageId: wizard.taskPackageId || null,
    billingBudgetSourceKey:
      budgetAllocation?.primaryCatalogKey ?? (wizard.billingBudgetSourceKey || null),
    proofTemplateKey: wizard.proofTemplateKey || null,
    documentationTemplateKey: wizard.documentationTemplate || null,
    riskFlagKeys: wizard.riskFlagKeys,
    recurrenceJson: buildVisitRecurrenceJson(wizard),
    catalogSnapshotJson: {
      ...wizard.catalogSnapshotJson,
      budgetAllocation: budgetAllocation ?? undefined,
    },
    budgetAllocation,
    budgetManualOverride: wizard.budgetManualOverride ?? null,
  };

  if (
    wizard.recurrencePattern !== 'none'
    && !wizard.recurrenceEndDate
    && !wizard.recurrenceOccurrenceCount
  ) {
    return {
      ok: false,
      error: 'Bitte für die Serie ein Enddatum oder eine Anzahl Termine angeben.',
    };
  }

  if (getServiceMode() === 'supabase') {
    const created = await visitSupabaseRepository.create(tenantId, input);
    if (!created.ok) return created;

    if (wizard.recurrencePattern !== 'none') {
      const occurrenceDates = expandVisitRecurrenceDates({
        assignmentDate: wizard.assignmentDate,
        recurrencePattern: wizard.recurrencePattern,
        recurrenceWeekdays: wizard.recurrenceWeekdays,
        recurrenceEndDate: wizard.recurrenceEndDate || null,
        recurrenceOccurrenceCount: wizard.recurrenceOccurrenceCount,
        maxOccurrences: wizard.recurrenceOccurrenceCount ?? 366,
      });

      for (const occurrenceDate of occurrenceDates.slice(1)) {
        const materialized = await visitSupabaseRepository.materializeOccurrence(
          tenantId,
          created.data.id,
          occurrenceDate,
        );
        if (!materialized.ok) {
          return {
            ok: false,
            error: `Serie konnte für ${occurrenceDate} nicht vollständig angelegt werden: ${materialized.error}`,
          };
        }
      }
    }
    return { ok: true, data: { id: created.data.id, conflicts } };
  }

  await new Promise((r) => setTimeout(r, 320));
  return { ok: true, data: { id: `visit-demo-${Date.now()}`, conflicts } };
}

export async function updateVisitFromWizard(
  tenantId: string,
  visitId: string,
  form: VisitEditFormData,
  actorRoleKey?: RoleKey | null,
  scope: VisitSeriesMutationScope = 'this_only',
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'assist.assignments.manage');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const payload = buildVisitUpdateInputFromEditForm(form);
  const { assignmentStatus, ...input } = payload;

  if (getServiceMode() === 'supabase') {
    if (!isResolvableVisitId(visitId)) return { ok: false, error: 'Einsatz nicht gefunden.' };

    const masterVisitId = resolveVisitMasterId(visitId);
    const existing = await fetchVisitDispositionDetail(visitId, tenantId, actorRoleKey);
    if (!existing.ok) return existing;
    if (!existing.data) return { ok: false, error: 'Einsatz nicht gefunden.' };

    const resolvedId = await visitSupabaseRepository.resolveVisitId(tenantId, visitId);
    const targetVisitId = resolvedId ?? masterVisitId;

    const existingRecurrence = parseVisitRecurrenceJson(existing.data.recurrenceJson);
    const seriesMasterId = existingRecurrence.parentSeriesId
      ?? (existingRecurrence.pattern !== 'none' ? existing.data.id : null);

    if (scope === 'this_and_following' && seriesMasterId) {
      const series = await visitSupabaseRepository.listSeriesOccurrences(
        tenantId,
        seriesMasterId,
      );
      if (!series.ok) return series;

      const selectedKey = visitOccurrenceDate(existing.data);
      const originalDate =
        existing.data.assignmentDate ?? existing.data.scheduledStart.slice(0, 10);
      const dayDelta = dateKeyDelta(originalDate, input.assignmentDate);
      const targets = series.data
        .filter((candidate) => visitOccurrenceDate(candidate) >= selectedKey)
        .filter((candidate) => (
          candidate.id === targetVisitId || !isProtectedSeriesHistory(candidate)
        ))
        .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));

      const updatedSnapshots: VisitDispositionDetail[] = [];
      for (const candidate of targets) {
        const candidateDate =
          candidate.assignmentDate ?? candidate.scheduledStart.slice(0, 10);
        const candidateForm: VisitEditFormData = {
          ...form,
          assignmentDate:
            candidate.id === targetVisitId
              ? input.assignmentDate
              : shiftDateKey(candidateDate, dayDelta),
          originalRecurrenceJson: parseVisitRecurrenceJson(candidate.recurrenceJson),
        };
        const { assignmentStatus: candidateStatus, ...candidateBaseInput } =
          buildVisitUpdateInputFromEditForm(candidateForm);
        const candidateInput = preserveMasterSeriesAnchor(candidate, candidateBaseInput);
        const updated = await visitSupabaseRepository.update(
          tenantId,
          candidate.id,
          candidateInput,
        );
        if (!updated.ok) {
          for (const snapshot of updatedSnapshots.reverse()) {
            const rollbackForm = mapVisitDetailToEditForm(snapshot);
            const { assignmentStatus: rollbackStatus, ...rollbackInput } =
              buildVisitUpdateInputFromEditForm(rollbackForm);
            await visitSupabaseRepository.update(tenantId, snapshot.id, rollbackInput);
            if (rollbackStatus !== snapshot.assignmentStatus) {
              await visitSupabaseRepository.updateAssignmentStatus(
                tenantId,
                snapshot.id,
                snapshot.assignmentStatus,
              );
            }
          }
          return updated;
        }
        updatedSnapshots.push(candidate);
        if (candidateStatus !== candidate.assignmentStatus) {
          const statusResult = await visitSupabaseRepository.updateAssignmentStatus(
            tenantId,
            candidate.id,
            candidateStatus,
          );
          if (!statusResult.ok) return statusResult;
        }
      }
      return { ok: true, data: { id: visitId } };
    }

    const updated = await visitSupabaseRepository.update(
      tenantId,
      targetVisitId,
      preserveMasterSeriesAnchor(existing.data, input),
    );
    if (!updated.ok) return updated;

    if (assignmentStatus !== existing.data.assignmentStatus) {
      const statusResult = await visitSupabaseRepository.updateAssignmentStatus(
        tenantId,
        targetVisitId,
        assignmentStatus,
      );
      if (!statusResult.ok) return statusResult;
    }

    return { ok: true, data: { id: visitId } };
  }

  await new Promise((r) => setTimeout(r, 280));
  const workflowMap: Partial<
    Record<AssignmentStatus, import('@/types/core/base').WorkflowStatus>
  > = {
    geplant: 'entwurf',
    bestaetigt: 'aktiv',
    unterwegs: 'aktiv',
    angekommen: 'in_bearbeitung',
    gestartet: 'in_bearbeitung',
    pausiert: 'in_bearbeitung',
    beendet: 'in_bearbeitung',
    dokumentation_offen: 'in_bearbeitung',
    unterschrift_offen: 'in_bearbeitung',
    abgeschlossen: 'abgeschlossen',
    storniert: 'fehlerhaft',
    nicht_erschienen: 'fehlerhaft',
  };

  const demoUpdated = updateDemoAssignmentFields(visitId, {
    title: input.title.trim(),
    location: input.addressSnapshot?.trim() ?? '',
    notes: input.internalNotes?.trim() ?? '',
    status: workflowMap[assignmentStatus] ?? 'aktiv',
  });
  if (!demoUpdated) return { ok: false, error: 'Einsatz nicht gefunden.' };

  return { ok: true, data: { id: visitId } };
}

export { visitDispositionKpiLabels };
