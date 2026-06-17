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

const REMOTE_TO_WORKFLOW: Record<string, WorkflowStatus> = {
  lead: 'entwurf',
  active: 'aktiv',
  paused: 'in_bearbeitung',
  inactive: 'abgeschlossen',
  archived: 'archiviert',
  deceased: 'abgeschlossen',
  blocked: 'gesperrt',
  deleted: 'archiviert',
};

export const REMOTE_CLIENT_DELETED_STATUS = 'deleted' as const;

export function isRemoteClientDeleted(status: string | null | undefined): boolean {
  return status === REMOTE_CLIENT_DELETED_STATUS;
}

export function workflowStatusToRemote(status: WorkflowStatus): RemoteClientStatus {
  return WORKFLOW_TO_REMOTE[status] ?? 'active';
}

export function remoteStatusToWorkflow(status: string | null | undefined): WorkflowStatus {
  if (!status) return 'aktiv';
  if (isRemoteClientDeleted(status)) return 'archiviert';
  if (status in REMOTE_TO_WORKFLOW) {
    return REMOTE_TO_WORKFLOW[status];
  }
  if (LOCAL_STATUSES.includes(status as WorkflowStatus)) {
    return status as WorkflowStatus;
  }
  return 'aktiv';
}
