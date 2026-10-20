import type { EmployeePortalTaskItem } from '@/types/modules/employeePortalExecution';
import type { ExtendedAssignmentTaskStatus } from '@/types/modules/assignmentWorkflow';
import { resolveVisitTaskCategory } from '@/lib/portal/resolveVisitTaskCategory';

export type VisitTaskCategoryKey =
  | 'haushalt'
  | 'betreuung'
  | 'einkauf'
  | 'pflege'
  | 'sonstiges';

export const VISIT_TASK_CATEGORY_LABELS: Record<VisitTaskCategoryKey, string> = {
  haushalt: 'Haushalt',
  betreuung: 'Betreuung',
  einkauf: 'Einkauf',
  pflege: 'Pflege',
  sonstiges: 'Sonstiges',
};

export type VisitTaskCategoryGroup = {
  key: VisitTaskCategoryKey;
  label: string;
  tasks: EmployeePortalTaskItem[];
  doneCount: number;
  totalCount: number;
  isComplete: boolean;
};

const GROUP_ORDER: VisitTaskCategoryKey[] = [
  'haushalt',
  'betreuung',
  'einkauf',
  'pflege',
  'sonstiges',
];

export function isTaskDone(status: ExtendedAssignmentTaskStatus): boolean {
  return status === 'done';
}

export function countDoneTasks(tasks: EmployeePortalTaskItem[]): number {
  return tasks.filter((task) => isTaskDone(task.status)).length;
}

export function groupEmployeePortalTasks(tasks: EmployeePortalTaskItem[]): VisitTaskCategoryGroup[] {
  const buckets = new Map<
    string,
    { key: VisitTaskCategoryKey; label: string; tasks: EmployeePortalTaskItem[] }
  >();

  for (const task of tasks) {
    const resolved = resolveVisitTaskCategory(task);
    const bucketId = `${resolved.key}::${resolved.label}`;
    const existing = buckets.get(bucketId);
    if (existing) {
      existing.tasks.push(task);
    } else {
      buckets.set(bucketId, { key: resolved.key, label: resolved.label, tasks: [task] });
    }
  }

  return [...buckets.values()]
    .sort((a, b) => {
      const ai = GROUP_ORDER.indexOf(a.key);
      const bi = GROUP_ORDER.indexOf(b.key);
      if (ai !== bi) return ai - bi;
      return a.label.localeCompare(b.label, 'de');
    })
    .map((bucket) => {
      const doneCount = countDoneTasks(bucket.tasks);
      return {
        key: bucket.key,
        label: bucket.label,
        tasks: bucket.tasks,
        doneCount,
        totalCount: bucket.tasks.length,
        isComplete: doneCount === bucket.tasks.length && bucket.tasks.length > 0,
      };
    });
}
