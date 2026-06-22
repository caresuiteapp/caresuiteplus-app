/**
 * Assist visit lifecycle — idempotent transitions through billing handoff readiness.
 * Does not create invoices, invoice numbers, or billing send actions (K.6 out of scope).
 */
export type AssistVisitLifecycleStatus =
  | 'planned'
  | 'published'
  | 'confirmed'
  | 'on_way'
  | 'arrived'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'documentation_open'
  | 'signature_open'
  | 'proof_ready'
  | 'portal_released'
  | 'billing_handoff_ready'
  | 'cancelled'
  | 'no_show';

export const ASSIST_VISIT_LIFECYCLE_LABELS: Record<AssistVisitLifecycleStatus, string> = {
  planned: 'Geplant',
  published: 'Veröffentlicht',
  confirmed: 'Bestätigt',
  on_way: 'Unterwegs',
  arrived: 'Angekommen',
  in_progress: 'In Durchführung',
  paused: 'Pausiert',
  completed: 'Beendet',
  documentation_open: 'Dokumentation offen',
  signature_open: 'Unterschrift offen',
  proof_ready: 'Nachweis bereit',
  portal_released: 'Im Klientenportal',
  billing_handoff_ready: 'Abrechnungsübergabe bereit',
  cancelled: 'Storniert',
  no_show: 'Nicht erschienen',
};

const TRANSITIONS: Record<AssistVisitLifecycleStatus, AssistVisitLifecycleStatus[]> = {
  planned: ['published', 'cancelled', 'no_show'],
  published: ['confirmed', 'cancelled', 'no_show'],
  confirmed: ['on_way', 'cancelled', 'no_show'],
  on_way: ['arrived', 'cancelled'],
  arrived: ['in_progress', 'cancelled'],
  in_progress: ['paused', 'completed', 'cancelled'],
  paused: ['in_progress', 'completed', 'cancelled'],
  completed: ['documentation_open', 'cancelled'],
  documentation_open: ['signature_open', 'proof_ready', 'cancelled'],
  signature_open: ['proof_ready', 'cancelled'],
  proof_ready: ['portal_released', 'billing_handoff_ready', 'cancelled'],
  portal_released: ['billing_handoff_ready'],
  billing_handoff_ready: [],
  cancelled: [],
  no_show: [],
};

const TERMINAL: AssistVisitLifecycleStatus[] = [
  'billing_handoff_ready',
  'cancelled',
  'no_show',
];

export function getAssistVisitAllowedTransitions(
  from: AssistVisitLifecycleStatus,
): AssistVisitLifecycleStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function validateAssistVisitTransition(
  from: AssistVisitLifecycleStatus,
  to: AssistVisitLifecycleStatus,
): { valid: true } | { valid: false; error: string } {
  if (from === to) {
    return { valid: true };
  }
  if (TERMINAL.includes(from)) {
    return {
      valid: false,
      error: `Status „${ASSIST_VISIT_LIFECYCLE_LABELS[from]}“ ist abgeschlossen.`,
    };
  }
  const allowed = TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    return {
      valid: false,
      error: `Übergang von „${ASSIST_VISIT_LIFECYCLE_LABELS[from]}“ nach „${ASSIST_VISIT_LIFECYCLE_LABELS[to]}“ ist nicht erlaubt.`,
    };
  }
  return { valid: true };
}

/** Idempotent: same target status is a no-op success. */
export function applyAssistVisitTransition(
  current: AssistVisitLifecycleStatus,
  target: AssistVisitLifecycleStatus,
): { ok: true; status: AssistVisitLifecycleStatus } | { ok: false; error: string } {
  if (current === target) {
    return { ok: true, status: current };
  }
  const validation = validateAssistVisitTransition(current, target);
  if (!validation.valid) {
    return { ok: false, error: validation.error };
  }
  return { ok: true, status: target };
}

export function isAssistVisitBillingHandoffReady(status: AssistVisitLifecycleStatus): boolean {
  return status === 'billing_handoff_ready';
}

export function mapAssignmentStatusToLifecycle(
  status: string,
  proofReleased = false,
): AssistVisitLifecycleStatus {
  switch (status) {
    case 'geplant':
    case 'entwurf':
      return 'planned';
    case 'bestaetigt':
    case 'aktiv':
      return 'confirmed';
    case 'unterwegs':
      return 'on_way';
    case 'angekommen':
      return 'arrived';
    case 'gestartet':
      return 'in_progress';
    case 'pausiert':
      return 'paused';
    case 'beendet':
      return 'completed';
    case 'dokumentation_offen':
    case 'in_bearbeitung':
      return 'documentation_open';
    case 'unterschrift_offen':
      return 'signature_open';
    case 'abgeschlossen':
      return proofReleased ? 'billing_handoff_ready' : 'proof_ready';
    case 'storniert':
      return 'cancelled';
    case 'nicht_erschienen':
      return 'no_show';
    case 'fehlerhaft':
      return 'documentation_open';
    default:
      return 'planned';
  }
}
