// Generated native presentation from src/lib/careAssessment/planLifecycleRepository.supabase.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { getSupabaseClient } from "../supabase/client.ts";
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { validatePlanLifecycleSnapshot, type PlanLifecycleSnapshot } from "./planLifecyclePacket.native.ts";
import type { RoleKey, ServiceResult } from '@/types';
export async function readPlanLifecycleSnapshot(input: {
    tenantId: string;
    assessmentId: string;
    subjectId: string;
    actorId: string;
    role?: RoleKey | null;
}): Promise<ServiceResult<PlanLifecycleSnapshot>> {
    const denied = enforcePermission<PlanLifecycleSnapshot>(input.role, 'pflege.plans.view');
    if (denied)
        return denied;
    const tenant = guardServiceTenant(input.tenantId);
    if (tenant)
        return tenant;
    const client = getSupabaseClient();
    if (!client)
        return { ok: false, error: 'Pflegeplan-Datenbank nicht verbunden.' };
    try {
        const rpc = client as unknown as {
            rpc(name: string, args: Record<string, unknown>): Promise<{
                data: unknown;
                error: unknown;
            }>;
        };
        const result = await withServiceQueryTimeout(rpc.rpc('web_read_ambulatory_plan_lifecycle_packet', { p_tenant_id: input.tenantId, p_assessment_id: input.assessmentId, p_subject_id: input.subjectId, p_actor_profile_id: input.actorId }), 'Planlebenszyklus vollständig laden', 20000);
        if (result.error)
            return { ok: false, error: toGermanSupabaseError(result.error as Parameters<typeof toGermanSupabaseError>[0]) };
        const issue = validatePlanLifecycleSnapshot(result.data, { tenantId: input.tenantId, assessmentId: input.assessmentId, subjectId: input.subjectId, actorId: input.actorId });
        if (issue)
            return { ok: false, error: issue };
        return { ok: true, data: structuredClone(result.data as PlanLifecycleSnapshot) };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Planlebenszyklus nicht vollständig verfügbar.' };
    }
}
