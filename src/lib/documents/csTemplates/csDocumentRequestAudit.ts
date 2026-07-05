import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

export type CsDocumentRequestAuditAction =
  | 'document_request_created'
  | 'document_request_sent'
  | 'document_request_opened'
  | 'document_request_signed'
  | 'document_request_completed'
  | 'document_request_cancelled';

export async function logCsDocumentRequestAudit(input: {
  tenantId: string;
  requestId: string;
  action: CsDocumentRequestAuditAction;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await fromUnknownTable(supabase, 'audit_logs').insert({
    tenant_id: input.tenantId,
    action: input.action,
    entity_type: 'cs_document_request',
    entity_id: input.requestId,
    table_name: 'cs_document_requests',
    metadata: input.metadata ?? {},
  });

  if (error && !isMissingTableError(error)) {
    console.warn('[csDocumentRequestAudit]', error.message);
  }
}

/**
 * Phase 2: Events werden best-effort in audit_logs geschrieben.
 * Falls RLS/Schema fehlt, bleibt der Dokumentenflow unberührt.
 */
export const CS_DOCUMENT_REQUEST_AUDIT_EVENTS: CsDocumentRequestAuditAction[] = [
  'document_request_created',
  'document_request_sent',
  'document_request_opened',
  'document_request_signed',
  'document_request_completed',
  'document_request_cancelled',
];
