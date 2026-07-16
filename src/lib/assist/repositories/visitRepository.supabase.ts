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
  deriveAssignmentStatusFromVisitDimensions,
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
  syncLegacyAssignmentStatusFromVisit,
  syncLegacyAssignmentTasksFromVisit,
  upsertLegacyAssignmentFromVisit,
} from '@/lib/assist/assistVisitLegacyAssignmentSync';
import {
  markAssignmentExecuted,
  storno as stornoAssignmentReservation,
} from '@/lib/assist/clientBudgetTransactionService';
import {
  persistAssignmentBudgetAllocations,
  reserveAssignmentBudget,
} from '@/lib/assist/assignmentBudgetAllocationService';
import {
  expandVisitDispositionListItems,
  parseVisitRecurrenceJson,
  shiftVisitScheduleToDate,
} from '@/lib/assist/visitRecurrenceExpansion';
import {
  buildRecurrenceJsonWithMaterializedOccurrence,
  getMaterializedOccurrenceId,
} from '@/lib/assist/visitRecurrenceExecution';
import { resolveVisitLocation } from '@/lib/assist/resolveVisitLocation';
import {
  isSupabaseMissingTableError,
  isSupabaseSchemaMismatchError,
} from '@/lib/supabase/errors';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';
import { isUuid } from '@/lib/validation/uuid';
import {
  overlayVisitDispositionListFromAssignments,
} from '@/lib/assist/overlayVisitDispositionFromAssignment';

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
  recurrence_json?: unknown;
  subject_key?: string | null;
  assignment_type_key?: string | null;
  service_category_key?: string | null;
  task_package_id?: string | null;
  billing_budget_source_key?: string | null;
  proof_template_key?: string | null;
  documentation_template_key?: string | null;
  risk_flag_keys?: unknown;
  catalog_snapshot_json?: unknown;
  client_visible_notes?: string | null;
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

/** clients.postal_code — never clients.zip (column does not exist on live DB). */
export const VISIT_CLIENT_NESTED_SELECT =
  'first_name, last_name, street, house_number, postal_code, city';

const CLIENT_LOCATION_SELECT = VISIT_CLIENT_NESTED_SELECT;

const VISIT_LIST_CORE_SELECT = `
  id, tenant_id, legacy_assignment_id, client_id, employee_id,
  service_key, service_name, title, description,
  assignment_date, planned_start_at, planned_end_at, duration_minutes,
  address_snapshot, planning_status, execution_status, documentation_status,
  proof_status, billing_status, portal_status, canonical_status,
  is_at_risk, is_incomplete, budget_amount_cents, budget_warning,
  error_code, error_message, created_at, updated_at, recurrence_json`;

const LIST_SELECT = `${VISIT_LIST_CORE_SELECT},
  clients(${CLIENT_LOCATION_SELECT}),
  employees(first_name, last_name)`;

const DETAIL_EXTRA_SELECT = `
  actual_start_at, actual_end_at, on_the_way_at, arrived_at, finished_at,
  location_notes, internal_notes, employee_notes, portal_release_enabled, employee_portal_visible,
  budget_currency, subject_key, assignment_type_key, service_category_key, task_package_id,
  billing_budget_source_key, proof_template_key, risk_flag_keys, catalog_snapshot_json,
  documentation_template_key, client_visible_notes`;

const DETAIL_SELECT = `${VISIT_LIST_CORE_SELECT},
  ${DETAIL_EXTRA_SELECT},
  clients(${CLIENT_LOCATION_SELECT}),
  employees(first_name, last_name),
  assist_visit_tasks(*)`;

const DETAIL_FLAT_SELECT = `${VISIT_LIST_CORE_SELECT},
  ${DETAIL_EXTRA_SELECT}`;

function shouldFallbackVisitEmbeddedSelect(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (isSupabaseSchemaMismatchError(error)) return true;
  const msg = error.message ?? '';
  return msg.includes('Could not find a relationship') || msg.includes('Could not embed');
}

