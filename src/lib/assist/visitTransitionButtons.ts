import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';

/**
 * Pure, dependency-light status-action normalizer.
 * Kept outside workflow/repository modules to avoid circular runtime imports.
 */
export function dedupeStatusTransitionButtons(
  transitions: AssignmentStatus[],
): AssignmentStatus[] {
  const seen = new Set<string>();
  const result: AssignmentStatus[] = [];
  for (const status of transitions) {
    const label = ASSIGNMENT_STATUS_LABELS[status];
    if (seen.has(label)) continue;
    seen.add(label);
    result.push(status);
  }
  return result;
}
