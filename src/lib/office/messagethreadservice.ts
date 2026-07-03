import type { RoleKey, ServiceResult } from '@/types';
import type {
  OfficeChatAgeFilter,
  OfficeInboxFilter,
  OfficeMessageAudience,
  OfficeMessageCategory,
  OfficeMessagePriority,
  OfficeMessageThread,
  OfficeThreadStatus,
} from '@/types/office/messaging';
import {
  filterThreadsByAudience,
  filterThreadsByChatAge,
  isNewChat,
} from '@/lib/office/officemessengerfilters';
import {
  computeOfficeMessageNavBadgeCounts,
  type OfficeMessageNavBadgeCounts,
} from '@/lib/office/officeMessageNavBadges';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableServiceError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { type PreviewAwareResult } from '@/lib/supabase/missingtablefallback';
import { fromDbThreadType } from '@/lib/office/messagebusinessrules';
import { enrichThreadsWithEmployeeGroupParticipants } from '@/lib/office/employeeGroupChatService';
import { fromDbThreadStatus, isClosedAppStatus, toDbThreadStatus } from '@/lib/office/messagestatuslabels';
import { canViewOfficeInternalMessages } from '@/lib/communication/officeComposeRouting';

export const OFFICE_MESSAGING_SCHEMA_ERROR =
  'Office-Messaging: Supabase-Tabellen fehlen. Migration 0089_office_messaging_live anwenden.';

export function sortThreads(threads: OfficeMessageThread[]): OfficeMessageThread[] {
  return [...threads].sort((a, b) => {
    const aTime = a.lastMessageAt ?? a.createdAt;
    const bTime = b.lastMessageAt ?? b.createdAt;
    return bTime.localeCompare(aTime);
  });
}

function filterThreadsByInbox(
  threads: OfficeMessageThread[],
  filter: OfficeInboxFilter,
): OfficeMessageThread[] {
  switch (filter) {
    case 'clients':
      return threads.filter((thread) => thread.threadType === 'client_office');
    case 'employees':
      return threads.filter(
        (thread) =>
          thread.threadType === 'employee_office' || thread.threadType === 'employee_group_office',
      );
    case 'internal':
      return threads.filter((thread) => thread.threadType === 'internal');
    case 'closed':
      return threads.filter((thread) => isClosedAppStatus(thread.status) || thread.status === 'deleted');
    case 'inbox':
    default:
      return threads.filter(
        (thread) => !isClosedAppStatus(thread.status) && thread.status !== 'deleted',
      );
  }
}

function filterThreadsByRole(
  threads: OfficeMessageThread[],
  actorRoleKey?: RoleKey | null,
): OfficeMessageThread[] {
  return threads.filter((thread) => {
    if (thread.threadType === 'internal' && !canViewOfficeInternalMessages(actorRoleKey)) {
      return false;
    }
    return true;
  });
}

