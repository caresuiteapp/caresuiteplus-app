import type { DataRequestType, DataSubjectRequestStatus } from './dataSubjectRequest.types';

export const DATA_REQUEST_TYPE_LABELS: Record<DataRequestType, string> = {
  access: 'Datenauskunft',
  export: 'Datenexport',
  correction: 'Berichtigung',
  deletion: 'Löschung',
  restriction: 'Einschränkung',
  objection: 'Widerspruch',
  portability: 'Datenübertragbarkeit',
  consent_withdrawal: 'Einwilligungswiderruf',
  other: 'Sonstiges',
};

export const DATA_SUBJECT_REQUEST_STATUS_LABELS: Record<DataSubjectRequestStatus, string> = {
  queued: 'In Warteschlange',
  running: 'In Bearbeitung',
  completed: 'Abgeschlossen',
  failed: 'Fehlgeschlagen',
  cancelled: 'Abgebrochen',
};

export function statusBadgeVariant(
  status: DataSubjectRequestStatus,
): 'orange' | 'green' | 'red' | 'cyan' {
  if (status === 'completed') return 'green';
  if (status === 'failed' || status === 'cancelled') return 'red';
  if (status === 'running') return 'cyan';
  return 'orange';
}
