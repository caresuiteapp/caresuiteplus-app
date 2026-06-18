import type { RoleKey, ServiceResult } from '@/types';
import type {
  OfficeInboxFilter,
  OfficeMessageCategory,
  OfficeMessageThread,
} from '@/types/office/messaging';
import {
  demoOfficeMessageCategories,
  getDemoOfficeMessageThreads,
} from '@/data/demo/officemessagethreads';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableServiceError, toGermanSupabaseError } from '@/lib/supabase/errors';
import {
  resolveMissingTableList,
  type PreviewAwareResult,
} from '@/lib/supabase/missingtablefallback';
import { fromDbThreadType } from '@/lib/office/messagebusinessrules';
import { canViewOfficeInternalMessages } from '@/lib/communication/officeComposeRouting';

function filterThreadsByInbox(
  threads: OfficeMessageThread[],
  filter: OfficeInboxFilter,
): OfficeMessageThread[] {
  switch (filter) {
    case 'clients':
      return threads.filter((thread) => thread.threadType === 'client_office');
    case 'employees':
      return threads.filter((thread) => thread.threadType === 'employee_office');
    case 'internal':
      return threads.filter((thread) => thread.threadType === 'internal');
    case 'closed':
      return threads.filter((thread) =>
        ['resolved', 'archived', 'deleted'].includes(thread.status),
      );
    case 'inbox':
    default:
      return threads.filter(
        (thread) => !['resolved', 'archived', 'deleted'].includes(thread.status),
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
    status: (row.status as OfficeMessageThread['status']) ?? 'open',
    priority: (row.priority as OfficeMessageThread['priority']) ?? 'normal',
    subject: String(row.subject ?? ''),
    categoryId: row.category_id ? String(row.category_id) : null,
    categoryLabel: null,
    clientId: row.client_id ? String(row.client_id) : null,
    clientName: null,
    employeeId: row.employee_id ? String(row.employee_id) : null,
    employeeName: null,
    participantName: null,
    lastMessageAt: row.last_message_at ? String(row.last_message_at) : null,
    lastMessagePreview: row.last_message_preview ? String(row.last_message_preview) : null,
    unreadCount: 0,
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
    .in('thread_type', ['client', 'employee', 'internal'])
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  const threads = (data ?? [])
    .map((row) => mapThreadRow(row as Record<string, unknown>))
    .filter((thread): thread is OfficeMessageThread => thread !== null);

  return { ok: true, data: threads };
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
  return { ok: true, data: thread };
}

export async function fetchOfficeMessageThreads(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  filter: OfficeInboxFilter = 'inbox',
): Promise<PreviewAwareResult<OfficeMessageThread[]>> {
  const denied = enforcePermission<OfficeMessageThread[]>(actorRoleKey, 'office.messages.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'demo') {
    const threads = filterThreadsByRole(getDemoOfficeMessageThreads(), actorRoleKey);
    return { ok: true, data: filterThreadsByInbox(threads, filter), previewData: true };
  }

  const result = await fetchThreadsLive(tenantId);
  if (!result.ok && isMissingTableServiceError(result.error)) {
    const resolved = resolveMissingTableList(result, tenantId, getDemoOfficeMessageThreads);
    if (!resolved.ok) return resolved;
    const threads = filterThreadsByRole(resolved.data, actorRoleKey);
    return {
      ok: true,
      data: filterThreadsByInbox(threads, filter),
      previewData: resolved.usedDemoFallback,
    };
  }
  if (!result.ok) return result;

  const threads = filterThreadsByRole(result.data, actorRoleKey);
  return { ok: true, data: filterThreadsByInbox(threads, filter), previewData: false };
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

  if (getServiceMode() === 'demo') {
    const thread = getDemoOfficeMessageThreads().find((item) => item.id === threadId) ?? null;
    if (thread?.threadType === 'internal' && !canViewOfficeInternalMessages(actorRoleKey)) {
      return { ok: false, error: 'Keine Berechtigung für interne Nachrichten.' };
    }
    return { ok: true, data: thread, previewData: true };
  }

  const result = await fetchThreadByIdLive(tenantId, threadId);
  if (!result.ok && isMissingTableServiceError(result.error)) {
    const thread = getDemoOfficeMessageThreads().find((item) => item.id === threadId) ?? null;
    return { ok: true, data: thread, previewData: true };
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

  if (getServiceMode() === 'demo') {
    return { ok: true, data: demoOfficeMessageCategories, previewData: true };
  }

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
      return { ok: true, data: demoOfficeMessageCategories, previewData: true };
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

export { fetchThreadByIdLive, fetchThreadsLive };
