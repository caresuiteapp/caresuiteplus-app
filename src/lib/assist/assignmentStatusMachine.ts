import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { ExtendedAssignmentTaskStatus } from '@/types/modules/assignmentWorkflow';

export const ALLOWED_TRANSITIONS: Record<AssignmentStatus, AssignmentStatus[]> = {
  geplant: ['bestaetigt', 'unterwegs', 'storniert', 'nicht_erschienen'],
  bestaetigt: ['unterwegs', 'storniert', 'nicht_erschienen'],
  unterwegs: ['angekommen', 'storniert'],
  angekommen: ['gestartet', 'storniert'],
  gestartet: ['pausiert', 'beendet', 'storniert'],
  pausiert: ['gestartet', 'beendet', 'storniert'],
  beendet: ['dokumentation_offen', 'storniert'],
  dokumentation_offen: ['unterschrift_offen', 'abgeschlossen', 'storniert'],
  unterschrift_offen: ['abgeschlossen', 'storniert'],
  abgeschlossen: [],
  storniert: [],
  nicht_erschienen: [],
};

const LOCKED_STATUSES: AssignmentStatus[] = ['abgeschlossen', 'storniert', 'nicht_erschienen'];

export function validateAssignmentTransition(
  from: AssignmentStatus,
  to: AssignmentStatus,
): { valid: true } | { valid: false; error: string } {
  if (from === to) {
    return { valid: false, error: 'Status ist bereits gesetzt.' };
  }
  if (isAssignmentLocked(from)) {
    return { valid: false, error: 'Abgeschlossener Einsatz kann nicht mehr geändert werden.' };
  }
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    return {
      valid: false,
      error: `Statuswechsel von „${from}“ nach „${to}“ ist nicht erlaubt.`,
    };
  }
  return { valid: true };
}

export function getAllowedAssignmentTransitions(from: AssignmentStatus): AssignmentStatus[] {
  return ALLOWED_TRANSITIONS[from] ?? [];
}

export function isAssignmentLocked(status: AssignmentStatus): boolean {
  return LOCKED_STATUSES.includes(status);
}

/** Dokumentation ist Pflicht vor Abschluss (ab beendet / Dokumentation offen). */
export function requiresDocumentationBeforeComplete(status: AssignmentStatus): boolean {
  return status === 'beendet' || status === 'dokumentation_offen';
}

type ExecutionTransitionOptions = {
  requireArrivedBeforeStart?: boolean;
  hasDocumentation?: boolean;
  hasRequiredSignature?: boolean;
  signatureImpossibleJustified?: boolean;
};

export function validateExecutionTransition(
  from: AssignmentStatus,
  to: AssignmentStatus,
  options?: ExecutionTransitionOptions,
): { valid: true } | { valid: false; error: string } {
  if (options?.requireArrivedBeforeStart && to === 'gestartet' && from !== 'angekommen') {
    return { valid: false, error: 'Ankunft muss vor dem Start bestätigt werden.' };
  }

  const base = validateAssignmentTransition(from, to);
  if (!base.valid) return base;

  if (to === 'abgeschlossen' && requiresDocumentationBeforeComplete(from) && !options?.hasDocumentation) {
    return { valid: false, error: 'Dokumentation muss vor Abschluss vorliegen.' };
  }

  return { valid: true };
}

const NOTE_REQUIRED_STATUSES: AssignmentStatus[] = ['storniert', 'nicht_erschienen'];

export function taskStatusRequiresNote(status: AssignmentStatus | ExtendedAssignmentTaskStatus): boolean {
  if (status === 'not_possible') return true;
  return NOTE_REQUIRED_STATUSES.includes(status as AssignmentStatus);
}
