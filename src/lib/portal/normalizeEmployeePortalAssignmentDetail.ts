import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type {
  CanonicalAssignmentStatus,
  ExtendedAssignmentTaskStatus,
} from '@/types/modules/assignmentWorkflow';
import type {
  EmployeePortalAssignmentDetail,
  EmployeePortalExecutionModule,
  EmployeePortalPauseEvent,
  EmployeePortalStatusHistoryEntry,
  EmployeePortalTaskItem,
} from '@/types/modules/employeePortalExecution';

const ASSIGNMENT_STATUSES = new Set<AssignmentStatus>([
  'geplant',
  'bestaetigt',
  'unterwegs',
  'angekommen',
  'gestartet',
  'pausiert',
  'beendet',
  'dokumentation_offen',
  'unterschrift_offen',
  'abgeschlossen',
  'storniert',
  'nicht_erschienen',
]);

const CANONICAL_STATUSES = new Set<CanonicalAssignmentStatus>([
  'planned',
  'assigned',
  'confirmed',
  'on_the_way',
  'arrived',
  'started',
  'paused',
  'resumed',
  'finished',
  'documentation_pending',
  'signature_pending',
  'completed',
  'cancel_requested',
  'reschedule_requested',
  'cancelled',
  'no_show',
  'missed',
  'corrected',
  'locked',
]);

const TASK_STATUSES = new Set<ExtendedAssignmentTaskStatus>([
  'open',
  'done',
  'not_done',
  'not_requested',
  'cancelled',
  'not_wanted',
  'not_possible',
  'skipped',
  'requires_follow_up',
]);

const EXECUTION_MODULES = new Set<EmployeePortalExecutionModule>([
  'sis',
  'vitals',
  'medication',
  'care_report',
  'photos',
]);

const DOCUMENTATION_STATUSES = new Set<EmployeePortalAssignmentDetail['documentationStatus']>([
  'none',
  'draft',
  'submitted',
  'locked',
]);

const SIGNATURE_STATUSES = new Set<EmployeePortalAssignmentDetail['signatureStatus']>([
  'none',
  'pending',
  'captured',
  'administrative_approval_pending',
  'administratively_rejected',
  'deferred_to_client_portal',
  'impossible_justified',
  'locked',
]);

const CANONICAL_BY_STATUS: Record<AssignmentStatus, CanonicalAssignmentStatus> = {
  geplant: 'planned',
  bestaetigt: 'confirmed',
  unterwegs: 'on_the_way',
  angekommen: 'arrived',
  gestartet: 'started',
  pausiert: 'paused',
  beendet: 'finished',
  dokumentation_offen: 'documentation_pending',
  unterschrift_offen: 'signature_pending',
  abgeschlossen: 'completed',
  storniert: 'cancelled',
  nicht_erschienen: 'no_show',
};

