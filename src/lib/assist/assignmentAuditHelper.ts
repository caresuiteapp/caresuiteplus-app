import type { SupabaseClient } from '@supabase/supabase-js';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

export type AssignmentMutationContext = {
  actorProfileId?: string;
  actorDisplayName?: string;
  actorEmployeeId?: string;
};

function resolveActorName(context?: AssignmentMutationContext): string {
  const name = context?.actorDisplayName?.trim();
  return name || 'System';
}

export async function writeAssignmentAudit(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    assignmentId: string;
    action: string;
    fromStatus?: AssignmentStatus | null;
    toStatus?: AssignmentStatus | null;
    details?: string;
    actor?: AssignmentMutationContext;
  },
): Promise<void> {
  const statusDetail =
    params.fromStatus && params.toStatus
      ? `${ASSIGNMENT_STATUS_LABELS[params.fromStatus]} → ${ASSIGNMENT_STATUS_LABELS[params.toStatus]}`
      : null;

  await fromUnknownTable(supabase, 'assignment_audit_events').insert({
    tenant_id: params.tenantId,
    assignment_id: params.assignmentId,
    action: params.action,
    actor_profile_id: params.actor?.actorProfileId ?? null,
    actor_name: resolveActorName(params.actor),
    from_status: params.fromStatus ?? null,
    to_status: params.toStatus ?? null,
    details: params.details ?? statusDetail,
    created_at: new Date().toISOString(),
  });
}
