import type { RoleKey, ServiceResult } from '@/types';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { CanonicalAssignmentStatus } from '@/types/modules/assignmentWorkflow';
import type { ExtendedAssignmentTaskStatus } from '@/types/modules/assignmentWorkflow';
import type {
  EmployeePortalAssignmentDetail,
  EmployeePortalOverview,
  EmployeePortalTaskItem,
} from '@/types/modules/employeePortalExecution';
import {
  assignmentSupabaseRepository,
  type AssignmentDetail,
  type AssignmentTaskItem,
} from '@/lib/assist/repositories/assignmentRepository.supabase';
import {
  getAllowedAssignmentTransitions,
  isAssignmentLocked,
  taskStatusRequiresNote,
  validateExecutionTransition,
} from '@/lib/assist/assignmentStatusMachine';
import { assignmentStatusToRemote } from '@/lib/assist/assignmentStatusBridge';
import { enforcePermission } from '@/lib/permissions';
import {
  buildWorkspaceAccessContext,
  canStartAssignment,
  canViewAssignment,
} from '@/lib/permissions/workspaceAccess';
import { getServiceMode } from '@/lib/services/mode';
import { runService } from '@/lib/services/serviceRunner';
import {
  canCaptureGps,
  canViewAccessHints,
  canViewEmergencyContact,
  resolveEnabledExecutionModules,
  type TenantModuleFlags,
} from './employeePortalModuleAccess';
import {
  applyEmployeePortalTrackingForStatus,
  peekEmployeePortalTrackingEntry,
} from './employeePortalVisitTrackingService';
import { persistEmployeePortalStatusTransition } from './employeePortalVisitTrackingPersistence';
import {
  buildEmployeePortalOverviewFromAppointments,
  fetchLiveEmployeePortalOverview,
} from './employeePortalLiveOverviewService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { resolveLiveAssignment } from '@/features/liveTracking/resolveLiveAssignment';
import { visitSupabaseRepository } from '@/lib/assist/repositories/visitRepository.supabase';
import {
  hasPortalPersistedClientSignature,
  resolveEmployeePortalDocumentationFlags,
} from './resolveEmployeePortalSignatureRequirement';
import { enrichPortalTaskCategory } from './enrichPortalTaskCategory';

function mapTask(task: AssignmentTaskItem): EmployeePortalTaskItem {
  return enrichPortalTaskCategory({
    id: task.id,
    title: task.title,
    description: null,
    required: task.isRequired,
    status: task.status as ExtendedAssignmentTaskStatus,
    completionNote: task.notDoneReason,
    requiresNote: task.requiresNoteIfNotDone,
    categoryKey: task.categoryKey ?? null,
    categoryLabel: task.categoryLabel ?? null,
  });
}