async function hydrateVisitRowRelations(
  tenantId: string,
  row: VisitRow,
  options?: { includeTasks?: boolean },
): Promise<VisitRow & { assist_visit_tasks?: VisitTaskRow[] }> {
  const supabase = getClient();
  const enriched: VisitRow & { assist_visit_tasks?: VisitTaskRow[] } = { ...row };

  if (!supabase) return enriched;

  if (row.client_id) {
    const { data: clientRow } = await fromUnknownTable(supabase, 'clients')
      .select(CLIENT_LOCATION_SELECT)
      .eq('tenant_id', tenantId)
      .eq('id', row.client_id)
      .maybeSingle();
    if (clientRow) {
      enriched.clients = clientRow as VisitRow['clients'];
    }
  }

  if (row.employee_id) {
    const { data: employeeRow } = await fromUnknownTable(supabase, 'employees')
      .select('first_name, last_name')
      .eq('tenant_id', tenantId)
      .eq('id', row.employee_id)
      .maybeSingle();
    if (employeeRow) {
      enriched.employees = employeeRow as VisitRow['employees'];
    }
  }

  if (options?.includeTasks) {
    const { data: taskRows } = await fromUnknownTable(supabase, 'assist_visit_tasks')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('visit_id', row.id)
      .order('sort_order', { ascending: true });
    enriched.assist_visit_tasks = (taskRows ?? []) as VisitTaskRow[];
  }

  return enriched;
}

