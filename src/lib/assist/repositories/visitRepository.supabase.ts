import type { ServiceResult } from '@/types';
import type { WorkflowStatus } from '@/types/core/base';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';
import {
  assignmentStatusToRemote,
  remoteStatusToAssignment,
} from '@/lib/assist/assignmentStatusBridge';
import {
  dedupeStatusTransitionButtons,
  getVisitAllowedTransitions,
  isVisitAtRisk,
  isVisitIncomplete,
} from '@/lib/assist/visitWorkflow';
import type {
  VisitBillingStatus,
  VisitCreateInput,
  VisitDispositionDetail,
  VisitDispositionListItem,
  VisitDocumentationStatus,
  VisitExecutionStatus,
  VisitPlanningStatus,
  VisitPortalStatus,
  VisitProofStatus,
  VisitTaskItem,
  VisitTaskStatus,
} from '@/lib/assist/visitTypes';
import {
  VISIT_BILLING_STATUS_LABELS,
  VISIT_DOCUMENTATION_STATUS_LABELS,
  VISIT_EXECUTION_STATUS_LABELS,
  VISIT_PLANNING_STATUS_LABELS,
  VISIT_PORTAL_STATUS_LABELS,
  VISIT_PROOF_STATUS_LABELS,
} from '@/lib/assist/visitTypes';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import {
  buildCalendarEventFromVisitDetail,
  cancelCalendarEventBySourceAsync,
  syncCalendarEventAsync,
} from '@/lib/calendar/calendarSyncService';
import {
  markAssignmentExecuted,
  storno as stornoAssignmentReservation,
} from '@/lib/assist/clientBudgetTransactionService';
import {
  persistAssignmentBudgetAllocations,
  reserveAssignmentBudget,
} from '@/lib/assist/assignmentBudgetAllocationService';
import { resolveVisitLocation } from '@/lib/assist/resolveVisitLocation';
import { isSupabaseMissingTableError } from '@/lib/supabase/errors';
import { isUuid } from '@/lib/validation/uuid';

type VisitRow = {
  id: string;
  tenant_id: string;
  legacy_assignment_id: string | null;
  client_id: string;
  employee_id: string | null;
  service_key: string | null;
  service_name: string | null;
  title: string;
  description: string | null;
  assignment_date: string;
  planned_start_at: string;
  planned_end_at: string;
  duration_minutes: number | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  on_the_way_at: string | null;
  arrived_at: string | null;
  finished_at: string | null;
  address_snapshot: string | null;
  location_notes: string | null;
  internal_notes: string | null;
  employee_notes: string | null;
  planning_status: VisitPlanningStatus;
  execution_status: VisitExecutionStatus;
  documentation_status: VisitDocumentationStatus;
  proof_status: VisitProofStatus;
  billing_status: VisitBillingStatus;
  portal_status: VisitPortalStatus;
  canonical_status: string;
  portal_release_enabled: boolean;
  employee_portal_visible: boolean;
  budget_amount_cents: number | null;
  budget_currency: string;
  budget_warning: string | null;
  is_at_risk: boolean;
  is_incomplete: boolean;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  clients?: {
    first_name: string | null;
    last_name: string | null;
    street?: string | null;
    house_number?: string | null;
    postal_code?: string | null;
    city?: string | null;
  } | null;
  employees?: { first_name: string | null; last_name: string | null } | null;
};

export type VisitStatusHistoryEntry = {
  id: string;
  dimension: string;
  dimensionLabel: string;
  fromStatus: string | null;
  fromStatusLabel: string | null;
  toStatus: string;
  toStatusLabel: string;
  note: string | null;
  changedAt: string;
};

type VisitTaskRow = {
  id: string;
  visit_id: string;
  tenant_id: string;
  title: string;
  status: VisitTaskStatus;
  is_required: boolean;
  not_done_reason: string | null;
  sort_order: number;
};

const CLIENT_LOCATION_SELECT =
  'first_name, last_name, street, house_number, postal_code, city';