function mapDetailToPortal(
  detail: AssignmentDetail,
  roleKey: RoleKey | null,
  employeeId: string,
  tenantModules?: TenantModuleFlags,
  extras?: {
    notesForEmployee?: string | null;
    accessHints?: string | null;
    emergencyContact?: string | null;
    requiresSignature?: boolean;
    requiresDocumentation?: boolean;
    signatureStatus?: EmployeePortalAssignmentDetail['signatureStatus'];
  },
): EmployeePortalAssignmentDetail {
  const status = detail.assignmentStatus;
  const canonicalStatus = assignmentStatusToRemote(status) as CanonicalAssignmentStatus;
  const ctx = buildWorkspaceAccessContext({ tenantId: detail.tenantId, roleKey, employeeId, userId: employeeId });
  const canStart = canStartAssignment(ctx, {
    tenantId: detail.tenantId,
    employeeId: detail.employeeId,
    clientId: detail.clientId,
  });
  const requiresDocumentation = extras?.requiresDocumentation ?? true;
  const requiresSignature = extras?.requiresSignature ?? false;
  const docNotes = detail.documentationNotes?.trim();
  const documentationStatus: EmployeePortalAssignmentDetail['documentationStatus'] =
    !docNotes && (status === 'beendet' || status === 'dokumentation_offen')
      ? 'draft'
      : docNotes
        ? 'submitted'
        : 'none';
  const signatureStatus: EmployeePortalAssignmentDetail['signatureStatus'] =
    extras?.signatureStatus ??
    (requiresSignature
      ? status === 'unterschrift_offen' || status === 'dokumentation_offen'
        ? 'pending'
        : 'none'
      : 'none');

  return {
    assignmentId: detail.id,
    tenantId: detail.tenantId,
    title: detail.title,
    clientId: detail.clientId,
    clientName: detail.clientName,
    locationAddress: detail.location,
    plannedStartAt: detail.plannedStartAt,
    plannedEndAt: detail.plannedEndAt,
    actualStartAt: detail.actualStartAt,
    actualEndAt: detail.actualEndAt,
    onTheWayAt: detail.onTheWayAt ?? null,
    arrivedAt: detail.arrivedAt ?? null,
    status,
    canonicalStatus,
    notesForEmployee: extras?.notesForEmployee?.trim() ?? '',
    accessHints: canViewAccessHints(roleKey) ? extras?.accessHints ?? null : null,
    emergencyContact: canViewEmergencyContact(roleKey) ? extras?.emergencyContact ?? null : null,
    tasks: detail.tasks.map(mapTask),
    statusHistory: [],
    pauseEvents: [],
    documentationStatus,
    signatureStatus,
    requiresSignature,
    requiresDocumentation,
    requiresRoute: Boolean(detail.location?.trim()),
    canStartExecution: canStart.allowed && !isAssignmentLocked(status),
    canOpenRoute: Boolean(detail.location?.trim()),
    canCaptureGps: canCaptureGps(roleKey),
    allowedTransitions: getAllowedAssignmentTransitions(status),
    isLocked: isAssignmentLocked(status),
    enabledModules: resolveEnabledExecutionModules(roleKey, tenantModules),
  };
}

