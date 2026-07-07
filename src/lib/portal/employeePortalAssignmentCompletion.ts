import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { EmployeePortalAssignmentDetail } from '@/types/modules/employeePortalExecution';

export type EmployeePortalAssignmentPendingInput = {
  status: AssignmentStatus;
  requiresDocumentation?: boolean;
  requiresSignature?: boolean;
  documentationStatus?: EmployeePortalAssignmentDetail['documentationStatus'];
  signatureStatus?: EmployeePortalAssignmentDetail['signatureStatus'];
  /** From assist visit overlay — true when doc/signature/tasks still open. */
  assignmentIncomplete?: boolean;
};

export type EmployeePortalAssignmentPendingFlags = {
  documentationPending: boolean;
  signaturePending: boolean;
};

const TERMINAL_STATUSES = new Set<AssignmentStatus>(['storniert', 'nicht_erschienen']);

const ACTIVE_EMPLOYEE_ASSIGNMENT_STATUSES = new Set<AssignmentStatus>([
  'bestaetigt',
  'unterwegs',
  'angekommen',
  'gestartet',
  'pausiert',
]);

export type EmployeePortalAssignmentNavigationInput = {
  assignmentId: string;
  status: AssignmentStatus;
  documentationPending?: boolean;
  signaturePending?: boolean;
};

/** Route to execution when the employee can still document, sign, or continue an active visit. */
export function shouldNavigateEmployeePortalAssignmentToExecution(
  input: Omit<EmployeePortalAssignmentNavigationInput, 'assignmentId'>,
): boolean {
  if (ACTIVE_EMPLOYEE_ASSIGNMENT_STATUSES.has(input.status)) return true;
  if (input.documentationPending || input.signaturePending) return true;
  if (
    input.status === 'beendet' ||
    input.status === 'dokumentation_offen' ||
    input.status === 'unterschrift_offen'
  ) {
    return true;
  }
  return false;
}

export function resolveEmployeePortalAssignmentNavigationRoute(
  input: EmployeePortalAssignmentNavigationInput,
): string {
  const base = `/portal/employee/assignments/${input.assignmentId}`;
  return shouldNavigateEmployeePortalAssignmentToExecution(input)
    ? `${base}/execute`
    : base;
}

function isDocumentationSatisfied(
  input: Pick<
    EmployeePortalAssignmentPendingInput,
    'requiresDocumentation' | 'documentationStatus'
  >,
): boolean {
  if (!input.requiresDocumentation) return true;
  return input.documentationStatus === 'submitted' || input.documentationStatus === 'locked';
}

function isSignatureSatisfied(
  input: Pick<EmployeePortalAssignmentPendingInput, 'requiresSignature' | 'signatureStatus'>,
): boolean {
  if (!input.requiresSignature) return true;
  return (
    input.signatureStatus === 'captured' ||
    input.signatureStatus === 'locked' ||
    input.signatureStatus === 'impossible_justified' ||
    input.signatureStatus === 'deferred_to_client_portal'
  );
}

/** True when the employee has no remaining documentation or signature work. */
export function isEmployeePortalAssignmentFullyComplete(
  input: EmployeePortalAssignmentPendingInput,
): boolean {
  if (TERMINAL_STATUSES.has(input.status)) return true;
  return isDocumentationSatisfied(input) && isSignatureSatisfied(input);
}

export function resolveEmployeePortalAssignmentPendingFlags(
  input: EmployeePortalAssignmentPendingInput,
): EmployeePortalAssignmentPendingFlags {
  const docSatisfied = isDocumentationSatisfied(input);
  const sigSatisfied = isSignatureSatisfied(input);

  const documentationPending =
    input.status === 'beendet' ||
    input.status === 'dokumentation_offen' ||
    (input.status === 'abgeschlossen' && input.assignmentIncomplete === true) ||
    (input.requiresDocumentation === true && !docSatisfied);

  const signaturePending =
    input.status === 'unterschrift_offen' ||
    (input.status === 'abgeschlossen' && input.assignmentIncomplete === true) ||
    (input.requiresSignature === true && !sigSatisfied);

  return { documentationPending, signaturePending };
}

/** Portal lock: only when cancelled/no-show or truly complete (doc + signature done). */
export function isEmployeePortalAssignmentLocked(
  input: EmployeePortalAssignmentPendingInput,
): boolean {
  if (TERMINAL_STATUSES.has(input.status)) return true;
  if (input.status !== 'abgeschlossen') return false;
  if (input.assignmentIncomplete === true) return false;
  return isEmployeePortalAssignmentFullyComplete(input);
}

export function isEmployeePortalAssignmentEditable(
  input: EmployeePortalAssignmentPendingInput,
): boolean {
  if (TERMINAL_STATUSES.has(input.status)) return false;
  if (isEmployeePortalAssignmentLocked(input)) return false;
  return true;
}

/** Hide from employee portal lists only when assignment is past and fully complete. */
export function shouldShowAssignmentInEmployeePortalList(input: {
  status: AssignmentStatus;
  plannedStartAt: string;
  assignmentIncomplete?: boolean;
  requiresDocumentation?: boolean;
  requiresSignature?: boolean;
  documentationStatus?: EmployeePortalAssignmentDetail['documentationStatus'];
  signatureStatus?: EmployeePortalAssignmentDetail['signatureStatus'];
  now?: Date;
}): boolean {
  if (TERMINAL_STATUSES.has(input.status)) return false;
  if (input.assignmentIncomplete === true) return true;

  const pendingInput: EmployeePortalAssignmentPendingInput = {
    status: input.status,
    requiresDocumentation: input.requiresDocumentation,
    requiresSignature: input.requiresSignature,
    documentationStatus: input.documentationStatus,
    signatureStatus: input.signatureStatus,
    assignmentIncomplete: input.assignmentIncomplete,
  };

  if (!isEmployeePortalAssignmentFullyComplete(pendingInput)) return true;

  if (input.status !== 'abgeschlossen') return true;

  const now = input.now ?? new Date();
  return new Date(input.plannedStartAt).getTime() >= now.getTime();
}