const LIST_SELECT = `
  id, tenant_id, legacy_assignment_id, client_id, employee_id,
  service_key, service_name, title, description,
  assignment_date, planned_start_at, planned_end_at, duration_minutes,
  address_snapshot, planning_status, execution_status, documentation_status,
  proof_status, billing_status, portal_status, canonical_status,
  is_at_risk, is_incomplete, budget_amount_cents, budget_warning,
  error_code, error_message, created_at, updated_at,
  clients(${CLIENT_LOCATION_SELECT}),
  employees(first_name, last_name)
`;

const DETAIL_SELECT = `${LIST_SELECT},
  actual_start_at, actual_end_at, on_the_way_at, arrived_at, finished_at,
  location_notes, internal_notes, employee_notes, portal_release_enabled, employee_portal_visible,
  budget_currency, assist_visit_tasks(*)`;

function getClient() {
  return getSupabaseClient();
}

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function personName(
  row?: { first_name: string | null; last_name: string | null } | null,
): string {
  if (!row) return 'Unbekannt';
  const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
  return name || 'Unbekannt';
}

function assignmentStatusToWorkflowFilter(status: AssignmentStatus): WorkflowStatus {
  const map: Partial<Record<AssignmentStatus, WorkflowStatus>> = {
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
  return map[status] ?? 'aktiv';
}

function durationMinutes(start: string, end: string, stored: number | null): number | null {
  if (stored != null && stored > 0) return stored;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (diff <= 0) return null;
  return Math.round(diff / 60000);
}

function mapTaskRow(row: VisitTaskRow): VisitTaskItem {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    isRequired: row.is_required,
    notDoneReason: row.not_done_reason,
  };
}

const VISIT_STATUS_DIMENSION_LABELS: Record<string, string> = {
  planning: 'Planung',
  execution: 'Durchführung',
  documentation: 'Dokumentation',
  proof: 'Nachweis',
  billing: 'Abrechnung',
  portal: 'Portal',
  canonical: 'Workflow',
};

function resolveVisitStatusLabel(dimension: string, status: string): string {
  switch (dimension) {
    case 'planning':
      return VISIT_PLANNING_STATUS_LABELS[status as VisitPlanningStatus] ?? status;
    case 'execution':
      return VISIT_EXECUTION_STATUS_LABELS[status as VisitExecutionStatus] ?? status;
    case 'documentation':
      return VISIT_DOCUMENTATION_STATUS_LABELS[status as VisitDocumentationStatus] ?? status;
    case 'proof':
      return VISIT_PROOF_STATUS_LABELS[status as VisitProofStatus] ?? status;
    case 'billing':
      return VISIT_BILLING_STATUS_LABELS[status as VisitBillingStatus] ?? status;
    case 'portal':
      return VISIT_PORTAL_STATUS_LABELS[status as VisitPortalStatus] ?? status;
    case 'canonical': {
      const assignmentStatus = remoteStatusToAssignment(status);
      return ASSIGNMENT_STATUS_LABELS[assignmentStatus] ?? status;
    }
    default:
      return status;
  }
}

function mapStatusHistoryRow(row: {
  id: string;
  dimension: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  changed_at: string;
}): VisitStatusHistoryEntry {
  return {
    id: row.id,
    dimension: row.dimension,
    dimensionLabel: VISIT_STATUS_DIMENSION_LABELS[row.dimension] ?? row.dimension,
    fromStatus: row.from_status,
    fromStatusLabel: row.from_status
      ? resolveVisitStatusLabel(row.dimension, row.from_status)
      : null,
    toStatus: row.to_status,
    toStatusLabel: resolveVisitStatusLabel(row.dimension, row.to_status),
    note: row.note,
    changedAt: row.changed_at,
  };
}

function visitLocationFromRow(row: VisitRow): string {
  return resolveVisitLocation({
    addressSnapshot: row.address_snapshot,
    locationNotes: row.location_notes,
    client: row.clients,
  });
}

