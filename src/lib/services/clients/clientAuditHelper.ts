import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkflowStatus } from '@/types/core/base';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import type { ClientMutationContext } from './types';

function resolveActorName(context?: ClientMutationContext): string {
  const name = context?.actorDisplayName?.trim();
  return name || 'System';
}

export async function writeClientAudit(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    clientId: string;
    action: string;
    details?: string;
    actor?: ClientMutationContext;
  },
): Promise<void> {
  await fromUnknownTable(supabase, 'client_audit_entries').insert({
    tenant_id: params.tenantId,
    client_id: params.clientId,
    action: params.action,
    actor_name: resolveActorName(params.actor),
    details: params.details ?? null,
    created_at: new Date().toISOString(),
  });
}

export async function writeClientHistory(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    clientId: string;
    icon: string;
    title: string;
    subtitle?: string;
    status: WorkflowStatus;
    actor?: ClientMutationContext;
  },
): Promise<void> {
  await fromUnknownTable(supabase, 'client_history_entries').insert({
    tenant_id: params.tenantId,
    client_id: params.clientId,
    icon: params.icon,
    title: params.title,
    subtitle: params.subtitle ?? null,
    status: params.status,
    actor_name: resolveActorName(params.actor),
    created_at: new Date().toISOString(),
  });
}