function mapThreadRow(row: Record<string, unknown>): OfficeMessageThread | null {
  const threadType = fromDbThreadType(String(row.thread_type ?? ''));
  if (!threadType) return null;

  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    threadType,
    status: fromDbThreadStatus(String(row.status ?? 'open')),
    priority: (row.priority as OfficeMessageThread['priority']) ?? 'normal',
    subject: String(row.subject ?? ''),
    categoryId: row.category_id ? String(row.category_id) : null,
    categoryLabel: null,
    clientId: row.client_id ? String(row.client_id) : null,
    clientName: null,
    employeeId: row.employee_id ? String(row.employee_id) : null,
    employeeName: null,
    participantName: null,
    assignedToUserId: row.assigned_to_user_id ? String(row.assigned_to_user_id) : null,
    assignedToUserName: null,
    assignedAt: row.assigned_at ? String(row.assigned_at) : null,
    closedAt: row.closed_at ? String(row.closed_at) : null,
    closedByUserId: row.closed_by_user_id ? String(row.closed_by_user_id) : null,
    participantProfileIds: [],
    lastMessageAt: row.last_message_at ? String(row.last_message_at) : null,
    lastMessagePreview: row.last_message_preview ? String(row.last_message_preview) : null,
    unreadCount: Number(row.office_unread_count ?? 0),
    archivedAt: row.archived_at ? String(row.archived_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function fetchThreadsLive(tenantId: string): Promise<ServiceResult<OfficeMessageThread[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { data, error } = await supabase
    .from('message_threads')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('thread_type', ['client', 'employee', 'employee_group', 'internal'])
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  const threads = (data ?? [])
    .map((row) => mapThreadRow(row as Record<string, unknown>))
    .filter((thread): thread is OfficeMessageThread => thread !== null);

  const enriched = await enrichThreadsWithEmployeeGroupParticipants(tenantId, threads);
  return { ok: true, data: enriched };
}

async function fetchThreadByIdLive(
  tenantId: string,
  threadId: string,
): Promise<ServiceResult<OfficeMessageThread | null>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { data, error } = await supabase
    .from('message_threads')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', threadId)
    .maybeSingle();

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  if (!data) return { ok: true, data: null };

  const thread = mapThreadRow(data as Record<string, unknown>);
  if (!thread) return { ok: true, data: null };

  if (thread.threadType === 'employee_group_office') {
    const [enriched] = await enrichThreadsWithEmployeeGroupParticipants(tenantId, [thread]);
    return { ok: true, data: enriched ?? thread };
  }
  return { ok: true, data: thread };
}

export async function fetchOfficeMessageThreads(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  filter: OfficeInboxFilter = 'inbox',
): Promise<PreviewAwareResult<OfficeMessageThread[]>> {
  return fetchOfficeMessageThreadsBySegment(tenantId, actorRoleKey, {
    audience: filter === 'clients' ? 'clients' : filter === 'internal' ? 'internal' : 'employees',
    chatAge: filter === 'closed' ? 'old' : filter === 'inbox' ? 'new' : 'current',
  });
}

export type OfficeMessageNavBadgeData = {
  counts: OfficeMessageNavBadgeCounts;
  newThreads: OfficeMessageThread[];
};

export async function fetchOfficeMessageNavBadgeData(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<PreviewAwareResult<OfficeMessageNavBadgeData>> {
  const denied = enforcePermission<OfficeMessageNavBadgeData>(actorRoleKey, 'office.messages.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const result = await fetchThreadsLive(tenantId);
  if (!result.ok && isMissingTableServiceError(result.error)) {
    return { ok: false, error: OFFICE_MESSAGING_SCHEMA_ERROR };
  }
  if (!result.ok) return result;

  const threads = filterThreadsByRole(result.data, actorRoleKey);
  const newThreads = threads.filter(isNewChat);
  return {
    ok: true,
    data: {
      counts: computeOfficeMessageNavBadgeCounts(threads),
      newThreads,
    },
    previewData: false,
  };
}

export async function fetchOfficeMessageNewChatCounts(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<PreviewAwareResult<OfficeMessageNavBadgeCounts>> {
  const result = await fetchOfficeMessageNavBadgeData(tenantId, actorRoleKey);
  if (!result.ok) return result;
  return { ok: true, data: result.data.counts, previewData: result.previewData };
}

export async function fetchOfficeMessageThreadsBySegment(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  segment: {
    audience: OfficeMessageAudience;
    chatAge: OfficeChatAgeFilter;
  } = { audience: 'employees', chatAge: 'new' },
): Promise<PreviewAwareResult<OfficeMessageThread[]>> {
  const denied = enforcePermission<OfficeMessageThread[]>(actorRoleKey, 'office.messages.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const result = await fetchThreadsLive(tenantId);
  if (!result.ok && isMissingTableServiceError(result.error)) {
    return { ok: false, error: OFFICE_MESSAGING_SCHEMA_ERROR };
  }
  if (!result.ok) return result;

  const threads = filterThreadsByRole(result.data, actorRoleKey);
  const byAudience = filterThreadsByAudience(threads, segment.audience);
  return {
    ok: true,
    data: filterThreadsByChatAge(byAudience, segment.chatAge),
    previewData: false,
  };
}

export async function fetchOfficeMessageThreadById(
  tenantId: string,
  threadId: string,
  actorRoleKey?: RoleKey | null,
): Promise<PreviewAwareResult<OfficeMessageThread | null>> {
  const denied = enforcePermission<OfficeMessageThread | null>(actorRoleKey, 'office.messages.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const result = await fetchThreadByIdLive(tenantId, threadId);
  if (!result.ok && isMissingTableServiceError(result.error)) {
    return { ok: false, error: OFFICE_MESSAGING_SCHEMA_ERROR };
  }
  if (!result.ok) return result;
  if (!result.data) return { ok: false, error: 'Chat nicht gefunden.' };
  if (result.data.threadType === 'internal' && !canViewOfficeInternalMessages(actorRoleKey)) {
    return { ok: false, error: 'Keine Berechtigung für interne Nachrichten.' };
  }
  return { ok: true, data: result.data, previewData: false };
}

export async function fetchOfficeMessageCategories(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<PreviewAwareResult<OfficeMessageCategory[]>> {
  const denied = enforcePermission<OfficeMessageCategory[]>(actorRoleKey, 'office.messages.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { data, error } = await supabase
    .from('message_categories')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    if (isMissingTableServiceError(toGermanSupabaseError(error))) {
      return { ok: false, error: OFFICE_MESSAGING_SCHEMA_ERROR };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  const categories = (data ?? []).map((row) => ({
    id: String(row.id),
    tenantId: String(row.tenant_id),
    key: String(row.key),
    label: String(row.label),
    audience: row.audience as OfficeMessageCategory['audience'],
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));

  return { ok: true, data: categories, previewData: false };
}

export async function patchOfficeMessageThread(
  tenantId: string,
  threadId: string,
  patch: {
    status?: OfficeThreadStatus;
    priority?: OfficeMessagePriority;
    categoryId?: string | null;
    assignedToUserId?: string | null;
  },
  actorRoleKey?: RoleKey | null,
  profileId?: string | null,
): Promise<ServiceResult<OfficeMessageThread>> {
  const denied = enforcePermission<OfficeMessageThread>(actorRoleKey, 'office.messages.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now };

  if (patch.status !== undefined) {
    update.status = toDbThreadStatus(patch.status);
    if (isClosedAppStatus(patch.status) || patch.status === 'archived') {
      update.closed_at = now;
      update.closed_by_user_id = profileId ?? null;
    }
  }
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.categoryId !== undefined) update.category_id = patch.categoryId;
  if (patch.assignedToUserId !== undefined) {
    update.assigned_to_user_id = patch.assignedToUserId;
    update.assigned_by_user_id = profileId ?? null;
    update.assigned_at = patch.assignedToUserId ? now : null;
  }

  const { error } = await supabase
    .from('message_threads')
    .update(update as never)
    .eq('tenant_id', tenantId)
    .eq('id', threadId);

  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  const refreshed = await fetchThreadByIdLive(tenantId, threadId);
  if (!refreshed.ok) return refreshed;
  if (!refreshed.data) return { ok: false, error: 'Chat nicht gefunden.' };
  return { ok: true, data: refreshed.data };
}

export { fetchThreadByIdLive, fetchThreadsLive };