type DetailFallback = {
  assignmentId?: string;
  tenantId?: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function string(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function boolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function assignmentStatus(value: unknown): AssignmentStatus {
  return ASSIGNMENT_STATUSES.has(value as AssignmentStatus)
    ? value as AssignmentStatus
    : 'bestaetigt';
}

function task(value: unknown, index: number): EmployeePortalTaskItem {
  const source = record(value);
  const status = TASK_STATUSES.has(source.status as ExtendedAssignmentTaskStatus)
    ? source.status as ExtendedAssignmentTaskStatus
    : 'open';
  return {
    id: string(source.id, `task-${index + 1}`),
    title: string(source.title, 'Aufgabe'),
    description: string(source.description),
    // Tasks are optional guidance in the employee workflow. Documentation and
    // signature remain the completion gates.
    required: false,
    status,
    completionNote: nullableString(source.completionNote),
    requiresNote: boolean(source.requiresNote),
    categoryKey: nullableString(source.categoryKey),
    categoryLabel: nullableString(source.categoryLabel),
  };
}

function historyEntry(value: unknown, index: number): EmployeePortalStatusHistoryEntry | null {
  const source = record(value);
  if (!ASSIGNMENT_STATUSES.has(source.toStatus as AssignmentStatus)) return null;
  return {
    id: string(source.id, `history-${index + 1}`),
    fromStatus: ASSIGNMENT_STATUSES.has(source.fromStatus as AssignmentStatus)
      ? source.fromStatus as AssignmentStatus
      : null,
    toStatus: source.toStatus as AssignmentStatus,
    note: nullableString(source.note),
    actorId: nullableString(source.actorId),
    createdAt: string(source.createdAt),
  };
}

function pauseEvent(value: unknown, index: number): EmployeePortalPauseEvent | null {
  const source = record(value);
  const pausedAt = string(source.pausedAt);
  if (!pausedAt) return null;
  return {
    id: string(source.id, `pause-${index + 1}`),
    pausedAt,
    resumedAt: nullableString(source.resumedAt),
    reason: nullableString(source.reason),
  };
}

/**
 * Treats Supabase and persisted cache payloads as untrusted runtime data.
 * A stale/null field must never crash the active employee visit screen.
 */
export function normalizeEmployeePortalAssignmentDetail(
  value: unknown,
  fallback: DetailFallback = {},
): EmployeePortalAssignmentDetail {
  const source = record(value);
  const status = assignmentStatus(source.status);
  const canonicalStatus = CANONICAL_STATUSES.has(source.canonicalStatus as CanonicalAssignmentStatus)
    ? source.canonicalStatus as CanonicalAssignmentStatus
    : CANONICAL_BY_STATUS[status];
  const documentationStatus = DOCUMENTATION_STATUSES.has(
    source.documentationStatus as EmployeePortalAssignmentDetail['documentationStatus'],
  )
    ? source.documentationStatus as EmployeePortalAssignmentDetail['documentationStatus']
    : 'none';
  const signatureStatus = SIGNATURE_STATUSES.has(
    source.signatureStatus as EmployeePortalAssignmentDetail['signatureStatus'],
  )
    ? source.signatureStatus as EmployeePortalAssignmentDetail['signatureStatus']
    : 'none';

  return {
    assignmentId: string(source.assignmentId, fallback.assignmentId ?? ''),
    tenantId: string(source.tenantId, fallback.tenantId ?? ''),
    title: string(source.title, 'Einsatz'),
    clientId: string(source.clientId),
    clientName: string(source.clientName, 'Klient:in'),
    locationAddress: string(source.locationAddress),
    plannedStartAt: string(source.plannedStartAt),
    plannedEndAt: string(source.plannedEndAt),
    actualStartAt: nullableString(source.actualStartAt),
    actualEndAt: nullableString(source.actualEndAt),
    onTheWayAt: nullableString(source.onTheWayAt),
    arrivedAt: nullableString(source.arrivedAt),
    status,
    canonicalStatus,
    notesForEmployee: string(source.notesForEmployee),
    accessHints: nullableString(source.accessHints),
    emergencyContact: nullableString(source.emergencyContact),
    tasks: (Array.isArray(source.tasks) ? source.tasks : []).map(task),
    statusHistory: (Array.isArray(source.statusHistory) ? source.statusHistory : [])
      .map(historyEntry)
      .filter((entry): entry is EmployeePortalStatusHistoryEntry => entry !== null),
    pauseEvents: (Array.isArray(source.pauseEvents) ? source.pauseEvents : [])
      .map(pauseEvent)
      .filter((entry): entry is EmployeePortalPauseEvent => entry !== null),
    documentationStatus,
    documentationNotes: nullableString(source.documentationNotes),
    signatureStatus,
    requiresSignature: boolean(source.requiresSignature),
    requiresDocumentation: boolean(source.requiresDocumentation, true),
    requiresRoute: boolean(source.requiresRoute, Boolean(string(source.locationAddress).trim())),
    clientPortalSignatureCompleted: boolean(source.clientPortalSignatureCompleted),
    canStartExecution: boolean(source.canStartExecution, true),
    canOpenRoute: boolean(source.canOpenRoute, Boolean(string(source.locationAddress).trim())),
    canCaptureGps: boolean(source.canCaptureGps),
    allowedTransitions: (Array.isArray(source.allowedTransitions) ? source.allowedTransitions : [])
      .filter((entry): entry is AssignmentStatus => ASSIGNMENT_STATUSES.has(entry as AssignmentStatus)),
    isLocked: boolean(source.isLocked),
    enabledModules: (Array.isArray(source.enabledModules) ? source.enabledModules : [])
      .filter((entry): entry is EmployeePortalExecutionModule =>
        EXECUTION_MODULES.has(entry as EmployeePortalExecutionModule)),
  };
}
