import type { RoleKey, ServiceResult } from '@/types';
import { getDemoMessages, getDemoThreads } from './communication.demoStore';
import { enforceCommunicationPermission } from './communication.permissions';
import type { CommunicationMessage, CommunicationThread, ThreadListItem } from './communication.types';
import { listThreads, type ListThreadsOptions } from './communication.service';

export type SearchResult = {
  threads: ThreadListItem[];
  messages: CommunicationMessage[];
};

export async function searchCommunication(
  tenantId: string,
  query: string,
  actorRoleKey?: RoleKey | null,
  profileId?: string,
  options?: ListThreadsOptions,
): Promise<ServiceResult<SearchResult>> {
  const denied = enforceCommunicationPermission<SearchResult>(
    actorRoleKey,
    'communication.view_center',
  );
  if (denied) return denied;

  const q = query.trim().toLowerCase();
  if (!q) {
    const threads = await listThreads(tenantId, options, actorRoleKey, profileId);
    if (!threads.ok) return threads;
    return { ok: true, data: { threads: threads.data, messages: [] } };
  }

  const threadResult = await listThreads(tenantId, { ...options, search: q }, actorRoleKey, profileId);
  if (!threadResult.ok) return threadResult;

  const messages = getDemoMessages().filter(
    (m) =>
      m.tenantId === tenantId &&
      !m.isInternalNote &&
      (m.bodyText?.toLowerCase().includes(q) ?? false),
  );

  return { ok: true, data: { threads: threadResult.data, messages } };
}

export function searchThreadsLocal(
  threads: CommunicationThread[],
  query: string,
): CommunicationThread[] {
  const q = query.trim().toLowerCase();
  if (!q) return threads;
  return threads.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      (t.previewText?.toLowerCase().includes(q) ?? false) ||
      (t.subject?.toLowerCase().includes(q) ?? false),
  );
}
