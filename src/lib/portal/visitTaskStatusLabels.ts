import type { ExtendedAssignmentTaskStatus } from '@/types/modules/assignmentWorkflow';
import { ASSIGNMENT_TASK_STATUS_LABELS } from '@/types/modules/assignmentStatus';

export const VISIT_TASK_STATUS_OPTIONS: Array<{
  value: ExtendedAssignmentTaskStatus;
  label: string;
  requiresNote?: boolean;
}> = [
  { value: 'done', label: 'Erledigt' },
  { value: 'not_done', label: 'Nicht durchgeführt', requiresNote: true },
  { value: 'not_wanted', label: 'Abgelehnt', requiresNote: true },
  { value: 'not_requested', label: 'Nicht erforderlich' },
  { value: 'open', label: 'Offen' },
];

export function visitTaskStatusLabel(status: ExtendedAssignmentTaskStatus): string {
  if (status in ASSIGNMENT_TASK_STATUS_LABELS) {
    return ASSIGNMENT_TASK_STATUS_LABELS[status as keyof typeof ASSIGNMENT_TASK_STATUS_LABELS];
  }
  switch (status) {
    case 'not_wanted':
      return 'Abgelehnt';
    case 'not_possible':
      return 'Nicht möglich';
    case 'skipped':
      return 'Übersprungen';
    case 'requires_follow_up':
      return 'Nachverfolgung';
    default:
      return status;
  }
}

export function visitTaskStatusRequiresNote(status: ExtendedAssignmentTaskStatus): boolean {
  return status === 'not_done' || status === 'not_wanted' || status === 'not_possible';
}