function mapListItem(row: VisitRow): VisitDispositionListItem {
  const assignmentStatus = remoteStatusToAssignment(row.canonical_status);
  const atRisk = isVisitAtRisk({
    planningStatus: row.planning_status,
    executionStatus: row.execution_status,
    isAtRisk: row.is_at_risk,
    errorMessage: row.error_message,
  });
  const incomplete = isVisitIncomplete({
    documentationStatus: row.documentation_status,
    proofStatus: row.proof_status,
    executionStatus: row.execution_status,
    isIncomplete: row.is_incomplete,
  });

  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title?.trim() || row.service_name?.trim() || 'Einsatz',
    serviceName: row.service_name,
    scheduledStart: row.planned_start_at,
    scheduledEnd: row.planned_end_at,
    durationMinutes: durationMinutes(row.planned_start_at, row.planned_end_at, row.duration_minutes),
    status: assignmentStatusToWorkflowFilter(assignmentStatus),
    planningStatus: row.planning_status,
    proofStatus: row.proof_status,
    billingStatus: row.billing_status,
    location: visitLocationFromRow(row),
    clientName: personName(row.clients),
    employeeName: personName(row.employees),
    isAtRisk: atRisk,
    isIncomplete: incomplete,
    updatedAt: row.updated_at,
  };
}

function mapDetail(
  row: VisitRow & { assist_visit_tasks?: VisitTaskRow[] },
): VisitDispositionDetail {
  const assignmentStatus = remoteStatusToAssignment(row.canonical_status);
  const allowed = dedupeStatusTransitionButtons(getVisitAllowedTransitions(assignmentStatus));
  const atRisk = isVisitAtRisk({
    planningStatus: row.planning_status,
    executionStatus: row.execution_status,
    isAtRisk: row.is_at_risk,
    errorMessage: row.error_message,
  });
  const incomplete = isVisitIncomplete({
    documentationStatus: row.documentation_status,
    proofStatus: row.proof_status,
    executionStatus: row.execution_status,
    isIncomplete: row.is_incomplete,
  });

  return {
    ...mapListItem(row),
    clientId: row.client_id,
    employeeId: row.employee_id,
    serviceKey: row.service_key,
    description: row.description,
    notes: row.internal_notes,
    employeeNotes: row.employee_notes,
    executionStatus: row.execution_status,
    documentationStatus: row.documentation_status,
    portalStatus: row.portal_status,
    assignmentStatus,
    allowedStatusTransitions: allowed,
    tasks: (row.assist_visit_tasks ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(mapTaskRow),
    budget:
      row.budget_amount_cents != null
        ? {
            budgetAmountCents: row.budget_amount_cents,
            usedAmountCents: 0,
            remainingAmountCents: row.budget_amount_cents,
            currency: row.budget_currency ?? 'EUR',
            warning: row.budget_warning,
          }
        : null,
    portalReleaseEnabled: row.portal_release_enabled,
    employeePortalVisible: row.employee_portal_visible,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    onTheWayAt: row.on_the_way_at,
    arrivedAt: row.arrived_at,
    finishedAt: row.finished_at,
    actualStartAt: row.actual_start_at,
    actualEndAt: row.actual_end_at,
    createdAt: row.created_at,
  };
}

async function writeStatusHistory(
  tenantId: string,
  visitId: string,
  dimension: string,
  fromStatus: string | null,
  toStatus: string,
  actorProfileId?: string | null,
  note?: string,
): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;
  await fromUnknownTable(supabase, 'assist_visit_status_history').insert({
    tenant_id: tenantId,
    visit_id: visitId,
    dimension,
    from_status: fromStatus,
    to_status: toStatus,
    note: note ?? null,
    changed_by: actorProfileId ?? null,
  });
}

async function writeAuditLog(
  tenantId: string,
  visitId: string,
  action: string,
  details: string,
  actorProfileId?: string | null,
): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;
  await fromUnknownTable(supabase, 'assist_visit_audit_logs').insert({
    tenant_id: tenantId,
    visit_id: visitId,
    action,
    details,
    actor_profile_id: actorProfileId ?? null,
  });
}

