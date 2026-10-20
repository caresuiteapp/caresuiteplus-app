import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import type { DocumentEngineAuditEntry } from '@/types/documents/documentEngine';

export async function writeDocumentAuditLog(input: {
  tenantId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId?: string | null;
  actorRole?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const tenantId = input.tenantId;
  if (!tenantId) {
    const { data: t } = await fromUnknownTable(supabase, 'tenants').select('id').limit(1).maybeSingle();
    if (!t) return;
  }

  await fromUnknownTable(supabase, 'document_audit_log').insert({
    tenant_id: input.tenantId ?? (await fromUnknownTable(supabase, 'tenants').select('id').limit(1).single()).data?.id,
    actor_user_id: input.actorUserId ?? null,
    actor_role: input.actorRole ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    old_value_json: input.oldValue ?? null,
    new_value_json: input.newValue ?? null,
  });
}

export async function listDocumentAuditLog(
  tenantId: string,
  limit = 50,
): Promise<DocumentEngineAuditEntry[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data } = await fromUnknownTable(supabase, 'document_audit_log')
    .select('id, action, entity_type, entity_id, actor_role, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      action: String(r.action),
      entityType: String(r.entity_type),
      entityId: String(r.entity_id),
      actorRole: r.actor_role ? String(r.actor_role) : null,
      createdAt: String(r.created_at),
    };
  });
}
