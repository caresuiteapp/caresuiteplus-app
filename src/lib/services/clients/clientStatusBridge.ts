import type { WorkflowStatus } from '@/types/core/base';
import type { Database } from '@/lib/supabase/database.types';

export type RemoteClientStatus = Database['public']['Enums']['client_status'];

const LOCAL_STATUSES: WorkflowStatus[] = [
  'entwurf',
  'aktiv',
  'in_bearbeitung',
  'abgeschlossen',
  'archiviert',
  'fehlerhaft',
  'gesperrt',
];

const WORKFLOW_TO_REMOTE: Record<WorkflowStatus, RemoteClientStatus> = {
  entwurf: 'lead',
  aktiv: 'active',
  in_bearbeitung: 'paused',
  abgeschlossen: 'inactive',
  archiviert: 'archived',
  fehlerhaft: 'paused',
  gesperrt: 'blocked',
};

const REMOTE_TO_WORKFLOW: Record<RemoteClientStatus, WorkflowStatus> = {
  lead: 'entwurf',
  active: 'aktiv',
  paused: 'in_bearbeitung',
  inactive: 'abgeschlossen',
  archived: 'archiviert',
  deceased: 'abgeschlossen',
  blocked: 'gesperrt',
};

export function workflowStatusToRemote(status: WorkflowStatus): RemoteClientStatus {
  return WORKFLOW_TO_REMOTE[status] ?? 'active';
}

export function remoteStatusToWorkflow(status: string | null | undefined): WorkflowStatus {
  if (!status) return 'aktiv';
  if (status in REMOTE_TO_WORKFLOW) {
    return REMOTE_TO_WORKFLOW[status as RemoteClientStatus];
  }
  if (LOCAL_STATUSES.includes(status as WorkflowStatus)) {
    return status as WorkflowStatus;
  }
  return 'aktiv';
}
