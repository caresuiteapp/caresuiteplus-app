import type { AssignmentStatus } from '@/types/modules/assignmentStatus';

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

export type AssignmentTransitionContext = {
  requireArrivedBeforeStart?: boolean;
  hasDocumentation?: boolean;
  hasRequiredSignature?: boolean;
  signatureImpossibleJustified?: boolean;
};

/** Erweiterte Prüfung für Einsatzdurchführung (Mitarbeiterportal). */
export function validateExecutionTransition(
  from: AssignmentStatus,
  to: AssignmentStatus,
  context: AssignmentTransitionContext = {},
): { valid: true } | { valid: false; error: string } {
  if (to === 'gestartet' && context.requireArrivedBeforeStart !== false && from !== 'angekommen' && from !== 'pausiert') {
    return { valid: false, error: 'Einsatz kann erst nach Ankunft gestartet werden.' };
  }

  const base = validateAssignmentTransition(from, to);
  if (!base.valid) return base;

  if (to === 'beendet' && from !== 'gestartet' && from !== 'pausiert') {
    return { valid: false, error: 'Einsatz kann nur aus laufendem Status beendet werden.' };
  }

  if (to === 'abgeschlossen') {
    if (from !== 'dokumentation_offen' && from !== 'unterschrift_offen') {
      return { valid: false, error: 'Abschluss nur nach Dokumentation/Unterschrift möglich.' };
    }
    if (!context.hasDocumentation) {
      return { valid: false, error: 'Dokumentation ist vor Abschluss erforderlich.' };
    }
    if (!context.hasRequiredSignature && !context.signatureImpossibleJustified) {
      return { valid: false, error: 'Unterschrift oder begründete Unmöglichkeit erforderlich.' };
    }
  }

  return { valid: true };
}

const TASK_STATUSES_REQUIRING_NOTE = new Set([
  'not_wanted',
  'not_possible',
  'skipped',
]);

export function taskStatusRequiresNote(status: string): boolean {
  return TASK_STATUSES_REQUIRING_NOTE.has(status);
}
