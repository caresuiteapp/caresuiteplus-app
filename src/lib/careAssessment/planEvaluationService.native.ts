// Generated native presentation from src/lib/careAssessment/planEvaluationService.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from "../supabase/client.ts";
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import type { ControlRpc } from '../pflege/clinicalControlRuntime';
import type { EvaluationRecord, EvaluationRequest } from './planEvaluationDomain';
import { readPlanEvaluations, writePlanEvaluation } from './planEvaluationRuntime';
const access = <T,>(tenant: string, role: RoleKey | null) => enforcePermission<T>(role, 'pflege.plans.view') ?? guardServiceTenant(tenant);
function rpc(): ControlRpc | null { const db = getServiceMode() === 'supabase' ? getSupabaseClient() : null; if (!db)
    return null; const client = db as unknown as {
    rpc: ControlRpc;
}; return async (name, args) => { const r = await withServiceQueryTimeout(client.rpc(name, args), 'Historische Pflegeevaluation', 20000); return { ...r, error: r.error ? { ...r.error, message: toGermanSupabaseError(r.error) } : null }; }; }
export async function fetchPlanEvaluations(tenant: string, assessment: string, client: string, role: RoleKey | null): Promise<ServiceResult<EvaluationRecord[]>> { const denied = access<EvaluationRecord[]>(tenant, role); if (denied)
    return denied; const run = rpc(); return run ? readPlanEvaluations(run, tenant, assessment, client) : { ok: false, error: 'Evaluationsdatenbank nicht verbunden.' }; }
export async function savePlanEvaluation(tenant: string, id: string, payload: EvaluationRequest, role: RoleKey | null, replay = false) { const denied = access<{
    id: string;
}>(tenant, role) ?? (!replay ? enforcePermission<{
    id: string;
}>(role, 'pflege.assessments.manage') : null); if (denied)
    return denied; const run = rpc(); return run ? writePlanEvaluation(run, tenant, id, payload, replay) : { ok: false as const, error: 'Evaluationsdatenbank nicht verbunden.' }; }