async function fetchAssignmentExtras(
  tenantId: string,
  assignmentId: string,
  clientId: string,
): Promise<{ notesForEmployee: string | null; accessHints: string | null; emergencyContact: string | null }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { notesForEmployee: null, accessHints: null, emergencyContact: null };
  }

  const [assignmentResult, contactResult] = await Promise.all([
    fromUnknownTable(supabase, 'assignments')
      .select('client_visible_notes, address_snapshot')
      .eq('tenant_id', tenantId)
      .eq('id', assignmentId)
      .maybeSingle(),
    fromUnknownTable(supabase, 'client_contacts')
      .select('full_name, first_name, last_name, phone, is_emergency_contact')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('is_emergency_contact', true)
      .limit(1),
  ]);

  if (assignmentResult.error && !isMissingTableError(assignmentResult.error)) {
    console.warn('[employeePortalExecutionLiveService] assignments notes:', assignmentResult.error.message);
  }

  const assignmentRow = assignmentResult.data as Record<string, unknown> | null;
  let emergencyContact: string | null = null;
  if (!contactResult.error && contactResult.data?.length) {
    const contact = contactResult.data[0] as Record<string, unknown>;
    const name =
      String(contact.full_name ?? '').trim() ||
      `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim();
    const phone = String(contact.phone ?? '').trim();
    emergencyContact = name ? `${name}${phone ? ` (${phone})` : ''}` : null;
  }

  return {
    notesForEmployee: assignmentRow?.client_visible_notes
      ? String(assignmentRow.client_visible_notes)
      : null,
    accessHints: null,
    emergencyContact,
  };
}

function assertLiveEmployeeAssignmentAccess(
  tenantId: string,
  employeeId: string,
  roleKey: RoleKey | null,
  detail: AssignmentDetail,
): ServiceResult<never> | null {
  if (!detail.employeeId) {
    return { ok: false, error: 'Einsatz nicht zugewiesen.' };
  }

  if (detail.employeeId !== employeeId) {
    return { ok: false, error: 'Einsatz nicht zugewiesen.' };
  }

  const ctx = buildWorkspaceAccessContext({ tenantId, roleKey, employeeId, userId: employeeId });
  const view = canViewAssignment(ctx, {
    tenantId: detail.tenantId,
    employeeId: detail.employeeId,
    clientId: detail.clientId,
  });
  if (!view.allowed) {
    return { ok: false, error: view.message ?? 'Kein Zugriff auf diesen Einsatz.' };
  }
  return null;
}

async function syncBudgetLifecycleAfterPortalStatus(
  tenantId: string,
  assignmentId: string,
  targetStatus: AssignmentStatus,
  actorProfileId?: string | null,
): Promise<ServiceResult<void>> {
  if (targetStatus !== 'beendet' && targetStatus !== 'abgeschlossen') {
    return { ok: true, data: undefined };
  }
  const { markAssignmentExecuted } = await import('@/lib/assist/clientBudgetTransactionService');
  const budgetResult = await markAssignmentExecuted(tenantId, assignmentId, actorProfileId ?? null);
  if (!budgetResult.ok) {
    return { ok: false, error: budgetResult.error ?? 'Budget-Reservierung konnte nicht verbucht werden.' };
  }
  return { ok: true, data: undefined };
}

/** Mirror assignments.status into assist_visits via SECURITY DEFINER RPC (direct visit UPDATE may fail RLS). */
export async function mirrorAssistVisitStatusFromAssignment(
  tenantId: string,
  assignmentId: string,
  targetStatus: AssignmentStatus,
  actorProfileId?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true };

  const { error } = await supabase.rpc('repair_assist_visit_workflow_status', {
    p_tenant_id: tenantId,
    p_assignment_id: assignmentId,
    p_target_status: targetStatus,
    p_reason: 'portal_execution_status_mirror',
    p_actor_employee_id: actorProfileId ?? null,
  });

  if (!error) {
    const budgetSync = await syncBudgetLifecycleAfterPortalStatus(
      tenantId,
      assignmentId,
      targetStatus,
      actorProfileId,
    );
    if (!budgetSync.ok) {
      return {
        ok: false,
        error: budgetSync.error ?? 'Budget-Reservierung konnte nicht auf „durchgeführt“ gesetzt werden.',
      };
    }
    return { ok: true };
  }

  const visitUpdated = await visitSupabaseRepository.updateAssignmentStatus(
    tenantId,
    assignmentId,
    targetStatus,
    actorProfileId ?? null,
  );
  if (visitUpdated.ok) {
    const budgetSync = await syncBudgetLifecycleAfterPortalStatus(
      tenantId,
      assignmentId,
      targetStatus,
      actorProfileId,
    );
    if (!budgetSync.ok) {
      return {
        ok: false,
        error: budgetSync.error ?? 'Budget-Reservierung konnte nicht auf „durchgeführt“ gesetzt werden.',
      };
    }
    return { ok: true };
  }

  const message = `${error.message}; visit fallback: ${visitUpdated.error ?? 'failed'}`;
  console.warn('[employeePortalExecutionLiveService] visit status mirror:', message);
  return { ok: false, error: message };
}

async function loadEmployeePortalAssignmentDetail(
  tenantId: string,
  assignmentId: string,
  employeeId?: string | null,
): Promise<ServiceResult<AssignmentDetail | null>> {
  const resolved = await resolveLiveAssignment({
    tenantId,
    rawId: assignmentId,
    employeeId,
  });
  if (!resolved.ok) return resolved;
  if (!resolved.data) return { ok: true, data: null };
  return { ok: true, data: resolved.data.detail };
}

export function isEmployeePortalLiveMode(): boolean {
  return getServiceMode() === 'supabase';
}

export async function fetchLiveEmployeePortalOverviewWrapped(
  tenantId: string,
  employeeId: string,
  roleKey: RoleKey | null,
): Promise<ServiceResult<EmployeePortalOverview>> {
  const denied = enforcePermission<EmployeePortalOverview>(roleKey, 'portal.employee.appointments.view');
  if (denied && roleKey === 'employee_portal') return denied;

  const overview = await fetchLiveEmployeePortalOverview(tenantId, employeeId);
  if (!overview.ok) return overview;

  const messageCount = await fetchLiveEmployeePortalUnreadCount(tenantId, employeeId);
  return {
    ok: true,
    data: {
      ...overview.data,
      adminMessageCount: messageCount,
      canReportProblem: true,
    },
  };
}

async function fetchLiveEmployeePortalUnreadCount(
  tenantId: string,
  employeeId: string,
): Promise<number> {
  const supabase = getSupabaseClient();
  if (!supabase) return 0;

  const { data, error } = await fromUnknownTable(supabase, 'message_threads')
    .select('portal_unread_count')
    .eq('tenant_id', tenantId)
    .eq('thread_type', 'employee')
    .eq('employee_id', employeeId);

  if (error) {
    if (!isMissingTableError(error)) {
      console.warn('[employeePortalExecutionLiveService] message_threads:', error.message);
    }
    return 0;
  }

  return (data ?? []).reduce(
    (sum, row) => sum + Number((row as { portal_unread_count?: number }).portal_unread_count ?? 0),
    0,
  );
}

export async function fetchLiveEmployeePortalAssignmentDetail(
  tenantId: string,
  assignmentId: string,
  employeeId: string,
  roleKey: RoleKey | null,
  tenantModules?: TenantModuleFlags,
): Promise<ServiceResult<EmployeePortalAssignmentDetail>> {
  const denied = enforcePermission<EmployeePortalAssignmentDetail>(
    roleKey,
    'portal.employee.appointments.view',
  );
  if (denied && roleKey === 'employee_portal') return denied;

  return runService(async () => {
    const loaded = await loadEmployeePortalAssignmentDetail(tenantId, assignmentId, employeeId);
    if (!loaded.ok) return loaded;
    if (!loaded.data) return { ok: false, error: 'Einsatz nicht gefunden.' };

    const accessDenied = assertLiveEmployeeAssignmentAccess(tenantId, employeeId, roleKey, loaded.data);
    if (accessDenied) return accessDenied;

    const extras = await fetchAssignmentExtras(tenantId, assignmentId, loaded.data.clientId);
    const docFlags = await resolveEmployeePortalDocumentationFlags(
      tenantId,
      assignmentId,
      loaded.data.assignmentStatus,
      loaded.data.documentationNotes,
      employeeId,
    );
    return {
      ok: true,
      data: mapDetailToPortal(loaded.data, roleKey, employeeId, tenantModules, {
        ...extras,
        requiresSignature: docFlags.requiresSignature,
        requiresDocumentation: docFlags.requiresDocumentation,
        signatureStatus: docFlags.signatureStatus,
      }),
    };
  });
}

export async function transitionLiveEmployeePortalAssignment(
  tenantId: string,
  assignmentId: string,
  employeeId: string,
  roleKey: RoleKey | null,
  toStatus: AssignmentStatus,
  options?: {
    profileId?: string | null;
    skipStatusPersistence?: boolean;
    arrivalOptions?: {
      arrivalMode?: 'gps' | 'without_gps' | 'manual';
      manualReason?: string | null;
    };
  },
): Promise<ServiceResult<EmployeePortalAssignmentDetail>> {
  const denied = enforcePermission<EmployeePortalAssignmentDetail>(roleKey, 'assist.execution.manage');
  if (denied) return denied;

  const existing = await loadEmployeePortalAssignmentDetail(tenantId, assignmentId, employeeId);
  if (!existing.ok) return existing;
  if (!existing.data) return { ok: false, error: 'Einsatz nicht gefunden.' };

  const accessDenied = assertLiveEmployeeAssignmentAccess(tenantId, employeeId, roleKey, existing.data);
  if (accessDenied) return accessDenied;

  const fromStatus = existing.data.assignmentStatus;
  if (fromStatus === toStatus) {
    const extras = await fetchAssignmentExtras(tenantId, assignmentId, existing.data.clientId);
    const docFlags = await resolveEmployeePortalDocumentationFlags(
      tenantId,
      assignmentId,
      fromStatus,
      existing.data.documentationNotes,
      employeeId,
    );
    return {
      ok: true,
      data: mapDetailToPortal(existing.data, roleKey, employeeId, undefined, {
        ...extras,
        requiresSignature: docFlags.requiresSignature,
        requiresDocumentation: docFlags.requiresDocumentation,
        signatureStatus: docFlags.signatureStatus,
      }),
    };
  }

  const docFlagsForValidation = await resolveEmployeePortalDocumentationFlags(
    tenantId,
    assignmentId,
    existing.data.assignmentStatus,
    existing.data.documentationNotes,
    employeeId,
  );
  const hasPersistedSignature = await hasPortalPersistedClientSignature(
    tenantId,
    assignmentId,
    employeeId,
  );

  const validation = validateExecutionTransition(existing.data.assignmentStatus, toStatus, {
    requireArrivedBeforeStart: true,
    hasDocumentation: Boolean(existing.data.documentationNotes?.trim()),
    hasRequiredSignature:
      !docFlagsForValidation.requiresSignature || hasPersistedSignature,
    signatureImpossibleJustified: false,
  });
  if (!validation.valid) return { ok: false, error: validation.error };

  // Assignments table is source of truth for portal execution (RLS + set_assignment_status RPC).
  const updated = await assignmentSupabaseRepository.updateStatus(
    tenantId,
    assignmentId,
    toStatus,
    {
      actorProfileId: options?.profileId ?? null,
      actorEmployeeId: employeeId,
    },
  );
  if (!updated.ok) return updated;
  let detailAfterUpdate: AssignmentDetail = updated.data;

  applyEmployeePortalTrackingForStatus(tenantId, assignmentId, fromStatus, toStatus);
  if (!options?.skipStatusPersistence) {
    const entry = peekEmployeePortalTrackingEntry(tenantId, assignmentId);
    await persistEmployeePortalStatusTransition(
      {
        tenantId,
        assignmentId,
        employeeId,
        profileId: options?.profileId ?? null,
        locationAddress: detailAfterUpdate.location,
      },
      fromStatus,
      toStatus,
      entry.geofenceLastCheck,
      options?.arrivalOptions,
    );
  }

  await mirrorAssistVisitStatusFromAssignment(
    tenantId,
    assignmentId,
    toStatus,
    options?.profileId ?? null,
  );

  const visitRow = await visitSupabaseRepository.getById(tenantId, assignmentId);
  if (visitRow.ok && visitRow.data) {
    const reloaded = await loadEmployeePortalAssignmentDetail(tenantId, assignmentId, employeeId);
    if (reloaded.ok && reloaded.data) detailAfterUpdate = reloaded.data;
  }

  const extras = await fetchAssignmentExtras(tenantId, assignmentId, detailAfterUpdate.clientId);
  const docFlags = await resolveEmployeePortalDocumentationFlags(
    tenantId,
    assignmentId,
    detailAfterUpdate.assignmentStatus,
    detailAfterUpdate.documentationNotes,
    employeeId,
  );
  return {
    ok: true,
    data: mapDetailToPortal(detailAfterUpdate, roleKey, employeeId, undefined, {
      ...extras,
      requiresSignature: docFlags.requiresSignature,
      requiresDocumentation: docFlags.requiresDocumentation,
      signatureStatus: docFlags.signatureStatus,
    }),
  };
}

export async function updateLiveEmployeePortalTask(
  tenantId: string,
  assignmentId: string,
  employeeId: string,
  roleKey: RoleKey | null,
  taskId: string,
  status: ExtendedAssignmentTaskStatus,
  completionNote?: string,
): Promise<ServiceResult<EmployeePortalAssignmentDetail>> {
  const denied = enforcePermission<EmployeePortalAssignmentDetail>(roleKey, 'assist.execution.manage');
  if (denied) return denied;

  if (taskStatusRequiresNote(status as AssignmentStatus) && !completionNote?.trim()) {
    return { ok: false, error: 'Abweichung erfordert eine Begründung.' };
  }

  const existing = await loadEmployeePortalAssignmentDetail(tenantId, assignmentId, employeeId);
  if (!existing.ok) return existing;
  if (!existing.data) return { ok: false, error: 'Einsatz nicht gefunden.' };

  const accessDenied = assertLiveEmployeeAssignmentAccess(tenantId, employeeId, roleKey, existing.data);
  if (accessDenied) return accessDenied;

  const taskStatus =
    status === 'done' ? 'done' : status === 'not_done' ? 'not_done' : (status as 'open' | 'skipped');
  const updated = await assignmentSupabaseRepository.updateTask(
    tenantId,
    assignmentId,
    taskId,
    taskStatus,
    completionNote,
    { actorProfileId: employeeId, actorEmployeeId: employeeId },
  );
  if (!updated.ok) return updated;

  const extras = await fetchAssignmentExtras(tenantId, assignmentId, updated.data.clientId);
  const docFlags = await resolveEmployeePortalDocumentationFlags(
    tenantId,
    assignmentId,
    updated.data.assignmentStatus,
    updated.data.documentationNotes,
    employeeId,
  );
  return {
    ok: true,
    data: mapDetailToPortal(updated.data, roleKey, employeeId, undefined, {
      ...extras,
      requiresSignature: docFlags.requiresSignature,
      requiresDocumentation: docFlags.requiresDocumentation,
      signatureStatus: docFlags.signatureStatus,
    }),
  };
}

export async function updateLiveEmployeePortalTasksBatch(
  tenantId: string,
  assignmentId: string,
  employeeId: string,
  roleKey: RoleKey | null,
  updates: Array<{
    taskId: string;
    status: ExtendedAssignmentTaskStatus;
    completionNote?: string;
  }>,
): Promise<ServiceResult<EmployeePortalAssignmentDetail>> {
  const denied = enforcePermission<EmployeePortalAssignmentDetail>(roleKey, 'assist.execution.manage');
  if (denied) return denied;
  if (!updates.length) {
    return fetchLiveEmployeePortalAssignmentDetail(tenantId, assignmentId, employeeId, roleKey);
  }

  const existing = await loadEmployeePortalAssignmentDetail(tenantId, assignmentId, employeeId);
  if (!existing.ok) return existing;
  if (!existing.data) return { ok: false, error: 'Einsatz nicht gefunden.' };

  const accessDenied = assertLiveEmployeeAssignmentAccess(tenantId, employeeId, roleKey, existing.data);
  if (accessDenied) return accessDenied;

  for (const item of updates) {
    if (taskStatusRequiresNote(item.status as AssignmentStatus) && !item.completionNote?.trim()) {
      return { ok: false, error: 'Abweichung erfordert eine Begründung.' };
    }
  }

  const mapped = updates.map((item) => ({
    taskId: item.taskId,
    status:
      item.status === 'done'
        ? 'done'
        : item.status === 'not_done'
          ? 'not_done'
          : (item.status as 'open' | 'skipped'),
    notDoneReason: item.completionNote,
  }));

  const updated = await assignmentSupabaseRepository.updateTasksBatch(
    tenantId,
    assignmentId,
    mapped,
    { actorProfileId: employeeId, actorEmployeeId: employeeId },
  );
  if (!updated.ok) return updated;

  const extras = await fetchAssignmentExtras(tenantId, assignmentId, updated.data.clientId);
  const docFlags = await resolveEmployeePortalDocumentationFlags(
    tenantId,
    assignmentId,
    updated.data.assignmentStatus,
    updated.data.documentationNotes,
    employeeId,
  );
  return {
    ok: true,
    data: mapDetailToPortal(updated.data, roleKey, employeeId, undefined, {
      ...extras,
      requiresSignature: docFlags.requiresSignature,
      requiresDocumentation: docFlags.requiresDocumentation,
      signatureStatus: docFlags.signatureStatus,
    }),
  };
}

export async function fetchLiveEmployeePortalOverviewFromAppointments(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<EmployeePortalOverview>> {
  return fetchLiveEmployeePortalOverview(tenantId, employeeId);
}

export { buildEmployeePortalOverviewFromAppointments };
