/** Domain-Status für Assist-Einsätze (UI / Workflow, deutsch). */
export type AssignmentStatus =
  | 'geplant'
  | 'bestaetigt'
  | 'unterwegs'
  | 'angekommen'
  | 'gestartet'
  | 'pausiert'
  | 'beendet'
  | 'dokumentation_offen'
  | 'unterschrift_offen'
  | 'abgeschlossen'
  | 'storniert'
  | 'nicht_erschienen';

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  geplant: 'Geplant',
  bestaetigt: 'Bestätigt',
  unterwegs: 'Unterwegs',
  angekommen: 'Angekommen',
  gestartet: 'Gestartet',
  pausiert: 'Pausiert',
  beendet: 'Beendet',
  dokumentation_offen: 'Dokumentation offen',
  unterschrift_offen: 'Unterschrift offen',
  abgeschlossen: 'Abgeschlossen',
  storniert: 'Storniert',
  nicht_erschienen: 'Nicht erschienen',
};

export type AssignmentTaskStatus =
  | 'open'
  | 'done'
  | 'not_done'
  | 'not_requested'
  | 'cancelled';

export const ASSIGNMENT_TASK_STATUS_LABELS: Record<AssignmentTaskStatus, string> = {
  open: 'Offen',
  done: 'Erledigt',
  not_done: 'Nicht erledigt',
  not_requested: 'Nicht angefordert',
  cancelled: 'Storniert',
};
