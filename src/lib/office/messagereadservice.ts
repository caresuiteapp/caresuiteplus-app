import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableServiceError, toGermanSupabaseError } from '@/lib/supabase/errors';
import type { PortalActor } from '@/lib/office/portalofficemessageservice';
import { OFFICE_MESSAGING_SCHEMA_ERROR } from '@/lib/office/messagethreadservice';

function officeMessagingError(error: string): ServiceResult<never> {
  if (isMissingTableServiceError(error)) {
    return { ok: false, error: OFFICE_MESSAGING_SCHEMA_ERROR };
  }
  return { ok: false, error };
}

/** Office: ungelesene Portal-Nachrichten als gelesen markieren, Zähler zurücksetzen. */
export async function markOfficeThreadMessagesRead(
  tenantId: string,
  threadId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<void>> {
  const denied = enforcePermission<void>(actorRoleKey, 'office.messages.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const now = new Date().toISOString();

  const { error: messagesError } = await supabase
    .from('messages')
    .update({ status: 'read', read_at: now, updated_at: now })
    .eq('tenant_id', tenantId)
    .eq('thread_id', threadId)
    .is('read_at', null)
    .or('sender_client_id.not.is.null,sender_employee_id.not.is.null');

  if (messagesError) return officeMessagingError(toGermanSupabaseError(messagesError));

  const { error: threadError } = await supabase
    .from('message_threads')
    .update({ office_unread_count: 0, updated_at: now })
    .eq('tenant_id', tenantId)
    .eq('id', threadId);

  if (threadError) return officeMessagingError(toGermanSupabaseError(threadError));

  return { ok: true, data: undefined };
}

/** Portal: Office-Nachrichten als gelesen markieren, Portal-Zähler zurücksetzen. */
export async function markPortalThreadMessagesRead(
  tenantId: string,
  threadId: string,
  actor: PortalActor,
): Promise<ServiceResult<void>> {
  const permission =
    actor.audience === 'client' ? 'portal.client.messages.view' : 'portal.employee.messages.view';
  const denied = enforcePermission<void>(actor.roleKey, permission);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const now = new Date().toISOString();

  const { error: messagesError } = await supabase
    .from('messages')
    .update({ status: 'read', read_at: now, updated_at: now })
    .eq('tenant_id', tenantId)
    .eq('thread_id', threadId)
    .eq('is_internal_note', false)
    .is('read_at', null)
    .not('sender_profile_id', 'is', null);

  if (messagesError) return officeMessagingError(toGermanSupabaseError(messagesError));

  const { error: threadError } = await supabase
    .from('message_threads')
    .update({ portal_unread_count: 0, updated_at: now })
    .eq('tenant_id', tenantId)
    .eq('id', threadId);

  if (threadError) return officeMessagingError(toGermanSupabaseError(threadError));

  return { ok: true, data: undefined };
}
