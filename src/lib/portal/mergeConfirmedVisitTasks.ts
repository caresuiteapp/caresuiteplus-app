import type { EmployeePortalTaskItem } from '@/types/modules/employeePortalExecution';

/** Append confirmed rows without replacing a current status, note or local draft. */
export function mergeConfirmedOptionalTasks(base: EmployeePortalTaskItem[], additions: EmployeePortalTaskItem[]) {
  const ids = new Set(base.map(task => task.id));
  const merged = [...base];
  for (const task of additions) {
    if (ids.has(task.id)) continue;
    ids.add(task.id); merged.push(task);
  }
  return merged;
}
