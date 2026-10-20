import type {
  InternalTask,
  TaskAttachment,
  TaskComment,
  TeamThread,
  TeamThreadComment,
  TeamThreadReadStatus,
} from '@/types/modules/internalTasks';

export type InternalTaskStore = {
  tasks: InternalTask[];
  comments: TaskComment[];
  attachments: TaskAttachment[];
  threads: TeamThread[];
  threadComments: TeamThreadComment[];
  readStatuses: TeamThreadReadStatus[];
};

export const INTERNAL_TASK_STORE: InternalTaskStore = {
  tasks: [],
  comments: [],
  attachments: [],
  threads: [],
  threadComments: [],
  readStatuses: [],
};

let taskCounter = 0;
let commentCounter = 0;
let attachmentCounter = 0;
let threadCounter = 0;
let threadCommentCounter = 0;
let readStatusCounter = 0;

export function nextInternalTaskId(): string {
  taskCounter += 1;
  return `int-task-${taskCounter}`;
}

export function nextTaskCommentId(): string {
  commentCounter += 1;
  return `task-cmt-${commentCounter}`;
}

export function nextTaskAttachmentId(): string {
  attachmentCounter += 1;
  return `task-att-${attachmentCounter}`;
}

export function nextTeamThreadId(): string {
  threadCounter += 1;
  return `team-thread-${threadCounter}`;
}

export function nextTeamThreadCommentId(): string {
  threadCommentCounter += 1;
  return `team-cmt-${threadCommentCounter}`;
}

export function nextReadStatusId(): string {
  readStatusCounter += 1;
  return `read-st-${readStatusCounter}`;
}

export function resetInternalTaskStore(): void {
  INTERNAL_TASK_STORE.tasks.length = 0;
  INTERNAL_TASK_STORE.comments.length = 0;
  INTERNAL_TASK_STORE.attachments.length = 0;
  INTERNAL_TASK_STORE.threads.length = 0;
  INTERNAL_TASK_STORE.threadComments.length = 0;
  INTERNAL_TASK_STORE.readStatuses.length = 0;
  taskCounter = 0;
  commentCounter = 0;
  attachmentCounter = 0;
  threadCounter = 0;
  threadCommentCounter = 0;
  readStatusCounter = 0;
}

export function filterTasksByTenant(tasks: InternalTask[], tenantId: string): InternalTask[] {
  return tasks.filter((t) => t.tenantId === tenantId);
}
