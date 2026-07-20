import type { ServiceResult } from '@/types';
import type { AssignmentListItem, AssignmentPlan } from '@/types/modules/assist';
import type { WorkflowStatus } from '@/types/core/base';
import type {
  AssignmentStatus,
  AssignmentTaskStatus,
} from '@/types/modules/assignmentStatus';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';
import {
  getAllowedAssignmentTransitions,
  validateAssignmentTransition,
} from '@/lib/assist/assignmentStatusMachine';
import { dedupeStatusTransitionButtons } from '@/lib/assist/visitWorkflow';
import {
  assignmentStatusToRemote,
  remoteStatusToAssignment,
} from '@/lib/assist/assignmentStatusBridge';
import { timestampPatchForStatusTransition } from '@/lib/assist/assignmentLifecycleTimestamps';
import type { AssignmentMutationContext } from '@/lib/assist/assignmentAuditHelper';
import { writeAssignmentAudit } from '@/lib/assist/assignmentAuditHelper';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import type { Database } from '@/lib/supabase/database.types';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { resolveVisitLocation } from '@/lib/assist/resolveVisitLocation';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';
import { isUuid } from '@/lib/validation/uuid';
import { cancelCalendarEventBySourceAsync } from '@/lib/calendar/calendarSyncService';

export type AssignmentTaskRow = {
  id: string;
  assignment_id: string;
  tenant_id: string;
  title: string;
  status: AssignmentTaskStatus;
  is_required: boolean | null;
  not_done_reason: string | null;
  requires_note_if_not_done: boolean | null;
  sort_order: number | null;
};

export type AssignmentLiveRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  employee_id: string | null;
  assignment_date: string;
  planned_start_at: string;
  planned_end_at: string;
  actual_start_at: string | null;
  actual_end_at: string | null;
  on_the_way_at?: string | null;
  arrived_at?: string | null;
  finished_at?: string | null;
  documentation_notes?: string | null;
  status: string;
  title: string | null;
  address_snapshot: string | null;
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

export type AssignmentDetail = AssignmentPlan & {
  assignmentStatus: AssignmentStatus;
  tasks: AssignmentTaskItem[];
  onTheWayAt: string | null;
  arrivedAt: string | null;
  finishedAt: string | null;
  documentationNotes: string | null;
  plannedStartAt: string;
  plannedEndAt: string;
  actualStartAt: string | null;
  actualEndAt: string | null;
};

export type AssignmentTaskItem = {
  id: string;
  title: string;
  status: AssignmentTaskStatus;
  isRequired: boolean;
  notDoneReason: string | null;
  requiresNoteIfNotDone: boolean;
  categoryKey?: string | null;
  categoryLabel?: string | null;
};

export type AssignmentCreateInput = {
  clientId: string;
  employeeId: string;
  assignmentDate: string;
  plannedStartAt: string;
  plannedEndAt: string;
  title: string;
  tasks: string[];
};

export type AssignmentListOptions = {
  statusFilter?: AssignmentStatus | 'all';
};

const LIST_SELECT = `
  id, tenant_id, client_id, employee_id, assignment_date,
  planned_start_at, planned_end_at, actual_start_at, actual_end_at,
  on_the_way_at, arrived_at, finished_at, documentation_notes,
  status, title, address_snapshot, created_at, updated_at,
  clients(first_name, last_name, street, house_number, postal_code, city),
  employees(first_name, last_name)
`;

const DETAIL_SELECT = LIST_SELECT;

/** Flat select — no nested clients/employees (RLS-safe for employee portal). */
const PORTAL_DETAIL_SELECT = `
  id, tenant_id, client_id, employee_id, assignment_date,
  planned_start_at, planned_end_at, actual_start_at, actual_end_at,
  on_the_way_at, arrived_at, finished_at, documentation_notes,
  status, title, address_snapshot, created_at, updated_at
`;

const DETAIL_TASKS_SELECT = '*';

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

function mapTaskRow(row: AssignmentTaskRow): AssignmentTaskItem {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    isRequired: row.is_required ?? false,
    notDoneReason: row.not_done_reason,
    requiresNoteIfNotDone: row.requires_note_if_not_done ?? false,
  };
}

function assignmentLocationFromRow(row: AssignmentLiveRow): string {
  return resolveVisitLocation({
    addressSnapshot: row.address_snapshot,
    client: row.clients,
  });
}

