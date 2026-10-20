import type { RoleKey, ServiceResult } from '@/types';
import type {
  TeamChannelKey,
  TeamThread,
  TeamThreadComment,
} from '@/types/modules/internalTasks';
import { TEAM_CHANNEL_LABELS } from '@/types/modules/internalTasks';
import { enforcePermission } from '@/lib/permissions';
import { guardLiveDemoFeature, guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  INTERNAL_TASK_STORE,
  nextReadStatusId,
  nextTeamThreadCommentId,
  nextTeamThreadId,
} from './internalTaskStore';

export function createTeamThread(input: {
  tenantId: string;
  channelKey: TeamChannelKey;
  title: string;
  linkedTaskId?: string | null;
  createdByUserId?: string | null;
}): TeamThread {
  const now = new Date().toISOString();
  const thread: TeamThread = {
    id: nextTeamThreadId(),
    tenantId: input.tenantId,
    channelKey: input.channelKey,
    title: input.title,
    linkedTaskId: input.linkedTaskId ?? null,
    isArchived: false,
    createdByUserId: input.createdByUserId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  INTERNAL_TASK_STORE.threads.push(thread);
  return thread;
}

export function addTeamThreadComment(input: {
  tenantId: string;
  threadId: string;
  body: string;
  authorUserId?: string | null;
  authorDisplayName: string;
  mentions?: string[];
}): TeamThreadComment | null {
  const thread = INTERNAL_TASK_STORE.threads.find(
    (t) => t.id === input.threadId && t.tenantId === input.tenantId,
  );
  if (!thread || thread.isArchived) return null;

  const comment: TeamThreadComment = {
    id: nextTeamThreadCommentId(),
    tenantId: input.tenantId,
    threadId: input.threadId,
    authorUserId: input.authorUserId ?? null,
    authorDisplayName: input.authorDisplayName,
    body: input.body,
    mentions: input.mentions ?? [],
    isInternalOnly: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  INTERNAL_TASK_STORE.threadComments.push(comment);
  thread.updatedAt = comment.createdAt;
  return comment;
}

export function markThreadRead(tenantId: string, threadId: string, userId: string): void {
  const existing = INTERNAL_TASK_STORE.readStatuses.find(
    (r) => r.tenantId === tenantId && r.threadId === threadId && r.userId === userId,
  );
  const now = new Date().toISOString();
  if (existing) {
    existing.lastReadAt = now;
    return;
  }
  INTERNAL_TASK_STORE.readStatuses.push({
    id: nextReadStatusId(),
    tenantId,
    threadId,
    userId,
    lastReadAt: now,
  });
}

export function archiveTeamThread(tenantId: string, threadId: string): TeamThread | null {
  const thread = INTERNAL_TASK_STORE.threads.find(
    (t) => t.id === threadId && t.tenantId === tenantId,
  );
  if (!thread) return null;
  thread.isArchived = true;
  thread.updatedAt = new Date().toISOString();
  return thread;
}

export function listTeamThreads(
  tenantId: string,
  filter?: { channelKey?: TeamChannelKey; search?: string; includeArchived?: boolean },
): TeamThread[] {
  let items = INTERNAL_TASK_STORE.threads.filter((t) => t.tenantId === tenantId);
  if (!filter?.includeArchived) items = items.filter((t) => !t.isArchived);
  if (filter?.channelKey) items = items.filter((t) => t.channelKey === filter.channelKey);
  if (filter?.search?.trim()) {
    const q = filter.search.trim().toLowerCase();
    items = items.filter((t) => t.title.toLowerCase().includes(q));
  }
  return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function listTeamThreadComments(tenantId: string, threadId: string): TeamThreadComment[] {
  return INTERNAL_TASK_STORE.threadComments
    .filter((c) => c.tenantId === tenantId && c.threadId === threadId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function isThreadUnread(tenantId: string, threadId: string, userId: string): boolean {
  const thread = INTERNAL_TASK_STORE.threads.find((t) => t.id === threadId && t.tenantId === tenantId);
  if (!thread) return false;
  const read = INTERNAL_TASK_STORE.readStatuses.find(
    (r) => r.tenantId === tenantId && r.threadId === threadId && r.userId === userId,
  );
  if (!read) return true;
  return new Date(thread.updatedAt).getTime() > new Date(read.lastReadAt).getTime();
}

export async function fetchTeamThreads(
  tenantId: string,
  filter: Parameters<typeof listTeamThreads>[1],
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TeamThread[]>> {
  const denied = enforcePermission<TeamThread[]>(actorRoleKey, 'office.access');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const liveBlock = guardLiveDemoFeature<TeamThread[]>(tenantId, 'Teamkommunikation');
  if (liveBlock) return liveBlock;

  if (actorRoleKey === 'client_portal' || actorRoleKey === 'family_portal') {
    return { ok: false, error: 'Teamkommunikation ist für Portale nicht sichtbar.' };
  }

  return { ok: true, data: listTeamThreads(tenantId, filter) };
}

export function getTeamChannelLabel(channel: TeamChannelKey): string {
  return TEAM_CHANNEL_LABELS[channel] ?? channel;
}

export function assertCommentSensitivityForChannel(
  channelKey: TeamChannelKey,
  sensitivity: 'health_data' | 'billing' | 'internal',
): { allowed: boolean; reason?: string } {
  if (sensitivity === 'health_data' && channelKey === 'billing') {
    return { allowed: false, reason: 'Gesundheitsdaten dürfen nicht im Abrechnungskanal geteilt werden.' };
  }
  if (sensitivity === 'billing' && channelKey === 'employee_questions') {
    return { allowed: false, reason: 'Abrechnungsdaten dürfen nicht im Mitarbeiterfragen-Kanal geteilt werden.' };
  }
  return { allowed: true };
}
