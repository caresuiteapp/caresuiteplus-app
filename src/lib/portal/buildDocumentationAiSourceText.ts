import type { EmployeePortalTaskItem } from '@/types/modules/employeePortalExecution';

/** Builds bullet seed text for documentation AI from completed visit tasks. */
export function buildDocumentationAiSourceFromTasks(tasks: EmployeePortalTaskItem[]): string {
  const done = tasks.filter((task) => task.status === 'done');
  if (done.length === 0) return '';
  return done.map((task) => `- ${task.title}`).join('\n');
}

export function resolveDocumentationAiSourceText(
  ...parts: Array<string | null | undefined>
): string {
  for (const part of parts) {
    const trimmed = part?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}
