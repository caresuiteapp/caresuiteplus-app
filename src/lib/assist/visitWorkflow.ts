import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';
import { ALLOWED_TRANSITIONS } from '@/lib/assist/assignmentStatusMachine';
import type {
  VisitBillingStatus,
  VisitDocumentationStatus,
  VisitExecutionStatus,
  VisitPlanningStatus,
  VisitPortalStatus,
  VisitProofStatus,
  VisitStatusDimension,
} from '@/lib/assist/visitTypes';

export const PLANNING_TRANSITIONS: Record<VisitPlanningStatus, VisitPlanningStatus[]> = {
  draft: ['scheduled', 'cancelled'],
  scheduled: ['confirmed', 'at_risk', 'cancelled'],
  confirmed: ['at_risk', 'cancelled'],
  at_risk: ['confirmed', 'cancelled'],
  cancelled: [],
};

export const EXECUTION_TRANSITIONS: Record<VisitExecutionStatus, VisitExecutionStatus[]> = {
  pending: ['on_way', 'cancelled', 'no_show'],
  on_way: ['arrived', 'cancelled'],
  arrived: ['in_progress', 'cancelled'],
  in_progress: ['paused', 'completed', 'cancelled'],
  paused: ['in_progress', 'completed', 'cancelled'],
  completed: [],
  no_show: [],
  cancelled: [],
};

export const DOCUMENTATION_TRANSITIONS: Record<
  VisitDocumentationStatus,
  VisitDocumentationStatus[]
> = {
  none: ['open'],
  open: ['complete', 'review'],
  review: ['complete', 'open'],
  complete: [],
};

export const PROOF_TRANSITIONS: Record<VisitProofStatus, VisitProofStatus[]> = {
  none: ['pending'],
  pending: ['signed', 'rejected'],
  signed: ['verified', 'rejected'],
  verified: [],
  rejected: ['pending'],
};

export const BILLING_TRANSITIONS: Record<VisitBillingStatus, VisitBillingStatus[]> = {
  none: ['preview'],
  preview: ['ready', 'blocked'],
  ready: ['invoiced', 'blocked'],
  invoiced: ['paid', 'blocked'],
  paid: [],
  blocked: ['preview'],
};

export const PORTAL_TRANSITIONS: Record<VisitPortalStatus, VisitPortalStatus[]> = {
  hidden: ['scheduled'],
  scheduled: ['released', 'hidden'],
  released: ['visible', 'archived'],
  visible: ['archived'],
  archived: [],
};

const LOCKED_ASSIGNMENT_STATUSES: AssignmentStatus[] = [
  'abgeschlossen',
  'storniert',
  'nicht_erschienen',
];

/** Canonical assignment status → allowed transitions (deduplicated, no workflow collapse). */
export function getVisitAllowedTransitions(from: AssignmentStatus): AssignmentStatus[] {
  return ALLOWED_TRANSITIONS[from] ?? [];
}

export function validateVisitStatusTransition(
  from: AssignmentStatus,
  to: AssignmentStatus,
): { valid: true } | { valid: false; error: string } {
  if (from === to) {
    return { valid: false, error: 'Status ist bereits gesetzt.' };
  }
  if (LOCKED_ASSIGNMENT_STATUSES.includes(from)) {
    return { valid: false, error: 'Abgeschlossener Einsatz kann nicht mehr geändert werden.' };
  }
  const allowed = getVisitAllowedTransitions(from);
  if (!allowed.includes(to)) {
    return {
      valid: false,
      error: `Statuswechsel von „${ASSIGNMENT_STATUS_LABELS[from]}“ nach „${ASSIGNMENT_STATUS_LABELS[to]}“ ist nicht erlaubt.`,
    };
  }
  return { valid: true };
}

/** Deduplicate status action buttons — never show duplicate labels. */
export function dedupeStatusTransitionButtons(
  transitions: AssignmentStatus[],
): AssignmentStatus[] {
  const seen = new Set<string>();
  const result: AssignmentStatus[] = [];
  for (const status of transitions) {
    const label = ASSIGNMENT_STATUS_LABELS[status];
    if (seen.has(label)) continue;
    seen.add(label);
    result.push(status);
  }
  return result;
}

export function validateDimensionTransition<T extends string>(
  dimension: VisitStatusDimension,
  from: T,
  to: T,
  map: Record<T, T[]>,
): { valid: true } | { valid: false; error: string } {
  if (from === to) {
    return { valid: false, error: `${dimension}: Status bereits gesetzt.` };
  }
  const allowed = map[from] ?? [];
  if (!allowed.includes(to)) {
    return { valid: false, error: `${dimension}: Übergang von „${from}“ nach „${to}“ nicht erlaubt.` };
  }
  return { valid: true };
}

