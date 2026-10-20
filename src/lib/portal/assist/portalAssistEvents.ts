import type { PortalRequest } from '@/types/portal/assist';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

/** Best-effort audit log + office notification stub on portal request create. */
export async function stubEmployeeNotificationForRequest(request: PortalRequest): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  await tryInsertAuditLog(request);
  await tryInsertOfficeTask(request);
}

async function tryInsertAuditLog(request: PortalRequest): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await fromUnknownTable(supabase, 'audit_logs').insert({
    tenant_id: request.tenantId,
    action: 'portal_request_created',
    entity_type: 'portal_request',
    entity_id: request.id,
    metadata: {
      client_id: request.clientId,
      request_type: request.requestType,
      title: request.title,
    },
  });

  if (error && !isMissingTableError(error)) {
    console.warn('[stubEmployeeNotification] audit_logs:', error.message);
  }
}

async function tryInsertOfficeTask(request: PortalRequest): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await fromUnknownTable(supabase, 'office_tasks').insert({
    tenant_id: request.tenantId,
    client_id: request.clientId,
    title: `Portal-Anfrage: ${request.title}`,
    description: request.description,
    status: 'offen',
    priority: 'normal',
    source: 'portal_request',
    source_id: request.id,
  });

  if (error && !isMissingTableError(error)) {
    console.warn('[stubEmployeeNotification] office_tasks:', error.message);
  }
}
