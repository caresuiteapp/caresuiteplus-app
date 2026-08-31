import type { RoleKey, ServiceResult } from '@/types';
import type { AssignmentStatus, AssignmentTaskStatus } from '@/types/modules/assignmentStatus';
import type { CanonicalAssignmentStatus } from '@/types/modules/assignmentWorkflow';
import type { ExtendedAssignmentTaskStatus } from '@/types/modules/assignmentWorkflow';
import type {
  EmployeePortalAssignmentDetail,
  EmployeePortalOverview,
  EmployeePortalTaskItem,
} from '@/types/modules/employeePortalExecution';
import {
  assignmentSupabaseRepository,
  assignmentStatusToWorkflowFilter,
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
import { resolveExecutableVisitId } from '@/lib/assist/visitService';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';
import { scheduleDeferredTask } from '@/lib/async/deferredTask';
import {
  resolveEmployeePortalDocumentationFlags,
} from './resolveEmployeePortalSignatureRequirement';
import { enrichPortalTaskCategory } from './enrichPortalTaskCategory';
import { isEmployeePortalAssignmentLocked } from './employeePortalAssignmentCompletion';

function mapTask(task: AssignmentTaskItem): EmployeePortalTaskItem {
  return enrichPortalTaskCategory({
    id: task.id,
    title: task.title,
    description: '',
    required: task.isRequired,
    status: task.status as ExtendedAssignmentTaskStatus,
    completionNote: task.notDoneReason,
    requiresNote: task.requiresNoteIfNotDone,
    categoryKey: task.categoryKey ?? null,
    categoryLabel: task.categoryLabel ?? null,
  });
}

function toPersistedTaskStatus(status: ExtendedAssignmentTaskStatus): AssignmentTaskStatus {
  if (status === 'done' || status === 'open' || status === 'cancelled') return status;
  if (status === 'not_requested' || status === 'not_wanted' || status === 'skipped') {
    return 'not_requested';
  }
  return 'not_done';
}

function mapPortalDetailToAssignmentDetail(
  detail: EmployeePortalAssignmentDetail,
  employeeId: string,
): AssignmentDetail {
  const now = new Date().toISOString();
  return {
    id: detail.assignmentId,
    tenantId: detail.tenantId,
    createdAt: now,
    updatedAt: now,
    visibility: 'own',
    sensitivity: 'care',
    clientId: detail.clientId,
    employeeId,
    appointmentId: null,
    title: detail.title,
    scheduledStart: detail.plannedStartAt,
    scheduledEnd: detail.plannedEndAt,
    status: assignmentStatusToWorkflowFilter(detail.status),
    location: detail.locationAddress,
    notes: detail.notesForEmployee || null,
    clientName: detail.clientName,
    employeeName: '',
    allowedStatusActions: [],
    allowedStatusTransitions: detail.allowedTransitions,
    assignmentStatus: detail.status,
    tasks: detail.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: toPersistedTaskStatus(task.status),
      isRequired: task.required,
      notDoneReason: task.completionNote,
      requiresNoteIfNotDone: task.requiresNote,
      categoryKey: task.categoryKey ?? null,
      categoryLabel: task.categoryLabel ?? null,
    })),
    onTheWayAt: detail.onTheWayAt,
    arrivedAt: detail.arrivedAt,
    finishedAt: detail.status === 'abgeschlossen' ? detail.actualEndAt : null,
    documentationNotes: detail.documentationNotes ?? null,
    plannedStartAt: detail.plannedStartAt,
    plannedEndAt: detail.plannedEndAt,
    actualStartAt: detail.actualStartAt,
    actualEndAt: detail.actualEndAt,
  };
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
    requiresRoute?: boolean;
    signatureStatus?: EmployeePortalAssignmentDetail['signatureStatus'];
    clientPortalSignatureCompleted?: boolean;
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
    documentationNotes: docNotes || null,
    signatureStatus,
    requiresSignature,
    requiresDocumentation,
    clientPortalSignatureCompleted: extras?.clientPortalSignatureCompleted ?? false,
    requiresRoute: extras?.requiresRoute ?? Boolean(detail.location?.trim()),
    canStartExecution: canStart.allowed && !isAssignmentLocked(status),
    canOpenRoute: Boolean(detail.location?.trim()),
    canCaptureGps: canCaptureGps(roleKey),
    allowedTransitions: getAllowedAssignmentTransitions(status),
    isLocked: isEmployeePortalAssignmentLocked({
      status,
      requiresDocumentation,
      requiresSignature,
      documentationStatus,
      signatureStatus,
    }),
    enabledModules: resolveEnabledExecutionModules(roleKey, tenantModules),
  };
}

