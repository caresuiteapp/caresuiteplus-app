import type { RoleKey, ServiceResult } from '@/types';
import type { KIMMailbox, KIMMailboxQuery, KIMMailboxResult, KIMMessageListItem } from '@/types/modules/ti';
import { queryKIMMailbox } from '@/data/demo/ti/kimQuery';
import {
  TI_DEMO_TENANT,
  demoKIMMailboxes,
  getKIMMessages,
  toKIMMessageListItem,
} from '@/data/demo/ti';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { kimMailboxesSupabaseRepository, kimMessagesSupabaseRepository } from '@/lib/ti/repositories';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { checkTIConsent } from './tiConsentService';

function toListItem(m: {
  id: string;
  tenantId: string;
  mailboxId: string;
  sender: string;
  senderName: string | null;
  subject: string;
  preview: string;
  status: KIMMessageListItem['status'];
  receivedAt: string;
  hasAttachments: boolean;
  isMedical: boolean;
}): KIMMessageListItem {
  return {
    id: m.id,
    tenantId: m.tenantId,
    mailboxId: m.mailboxId,
    sender: m.sender,
    senderName: m.senderName,
    subject: m.subject,
    preview: m.preview,
    status: m.status,
    receivedAt: m.receivedAt,
    hasAttachments: m.hasAttachments,
    isMedical: m.isMedical,
  };
}

export async function fetchKIMMailbox(
  tenantId: string,
  query: KIMMailboxQuery,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<KIMMailboxResult>> {
  const denied = enforcePermission<KIMMailboxResult>(actorRoleKey, 'ti.kim.view');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  const consentCheck = await checkTIConsent(tenantId, ['kim'], actorRoleKey);
  if (consentCheck.ok && !consentCheck.data.hasConsent) {
    return { ok: false, error: consentCheck.data.blockedReason ?? 'Einwilligung für KIM fehlt.' };
  }

  if (getServiceMode() === 'supabase') {
    const mailboxes = await kimMailboxesSupabaseRepository.list(tenantId);
    if (!mailboxes.ok) return mailboxes;
    if (mailboxes.data.length === 0) {
      return {
        ok: false,
        error: 'provider_required: Kein KIM-Postfach konfiguriert. Bitte TI-Provider einrichten.',
      };
    }

    const messages = await kimMessagesSupabaseRepository.list(tenantId, query.mailboxId);
    if (!messages.ok) return messages;

    const items = messages.data.map(toListItem);
    const result = queryKIMMailbox(items, query);
    return { ok: true, data: result };
  }

  if (tenantId !== TI_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };

  await new Promise((r) => setTimeout(r, 180));

  const messages = getKIMMessages().map(toKIMMessageListItem);
  const result = queryKIMMailbox(messages, query);

  return { ok: true, data: result };
}

export async function fetchKIMMailboxes(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<KIMMailbox[]>> {
  const denied = enforcePermission<KIMMailbox[]>(actorRoleKey, 'ti.kim.view');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (getServiceMode() === 'supabase') {
    const result = await kimMailboxesSupabaseRepository.list(tenantId);
    if (!result.ok) return result;
    if (result.data.length === 0) {
      return {
        ok: false,
        error: 'provider_required: Kein KIM-Postfach konfiguriert. Bitte TI-Provider einrichten.',
      };
    }
    return { ok: true, data: result.data };
  }

  if (tenantId !== TI_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };

  await new Promise((r) => setTimeout(r, 100));
  return { ok: true, data: demoKIMMailboxes };
}
