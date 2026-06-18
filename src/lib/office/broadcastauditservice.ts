import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

export type BroadcastAuditAction =
  | 'broadcast_created'
  | 'broadcast_sent'
  | 'broadcast_archived'
  | 'broadcast_read'
  | 'broadcast_acknowledged'
  | 'broadcast_reply_started'
  | 'broadcast_attachment_uploaded'
  | 'broadcast_recipients_created'
  | 'broadcast_send_failed';

type AuditInput = {
  tenantId: string;
  actorUserId?: string | null;
  action: BroadcastAuditAction;
  broadcastId: string;
  metadata?: Record<string, unknown>;
};

export async function logBroadcastAuditEvent(input: AuditInput): Promise<ServiceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, data: undefined };

  const result = await fromUnknownTable(supabase, 'broadcast_audit_events').insert({
    tenant_id: input.tenantId,
    actor_user_id: input.actorUserId ?? null,
    action: input.action,
    entity_type: 'notification_broadcast',
    entity_id: input.broadcastId,
    metadata: input.metadata ?? {},
  });

  if (result.error) return { ok: false, error: result.error.message };
  return { ok: true, data: undefined };
}
