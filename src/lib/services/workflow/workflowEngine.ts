import type { WorkflowStatus } from '@/types/core/base';
import type { StatusTransition } from '@/types/workflow/status';
import { DEFAULT_WORKFLOW_TRANSITIONS, WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import {
  CLIENT_STATUS_HINTS,
  CLIENT_STATUS_TRANSITIONS,
  canTransitionStatus,
  getAllowedStatusActions,
} from './clientStatus';

export type WorkflowAction = {
  targetStatus: WorkflowStatus;
  label: string;
  hint: string;
};

export type TransitionValidation = {
  valid: boolean;
  error?: string;
};

const TRANSITION_LABELS: Partial<Record<WorkflowStatus, string>> = {
  aktiv: 'Aktivieren',
  in_bearbeitung: 'Bearbeitung starten',
  abgeschlossen: 'Abschließen',
  archiviert: 'Archivieren',
  gesperrt: 'Sperren',
  fehlerhaft: 'Als fehlerhaft markieren',
  entwurf: 'Als Entwurf speichern',
};

function transitionLabel(to: WorkflowStatus): string {
  return TRANSITION_LABELS[to] ?? WORKFLOW_STATUS_LABELS[to];
}

export function validateTransition(
  from: WorkflowStatus,
  to: WorkflowStatus,
): TransitionValidation {
  if (from === to) {
    return { valid: false, error: 'Status ist bereits gesetzt.' };
  }

  if (!canTransitionStatus(from, to)) {
    const allowed = getAllowedStatusActions(from);
    const allowedLabels = allowed.map((s) => WORKFLOW_STATUS_LABELS[s]).join(', ');
    return {
      valid: false,
      error: `Übergang von „${WORKFLOW_STATUS_LABELS[from]}" nach „${WORKFLOW_STATUS_LABELS[to]}" ist nicht erlaubt.${
        allowed.length > 0 ? ` Erlaubt: ${allowedLabels}.` : ''
      }`,
    };
  }

  return { valid: true };
}

export function getNextActions(status: WorkflowStatus): WorkflowAction[] {
  const targets = getAllowedStatusActions(status);
  const hint = CLIENT_STATUS_HINTS[status] ?? '';

  return targets.map((targetStatus) => ({
    targetStatus,
    label: transitionLabel(targetStatus),
    hint,
  }));
}

export function getStatusTransitions(
  status: WorkflowStatus,
): StatusTransition<WorkflowStatus>[] {
  const targets = CLIENT_STATUS_TRANSITIONS[status] ?? [];
  return targets.map((to) => ({
    from: status,
    to,
    label: transitionLabel(to),
  }));
}

export {
  CLIENT_STATUS_TRANSITIONS,
  CLIENT_STATUS_HINTS,
  canTransitionStatus,
  getAllowedStatusActions,
  DEFAULT_WORKFLOW_TRANSITIONS,
};
