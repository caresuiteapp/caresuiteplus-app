import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';

export const ASSIST_PROOF_STATUS_LABELS: Record<AssistVisitProofRow['status'], string> = {
  draft: 'Entwurf',
  pending_review: 'Zur Prüfung',
  approved: 'Freigegeben',
  exported: 'PDF exportiert',
  archived: 'Archiviert',
  rejected: 'Abgelehnt',
};

export const ASSIST_PROOF_PORTAL_RELEASE_LABELS = {
  none: 'Nicht veröffentlicht',
  released: 'Im Klientenportal',
  revoked: 'Zurückgezogen',
} as const;
