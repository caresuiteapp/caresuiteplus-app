/**
 * ASSIST.WORKFLOW.1 — Employee visit execution state machine.
 * Maps assignment status ↔ guided workflow steps with validated transitions.
 */
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import {
  getAllowedAssignmentTransitions,
  isAssignmentLocked,
  validateAssignmentTransition,
  validateExecutionTransition,
} from '@/lib/assist/assignmentStatusMachine';
import type { AssistWorkflowStep } from './types';

export const ASSIST_WORKFLOW_STEP_LABELS: Record<AssistWorkflowStep, string> = {
  consent: 'Einwilligung',
  en_route: 'Anfahrt',
  arrived: 'Angekommen',
  in_service: 'Einsatz',
  paused: 'Pause',
  tasks: 'Aufgaben',
  documentation: 'Dokumentation',
  signature: 'Unterschrift',
  finalize: 'Abschluss',
  completed: 'Abgeschlossen',
  no_show: 'Nicht angetroffen',
  locked: 'Gesperrt',
};

const STATUS_TO_STEP: Partial<Record<AssignmentStatus, AssistWorkflowStep>> = {
  geplant: 'consent',
  bestaetigt: 'consent',
  unterwegs: 'en_route',
  angekommen: 'arrived',
  gestartet: 'in_service',
  pausiert: 'paused',
  beendet: 'documentation',
  dokumentation_offen: 'documentation',
  unterschrift_offen: 'signature',
  abgeschlossen: 'completed',
  storniert: 'locked',
  nicht_erschienen: 'no_show',
};

const PRIMARY_ACTION: Partial<Record<AssignmentStatus, AssignmentStatus>> = {
  geplant: 'unterwegs',
  bestaetigt: 'unterwegs',
  unterwegs: 'angekommen',
  angekommen: 'gestartet',
  gestartet: 'beendet',
  pausiert: 'gestartet',
  beendet: 'dokumentation_offen',
  dokumentation_offen: 'unterschrift_offen',
  unterschrift_offen: 'abgeschlossen',
};

export function assignmentStatusToWorkflowStep(status: AssignmentStatus): AssistWorkflowStep {
  if (isAssignmentLocked(status)) {
    if (status === 'abgeschlossen') return 'completed';
    if (status === 'nicht_erschienen') return 'no_show';
    return 'locked';
  }
  return STATUS_TO_STEP[status] ?? 'consent';
}

export function getPrimaryWorkflowAction(status: AssignmentStatus): AssignmentStatus | null {
  return PRIMARY_ACTION[status] ?? null;
}

export function getWorkflowTimelineSteps(
  currentStatus: AssignmentStatus,
  options?: { requiresSignature?: boolean },
): AssistWorkflowStep[] {
  const requiresSignature = options?.requiresSignature ?? true;
  const base: AssistWorkflowStep[] = [
    'consent',
    'en_route',
    'arrived',
    'in_service',
    'tasks',
    'documentation',
  ];
  if (requiresSignature) base.push('signature');
  base.push('finalize', 'completed');

  if (currentStatus === 'nicht_erschienen') {
    return ['consent', 'no_show'];
  }
  if (currentStatus === 'storniert') {
    return ['consent', 'locked'];
  }
  return base;
}

export function isWorkflowStepComplete(
  step: AssistWorkflowStep,
  status: AssignmentStatus,
): boolean {
  const order: AssistWorkflowStep[] = [
    'consent',
    'en_route',
    'arrived',
    'in_service',
    'tasks',
    'documentation',
    'signature',
    'finalize',
    'completed',
  ];
  const current = assignmentStatusToWorkflowStep(status);
  const stepIdx = order.indexOf(step);
  const currentIdx = order.indexOf(current);
  if (stepIdx < 0 || currentIdx < 0) return false;
  if (current === 'completed') return true;
  if (current === 'paused') {
    return stepIdx < order.indexOf('in_service');
  }
  return stepIdx < currentIdx;
}

export function validateWorkflowTransition(
  from: AssignmentStatus,
  to: AssignmentStatus,
  options?: {
    requireArrivedBeforeStart?: boolean;
    hasServiceStarted?: boolean;
    hasTravelEnded?: boolean;
    hasDocumentation?: boolean;
    hasRequiredSignature?: boolean;
    signatureImpossibleJustified?: boolean;
    noShowNote?: string | null;
  },
): { valid: true } | { valid: false; error: string } {
  if (to === 'nicht_erschienen' && !options?.noShowNote?.trim()) {
    return { valid: false, error: 'Begründung für „Nicht angetroffen“ ist erforderlich.' };
  }

  return validateExecutionTransition(from, to, {
    requireArrivedBeforeStart: options?.requireArrivedBeforeStart ?? true,
    hasServiceStarted: options?.hasServiceStarted,
    hasTravelEnded: options?.hasTravelEnded,
    hasDocumentation: options?.hasDocumentation,
    hasRequiredSignature: options?.hasRequiredSignature,
    signatureImpossibleJustified: options?.signatureImpossibleJustified,
  });
}

export function getAllowedWorkflowTransitions(from: AssignmentStatus): AssignmentStatus[] {
  return getAllowedAssignmentTransitions(from);
}

export { validateAssignmentTransition, isAssignmentLocked };