function mapListItem(row: AssignmentLiveRow): AssignmentListItem {
  const assignmentStatus = remoteStatusToAssignment(row.status);
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title?.trim() || 'Einsatz',
    scheduledStart: row.planned_start_at,
    scheduledEnd: row.planned_end_at,
    status: assignmentStatusToWorkflowFilter(assignmentStatus),
    assignmentStatus,
    onTheWayAt: row.on_the_way_at,
    arrivedAt: row.arrived_at,
    actualStartAt: row.actual_start_at,
    actualEndAt: row.actual_end_at,
    location: assignmentLocationFromRow(row),
    clientName: personName(row.clients),
    employeeId: row.employee_id ?? null,
    employeeName: personName(row.employees),
    updatedAt: row.updated_at,
  };
}

function mapDetail(row: AssignmentLiveRow & { assignment_tasks?: AssignmentTaskRow[] }): AssignmentDetail {
  const assignmentStatus = remoteStatusToAssignment(row.status);
  const allowed = dedupeStatusTransitionButtons(getAllowedAssignmentTransitions(assignmentStatus));
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    employeeId: row.employee_id ?? '',
    appointmentId: null,
    title: row.title?.trim() || 'Einsatz',
    scheduledStart: row.planned_start_at,
    scheduledEnd: row.planned_end_at,
    status: assignmentStatusToWorkflowFilter(assignmentStatus),
    location: assignmentLocationFromRow(row),
    notes: row.documentation_notes ?? null,
    clientName: personName(row.clients),
    employeeName: personName(row.employees),
    nextActionHint: ASSIGNMENT_STATUS_LABELS[assignmentStatus],
    allowedStatusActions: allowed.map(assignmentStatusToWorkflowFilter),
    allowedStatusTransitions: allowed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    visibility: 'team',
    sensitivity: 'care',
    assignmentStatus,
    tasks: (row.assignment_tasks ?? []).map(mapTaskRow),
    onTheWayAt: row.on_the_way_at ?? null,
    arrivedAt: row.arrived_at ?? null,
    finishedAt: row.finished_at ?? null,
    documentationNotes: row.documentation_notes ?? null,
    plannedStartAt: row.planned_start_at,
    plannedEndAt: row.planned_end_at,
    actualStartAt: row.actual_start_at,
    actualEndAt: row.actual_end_at,
  };
}

function timestampPatchForStatus(
  to: AssignmentStatus,
  now: string,
  existing: AssignmentLifecycleTimestamps = {},
): Record<string, string | null> {
  return timestampPatchForStatusTransition(to, now, existing);
}

type AssignmentLifecycleTimestamps = {
  on_the_way_at?: string | null;
  arrived_at?: string | null;
  actual_start_at?: string | null;
  actual_end_at?: string | null;
  finished_at?: string | null;
};

function remoteStatusFilter(status: AssignmentStatus): string {
  return assignmentStatusToRemote(status);
}

