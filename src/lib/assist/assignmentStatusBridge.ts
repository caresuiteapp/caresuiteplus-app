import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { Database } from '@/lib/supabase/database.types';

export type RemoteAssignmentStatus = Database['public']['Enums']['assignment_status'];

const LOCAL_TO_REMOTE: Record<AssignmentStatus, RemoteAssignmentStatus> = {
  geplant: 'planned',
  bestaetigt: 'confirmed',
  unterwegs: 'on_the_way',
  angekommen: 'arrived',
  gestartet: 'started',
  pausiert: 'paused',
  beendet: 'finished',
  dokumentation_offen: 'documentation_open',
  unterschrift_offen: 'signature_open',
  abgeschlossen: 'completed',
  storniert: 'cancelled',
  nicht_erschienen: 'no_show',
};

const REMOTE_TO_LOCAL: Record<RemoteAssignmentStatus, AssignmentStatus> = {
  planned: 'geplant',
  confirmed: 'bestaetigt',
  on_the_way: 'unterwegs',
  arrived: 'angekommen',
  started: 'gestartet',
  paused: 'pausiert',
  finished: 'beendet',
  documentation_open: 'dokumentation_offen',
  signature_open: 'unterschrift_offen',
  completed: 'abgeschlossen',
  cancelled: 'storniert',
  no_show: 'nicht_erschienen',
};

export function assignmentStatusToRemote(status: AssignmentStatus): RemoteAssignmentStatus {
  return LOCAL_TO_REMOTE[status];
}

export function remoteStatusToAssignment(status: string | null | undefined): AssignmentStatus {
  if (!status) return 'geplant';
  if (status in REMOTE_TO_LOCAL) {
    return REMOTE_TO_LOCAL[status as RemoteAssignmentStatus];
  }
  const legacyMap: Record<string, AssignmentStatus> = {
    entwurf: 'geplant',
    aktiv: 'bestaetigt',
    in_bearbeitung: 'gestartet',
    abgeschlossen: 'abgeschlossen',
    fehlerhaft: 'storniert',
    gesperrt: 'storniert',
    archiviert: 'abgeschlossen',
  };
  return legacyMap[status] ?? 'geplant';
}
