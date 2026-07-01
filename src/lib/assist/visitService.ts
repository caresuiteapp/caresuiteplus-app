import type { RoleKey, ServiceResult } from '@/types';
import type { AssignmentListItem } from '@/types/modules/assist';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';
import {
  getDemoAssignmentListItems,
  getDemoAssignmentSeedById,
  isAssignmentToday,
  isAssignmentUpcoming,
  removeDemoAssignmentSeed,
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
} from '@/lib/assist/visitTypes';
import { buildVisitRecurrenceJson } from '@/lib/assist/visitTypes';
import { remoteStatusToAssignment } from '@/lib/assist/assignmentStatusBridge';
import { assignmentStatusToRemote } from '@/lib/assist/assignmentStatusBridge';
import { getAllowedAssignmentTransitions } from '@/lib/assist/assignmentStatusMachine';
import { dedupeStatusTransitionButtons } from '@/lib/assist/visitWorkflow';
import { assignmentStatusToDimensions } from '@/lib/assist/visitWorkflow';
import { buildPlannedTimestamps } from '@/lib/assist/assignmentProductionValidation';
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
import {
  applyOccurrenceDateToVisitDetail,
  isResolvableVisitId,
  parseVisitOccurrenceId,
  resolveVisitMasterId,
} from '@/lib/assist/visitRecurrenceExpansion';

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
  const assignmentStatus = remoteStatusToAssignment(
    item.status === 'entwurf' ? 'planned' : item.status,
  );
  const dims = assignmentStatusToDimensions(assignmentStatus);
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
    planningStatus: dims.planning,
    proofStatus: dims.proof,
    billingStatus: dims.billing,
    location: item.location,
    clientName: item.clientName,
    employeeId: item.employeeId ?? null,
    employeeName: item.employeeName,
    isAtRisk: item.status === 'fehlerhaft',
    isIncomplete: item.status === 'in_bearbeitung',
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
    if (visitResult.ok && visitResult.data.length > 0) {
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
  const denied = enforcePermission<VisitDispositionDetail>(
    actorRoleKey,
    'assist.assignments.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    if (!isResolvableVisitId(visitId)) return { ok: false, error: 'Einsatz nicht gefunden.' };

    const { visitId: masterVisitId, occurrenceDate } = parseVisitOccurrenceId(visitId);

    const visitResult = await visitSupabaseRepository.getById(tenantId, masterVisitId);
    if (visitResult.ok && visitResult.data) {
      const detail =
        occurrenceDate != null
          ? applyOccurrenceDateToVisitDetail(visitResult.data, occurrenceDate, visitId)
          : visitResult.data;
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

    const legacyDetail: VisitDispositionDetail = {
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

    return {
      ok: true,
      data:
        occurrenceDate != null
          ? applyOccurrenceDateToVisitDetail(legacyDetail, occurrenceDate, visitId)
          : legacyDetail,
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

    const existing = await fetchVisitDispositionDetail(visitId, tenantId, actorRoleKey);
    if (!existing.ok) return existing;
    if (!existing.data) return { ok: false, error: 'Einsatz nicht gefunden.' };

    const validation = validateVisitStatusTransition(
      existing.data.assignmentStatus,
      toStatus,
    );
    if (!validation.valid) {
      return { ok: false, error: validation.error ?? 'Statuswechsel nicht erlaubt.' };
    }

    const resolvedId = await visitSupabaseRepository.resolveVisitId(tenantId, visitId);
    if (resolvedId) {
      const updated = await visitSupabaseRepository.updateAssignmentStatus(
        tenantId,
        resolvedId,
        toStatus,
      );
      if (!updated.ok) return updated;
      return fetchVisitDispositionDetail(visitId, tenantId, actorRoleKey);
    }

    const masterVisitId = resolveVisitMasterId(visitId);
    const updated = await assignmentSupabaseRepository.updateStatus(tenantId, masterVisitId, toStatus);
    if (!updated.ok) return updated;
    return fetchVisitDispositionDetail(visitId, tenantId, actorRoleKey);
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
): Promise<ServiceResult<void>> {
  const denied = enforcePermission<void>(actorRoleKey, 'assist.assignments.manage');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    if (!isResolvableVisitId(visitId)) return { ok: false, error: 'Einsatz nicht gefunden.' };

    const resolvedId = await visitSupabaseRepository.resolveVisitId(tenantId, visitId);
    if (resolvedId) {
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
    tasks: taskTitles,
    budgetAmountCents: budgetAmountCents ?? wizard.budgetAmountCents,
    internalNotes: wizard.internalNotes,
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
    riskFlagKeys: wizard.riskFlagKeys,
    recurrenceJson: buildVisitRecurrenceJson(wizard),
    catalogSnapshotJson: {
      ...wizard.catalogSnapshotJson,
      budgetAllocation: budgetAllocation ?? undefined,
    },
    budgetAllocation,
    budgetManualOverride: wizard.budgetManualOverride ?? null,
  };

  if (getServiceMode() === 'supabase') {
    const created = await visitSupabaseRepository.create(tenantId, input);
    if (!created.ok) return created;
    return { ok: true, data: { id: created.data.id, conflicts } };
  }

  await new Promise((r) => setTimeout(r, 320));
  return { ok: true, data: { id: `visit-demo-${Date.now()}`, conflicts } };
}

export { visitDispositionKpiLabels };
