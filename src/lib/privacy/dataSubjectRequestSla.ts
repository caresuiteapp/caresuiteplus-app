import {
  DATA_REQUEST_TYPE_LABELS,
  DATA_SUBJECT_REQUEST_STATUS_LABELS,
} from './dataSubjectRequestLabels';
import type { DataSubjectRequest, DataSubjectRequestStatus } from './dataSubjectRequest.types';

/** Art. 12 Abs. 3 DSGVO — Antwort spätestens innerhalb eines Monats nach Eingang. */
export const DSGVO_ART12_RESPONSE_DAYS = 30;

/** Warnschwelle: Frist läuft in ≤7 Tagen ab (offene Anfragen). */
export const DSGVO_DEADLINE_WARNING_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type DataSubjectRequestDeadlineStatus =
  | 'completed'
  | 'cancelled'
  | 'overdue'
  | 'due_soon'
  | 'on_track';

export type DataSubjectRequestDeadlineInfo = {
  receivedAt: string;
  deadlineAt: string;
  daysRemaining: number | null;
  status: DataSubjectRequestDeadlineStatus;
  label: string;
};

const CLOSED_STATUSES: DataSubjectRequestStatus[] = ['completed', 'failed', 'cancelled'];

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getDataSubjectRequestReceivedAt(request: DataSubjectRequest): string {
  return request.receivedAt ?? request.createdAt;
}

export function computeDataSubjectRequestDeadline(receivedAtIso: string): Date {
  const received = new Date(receivedAtIso);
  return new Date(received.getTime() + DSGVO_ART12_RESPONSE_DAYS * MS_PER_DAY);
}

export function getDataSubjectRequestDeadlineInfo(
  request: DataSubjectRequest,
  now = new Date(),
): DataSubjectRequestDeadlineInfo {
  const receivedAt = getDataSubjectRequestReceivedAt(request);
  const deadline = computeDataSubjectRequestDeadline(receivedAt);
  const deadlineAt = deadline.toISOString();

  if (request.status === 'completed') {
    return {
      receivedAt,
      deadlineAt,
      daysRemaining: null,
      status: 'completed',
      label: 'Erledigt',
    };
  }

  if (request.status === 'cancelled' || request.status === 'failed') {
    return {
      receivedAt,
      deadlineAt,
      daysRemaining: null,
      status: 'cancelled',
      label: request.status === 'failed' ? 'Fehlgeschlagen' : 'Abgebrochen',
    };
  }

  const today = startOfLocalDay(now);
  const deadlineDay = startOfLocalDay(deadline);
  const daysRemaining = Math.round((deadlineDay.getTime() - today.getTime()) / MS_PER_DAY);

  if (daysRemaining < 0) {
    return {
      receivedAt,
      deadlineAt,
      daysRemaining,
      status: 'overdue',
      label: `Überfällig (${Math.abs(daysRemaining)} T.)`,
    };
  }

  if (daysRemaining <= DSGVO_DEADLINE_WARNING_DAYS) {
    return {
      receivedAt,
      deadlineAt,
      daysRemaining,
      status: 'due_soon',
      label: daysRemaining === 0 ? 'Frist heute' : `Frist in ${daysRemaining} T.`,
    };
  }

  return {
    receivedAt,
    deadlineAt,
    daysRemaining,
    status: 'on_track',
    label: `Frist ${formatGermanDate(deadlineAt)}`,
  };
}

export function deadlineBadgeVariant(
  status: DataSubjectRequestDeadlineStatus,
): 'orange' | 'green' | 'red' | 'cyan' {
  if (status === 'completed') return 'green';
  if (status === 'cancelled') return 'red';
  if (status === 'overdue') return 'red';
  if (status === 'due_soon') return 'orange';
  return 'cyan';
}

export function isDataSubjectRequestOpen(request: DataSubjectRequest): boolean {
  return !CLOSED_STATUSES.includes(request.status);
}

export function countOverdueDataSubjectRequests(
  requests: DataSubjectRequest[],
  now = new Date(),
): number {
  return requests.filter(
    (item) =>
      isDataSubjectRequestOpen(item) &&
      getDataSubjectRequestDeadlineInfo(item, now).status === 'overdue',
  ).length;
}

function formatGermanDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function escapeCsvCell(value: string): string {
  if (/[;"\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** CSV-Export der Admin-Liste (Semikolon, UTF-8, deutsche Spalten). */
export function buildDataSubjectRequestsAdminCsv(requests: DataSubjectRequest[]): string {
  const header =
    'Anfragenummer;Typ;Status;Antragsteller;E-Mail;Eingegangen;Frist;Frist-Status;Notizen';
  const rows = requests.map((item) => {
    const deadline = getDataSubjectRequestDeadlineInfo(item);
    return [
      item.requestNumber ?? item.id,
      DATA_REQUEST_TYPE_LABELS[item.requestType],
      DATA_SUBJECT_REQUEST_STATUS_LABELS[item.status],
      item.requesterName ?? '',
      item.requesterEmail ?? '',
      formatGermanDate(getDataSubjectRequestReceivedAt(item)),
      formatGermanDate(deadline.deadlineAt),
      deadline.label,
      item.verificationNotes ?? '',
    ]
      .map((cell) => escapeCsvCell(String(cell)))
      .join(';');
  });
  return [header, ...rows].join('\n');
}
