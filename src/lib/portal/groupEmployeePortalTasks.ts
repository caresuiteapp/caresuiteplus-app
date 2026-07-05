import type { EmployeePortalTaskItem } from '@/types/modules/employeePortalExecution';
import type { ExtendedAssignmentTaskStatus } from '@/types/modules/assignmentWorkflow';

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

const CATEGORY_KEYWORDS: Record<Exclude<VisitTaskCategoryKey, 'sonstiges'>, string[]> = {
  haushalt: ['haushalt', 'staub', 'wisch', 'putz', 'geschirr', 'müll', 'fenster', 'bügel', 'wäsche'],
  betreuung: ['betreu', 'begleit', 'spazier', 'aktivier', 'demenz', 'gespräch', 'sozial'],
  einkauf: ['einkauf', 'apotheke', 'lebensmittel', 'besorg'],
  pflege: ['pflege', 'körper', 'anzieh', 'medik', 'mobilis', 'ernähr', 'essen', 'trink'],
};

function inferCategory(task: EmployeePortalTaskItem): VisitTaskCategoryKey {
  const haystack = `${task.title} ${task.description ?? ''}`.toLowerCase();
  for (const [key, keywords] of Object.entries(CATEGORY_KEYWORDS) as Array<
    [Exclude<VisitTaskCategoryKey, 'sonstiges'>, string[]]
  >) {
    if (keywords.some((word) => haystack.includes(word))) {
      return key;
    }
  }
  return 'sonstiges';
}

export function isTaskDone(status: ExtendedAssignmentTaskStatus): boolean {
  return status === 'done';
}

export function countDoneTasks(tasks: EmployeePortalTaskItem[]): number {
  return tasks.filter((task) => isTaskDone(task.status)).length;
}

export function groupEmployeePortalTasks(tasks: EmployeePortalTaskItem[]): VisitTaskCategoryGroup[] {
  const buckets = new Map<VisitTaskCategoryKey, EmployeePortalTaskItem[]>();

  for (const task of tasks) {
    const key = inferCategory(task);
    const list = buckets.get(key) ?? [];
    list.push(task);
    buckets.set(key, list);
  }

  const order: VisitTaskCategoryKey[] = ['haushalt', 'betreuung', 'einkauf', 'pflege', 'sonstiges'];

  return order
    .filter((key) => (buckets.get(key)?.length ?? 0) > 0)
    .map((key) => {
      const groupTasks = buckets.get(key) ?? [];
      const doneCount = countDoneTasks(groupTasks);
      return {
        key,
        label: VISIT_TASK_CATEGORY_LABELS[key],
        tasks: groupTasks,
        doneCount,
        totalCount: groupTasks.length,
        isComplete: doneCount === groupTasks.length && groupTasks.length > 0,
      };
    });
}
