import type { ClientTask } from '@/types/modules/client';

export type AssignmentCreateTaskSelection = {
  clientTaskId: string;
  title: string;
};

export function getActiveClientTasksForAssignment(tasks: ClientTask[]): ClientTask[] {
  return tasks.filter((task) => task.isActive);
}

export function buildDefaultTaskSelections(tasks: ClientTask[]): AssignmentCreateTaskSelection[] {
  return getActiveClientTasksForAssignment(tasks).map((task) => ({
    clientTaskId: task.id,
    title: task.title,
  }));
}

export function toggleTaskSelection(
  selected: AssignmentCreateTaskSelection[],
  task: ClientTask,
): AssignmentCreateTaskSelection[] {
  const exists = selected.some((entry) => entry.clientTaskId === task.id);
  if (exists) {
    return selected.filter((entry) => entry.clientTaskId !== task.id);
  }
  return [...selected, { clientTaskId: task.id, title: task.title }];
}

export function isTaskSelected(
  selected: AssignmentCreateTaskSelection[],
  taskId: string,
): boolean {
  return selected.some((entry) => entry.clientTaskId === taskId);
}
