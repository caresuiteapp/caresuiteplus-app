import type { AssignmentWorkflowRecord } from '@/types/modules/assignmentWorkflow';
import { upsertAssignmentWorkflowRecord } from './assignmentWorkflowService';

export function upsertAssignmentForMonitor(record: AssignmentWorkflowRecord): AssignmentWorkflowRecord {
  return upsertAssignmentWorkflowRecord(record);
}