/** Map assignment_status enum to disposition dimensions. */
export function assignmentStatusToDimensions(status: AssignmentStatus): {
  planning: VisitPlanningStatus;
  execution: VisitExecutionStatus;
  documentation: VisitDocumentationStatus;
  proof: VisitProofStatus;
  billing: VisitBillingStatus;
  portal: VisitPortalStatus;
} {
  switch (status) {
    case 'geplant':
      return {
        planning: 'draft',
        execution: 'pending',
        documentation: 'none',
        proof: 'none',
        billing: 'none',
        portal: 'hidden',
      };
    case 'bestaetigt':
      return {
        planning: 'confirmed',
        execution: 'pending',
        documentation: 'none',
        proof: 'none',
        billing: 'preview',
        portal: 'scheduled',
      };
    case 'unterwegs':
      return {
        planning: 'confirmed',
        execution: 'on_way',
        documentation: 'none',
        proof: 'none',
        billing: 'preview',
        portal: 'scheduled',
      };
    case 'angekommen':
      return {
        planning: 'confirmed',
        execution: 'arrived',
        documentation: 'none',
        proof: 'none',
        billing: 'preview',
        portal: 'scheduled',
      };
    case 'gestartet':
    case 'pausiert':
      return {
        planning: 'confirmed',
        execution: status === 'pausiert' ? 'paused' : 'in_progress',
        documentation: 'none',
        proof: 'none',
        billing: 'preview',
        portal: 'visible',
      };
    case 'beendet':
      return {
        planning: 'confirmed',
        execution: 'completed',
        documentation: 'open',
        proof: 'pending',
        billing: 'ready',
        portal: 'visible',
      };
    case 'dokumentation_offen':
      return {
        planning: 'confirmed',
        execution: 'completed',
        documentation: 'open',
        proof: 'pending',
        billing: 'ready',
        portal: 'visible',
      };
    case 'unterschrift_offen':
      return {
        planning: 'confirmed',
        execution: 'completed',
        documentation: 'complete',
        proof: 'pending',
        billing: 'ready',
        portal: 'released',
      };
    case 'abgeschlossen':
      return {
        planning: 'confirmed',
        execution: 'completed',
        documentation: 'complete',
        proof: 'verified',
        billing: 'invoiced',
        portal: 'archived',
      };
    case 'storniert':
      return {
        planning: 'cancelled',
        execution: 'cancelled',
        documentation: 'none',
        proof: 'none',
        billing: 'blocked',
        portal: 'hidden',
      };
    case 'nicht_erschienen':
      return {
        planning: 'at_risk',
        execution: 'no_show',
        documentation: 'none',
        proof: 'none',
        billing: 'blocked',
        portal: 'hidden',
      };
    default:
      return {
        planning: 'draft',
        execution: 'pending',
        documentation: 'none',
        proof: 'none',
        billing: 'none',
        portal: 'hidden',
      };
  }
}

export function isVisitAtRisk(input: {
  planningStatus: VisitPlanningStatus;
  executionStatus: VisitExecutionStatus;
  isAtRisk?: boolean;
  errorMessage?: string | null;
}): boolean {
  return (
    input.isAtRisk === true ||
    input.planningStatus === 'at_risk' ||
    input.executionStatus === 'no_show' ||
    Boolean(input.errorMessage)
  );
}

export function isVisitIncomplete(input: {
  documentationStatus: VisitDocumentationStatus;
  proofStatus: VisitProofStatus;
  executionStatus: VisitExecutionStatus;
  isIncomplete?: boolean;
}): boolean {
  if (input.isIncomplete) return true;
  if (input.executionStatus === 'completed') {
    return input.documentationStatus !== 'complete' || input.proofStatus === 'pending';
  }
  return false;
}

const ASSIGNMENT_STATUS_PROGRESS: Record<AssignmentStatus, number> = {
  geplant: 0,
  bestaetigt: 1,
  unterwegs: 2,
  angekommen: 3,
  gestartet: 4,
  pausiert: 4,
  beendet: 5,
  dokumentation_offen: 6,
  unterschrift_offen: 7,
  abgeschlossen: 8,
  storniert: -1,
  nicht_erschienen: -1,
};

/** Prefer the more advanced assignment status when visit and assignment rows disagree. */
export function pickAdvancedAssignmentStatus(
  current: AssignmentStatus,
  candidate: AssignmentStatus,
): AssignmentStatus {
  const currentRank = ASSIGNMENT_STATUS_PROGRESS[current] ?? 0;
  const candidateRank = ASSIGNMENT_STATUS_PROGRESS[candidate] ?? 0;
  return candidateRank > currentRank ? candidate : current;
}

/** Derive display status from assist_visits dimension columns when canonical_status lags. */
export function deriveAssignmentStatusFromVisitDimensions(input: {
  canonicalStatus: AssignmentStatus;
  executionStatus: VisitExecutionStatus;
  documentationStatus: VisitDocumentationStatus;
  proofStatus: VisitProofStatus;
}): AssignmentStatus {
  const { canonicalStatus, executionStatus, documentationStatus, proofStatus } = input;
  let derived = canonicalStatus;

  if (executionStatus === 'completed') {
    if (documentationStatus !== 'complete') {
      derived = 'dokumentation_offen';
    } else if (proofStatus === 'verified') {
      derived = 'abgeschlossen';
    } else if (
      proofStatus === 'signed' ||
      proofStatus === 'pending' ||
      proofStatus === 'none'
    ) {
      derived = 'unterschrift_offen';
    } else {
      derived = 'beendet';
    }
  } else {
    const executionMap: Partial<Record<VisitExecutionStatus, AssignmentStatus>> = {
      on_way: 'unterwegs',
      arrived: 'angekommen',
      in_progress: 'gestartet',
      paused: 'pausiert',
      no_show: 'nicht_erschienen',
      cancelled: 'storniert',
    };
    const mapped = executionMap[executionStatus];
    if (mapped) derived = mapped;
  }

  return pickAdvancedAssignmentStatus(canonicalStatus, derived);
}
