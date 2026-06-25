import type { WorkflowStatus } from '@/types';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';

export type WorkflowStatusBadgeVariant = 'green' | 'red' | 'orange' | 'muted';

export function resolveWorkflowStatusLabel(status: WorkflowStatus | string): string {
  if (status in WORKFLOW_STATUS_LABELS) {
    return WORKFLOW_STATUS_LABELS[status as WorkflowStatus];
  }
  return status.replace(/_/g, ' ').replace(/^\w/, (char) => char.toUpperCase());
}

export function resolveWorkflowStatusVariant(status: WorkflowStatus | string): WorkflowStatusBadgeVariant {
  switch (status) {
    case 'aktiv':
      return 'green';
    case 'fehlerhaft':
    case 'gesperrt':
      return 'red';
    case 'in_bearbeitung':
    case 'entwurf':
      return 'orange';
    default:
      return 'muted';
  }
}