export type VisitListOptions = {
  planningStatus?: VisitPlanningStatus | 'all';
  clientId?: string;
  employeeId?: string;
  serviceKey?: string;
  dateFrom?: string;
  dateTo?: string;
};

export const visitSupabaseRepository = {
  wpNumber: 116 as const,

  async list(
    tenantId: string,
    options?: VisitListOptions,
  ): Promise<ServiceResult<VisitDispositionListItem[]>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    let query = fromUnknownTable(supabase, 'assist_visits')
      .select(LIST_SELECT)
      .eq('tenant_id', tenantId)
      .order('planned_start_at', { ascending: true });

    if (options?.planningStatus && options.planningStatus !== 'all') {
      query = query.eq('planning_status', options.planningStatus);
    }
    if (options?.clientId) query = query.eq('client_id', options.clientId);
    if (options?.employeeId) query = query.eq('employee_id', options.employeeId);
    if (options?.serviceKey) query = query.eq('service_key', options.serviceKey);
    if (options?.dateFrom) query = query.gte('planned_start_at', options.dateFrom);
    if (options?.dateTo) query = query.lte('planned_start_at', options.dateTo);

    const { data, error } = await query;
    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    const rows = (data ?? []) as unknown as VisitRow[];
    return { ok: true, data: rows.map(mapListItem) };
  },

  async getById(
    tenantId: string,
    visitId: string,
  ): Promise<ServiceResult<VisitDispositionDetail | null>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    if (!isUuid(visitId)) return { ok: true, data: null };

    const { data, error } = await fromUnknownTable(supabase, 'assist_visits')
      .select(DETAIL_SELECT)
      .eq('tenant_id', tenantId)
      .eq('id', visitId)
      .maybeSingle();

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) return { ok: true, data: null };

    return {
      ok: true,
      data: mapDetail(data as unknown as VisitRow & { assist_visit_tasks?: VisitTaskRow[] }),
    };
  },

  async create(
    tenantId: string,
    input: VisitCreateInput,
    actorProfileId?: string | null,
  ): Promise<ServiceResult<{ id: string }>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const duration = durationMinutes(input.plannedStartAt, input.plannedEndAt, null);
    const taskTitles = input.tasks.map((t) => t.trim()).filter(Boolean);

    const insertRow = {
      tenant_id: tenantId,
      client_id: input.clientId,
      employee_id: input.employeeId,
      service_key: input.serviceKey,
      service_name: input.serviceName,
      title: input.title.trim(),
      description: input.description ?? null,
      assignment_date: input.assignmentDate,
      planned_start_at: input.plannedStartAt,
      planned_end_at: input.plannedEndAt,
      duration_minutes: duration,
      address_snapshot: input.addressSnapshot ?? null,
      internal_notes: input.internalNotes ?? null,
      planning_status: input.saveAsDraft ? 'draft' : 'scheduled',
      execution_status: 'pending',
      documentation_status: 'none',
      proof_status: 'none',
      billing_status: input.budgetAmountCents ? 'preview' : 'none',
      portal_status: input.portalReleaseEnabled ? 'scheduled' : 'hidden',
      canonical_status: assignmentStatusToRemote('geplant'),
      portal_release_enabled: input.portalReleaseEnabled ?? false,
      budget_amount_cents: input.budgetAmountCents ?? null,
      subject_key: input.subjectKey ?? null,
      assignment_type_key: input.assignmentTypeKey ?? null,
      service_category_key: input.serviceCategoryKey ?? null,
      task_package_id: input.taskPackageId ?? null,
      billing_budget_source_key: input.billingBudgetSourceKey ?? null,
      proof_template_key: input.proofTemplateKey ?? null,
      risk_flag_keys: input.riskFlagKeys ?? [],
      recurrence_json: input.recurrenceJson ?? {},
      catalog_snapshot_json: input.catalogSnapshotJson ?? {},
      created_by: actorProfileId ?? null,
    };

    const { data, error } = await fromUnknownTable(supabase, 'assist_visits')
      .insert(insertRow)
      .select('id')
      .single();

    if (error || !data) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    const visitId = (data as { id: string }).id;

    if (taskTitles.length > 0) {
      const taskRows = taskTitles.map((title, index) => ({
        tenant_id: tenantId,
        visit_id: visitId,
        title,
        status: 'open',
        is_required: true,
        sort_order: index,
      }));
      const { error: taskError } = await fromUnknownTable(supabase, 'assist_visit_tasks').insert(
        taskRows,
      );
      if (taskError) return { ok: false, error: toGermanSupabaseError(taskError) };
    }

    if (input.budgetAmountCents) {
      await fromUnknownTable(supabase, 'assist_visit_budget_snapshots').insert({
        tenant_id: tenantId,
        visit_id: visitId,
        budget_amount_cents: input.budgetAmountCents,
        remaining_amount_cents: input.budgetAmountCents,
        source_type: 'preview',
      });
    }

    await writeStatusHistory(tenantId, visitId, 'planning', null, 'scheduled', actorProfileId);
    await writeAuditLog(
      tenantId,
      visitId,
      'create',
      `Einsatz „${input.title.trim()}“ angelegt`,
      actorProfileId,
    );

    syncCalendarEventAsync(
      buildCalendarEventFromVisitDetail({
        tenantId,
        id: visitId,
        title: input.title.trim(),
        plannedStartAt: input.plannedStartAt,
        plannedEndAt: input.plannedEndAt,
        clientId: input.clientId,
        employeeId: input.employeeId ?? null,
        canonicalStatus: assignmentStatusToRemote('geplant'),
        portalReleaseEnabled: input.portalReleaseEnabled ?? false,
        employeePortalVisible: false,
      }),
    );

    if (
      !input.saveAsDraft
      && input.budgetAllocation
      && input.budgetAllocation.allocationProposal.some(
        (l) =>
          l.amountCents > 0
          && l.budgetAccountId
          && l.catalogKey !== 'kulanz'
          && l.catalogKey !== 'ungeklaert',
      )
    ) {
      await persistAssignmentBudgetAllocations({
        tenantId,
        assignmentId: visitId,
        clientId: input.clientId,
        allocation: input.budgetAllocation,
        manualOverride: input.budgetManualOverride ?? null,
        actorProfileId,
      });
      await reserveAssignmentBudget({
        tenantId,
        clientId: input.clientId,
        visitId,
        allocation: input.budgetAllocation,
        assignmentDate: input.assignmentDate,
        createdBy: actorProfileId,
      });
    } else if (!input.saveAsDraft && input.budgetAmountCents && input.budgetAmountCents > 0) {
      const { reserveForAssignment } = await import('@/lib/assist/clientBudgetTransactionService');
      await reserveForAssignment({
        tenantId,
        clientId: input.clientId,
        visitId,
        amountCents: input.budgetAmountCents,
        catalogKey: input.billingBudgetSourceKey,
        assignmentDate: input.assignmentDate,
        createdBy: actorProfileId,
      });
    }

    return { ok: true, data: { id: visitId } };
  },

  async updateAssignmentStatus(
    tenantId: string,
    visitId: string,
    toStatus: AssignmentStatus,
    actorProfileId?: string | null,
    note?: string,
  ): Promise<ServiceResult<VisitDispositionDetail>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const existing = await this.getById(tenantId, visitId);
    if (!existing.ok) return existing;
    if (!existing.data) return { ok: false, error: 'Einsatz nicht gefunden.' };

    const fromStatus = existing.data.assignmentStatus;
    const remoteStatus = assignmentStatusToRemote(toStatus);
    const now = new Date().toISOString();

    const patch: Record<string, unknown> = {
      canonical_status: remoteStatus,
      updated_by: actorProfileId ?? null,
    };

    if (toStatus === 'unterwegs') patch.on_the_way_at = now;
    if (toStatus === 'angekommen') patch.arrived_at = now;
    if (toStatus === 'gestartet') patch.actual_start_at = now;
    if (toStatus === 'beendet' || toStatus === 'abgeschlossen') {
      patch.actual_end_at = now;
      patch.finished_at = now;
    }

    const { error } = await fromUnknownTable(supabase, 'assist_visits')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', visitId);

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    await writeStatusHistory(
      tenantId,
      visitId,
      'canonical',
      assignmentStatusToRemote(fromStatus),
      remoteStatus,
      actorProfileId,
      note,
    );
    await writeAuditLog(
      tenantId,
      visitId,
      'status_change',
      `${ASSIGNMENT_STATUS_LABELS[fromStatus]} → ${ASSIGNMENT_STATUS_LABELS[toStatus]}`,
      actorProfileId,
    );

    // TODO: Sync legacy assignments row if legacy_assignment_id present

    const refreshed = await this.getById(tenantId, visitId);
    if (!refreshed.ok) return refreshed;
    if (!refreshed.data) return { ok: false, error: 'Einsatz nicht gefunden.' };

    if (toStatus === 'storniert') {
      cancelCalendarEventBySourceAsync(tenantId, 'assist_visit', visitId);
      await stornoAssignmentReservation(tenantId, visitId, actorProfileId);
    } else {
      if (toStatus === 'beendet' || toStatus === 'abgeschlossen') {
        await markAssignmentExecuted(tenantId, visitId, actorProfileId);
      }
      syncCalendarEventAsync(
        buildCalendarEventFromVisitDetail({
          tenantId,
          id: refreshed.data.id,
          title: refreshed.data.title,
          plannedStartAt: refreshed.data.scheduledStart,
          plannedEndAt: refreshed.data.scheduledEnd,
          clientId: refreshed.data.clientId,
          employeeId: refreshed.data.employeeId,
          clientName: refreshed.data.clientName,
          employeeName: refreshed.data.employeeName,
          serviceName: refreshed.data.serviceName,
          canonicalStatus: refreshed.data.assignmentStatus,
          portalReleaseEnabled: refreshed.data.portalReleaseEnabled,
          employeePortalVisible: refreshed.data.employeePortalVisible,
        }),
      );
    }

    return { ok: true, data: refreshed.data };
  },

  async updateTask(
    tenantId: string,
    visitId: string,
    taskId: string,
    status: VisitTaskStatus,
    notDoneReason?: string | null,
    actorProfileId?: string | null,
  ): Promise<ServiceResult<VisitDispositionDetail>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    if (status === 'not_done' && !notDoneReason?.trim()) {
      return { ok: false, error: 'Abweichung erfordert eine Begründung.' };
    }
    if (status === 'not_requested' && !notDoneReason?.trim()) {
      return { ok: false, error: '„Nicht gewünscht“ erfordert eine kurze Begründung.' };
    }

    const now = new Date().toISOString();
    const { error } = await fromUnknownTable(supabase, 'assist_visit_tasks')
      .update({
        status,
        not_done_reason:
          status === 'not_done' || status === 'not_requested'
            ? (notDoneReason?.trim() ?? null)
            : null,
        completed_at: status === 'done' ? now : null,
        updated_at: now,
      })
      .eq('tenant_id', tenantId)
      .eq('visit_id', visitId)
      .eq('id', taskId);

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    await writeAuditLog(
      tenantId,
      visitId,
      'task_update',
      `Aufgabe ${taskId} → ${status}`,
      actorProfileId,
    );

    const refreshed = await this.getById(tenantId, visitId);
    if (!refreshed.ok) return refreshed;
    if (!refreshed.data) return { ok: false, error: 'Einsatz nicht gefunden.' };
    return { ok: true, data: refreshed.data };
  },

  async updateDocumentation(
    tenantId: string,
    visitId: string,
    employeeNotes: string,
    actorProfileId?: string | null,
  ): Promise<ServiceResult<VisitDispositionDetail>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    if (!employeeNotes.trim()) {
      return { ok: false, error: 'Dokumentation darf nicht leer sein.' };
    }

    const docStatus = 'complete';
    const { error } = await fromUnknownTable(supabase, 'assist_visits')
      .update({
        employee_notes: employeeNotes.trim(),
        documentation_status: docStatus,
        updated_by: actorProfileId ?? null,
      })
      .eq('tenant_id', tenantId)
      .eq('id', visitId);

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    await writeStatusHistory(
      tenantId,
      visitId,
      'documentation',
      null,
      docStatus,
      actorProfileId,
      'Dokumentation gespeichert',
    );
    await writeAuditLog(
      tenantId,
      visitId,
      'documentation',
      'Durchführungsdokumentation gespeichert',
      actorProfileId,
    );

    const refreshed = await this.getById(tenantId, visitId);
    if (!refreshed.ok) return refreshed;
    if (!refreshed.data) return { ok: false, error: 'Einsatz nicht gefunden.' };
    return { ok: true, data: refreshed.data };
  },

  async delete(tenantId: string, visitId: string): Promise<ServiceResult<void>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const { data: row, error: lookupError } = await fromUnknownTable(supabase, 'assist_visits')
      .select('id, legacy_assignment_id')
      .eq('tenant_id', tenantId)
      .eq('id', visitId)
      .maybeSingle();

    if (lookupError) return { ok: false, error: toGermanSupabaseError(lookupError) };
    if (!row) return { ok: false, error: 'Einsatz nicht gefunden.' };

    const legacyAssignmentId = (row as { legacy_assignment_id: string | null }).legacy_assignment_id;

    cancelCalendarEventBySourceAsync(tenantId, 'assist_visit', visitId);

    const { error } = await fromUnknownTable(supabase, 'assist_visits')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', visitId);

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    if (legacyAssignmentId) {
      cancelCalendarEventBySourceAsync(tenantId, 'assist_visit', legacyAssignmentId);
      await fromUnknownTable(supabase, 'assignments')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('id', legacyAssignmentId);
    }

    return { ok: true, data: undefined };
  },

  /** Resolve visit id from legacy assignment id (for execute flow bridge). */
  async resolveVisitId(
    tenantId: string,
    assignmentOrVisitId: string,
  ): Promise<string | null> {
    const supabase = getClient();
    if (!supabase || !isUuid(assignmentOrVisitId)) return null;

    const direct = await this.getById(tenantId, assignmentOrVisitId);
    if (direct.ok && direct.data) return assignmentOrVisitId;

    const { data } = await fromUnknownTable(supabase, 'assist_visits')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('legacy_assignment_id', assignmentOrVisitId)
      .maybeSingle();

    return (data as { id: string } | null)?.id ?? null;
  },

  async fetchStatusHistory(
    tenantId: string,
    visitId: string,
  ): Promise<ServiceResult<VisitStatusHistoryEntry[]>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    if (!isUuid(visitId)) return { ok: true, data: [] };

    const { data, error } = await fromUnknownTable(supabase, 'assist_visit_status_history')
      .select('id, dimension, from_status, to_status, note, changed_at')
      .eq('tenant_id', tenantId)
      .eq('visit_id', visitId)
      .order('changed_at', { ascending: false });

    if (error) {
      if (isSupabaseMissingTableError(error)) {
        return { ok: true, data: [] };
      }
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    const rows = (data ?? []) as Array<{
      id: string;
      dimension: string;
      from_status: string | null;
      to_status: string;
      note: string | null;
      changed_at: string;
    }>;

    return { ok: true, data: rows.map(mapStatusHistoryRow) };
  },
};

export function visitDispositionKpiLabels(item: VisitDispositionListItem): {
  planning: string;
  proof: string;
  budget: string;
} {
  return {
    planning: VISIT_PLANNING_STATUS_LABELS[item.planningStatus],
    proof: VISIT_PROOF_STATUS_LABELS[item.proofStatus],
    budget: VISIT_BILLING_STATUS_LABELS[item.billingStatus],
  };
}
