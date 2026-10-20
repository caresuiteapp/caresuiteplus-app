import type { RoleKey } from '@/types';
import type {
  CreateEmployeeGroupChatInput,
  OfficeMessageThread,
} from '@/types/office/messaging';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableServiceError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { type PreviewAwareResult } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import {
  uniqueEmployeeGroupParticipantIds,
  validateEmployeeGroupChatInput,
} from '@/lib/office/messagebusinessrules';
import {
  createOfficeMessageThread,
} from '@/lib/office/messageservice';
import { fetchOfficeMessageThreadById } from '@/lib/office/messagethreadservice';
import { formatPersonFullName } from '@/lib/office/officemessagemappers';

const EMPLOYEE_PARTICIPANTS_TABLE = 'message_thread_employee_participants';

export function resolveEmployeeGroupParticipantLabel(
  names: string[],
  memberCount: number,
): string {
  if (names.length === 0) {
    return memberCount > 0 ? `${memberCount} Mitglieder` : 'Gruppen-Chat';
  }
  if (names.length <= 2) return names.join(' · ');
  return `${names.slice(0, 2).join(' · ')} · +${memberCount - 2}`;
}

export function isDirectEmployeeThread(thread: OfficeMessageThread): boolean {
  return thread.threadType === 'employee_office';
}

export function isEmployeeGroupChatThread(thread: OfficeMessageThread): boolean {
  return thread.threadType === 'employee_group_office';
}

export async function createEmployeeGroupChat(
  tenantId: string,
  input: CreateEmployeeGroupChatInput,
  actorRoleKey?: RoleKey | null,
  profileId?: string | null,
): Promise<PreviewAwareResult<OfficeMessageThread>> {
  const denied = enforcePermission<OfficeMessageThread>(actorRoleKey, 'office.access');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const validation = validateEmployeeGroupChatInput({
    subject: input.subject,
    employeeIds: input.employeeIds,
  });
  if (!validation.ok) return validation;

  const uniqueEmployeeIds = uniqueEmployeeGroupParticipantIds(input.employeeIds);

  return createOfficeMessageThread(
    tenantId,
    {
      threadType: 'employee_group_office',
      subject: input.subject.trim(),
      categoryId: input.categoryId ?? null,
      employeeParticipantIds: uniqueEmployeeIds,
      initialMessage: input.initialMessage,
      priority: input.priority,
    },
    actorRoleKey,
    profileId,
  );
}

type EmployeeParticipantRow = {
  thread_id: string;
  employee_id: string;
  is_active: boolean;
};

export async function fetchEmployeeParticipantsForThreads(
  tenantId: string,
  threadIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (threadIds.length === 0) return map;

  const supabase = getSupabaseClient();
  if (!supabase) return map;

  const { data, error } = await fromUnknownTable(supabase, EMPLOYEE_PARTICIPANTS_TABLE)
    .select('thread_id, employee_id, is_active')
    .eq('tenant_id', tenantId)
    .in('thread_id', threadIds)
    .eq('is_active', true);

  if (error) return map;

  for (const row of (data ?? []) as EmployeeParticipantRow[]) {
    const threadId = String(row.thread_id);
    const employeeId = String(row.employee_id);
    const list = map.get(threadId) ?? [];
    list.push(employeeId);
    map.set(threadId, list);
  }
  return map;
}

export async function fetchEmployeeNamesById(
  tenantId: string,
  employeeIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (employeeIds.length === 0) return map;

  const supabase = getSupabaseClient();
  if (!supabase) return map;

  const { data, error } = await supabase
    .from('employees')
    .select('id, first_name, last_name')
    .eq('tenant_id', tenantId)
    .in('id', employeeIds);

  if (error) return map;

  for (const row of data ?? []) {
    const id = String(row.id);
    const name = formatPersonFullName(
      row.first_name ? String(row.first_name) : null,
      row.last_name ? String(row.last_name) : null,
    );
    if (name) map.set(id, name);
  }
  return map;
}

export async function enrichThreadsWithEmployeeGroupParticipants(
  tenantId: string,
  threads: OfficeMessageThread[],
): Promise<OfficeMessageThread[]> {
  const groupThreadIds = threads
    .filter((thread) => thread.threadType === 'employee_group_office')
    .map((thread) => thread.id);
  if (groupThreadIds.length === 0) return threads;

  const participantsByThread = await fetchEmployeeParticipantsForThreads(tenantId, groupThreadIds);
  const allEmployeeIds = [...new Set([...participantsByThread.values()].flat())];
  const namesById = await fetchEmployeeNamesById(tenantId, allEmployeeIds);

  return threads.map((thread) => {
    if (thread.threadType !== 'employee_group_office') return thread;

    const employeeParticipantIds = participantsByThread.get(thread.id) ?? [];
    const employeeParticipantNames = employeeParticipantIds
      .map((id) => namesById.get(id))
      .filter((name): name is string => Boolean(name));
    const memberCount = employeeParticipantIds.length;

    return {
      ...thread,
      employeeParticipantIds,
      employeeParticipantNames,
      memberCount,
      participantName: resolveEmployeeGroupParticipantLabel(employeeParticipantNames, memberCount),
    };
  });
}

export async function fetchEmployeeGroupThreadDetail(
  tenantId: string,
  threadId: string,
  actorRoleKey?: RoleKey | null,
): Promise<PreviewAwareResult<OfficeMessageThread | null>> {
  const result = await fetchOfficeMessageThreadById(tenantId, threadId, actorRoleKey);
  if (!result.ok || !result.data) return result;
  if (result.data.threadType !== 'employee_group_office') {
    return { ok: true, data: result.data, previewData: result.previewData };
  }

  const [enriched] = await enrichThreadsWithEmployeeGroupParticipants(tenantId, [result.data]);
  return { ok: true, data: enriched ?? result.data, previewData: result.previewData };
}

export async function insertEmployeeGroupParticipants(
  tenantId: string,
  threadId: string,
  employeeIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const rows = employeeIds.map((employeeId) => ({
    tenant_id: tenantId,
    thread_id: threadId,
    employee_id: employeeId,
    is_active: true,
  }));

  const { error } = await fromUnknownTable(supabase, EMPLOYEE_PARTICIPANTS_TABLE).insert(rows);
  if (error) {
    if (isMissingTableServiceError(toGermanSupabaseError(error))) {
      return {
        ok: false,
        error:
          'Gruppen-Chat-Teilnehmer konnten nicht gespeichert werden. Migration 0224_employee_group_chats anwenden.',
      };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }
  return { ok: true };
}