export const assignmentSupabaseRepository = {
  wpNumber: 244 as const,

  async list(
    tenantId: string,
    options?: AssignmentListOptions,
  ): Promise<ServiceResult<AssignmentListItem[]>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    let query = fromUnknownTable(supabase, 'assignments')
      .select(LIST_SELECT)
      .eq('tenant_id', tenantId)
      .order('planned_start_at', { ascending: true });

    if (options?.statusFilter && options.statusFilter !== 'all') {
      query = query.eq('status', remoteStatusFilter(options.statusFilter));
    }

    const { data, error } = await query;
    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    const rows = (data ?? []) as unknown as AssignmentLiveRow[];
    return { ok: true, data: rows.map(mapListItem) };
  },

  async getById(
    tenantId: string,
    assignmentId: string,
    options?: { portalEmployeeId?: string | null },
  ): Promise<ServiceResult<AssignmentDetail | null>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    if (!isUuid(assignmentId)) {
      return { ok: true, data: null };
    }

    const portalEmployeeId = options?.portalEmployeeId?.trim();
    const usePortalFlatSelect = Boolean(portalEmployeeId);

    let query = fromUnknownTable(supabase, 'assignments')
      .select(usePortalFlatSelect ? PORTAL_DETAIL_SELECT : DETAIL_SELECT)
      .eq('tenant_id', tenantId)
      .eq('id', assignmentId);

    if (portalEmployeeId) {
      query = query.eq('employee_id', portalEmployeeId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) return { ok: true, data: null };

    const row = data as unknown as AssignmentLiveRow;

    if (usePortalFlatSelect && row.client_id) {
      const { data: clientRow } = await fromUnknownTable(supabase, 'clients')
        .select('first_name, last_name, street, house_number, postal_code, city')
        .eq('tenant_id', tenantId)
        .eq('id', row.client_id)
        .maybeSingle();
      if (clientRow) {
        row.clients = clientRow as AssignmentLiveRow['clients'];
      }
    }

    const { data: taskRows, error: taskError } = await fromUnknownTable(supabase, 'assignment_tasks')
      .select(DETAIL_TASKS_SELECT)
      .eq('tenant_id', tenantId)
      .eq('assignment_id', assignmentId)
      .order('sort_order', { ascending: true });

    if (taskError) {
      console.warn('[assignmentRepository] assignment_tasks:', taskError.message);
    }

    const tasks = (taskRows ?? []) as unknown as AssignmentTaskRow[];

    return {
      ok: true,
      data: mapDetail({ ...row, assignment_tasks: tasks }),
    };
  },

  async create(
    tenantId: string,
    input: AssignmentCreateInput,
    context?: AssignmentMutationContext,
  ): Promise<ServiceResult<{ id: string }>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const taskTitles = input.tasks.map((t) => t.trim()).filter(Boolean);
    const insertRow = {
      tenant_id: tenantId,
      client_id: input.clientId,
      employee_id: input.employeeId,
      assignment_date: input.assignmentDate,
      planned_start_at: input.plannedStartAt,
      planned_end_at: input.plannedEndAt,
      title: input.title.trim(),
      status: assignmentStatusToRemote('geplant'),
      product_key: 'assist',
      created_by: context?.actorProfileId ?? null,
    } as Database['public']['Tables']['assignments']['Insert'];

    const { data, error } = await supabase
      .from('assignments')
      .insert(insertRow)
      .select('id')
      .single();

    if (error || !data) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    const assignmentId = data.id;

    if (taskTitles.length > 0) {
      const taskRows = taskTitles.map((title, index) => ({
        tenant_id: tenantId,
        assignment_id: assignmentId,
        title,
        status: 'open' as const,
        is_required: true,
        requires_note_if_not_done: true,
        sort_order: index,
      }));

      const { error: taskError } = await supabase.from('assignment_tasks').insert(taskRows);
      if (taskError) {
        return { ok: false, error: toGermanSupabaseError(taskError) };
      }
    }

    await writeAssignmentAudit(supabase, {
      tenantId,
      assignmentId,
      action: 'create',
      toStatus: 'geplant',
      details: `Einsatz „${input.title.trim()}“ angelegt`,
      actor: context,
    });

    return { ok: true, data: { id: assignmentId } };
  },

  async updateStatus(
    tenantId: string,
    assignmentId: string,
    toStatus: AssignmentStatus,
    context?: AssignmentMutationContext,
    note?: string,
  ): Promise<ServiceResult<AssignmentDetail>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const masterAssignmentId = resolveVisitMasterId(assignmentId);
    const existing = await this.getById(tenantId, masterAssignmentId);
    if (!existing.ok) return existing;
    if (!existing.data) {
      return { ok: false, error: 'Einsatz nicht gefunden.' };
    }

    const fromStatus = existing.data.assignmentStatus;
    if (fromStatus === toStatus) {
      return { ok: true, data: existing.data };
    }

    const validation = validateAssignmentTransition(fromStatus, toStatus);
    if (!validation.valid) {
      return { ok: false, error: validation.error };
    }

    const now = new Date().toISOString();
    const remoteStatus = assignmentStatusToRemote(toStatus);
    const timestampPatch = timestampPatchForStatus(toStatus, now, {
      on_the_way_at: existing.data.onTheWayAt,
      arrived_at: existing.data.arrivedAt,
      actual_start_at: existing.data.actualStartAt,
      actual_end_at: existing.data.actualEndAt,
      finished_at: existing.data.finishedAt,
    });

    const { error: rpcError } = await supabase.rpc('set_assignment_status', {
      input_assignment_id: masterAssignmentId,
      input_status: remoteStatus,
      input_note: note,
      input_employee_id: context?.actorEmployeeId,
    });

    if (rpcError) {
      const patch = {
        status: remoteStatus,
        updated_by: context?.actorProfileId ?? null,
        updated_at: now,
        ...timestampPatch,
      };

      const { error: updateError } = await fromUnknownTable(supabase, 'assignments')
        .update(patch)
        .eq('tenant_id', tenantId)
        .eq('id', masterAssignmentId);

      if (updateError) {
        return { ok: false, error: toGermanSupabaseError(updateError) };
      }
    } else if (Object.keys(timestampPatch).length > 0) {
      // set_assignment_status updates status only — patch lifecycle timestamps separately.
      const { error: timestampError } = await fromUnknownTable(supabase, 'assignments')
        .update({ ...timestampPatch, updated_at: now })
        .eq('tenant_id', tenantId)
        .eq('id', masterAssignmentId);

      if (timestampError) {
        return { ok: false, error: toGermanSupabaseError(timestampError) };
      }
    }

    await writeAssignmentAudit(supabase, {
      tenantId,
      assignmentId: masterAssignmentId,
      action: 'status_change',
      fromStatus,
      toStatus,
      details: note,
      actor: context,
    });

    const refreshed = await this.getById(tenantId, masterAssignmentId);
    if (!refreshed.ok) return refreshed;
    if (!refreshed.data) {
      return { ok: false, error: 'Einsatz nach Statuswechsel nicht gefunden.' };
    }
    return { ok: true, data: refreshed.data };
  },

  async updateTask(
    tenantId: string,
    assignmentId: string,
    taskId: string,
    status: AssignmentTaskStatus,
    notDoneReason?: string,
    context?: AssignmentMutationContext,
  ): Promise<ServiceResult<AssignmentDetail>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const { data: task, error: taskError } = await supabase
      .from('assignment_tasks')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('assignment_id', assignmentId)
      .eq('id', taskId)
      .maybeSingle();

    if (taskError) return { ok: false, error: toGermanSupabaseError(taskError) };
    if (!task) return { ok: false, error: 'Aufgabe nicht gefunden.' };

    if (
      status === 'not_done' &&
      (task.requires_note_if_not_done ?? false) &&
      !notDoneReason?.trim()
    ) {
      return { ok: false, error: 'Abweichung erfordert eine Begründung.' };
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('assignment_tasks')
      .update({
        status,
        not_done_reason: status === 'not_done' ? (notDoneReason?.trim() ?? null) : null,
        completed_at: status === 'done' ? now : null,
        completed_by_employee_id: status === 'done' ? (context?.actorEmployeeId ?? null) : null,
        updated_at: now,
      })
      .eq('tenant_id', tenantId)
      .eq('id', taskId);

    if (updateError) {
      return { ok: false, error: toGermanSupabaseError(updateError) };
    }

    await writeAssignmentAudit(supabase, {
      tenantId,
      assignmentId,
      action: 'task_update',
      details: `Aufgabe „${task.title}“ → ${status}`,
      actor: context,
    });

    const refreshed = await this.getById(tenantId, assignmentId);
    if (!refreshed.ok) return refreshed;
    if (!refreshed.data) {
      return { ok: false, error: 'Einsatz nicht gefunden.' };
    }
    return { ok: true, data: refreshed.data };
  },

  async updateTasksBatch(
    tenantId: string,
    assignmentId: string,
    updates: Array<{
      taskId: string;
      status: AssignmentTaskStatus;
      notDoneReason?: string;
    }>,
    context?: AssignmentMutationContext,
  ): Promise<ServiceResult<AssignmentDetail>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    if (!updates.length) {
      const current = await this.getById(tenantId, assignmentId);
      return current;
    }

    const now = new Date().toISOString();
    for (const item of updates) {
      const { data: task, error: taskError } = await supabase
        .from('assignment_tasks')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('assignment_id', assignmentId)
        .eq('id', item.taskId)
        .maybeSingle();

      if (taskError) return { ok: false, error: toGermanSupabaseError(taskError) };
      if (!task) return { ok: false, error: 'Aufgabe nicht gefunden.' };

      if (
        item.status === 'not_done' &&
        (task.requires_note_if_not_done ?? false) &&
        !item.notDoneReason?.trim()
      ) {
        return { ok: false, error: 'Abweichung erfordert eine Begründung.' };
      }

      const { error: updateError } = await supabase
        .from('assignment_tasks')
        .update({
          status: item.status,
          not_done_reason: item.status === 'not_done' ? (item.notDoneReason?.trim() ?? null) : null,
          completed_at: item.status === 'done' ? now : null,
          completed_by_employee_id:
            item.status === 'done' ? (context?.actorEmployeeId ?? null) : null,
          updated_at: now,
        })
        .eq('tenant_id', tenantId)
        .eq('id', item.taskId);

      if (updateError) {
        return { ok: false, error: toGermanSupabaseError(updateError) };
      }

      await writeAssignmentAudit(supabase, {
        tenantId,
        assignmentId,
        action: 'task_update',
        details: `Aufgabe „${task.title}“ → ${item.status}`,
        actor: context,
      });
    }

    const refreshed = await this.getById(tenantId, assignmentId);
    if (!refreshed.ok) return refreshed;
    if (!refreshed.data) {
      return { ok: false, error: 'Einsatz nicht gefunden.' };
    }
    return { ok: true, data: refreshed.data };
  },

  async completeWithDocumentation(
    tenantId: string,
    assignmentId: string,
    documentationNotes: string,
    context?: AssignmentMutationContext,
  ): Promise<ServiceResult<AssignmentDetail>> {
    if (!documentationNotes.trim()) {
      return { ok: false, error: 'Dokumentation ist vor Abschluss erforderlich.' };
    }

    const supabase = getClient();
    if (!supabase) return unavailable();

    const existing = await this.getById(tenantId, assignmentId);
    if (!existing.ok) return existing;
    if (!existing.data) {
      return { ok: false, error: 'Einsatz nicht gefunden.' };
    }

    const now = new Date().toISOString();
    const { error: notesError } = await fromUnknownTable(supabase, 'assignments')
      .update({
        documentation_notes: documentationNotes.trim(),
        updated_at: now,
        updated_by: context?.actorProfileId ?? null,
      })
      .eq('tenant_id', tenantId)
      .eq('id', assignmentId);

    if (notesError) {
      return { ok: false, error: toGermanSupabaseError(notesError) };
    }

    const targetStatus: AssignmentStatus =
      existing.data.assignmentStatus === 'unterschrift_offen'
        ? 'abgeschlossen'
        : 'dokumentation_offen';

    const statusResult = await this.updateStatus(
      tenantId,
      assignmentId,
      targetStatus,
      context,
      documentationNotes.trim(),
    );
    if (!statusResult.ok) return statusResult;

    if (targetStatus === 'abgeschlossen') {
      await this.prepareServiceRecord(tenantId, assignmentId, context);
    }

    return statusResult;
  },

  async prepareServiceRecord(
    tenantId: string,
    assignmentId: string,
    context?: AssignmentMutationContext,
  ): Promise<ServiceResult<{ id: string } | null>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const detail = await this.getById(tenantId, assignmentId);
    if (!detail.ok) return detail;
    if (!detail.data) {
      return { ok: false, error: 'Einsatz nicht gefunden.' };
    }

    if (detail.data.assignmentStatus !== 'abgeschlossen') {
      return { ok: true, data: null };
    }

    const { data: existing } = await supabase
      .from('service_records')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('assignment_id', assignmentId)
      .maybeSingle();

    if (existing?.id) {
      return { ok: true, data: { id: existing.id } };
    }

    const startMs = detail.data.actualStartAt
      ? new Date(detail.data.actualStartAt).getTime()
      : null;
    const endMs = detail.data.actualEndAt ? new Date(detail.data.actualEndAt).getTime() : null;
    const actualMinutes =
      startMs && endMs ? Math.max(1, Math.round((endMs - startMs) / 60_000)) : null;

    const { data, error } = await supabase
      .from('service_records')
      .insert({
        tenant_id: tenantId,
        assignment_id: assignmentId,
        client_id: detail.data.clientId,
        employee_id: detail.data.employeeId || null,
        service_date: detail.data.plannedStartAt.slice(0, 10),
        notes: detail.data.documentationNotes,
        actual_minutes: actualMinutes,
        planned_minutes: null,
        status: 'draft',
        product_key: 'assist',
      } as Database['public']['Tables']['service_records']['Insert'])
      .select('id')
      .single();

    if (error || !data) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    await writeAssignmentAudit(supabase, {
      tenantId,
      assignmentId,
      action: 'service_record_created',
      details: `Leistungsnachweis ${data.id} vorbereitet`,
      actor: context,
    });

    return { ok: true, data: { id: data.id } };
  },

  async delete(tenantId: string, assignmentId: string): Promise<ServiceResult<void>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const existing = await this.getById(tenantId, assignmentId);
    if (!existing.ok) return existing;
    if (!existing.data) {
      return { ok: false, error: 'Einsatz nicht gefunden.' };
    }

    const isUnstarted = ['geplant', 'bestaetigt', 'storniert'].includes(
      existing.data.assignmentStatus,
    );
    const hasExecutionEvidence = Boolean(
      existing.data.onTheWayAt
      || existing.data.arrivedAt
      || existing.data.actualStartAt
      || existing.data.actualEndAt
      || existing.data.finishedAt,
    );
    if (!isUnstarted || hasExecutionEvidence) {
      return {
        ok: false,
        error: 'Begonnene oder abgeschlossene Einsätze dürfen nicht gelöscht werden.',
      };
    }

    cancelCalendarEventBySourceAsync(tenantId, 'assist_visit', assignmentId);

    const { data: deletedAssignment, error } = await fromUnknownTable(supabase, 'assignments')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', assignmentId)
      .select('id')
      .maybeSingle();

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!deletedAssignment) return { ok: false, error: 'Einsatz konnte nicht gelöscht werden.' };
    return { ok: true, data: undefined };
  },
};