async function fetchAssignmentExtras(
  tenantId: string,
  assignmentId: string,
  clientId: string,
): Promise<{
  notesForEmployee: string | null;
  accessHints: string | null;
  emergencyContact: string | null;
  requiresRoute?: boolean;
}> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { notesForEmployee: null, accessHints: null, emergencyContact: null };
  }

  const [assignmentResult, clientResult, ambulatoryResult, preferencesResult, risksResult, contactResult] = await Promise.all([
    fromUnknownTable(supabase, 'assignments')
      .select('description, internal_notes, operational_context, address_snapshot')
      .eq('tenant_id', tenantId)
      .eq('id', resolveVisitMasterId(assignmentId))
      .maybeSingle(),
    fromUnknownTable(supabase, 'clients')
      .select(
        'visible_notes_for_employee, emergency_notes, allergies, mobility_notes, pets, key_management_notes, internal_notes',
      )
      .eq('tenant_id', tenantId)
      .eq('id', clientId)
      .maybeSingle(),
    fromUnknownTable(supabase, 'client_ambulatory_details')
      .select(
        'home_access, key_status, key_number, key_safe_code, door_code, bell_name, floor, elevator_available, parking_notes, access_notes, hazard_notes, pets, smoker_household, aids_on_site, hygiene_notes, infection_notes',
      )
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .maybeSingle(),
    fromUnknownTable(supabase, 'client_preferences')
      .select('mobility_notes, household_notes, pet_notes, access_instructions')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .maybeSingle(),
    fromUnknownTable(supabase, 'client_risks')
      .select('category, level, description, mitigation, assessed_at')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('assessed_at', { ascending: false }),
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
  const clientRow = clientResult.data as Record<string, unknown> | null;
  const ambulatoryRow = ambulatoryResult.data as Record<string, unknown> | null;
  const preferencesRow = preferencesResult.data as Record<string, unknown> | null;
  const operationalContext =
    assignmentRow?.operational_context
    && typeof assignmentRow.operational_context === 'object'
    && !Array.isArray(assignmentRow.operational_context)
      ? assignmentRow.operational_context as Record<string, unknown>
      : null;
  const operationalRequirements =
    operationalContext?.requirements
    && typeof operationalContext.requirements === 'object'
    && !Array.isArray(operationalContext.requirements)
      ? operationalContext.requirements as Record<string, unknown>
      : null;
  const text = (value: unknown): string | null => {
    const resolved = typeof value === 'string' ? value.trim() : '';
    return resolved || null;
  };
  const section = (label: string, value: unknown): string | null => {
    const resolved = text(value);
    return resolved ? `${label}: ${resolved}` : null;
  };
  const compactSections = (parts: (string | null | undefined)[]): string | null => {
    const seen = new Set<string>();
    const unique = parts.filter((part): part is string => {
      const resolved = part?.trim();
      if (!resolved || seen.has(resolved)) return false;
      seen.add(resolved);
      return true;
    });
    return unique.length ? unique.join('\n\n') : null;
  };

  const risks = !risksResult.error && Array.isArray(risksResult.data)
    ? (risksResult.data as Record<string, unknown>[]).map((risk) => {
        const category = text(risk.category)?.toUpperCase() ?? 'RISIKO';
        const level = text(risk.level)?.toUpperCase();
        const description = text(risk.description);
        const mitigation = text(risk.mitigation);
        if (!description) return null;
        return `${category}${level ? ` · ${level}` : ''}: ${description}${
          mitigation ? ` — Maßnahme: ${mitigation}` : ''
        }`;
      }).filter((value): value is string => Boolean(value))
    : [];

  // Bei neuen Einsätzen ist `operational_context` der unveränderliche Snapshot
  // zum Freigabezeitpunkt. Für ältere Einsätze werden die aktuellen Aktenwerte
  // als sichere Rückwärtskompatibilität verwendet.
  const snapshotEmployeeNotes = text(operationalContext?.employeeNotes);
  const liveEmployeeNotes = compactSections([
    risks.length ? `RISIKEN\n${risks.join('\n')}` : null,
    section('Notfall-/Risikohinweis', clientRow?.emergency_notes),
    section('Gefahren im Haushalt', ambulatoryRow?.hazard_notes),
    ambulatoryRow?.smoker_household === true ? 'Raucherhaushalt: Ja' : null,
    section('Hilfsmittel vor Ort', ambulatoryRow?.aids_on_site),
    section('Hygienehinweis', ambulatoryRow?.hygiene_notes),
    section('Infektionshinweis', ambulatoryRow?.infection_notes),
    section('Allergien', clientRow?.allergies),
    section('Mobilität', clientRow?.mobility_notes ?? preferencesRow?.mobility_notes),
    section('Haustiere', clientRow?.pets ?? ambulatoryRow?.pets ?? preferencesRow?.pet_notes),
    section('Haushalt', preferencesRow?.household_notes),
    section('Hinweis für Mitarbeitende', clientRow?.visible_notes_for_employee),
    section('Interner Aktenhinweis', clientRow?.internal_notes),
  ]);
  const notesForEmployee =
    snapshotEmployeeNotes
    ?? compactSections([
      text(assignmentRow?.description),
      text(assignmentRow?.internal_notes),
      liveEmployeeNotes,
    ]);

  const snapshotAccess = text(operationalContext?.accessAndKeys);
  const accessHints = snapshotAccess ?? compactSections([
    section('Schlüsselhinweis', clientRow?.key_management_notes),
    section('Hauszugang', ambulatoryRow?.home_access),
    section('Schlüsselstatus', ambulatoryRow?.key_status),
    section('Schlüsselnummer', ambulatoryRow?.key_number),
    section('Schlüsseltresor', ambulatoryRow?.key_safe_code),
    section('Türcode', ambulatoryRow?.door_code),
    section('Klingel', ambulatoryRow?.bell_name),
    section('Etage', ambulatoryRow?.floor),
    section('Parken', ambulatoryRow?.parking_notes),
    section('Zugang', ambulatoryRow?.access_notes),
    section('Zugangsablauf', preferencesRow?.access_instructions),
  ]);

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
    notesForEmployee,
    accessHints,
    emergencyContact,
    requiresRoute:
      typeof operationalRequirements?.route === 'boolean'
        ? operationalRequirements.route
        : undefined,
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

  // Keep rpc attached to the Supabase client. Extracting `supabase.rpc` into a
  // standalone function loses its `this` binding and crashes WebKit with
  // "undefined is not an object (evaluating 'this.rest')" after the assignment
  // status has already been persisted.
  const { error } = await (supabase.rpc(
    'repair_assist_visit_workflow_status' as never,
    {
      p_tenant_id: tenantId,
      p_assignment_id: assignmentId,
      p_target_status: targetStatus,
      p_reason: 'portal_execution_status_mirror',
      p_actor_employee_id: actorProfileId ?? null,
    } as never,
  ) as unknown as Promise<{ error: { message: string } | null }>);

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

  return runService<EmployeePortalAssignmentDetail>(async () => {
    // A concrete series date must have its own visit/assignment row. Repair older virtual
    // occurrences lazily when they are opened, then use that row for every following read.
    let executableAssignmentId = assignmentId;
    if (assignmentId.includes('::')) {
      const executable = await resolveExecutableVisitId(tenantId, assignmentId, roleKey);
      if (executable.ok) {
        executableAssignmentId = executable.data.visitId;
      } else {
        console.warn('[employeePortalExecutionLiveService] series occurrence materialization:', executable.error);
        return {
          ok: false,
          error:
            'Dieser Serientermin konnte nicht als eigener Einsatz vorbereitet werden. '
            + 'Bitte erneut laden; der vorherige Termin wurde nicht verändert.',
        };
      }
    }

    const loaded = await loadEmployeePortalAssignmentDetail(
      tenantId,
      executableAssignmentId,
      employeeId,
    );
    if (!loaded.ok) return loaded;
    if (!loaded.data) return { ok: false, error: 'Einsatz nicht gefunden.' };

    const accessDenied = assertLiveEmployeeAssignmentAccess(tenantId, employeeId, roleKey, loaded.data);
    if (accessDenied) return accessDenied;

    // Notes, emergency contacts and signature/proof metadata enrich the execution view, but they
    // are not prerequisites for opening or executing an assigned visit. In particular, virtual
    // recurring occurrences can temporarily have no standalone proof/tracking rows yet. A failed
    // optional read must therefore never push a live visit into the offline/read-only fallback.
    const [extrasResult, docFlagsResult] = await Promise.allSettled([
      fetchAssignmentExtras(tenantId, executableAssignmentId, loaded.data.clientId),
      resolveEmployeePortalDocumentationFlags(
        tenantId,
        executableAssignmentId,
        loaded.data.assignmentStatus,
        loaded.data.documentationNotes,
        employeeId,
      ),
    ]);

    if (extrasResult.status === 'rejected') {
      console.warn('[employeePortalExecutionLiveService] optional assignment extras unavailable');
    }
    if (docFlagsResult.status === 'rejected') {
      console.warn('[employeePortalExecutionLiveService] optional signature metadata unavailable');
    }

    const extras =
      extrasResult.status === 'fulfilled'
        ? extrasResult.value
        : { notesForEmployee: null, accessHints: null, emergencyContact: null };
    const fallbackRequiresSignature = loaded.data.assignmentStatus === 'unterschrift_offen';
    const docFlags =
      docFlagsResult.status === 'fulfilled'
        ? docFlagsResult.value
        : {
            requiresSignature: fallbackRequiresSignature,
            requiresDocumentation: true,
            signatureStatus: fallbackRequiresSignature ? ('pending' as const) : ('none' as const),
            signatureCapturedViaClientPortal: false,
          };
    return {
      ok: true,
      data: mapDetailToPortal(loaded.data, roleKey, employeeId, tenantModules, {
        ...extras,
        requiresSignature: docFlags.requiresSignature,
        requiresDocumentation: docFlags.requiresDocumentation,
        signatureStatus: docFlags.signatureStatus,
        clientPortalSignatureCompleted: docFlags.signatureCapturedViaClientPortal === true,
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
    executionTransition?: {
      hasDocumentation?: boolean;
      hasRequiredSignature?: boolean;
      signatureDeferredToClientPortal?: boolean;
    };
    /** Employee tap: wait only for authoritative assignment persistence. */
    fastWorkflow?: boolean;
    /** RLS-scoped detail already loaded by the execution screen. */
    knownDetail?: EmployeePortalAssignmentDetail;
  },
): Promise<ServiceResult<EmployeePortalAssignmentDetail>> {
  const denied = enforcePermission<EmployeePortalAssignmentDetail>(roleKey, 'assist.execution.manage');
  if (denied) return denied;

  const executable = options?.knownDetail
    ? { ok: true as const, data: { visitId: options.knownDetail.assignmentId } }
    : await resolveExecutableVisitId(tenantId, assignmentId, roleKey);
  if (!executable.ok) return executable;
  const executableAssignmentId = executable.data.visitId;

  const existing = options?.knownDetail
    ? {
        ok: true as const,
        data: mapPortalDetailToAssignmentDetail(options.knownDetail, employeeId),
      }
    : await loadEmployeePortalAssignmentDetail(
        tenantId,
        executableAssignmentId,
        employeeId,
      );
  if (!existing.ok) return existing;
  if (!existing.data) return { ok: false, error: 'Einsatz nicht gefunden.' };

  const accessDenied = assertLiveEmployeeAssignmentAccess(tenantId, employeeId, roleKey, existing.data);
  if (accessDenied) return accessDenied;
  const persistentAssignmentId = existing.data.id;

  const fromStatus = existing.data.assignmentStatus;
  if (fromStatus === toStatus) {
    if (options?.fastWorkflow) {
      return {
        ok: true,
        data: mapDetailToPortal(existing.data, roleKey, employeeId),
      };
    }
    const [extras, docFlags] = await Promise.all([
      fetchAssignmentExtras(tenantId, executableAssignmentId, existing.data.clientId),
      resolveEmployeePortalDocumentationFlags(
        tenantId,
        executableAssignmentId,
        fromStatus,
        existing.data.documentationNotes,
        employeeId,
      ),
    ]);
    return {
      ok: true,
      data: mapDetailToPortal(existing.data, roleKey, employeeId, undefined, {
        ...extras,
        requiresSignature: docFlags.requiresSignature,
        requiresDocumentation: docFlags.requiresDocumentation,
        signatureStatus: docFlags.signatureStatus,
        clientPortalSignatureCompleted: docFlags.signatureCapturedViaClientPortal === true,
      }),
    };
  }

  // Optional display data and workflow requirements share the same assignment
  // snapshot and can be loaded concurrently. The documentation resolver already
  // verifies a persisted signature, so the former second signature lookup was
  // redundant on every mobile action.
  const [extras, docFlagsForValidation] = options?.fastWorkflow
    ? [
        { notesForEmployee: null, accessHints: null, emergencyContact: null },
        {
          requiresSignature: false,
          requiresDocumentation: true,
          signatureStatus: 'none' as const,
          signatureCapturedViaClientPortal: false,
        },
      ]
    : await Promise.all([
        fetchAssignmentExtras(tenantId, executableAssignmentId, existing.data.clientId),
        resolveEmployeePortalDocumentationFlags(
          tenantId,
          executableAssignmentId,
          existing.data.assignmentStatus,
          existing.data.documentationNotes,
          employeeId,
        ),
      ]);
  const hasPersistedSignature = docFlagsForValidation.signatureStatus === 'captured';

  const validation = validateExecutionTransition(existing.data.assignmentStatus, toStatus, {
    requireArrivedBeforeStart: true,
    hasDocumentation:
      options?.executionTransition?.hasDocumentation ??
      Boolean(existing.data.documentationNotes?.trim()),
    hasRequiredSignature:
      options?.executionTransition?.signatureDeferredToClientPortal === true
        ? true
        : options?.executionTransition?.hasRequiredSignature ??
          (!docFlagsForValidation.requiresSignature || hasPersistedSignature),
    signatureDeferredToClientPortal:
      options?.executionTransition?.signatureDeferredToClientPortal,
    signatureImpossibleJustified: false,
  });
  if (!validation.valid) return { ok: false, error: validation.error };

  // Assignments table is source of truth for portal execution (RLS + set_assignment_status RPC).
  const updated = await assignmentSupabaseRepository.updateStatus(
    tenantId,
    persistentAssignmentId,
    toStatus,
    {
      actorProfileId: options?.profileId ?? undefined,
      actorEmployeeId: employeeId,
      knownExistingDetail: existing.data,
      fastWorkflow: options?.fastWorkflow,
    },
  );
  if (!updated.ok) return updated;
  const detailAfterUpdate: AssignmentDetail = updated.data;

  applyEmployeePortalTrackingForStatus(tenantId, persistentAssignmentId, fromStatus, toStatus);
  if (!options?.skipStatusPersistence) {
    const entry = peekEmployeePortalTrackingEntry(tenantId, persistentAssignmentId);
    await persistEmployeePortalStatusTransition(
      {
        tenantId,
        assignmentId: persistentAssignmentId,
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

  if (options?.fastWorkflow) {
    scheduleDeferredTask(
      `assist-status:${tenantId}:${persistentAssignmentId}`,
      async () => {
        const mirrored = await mirrorAssistVisitStatusFromAssignment(
          tenantId,
          persistentAssignmentId,
          toStatus,
          options?.profileId ?? null,
        );
        if (!mirrored.ok) throw new Error(mirrored.error);
      },
    );
  } else {
    const mirrored = await mirrorAssistVisitStatusFromAssignment(
      tenantId,
      persistentAssignmentId,
      toStatus,
      options?.profileId ?? null,
    );
    if (!mirrored.ok) {
      return {
        ok: false,
        error:
          mirrored.error ??
          'Einsatzstatus wurde gespeichert, aber nicht in den Live-Monitor übertragen.',
      };
    }
  }

  // updateStatus already performs the authoritative post-write readback. Do not
  // reload the visit, assignment, extras and proof metadata a second time here.
  const requiresSignature =
    docFlagsForValidation.requiresSignature || toStatus === 'unterschrift_offen';
  const signatureStatus = !requiresSignature
    ? ('none' as const)
    : docFlagsForValidation.signatureStatus === 'captured' ||
        docFlagsForValidation.signatureStatus === 'deferred_to_client_portal'
      ? docFlagsForValidation.signatureStatus
      : toStatus === 'unterschrift_offen'
        ? ('pending' as const)
        : docFlagsForValidation.signatureStatus;
  return {
    ok: true,
    data: mapDetailToPortal(detailAfterUpdate, roleKey, employeeId, undefined, {
      ...extras,
      requiresSignature,
      requiresDocumentation: docFlagsForValidation.requiresDocumentation,
      signatureStatus,
      clientPortalSignatureCompleted:
        docFlagsForValidation.signatureCapturedViaClientPortal === true,
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
  const persistentAssignmentId = existing.data.id;

  const taskStatus = toPersistedTaskStatus(status);
  const updated = await assignmentSupabaseRepository.updateTask(
    tenantId,
    persistentAssignmentId,
    taskId,
    taskStatus,
    completionNote,
    { actorProfileId: employeeId, actorEmployeeId: employeeId },
  );
  if (!updated.ok) return updated;

  const extras = await fetchAssignmentExtras(tenantId, persistentAssignmentId, updated.data.clientId);
  const docFlags = await resolveEmployeePortalDocumentationFlags(
    tenantId,
    persistentAssignmentId,
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
      clientPortalSignatureCompleted: docFlags.signatureCapturedViaClientPortal === true,
    }),
  };
}

export async function updateLiveEmployeePortalTasksBatch(
  tenantId: string,
  assignmentId: string,
  employeeId: string,
  roleKey: RoleKey | null,
  updates: {
    taskId: string;
    status: ExtendedAssignmentTaskStatus;
    completionNote?: string;
  }[],
  knownDetail?: EmployeePortalAssignmentDetail,
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
  const persistentAssignmentId = existing.data.id;

  for (const item of updates) {
    if (taskStatusRequiresNote(item.status as AssignmentStatus) && !item.completionNote?.trim()) {
      return { ok: false, error: 'Abweichung erfordert eine Begründung.' };
    }
  }

  const mapped: {
    taskId: string;
    status: AssignmentTaskStatus;
    notDoneReason?: string;
  }[] = updates.map((item) => ({
    taskId: item.taskId,
    status: toPersistedTaskStatus(item.status),
    notDoneReason: item.completionNote,
  }));

  const updated = await assignmentSupabaseRepository.updateTasksBatch(
    tenantId,
    persistentAssignmentId,
    mapped,
    { actorProfileId: employeeId, actorEmployeeId: employeeId },
  );
  if (!updated.ok) return updated;

  if (knownDetail) {
    const updatesById = new Map(updates.map((item) => [item.taskId, item]));
    return {
      ok: true,
      // All non-task fields are unchanged by this command. Reusing the known,
      // already authorized portal detail avoids extra reads for assignment
      // extras and document flags after every task tap.
      data: {
        ...knownDetail,
        tasks: knownDetail.tasks.map((task) => {
          const taskUpdate = updatesById.get(task.id);
          if (!taskUpdate) return task;
          return {
            ...task,
            status: taskUpdate.status,
            completionNote: taskUpdate.completionNote?.trim() || null,
          };
        }),
      },
    };
  }

  const extras = await fetchAssignmentExtras(tenantId, persistentAssignmentId, updated.data.clientId);
  const docFlags = await resolveEmployeePortalDocumentationFlags(
    tenantId,
    persistentAssignmentId,
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
      clientPortalSignatureCompleted: docFlags.signatureCapturedViaClientPortal === true,
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
