import type { WorkflowStatus } from '../../core/base';

export type TimelineEventType =
  | 'status'
  | 'einsatz'
  | 'dokument'
  | 'rechnung'
  | 'einwilligung'
  | 'notiz'
  | 'pflegeplan'
  | 'kontakt'
  | 'portal'
  | 'sonstige';

export const TIMELINE_EVENT_TYPE_LABELS: Record<TimelineEventType, string> = {
  status: 'Statusänderung',
  einsatz: 'Einsatz',
  dokument: 'Dokument',
  rechnung: 'Rechnung',
  einwilligung: 'Einwilligung',
  notiz: 'Notiz',
  pflegeplan: 'Pflegeplan',
  kontakt: 'Kontakt',
  portal: 'Portal',
  sonstige: 'Sonstiges',
};

export type ClientTimelineEvent = {
  id: string;
  clientId: string;
  eventType: TimelineEventType;
  icon: string;
  title: string;
  subtitle: string | null;
  timestamp: string;
  status: WorkflowStatus;
  actorName: string | null;
  /** Interne Notizen erscheinen nie im Portal */
  isInternal: boolean;
  metadata: Record<string, string> | null;
};

/** Interne Notiz — niemals im Portal sichtbar */
export type ClientInternalNote = {
  id: string;
  clientId: string;
  tenantId: string;
  content: string;
  isInternal: true;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  category: 'allgemein' | 'einsatz' | 'abrechnung' | 'gesundheit' | 'portal';
};

export const INTERNAL_NOTE_CATEGORY_LABELS: Record<ClientInternalNote['category'], string> = {
  allgemein: 'Allgemein',
  einsatz: 'Einsatz',
  abrechnung: 'Abrechnung',
  gesundheit: 'Gesundheit',
  portal: 'Portal',
};