async function hydrateVisitRowRelationsBatch(
  tenantId: string,
  rows: VisitRow[],
): Promise<VisitRow[]> {
  if (rows.length === 0) return rows;

  const supabase = getClient();
  if (!supabase) return rows;

  const clientIds = [...new Set(rows.map((row) => row.client_id).filter(Boolean))] as string[];
  const employeeIds = [...new Set(rows.map((row) => row.employee_id).filter(Boolean))] as string[];

  const [clientResult, employeeResult] = await Promise.all([
    clientIds.length
      ? fromUnknownTable(supabase, 'clients')
          .select(`id, ${CLIENT_LOCATION_SELECT}`)
          .eq('tenant_id', tenantId)
          .in('id', clientIds)
      : Promise.resolve({ data: [], error: null }),
    employeeIds.length
      ? fromUnknownTable(supabase, 'employees')
          .select('id, first_name, last_name')
          .eq('tenant_id', tenantId)
          .in('id', employeeIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const clientsById = new Map<string, VisitRow['clients']>();
  for (const row of (clientResult.data ?? []) as Array<{ id: string } & VisitRow['clients']>) {
    clientsById.set(row.id, row);
  }

  const employeesById = new Map<string, VisitRow['employees']>();
  for (const row of (employeeResult.data ?? []) as Array<{ id: string } & VisitRow['employees']>) {
    employeesById.set(row.id, row);
  }

  return rows.map((row) => ({
    ...row,
    clients: row.client_id ? clientsById.get(row.client_id) ?? row.clients : row.clients,
    employees: row.employee_id ? employeesById.get(row.employee_id) ?? row.employees : row.employees,
  }));
}

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
  const canonicalStatus = remoteStatusToAssignment(row.canonical_status);
  const assignmentStatus = deriveAssignmentStatusFromVisitDimensions({
    canonicalStatus,
    executionStatus: row.execution_status,
    documentationStatus: row.documentation_status,
    proofStatus: row.proof_status,
  });
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
    clientId: row.client_id,
    title: row.title?.trim() || row.service_name?.trim() || 'Einsatz',
    serviceName: row.service_name,
    scheduledStart: row.planned_start_at,
    scheduledEnd: row.planned_end_at,
    durationMinutes: durationMinutes(row.planned_start_at, row.planned_end_at, row.duration_minutes),
    status: assignmentStatusToWorkflowFilter(assignmentStatus),
    assignmentStatus,
    planningStatus: row.planning_status,
    executionStatus: row.execution_status,
    documentationStatus: row.documentation_status,
    proofStatus: row.proof_status,
    billingStatus: row.billing_status,
    location: visitLocationFromRow(row),
    clientName: personName(row.clients),
    employeeId: row.employee_id,
    employeeName: personName(row.employees),
    isAtRisk: atRisk,
    isIncomplete: incomplete,
    updatedAt: row.updated_at,
  };
}

function mapDetail(
  row: VisitRow & { assist_visit_tasks?: VisitTaskRow[] },
): VisitDispositionDetail {
  const canonicalStatus = remoteStatusToAssignment(row.canonical_status);
  const assignmentStatus = deriveAssignmentStatusFromVisitDimensions({
    canonicalStatus,
    executionStatus: row.execution_status,
    documentationStatus: row.documentation_status,
    proofStatus: row.proof_status,
  });
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
    assignmentDate: row.assignment_date,
    description: row.description,
    notes: row.internal_notes,
    employeeNotes: row.employee_notes,
    clientVisibleNotes: row.client_visible_notes ?? null,
    addressSnapshot: row.address_snapshot,
    locationNotes: row.location_notes,
    subjectKey: row.subject_key ?? null,
    assignmentTypeKey: row.assignment_type_key ?? null,
    serviceCategoryKey: row.service_category_key ?? null,
    taskPackageId: row.task_package_id ?? null,
    billingBudgetSourceKey: row.billing_budget_source_key ?? null,
    proofTemplateKey: row.proof_template_key ?? null,
    documentationTemplateKey: row.documentation_template_key ?? null,
    riskFlagKeys: Array.isArray(row.risk_flag_keys)
      ? row.risk_flag_keys.filter((key): key is string => typeof key === 'string')
      : [],
    catalogSnapshotJson:
      row.catalog_snapshot_json && typeof row.catalog_snapshot_json === 'object'
        ? (row.catalog_snapshot_json as Record<string, unknown>)
        : {},
    recurrenceJson: parseVisitRecurrenceJson(row.recurrence_json),
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
  /** Filter for portal visibility (client or employee portal). */
  portalAudience?: 'client' | 'employee';
};

export const visitSupabaseRepository = {
  wpNumber: 116 as const,

  async list(
    tenantId: string,
    options?: VisitListOptions,
  ): Promise<ServiceResult<VisitDispositionListItem[]>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const baseQuery = () => {
      let query = fromUnknownTable(supabase, 'assist_visits')
        .select(LIST_SELECT)
        .eq('tenant_id', tenantId);

      if (options?.planningStatus && options.planningStatus !== 'all') {
        query = query.eq('planning_status', options.planningStatus);
      } else if (options?.portalAudience) {
        query = query.neq('planning_status', 'draft');
      }
      if (options?.clientId) query = query.eq('client_id', options.clientId);
      if (options?.employeeId) query = query.eq('employee_id', options.employeeId);
      if (options?.serviceKey) query = query.eq('service_key', options.serviceKey);
      // Client portal lists all non-draft own visits; portal_release_enabled gates live-tracking/detail only.
      if (options?.portalAudience === 'employee') {
        query = query.eq('employee_portal_visible', true);
      }
      return query;
    };

    const expandOptions = {
      dateFrom: options?.dateFrom,
      dateTo: options?.dateTo,
    };

    let rows: VisitRow[] = [];

    if (options?.dateFrom || options?.dateTo) {
      const dateToKey = options.dateTo?.slice(0, 10) ?? '9999-12-31';

      let inRangeQuery = baseQuery().order('planned_start_at', { ascending: true });
      if (options.dateFrom) inRangeQuery = inRangeQuery.gte('planned_start_at', options.dateFrom);
      if (options.dateTo) inRangeQuery = inRangeQuery.lte('planned_start_at', options.dateTo);

      let recurringQuery = baseQuery()
        .neq('recurrence_json->>pattern', 'none')
        .lte('assignment_date', dateToKey)
        .order('planned_start_at', { ascending: true });

      const [inRangeResult, recurringResult] = await Promise.all([inRangeQuery, recurringQuery]);

      if (inRangeResult.error) {
        return { ok: false, error: toGermanSupabaseError(inRangeResult.error) };
      }
      if (recurringResult.error) {
        return { ok: false, error: toGermanSupabaseError(recurringResult.error) };
      }

      const byId = new Map<string, VisitRow>();
      for (const row of (inRangeResult.data ?? []) as unknown as VisitRow[]) {
        byId.set(row.id, row);
      }
      for (const row of (recurringResult.data ?? []) as unknown as VisitRow[]) {
        byId.set(row.id, row);
      }
      rows = [...byId.values()];
    } else {
      const { data, error } = await baseQuery().order('planned_start_at', { ascending: true });
      if (error && shouldFallbackVisitEmbeddedSelect(error)) {
        let flatQuery = fromUnknownTable(supabase, 'assist_visits')
          .select(VISIT_LIST_CORE_SELECT)
          .eq('tenant_id', tenantId);
        if (options?.planningStatus && options.planningStatus !== 'all') {
          flatQuery = flatQuery.eq('planning_status', options.planningStatus);
        } else if (options?.portalAudience) {
          flatQuery = flatQuery.neq('planning_status', 'draft');
        }
        if (options?.clientId) flatQuery = flatQuery.eq('client_id', options.clientId);
        if (options?.employeeId) flatQuery = flatQuery.eq('employee_id', options.employeeId);
        if (options?.serviceKey) flatQuery = flatQuery.eq('service_key', options.serviceKey);
        if (options?.portalAudience === 'employee') {
          flatQuery = flatQuery.eq('employee_portal_visible', true);
        }
        const flatResult = await flatQuery.order('planned_start_at', { ascending: true });
        if (flatResult.error) {
          return { ok: false, error: toGermanSupabaseError(flatResult.error) };
        }
        const flatRows = (flatResult.data ?? []) as unknown as VisitRow[];
        rows = await hydrateVisitRowRelationsBatch(tenantId, flatRows);
      } else if (error) {
        return { ok: false, error: toGermanSupabaseError(error) };
      } else {
        rows = (data ?? []) as unknown as VisitRow[];
      }
    }

    const expanded = expandVisitDispositionListItems(
      rows.map((row) => ({ row, item: mapListItem(row) })),
      expandOptions,
    );
    const synced = await overlayVisitDispositionListFromAssignments(tenantId, expanded);
    return { ok: true, data: synced };
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

    if (error && shouldFallbackVisitEmbeddedSelect(error)) {
      const { data: flatRow, error: flatError } = await fromUnknownTable(supabase, 'assist_visits')
        .select(DETAIL_FLAT_SELECT)
        .eq('tenant_id', tenantId)
        .eq('id', visitId)
        .maybeSingle();

      if (flatError) return { ok: false, error: toGermanSupabaseError(flatError) };
      if (!flatRow) return { ok: true, data: null };

      const hydrated = await hydrateVisitRowRelations(
        tenantId,
        flatRow as unknown as VisitRow,
        { includeTasks: true },
      );
      return { ok: true, data: mapDetail(hydrated) };
    }

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
      location_notes: input.locationNotes ?? null,
      internal_notes: input.internalNotes ?? null,
      employee_notes: input.employeeNotes ?? null,
      client_visible_notes: input.clientVisibleNotes ?? null,
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
      documentation_template_key: input.documentationTemplateKey ?? null,
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

    const legacySync = await upsertLegacyAssignmentFromVisit(supabase, {
      visitId,
      tenantId,
      clientId: input.clientId,
      employeeId: input.employeeId,
      assignmentDate: input.assignmentDate,
      plannedStartAt: input.plannedStartAt,
      plannedEndAt: input.plannedEndAt,
      title: input.title,
      description: input.description ?? null,
      addressSnapshot: input.addressSnapshot ?? null,
      internalNotes: input.internalNotes ?? null,
      clientVisibleNotes: input.clientVisibleNotes ?? null,
      canonicalStatus: insertRow.canonical_status,
      saveAsDraft: input.saveAsDraft ?? false,
      createdBy: actorProfileId ?? null,
    });
    if (!legacySync.ok) return legacySync;

    if (taskTitles.length > 0 && !input.saveAsDraft) {
      const taskMirror = await syncLegacyAssignmentTasksFromVisit(
        supabase,
        tenantId,
        visitId,
        taskTitles,
      );
      if (!taskMirror.ok) return taskMirror;
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

    if (toStatus === 'unterwegs' && !existing.data.onTheWayAt) patch.on_the_way_at = now;
    if (toStatus === 'angekommen' && !existing.data.arrivedAt) patch.arrived_at = now;
    if (toStatus === 'gestartet' && !existing.data.actualStartAt) patch.actual_start_at = now;
    if (toStatus === 'beendet' && !existing.data.actualEndAt) {
      patch.actual_end_at = now;
      patch.execution_status = 'completed';
    }
    if (toStatus === 'abgeschlossen') {
      patch.execution_status = 'completed';
      patch.documentation_status = 'complete';
    }
    if (toStatus === 'unterwegs') patch.execution_status = 'on_way';
    if (toStatus === 'angekommen') patch.execution_status = 'arrived';
    if (toStatus === 'gestartet') patch.execution_status = 'in_progress';
    if (toStatus === 'pausiert') patch.execution_status = 'paused';

    const { error } = await fromUnknownTable(supabase, 'assist_visits')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', visitId);

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    const legacyStatusSync = await syncLegacyAssignmentStatusFromVisit(
      supabase,
      tenantId,
      visitId,
      remoteStatus,
      {
        on_the_way_at: patch.on_the_way_at,
        arrived_at: patch.arrived_at,
        actual_start_at: patch.actual_start_at,
        actual_end_at: patch.actual_end_at,
        finished_at: patch.finished_at,
        updated_by: actorProfileId ?? null,
      },
    );
    if (!legacyStatusSync.ok) return legacyStatusSync;

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

    if (status === 'not_requested' && !notDoneReason?.trim()) {
      return { ok: false, error: '„Nicht gewünscht“ erfordert eine kurze Begründung.' };
    }
    if (
      (status === 'partial' ||
        status === 'not_possible' ||
        status === 'cancelled' ||
        status === 'deferred') &&
      !notDoneReason?.trim()
    ) {
      return { ok: false, error: 'Abweichung erfordert eine Begründung.' };
    }

    const { data: existingTask, error: fetchError } = await fromUnknownTable(
      supabase,
      'assist_visit_tasks',
    )
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('visit_id', visitId)
      .eq('id', taskId)
      .maybeSingle();

    if (fetchError) return { ok: false, error: toGermanSupabaseError(fetchError) };
    if (!existingTask) return { ok: false, error: 'Aufgabe nicht gefunden.' };

    const now = new Date().toISOString();
    const reasonStatuses: VisitTaskStatus[] = [
      'not_requested',
      'partial',
      'not_possible',
      'cancelled',
      'deferred',
    ];
    const { error } = await fromUnknownTable(supabase, 'assist_visit_tasks')
      .update({
        status,
        not_done_reason: reasonStatuses.includes(status)
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

  async update(
    tenantId: string,
    visitId: string,
    input: VisitCreateInput,
    actorProfileId?: string | null,
  ): Promise<ServiceResult<VisitDispositionDetail>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const existing = await this.getById(tenantId, visitId);
    if (!existing.ok) return existing;
    if (!existing.data) return { ok: false, error: 'Einsatz nicht gefunden.' };

    const duration = durationMinutes(input.plannedStartAt, input.plannedEndAt, null);
    const taskTitles = input.tasks.map((task) => task.trim()).filter(Boolean);

    const patch = {
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
      location_notes: input.locationNotes ?? null,
      internal_notes: input.internalNotes ?? null,
      employee_notes: input.employeeNotes ?? null,
      client_visible_notes: input.clientVisibleNotes ?? null,
      portal_release_enabled: input.portalReleaseEnabled ?? false,
      budget_amount_cents: input.budgetAmountCents ?? null,
      subject_key: input.subjectKey ?? null,
      assignment_type_key: input.assignmentTypeKey ?? null,
      service_category_key: input.serviceCategoryKey ?? null,
      task_package_id: input.taskPackageId ?? null,
      billing_budget_source_key: input.billingBudgetSourceKey ?? null,
      proof_template_key: input.proofTemplateKey ?? null,
      documentation_template_key: input.documentationTemplateKey ?? null,
      risk_flag_keys: input.riskFlagKeys ?? [],
      recurrence_json: input.recurrenceJson ?? {},
      catalog_snapshot_json: input.catalogSnapshotJson ?? {},
      updated_by: actorProfileId ?? null,
    };

    const { error } = await fromUnknownTable(supabase, 'assist_visits')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', visitId);

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    const legacySync = await upsertLegacyAssignmentFromVisit(supabase, {
      visitId,
      tenantId,
      clientId: input.clientId,
      employeeId: input.employeeId,
      assignmentDate: input.assignmentDate,
      plannedStartAt: input.plannedStartAt,
      plannedEndAt: input.plannedEndAt,
      title: input.title,
      description: input.description ?? null,
      addressSnapshot: input.addressSnapshot ?? null,
      internalNotes: input.internalNotes ?? null,
      clientVisibleNotes: input.clientVisibleNotes ?? null,
      canonicalStatus: assignmentStatusToRemote(existing.data.assignmentStatus),
      saveAsDraft: input.saveAsDraft ?? false,
      createdBy: actorProfileId ?? null,
    });
    if (!legacySync.ok) return legacySync;

    if (taskTitles.length > 0) {
      const taskMirror = await syncLegacyAssignmentTasksFromVisit(
        supabase,
        tenantId,
        visitId,
        taskTitles,
      );
      if (!taskMirror.ok) return taskMirror;
    }

    syncCalendarEventAsync(
      buildCalendarEventFromVisitDetail({
        tenantId,
        id: visitId,
        title: input.title.trim(),
        plannedStartAt: input.plannedStartAt,
        plannedEndAt: input.plannedEndAt,
        clientId: input.clientId,
        employeeId: input.employeeId,
        clientName: existing.data.clientName,
        employeeName: existing.data.employeeName,
        serviceName: input.serviceName,
        canonicalStatus: existing.data.assignmentStatus,
        portalReleaseEnabled: input.portalReleaseEnabled ?? false,
        employeePortalVisible: existing.data.employeePortalVisible,
      }),
    );

    await writeAuditLog(
      tenantId,
      visitId,
      'update',
      `Einsatz „${input.title.trim()}“ aktualisiert`,
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
    const masterId = resolveVisitMasterId(assignmentOrVisitId);
    if (!supabase || !isUuid(masterId)) return null;

    const direct = await this.getById(tenantId, masterId);
    if (direct.ok && direct.data) return masterId;

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

  /**
   * Split one recurring occurrence into a standalone visit before execution.
   * Idempotent — returns existing materialized visit when already created.
   */
  async materializeOccurrence(
    tenantId: string,
    masterVisitId: string,
    occurrenceDate: string,
    actorProfileId?: string | null,
  ): Promise<ServiceResult<{ id: string; materialized: boolean }>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const master = await this.getById(tenantId, masterVisitId);
    if (!master.ok) return master;
    if (!master.data) return { ok: false, error: 'Einsatz nicht gefunden.' };

    const recurrence = parseVisitRecurrenceJson(master.data.recurrenceJson ?? { pattern: 'none' });
    if (recurrence.pattern === 'none') {
      return { ok: true, data: { id: masterVisitId, materialized: false } };
    }

    const existingMaterializedId = getMaterializedOccurrenceId(recurrence, occurrenceDate);
    if (existingMaterializedId) {
      const existing = await this.getById(tenantId, existingMaterializedId);
      if (!existing.ok) return existing;
      if (existing.data) {
        return { ok: true, data: { id: existingMaterializedId, materialized: false } };
      }
    }

    const masterDateKey = master.data.assignmentDate?.slice(0, 10) ?? master.data.scheduledStart.slice(0, 10);
    if (occurrenceDate === masterDateKey) {
      return { ok: true, data: { id: masterVisitId, materialized: false } };
    }

    const shifted = shiftVisitScheduleToDate(
      master.data.scheduledStart,
      master.data.scheduledEnd,
      occurrenceDate,
    );

    const taskTitles = master.data.tasks.map((task) => task.title.trim()).filter(Boolean);
    const input: VisitCreateInput = {
      clientId: master.data.clientId,
      employeeId: master.data.employeeId,
      serviceKey: master.data.serviceKey ?? 'general',
      serviceName: master.data.serviceName ?? master.data.title,
      title: master.data.title,
      description: master.data.description,
      assignmentDate: occurrenceDate,
      plannedStartAt: shifted.scheduledStart,
      plannedEndAt: shifted.scheduledEnd,
      addressSnapshot: master.data.addressSnapshot ?? master.data.location,
      locationNotes: master.data.locationNotes,
      tasks: taskTitles,
      budgetAmountCents: master.data.budget?.budgetAmountCents ?? null,
      internalNotes: master.data.notes,
      employeeNotes: master.data.employeeNotes,
      clientVisibleNotes: master.data.clientVisibleNotes,
      notifyEmployee: false,
      notifyClient: false,
      portalReleaseEnabled: master.data.portalReleaseEnabled,
      saveAsDraft: master.data.planningStatus === 'draft',
      subjectKey: master.data.subjectKey ?? null,
      assignmentTypeKey: master.data.assignmentTypeKey ?? null,
      serviceCategoryKey: master.data.serviceCategoryKey ?? null,
      taskPackageId: master.data.taskPackageId ?? null,
      billingBudgetSourceKey: master.data.billingBudgetSourceKey ?? null,
      proofTemplateKey: master.data.proofTemplateKey ?? null,
      documentationTemplateKey: master.data.documentationTemplateKey ?? null,
      riskFlagKeys: master.data.riskFlagKeys ?? [],
      recurrenceJson: {
        pattern: 'none',
        parentSeriesId: masterVisitId,
        sourceOccurrenceDate: occurrenceDate,
      },
      catalogSnapshotJson: {
        ...(master.data.catalogSnapshotJson ?? {}),
        materializedFromSeriesId: masterVisitId,
        sourceOccurrenceDate: occurrenceDate,
      },
      budgetAllocation: null,
      budgetManualOverride: null,
    };

    const created = await this.create(tenantId, input, actorProfileId);
    if (!created.ok) return created;

    const updatedRecurrence = buildRecurrenceJsonWithMaterializedOccurrence(
      recurrence,
      occurrenceDate,
      created.data.id,
    );

    const { error: updateError } = await fromUnknownTable(supabase, 'assist_visits')
      .update({ recurrence_json: updatedRecurrence, updated_by: actorProfileId ?? null })
      .eq('tenant_id', tenantId)
      .eq('id', masterVisitId);

    if (updateError) {
      return { ok: false, error: toGermanSupabaseError(updateError) };
    }

    return { ok: true, data: { id: created.data.id, materialized: true } };
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
