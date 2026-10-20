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
  hasServiceStarted?: boolean;
  hasTravelEnded?: boolean;
  hasDocumentation?: boolean;
  hasRequiredSignature?: boolean;
  signatureImpossibleJustified?: boolean;
  /** Employee finalized without on-device signature; client signs later in portal. */
  signatureDeferredToClientPortal?: boolean;
};

export function validateExecutionTransition(
  from: AssignmentStatus,
  to: AssignmentStatus,
  options?: ExecutionTransitionOptions,
): { valid: true } | { valid: false; error: string } {
  if (
    options?.requireArrivedBeforeStart &&
    to === 'gestartet' &&
    from !== 'angekommen' &&
    from !== 'pausiert'
  ) {
    return { valid: false, error: 'Ankunft muss vor dem Start bestätigt werden.' };
  }

  if (to === 'beendet' && options?.hasServiceStarted === false) {
    return {
      valid: false,
      error: 'Einsatz kann erst beendet werden, nachdem „Einsatz starten“ bestätigt wurde.',
    };
  }

  if (to === 'beendet' && options?.hasTravelEnded === false) {
    return {
      valid: false,
      error: 'Ankunft muss vor dem Beenden bestätigt werden.',
    };
  }

  if (to === 'dokumentation_offen' && from === 'gestartet') {
    return {
      valid: false,
      error: 'Dokumentation erst nach Beendigung des Einsatzes möglich.',
    };
  }

  if (to === 'unterschrift_offen' && !options?.hasDocumentation) {
    return { valid: false, error: 'Dokumentation muss vor der Unterschrift vorliegen.' };
  }

  const base = validateAssignmentTransition(from, to);
  if (!base.valid) return base;

  if (to === 'abgeschlossen' && requiresDocumentationBeforeComplete(from) && !options?.hasDocumentation) {
    return { valid: false, error: 'Dokumentation muss vor Abschluss vorliegen.' };
  }

  if (
    to === 'abgeschlossen' &&
    options?.hasRequiredSignature === false &&
    !options?.signatureDeferredToClientPortal
  ) {
    return { valid: false, error: 'Klient:innen-Unterschrift fehlt.' };
  }

  return { valid: true };
}

const NOTE_REQUIRED_STATUSES: AssignmentStatus[] = ['storniert', 'nicht_erschienen'];

export function taskStatusRequiresNote(status: AssignmentStatus | ExtendedAssignmentTaskStatus): boolean {
  if (status === 'not_possible') return true;
  return NOTE_REQUIRED_STATUSES.includes(status as AssignmentStatus);
}
