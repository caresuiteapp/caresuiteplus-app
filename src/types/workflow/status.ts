import type { WorkflowStatus } from '../core/base';

export type { WorkflowStatus } from '../core/base';

export type StatusTransition<TStatus extends string = WorkflowStatus> = {
  from: TStatus;
  to: TStatus;
  label: string;
  requiresFields?: string[];
};

export const DEFAULT_WORKFLOW_TRANSITIONS: StatusTransition<WorkflowStatus>[] = [
  { from: 'entwurf', to: 'aktiv', label: 'Aktivieren' },
  { from: 'aktiv', to: 'in_bearbeitung', label: 'Bearbeitung starten' },
  { from: 'in_bearbeitung', to: 'abgeschlossen', label: 'Abschließen' },
  { from: 'abgeschlossen', to: 'archiviert', label: 'Archivieren' },
  { from: 'aktiv', to: 'gesperrt', label: 'Sperren' },
  { from: 'in_bearbeitung', to: 'fehlerhaft', label: 'Als fehlerhaft markieren' },
  { from: 'fehlerhaft', to: 'in_bearbeitung', label: 'Erneut bearbeiten' },
  { from: 'gesperrt', to: 'aktiv', label: 'Entsperren' },
];

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  entwurf: 'Entwurf',
  aktiv: 'Aktiv',
  in_bearbeitung: 'In Bearbeitung',
  abgeschlossen: 'Abgeschlossen',
  archiviert: 'Archiviert',
  fehlerhaft: 'Fehlerhaft',
  gesperrt: 'Gesperrt',
};
