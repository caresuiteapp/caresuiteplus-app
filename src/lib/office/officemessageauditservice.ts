import type { ServiceResult } from '@/types';
import type { OfficeMessageThread, OfficeThreadType } from '@/types/office/messaging';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

export type OfficeMessageAuditAction =
  | 'office_message_thread_created'
  | 'office_message_sent'
  | 'office_message_status_changed'
  | 'office_message_assigned'
  | 'office_message_closed'
  | 'office_message_attachment_uploaded'
  | 'office_message_internal_note';

type AuditInput = {
  tenantId: string;
  action: OfficeMessageAuditAction;
  threadId: string;
  threadType: OfficeThreadType;
  clientId?: string | null;
  employeeId?: string | null;
  actorName?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
};

const ACTION_LABELS: Record<OfficeMessageAuditAction, string> = {
  office_message_thread_created: 'Chat erstellt',
  office_message_sent: 'Nachricht gesendet',
  office_message_status_changed: 'Status geändert',
  office_message_assigned: 'Chat zugewiesen',
  office_message_closed: 'Chat abgeschlossen',
  office_message_attachment_uploaded: 'Anhang hochgeladen',
  office_message_internal_note: 'Interne Notiz',
};

export async function logOfficeMessageAuditEvent(
  input: AuditInput,
): Promise<ServiceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, data: undefined };

  const actionLabel = ACTION_LABELS[input.action] ?? input.action;
  const details = input.summary;
  const actorName = input.actorName?.trim() || 'System';

  if (input.threadType === 'client_office' && input.clientId) {
    const result = await fromUnknownTable(supabase, 'client_audit_entries').insert({
      tenant_id: input.tenantId,
      client_id: input.clientId,
      action: actionLabel,
      actor_name: actorName,
      details,
    });
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true, data: undefined };
  }

  if (input.threadType === 'employee_office' && input.employeeId) {
    const result = await fromUnknownTable(supabase, 'employee_audit_events').insert({
      tenant_id: input.tenantId,
      employee_id: input.employeeId,
      action: input.action,
      summary: `${actionLabel}: ${details}`,
      metadata: input.metadata ?? { threadId: input.threadId },
    });
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true, data: undefined };
  }

  return { ok: true, data: undefined };
}

export function auditFromThread(
  thread: Pick<OfficeMessageThread, 'id' | 'threadType' | 'clientId' | 'employeeId'>,
): Pick<AuditInput, 'threadId' | 'threadType' | 'clientId' | 'employeeId'> {
  return {
    threadId: thread.id,
    threadType: thread.threadType,
    clientId: thread.clientId,
    employeeId: thread.employeeId,
  };
}
