// Generated native presentation from src/lib/careAssessment/planAmendmentHistoryService.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from "../supabase/client.ts";
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import type { ControlRpc } from '../pflege/clinicalControlRuntime';
import type { PlanAmendmentHistoryRecord } from './planAmendmentHistoryDomain';
import { readPlanAmendmentHistory } from './planAmendmentHistoryRuntime';
export async function fetchPlanAmendmentHistory(tenant: string, assessment: string, client: string, role: RoleKey | null): Promise<ServiceResult<PlanAmendmentHistoryRecord[]>> {
    const denied = enforcePermission<PlanAmendmentHistoryRecord[]>(role, 'pflege.plans.view') ?? guardServiceTenant(tenant);
    if (denied)
        return denied;
    const db = getServiceMode() === 'supabase' ? getSupabaseClient() : null;
    if (!db)
        return { ok: false, error: 'Änderungshistorie nicht mit der Datenbank verbunden.' };
    const rpc: ControlRpc = async (name, args) => { const r = await withServiceQueryTimeout((db as unknown as {
        rpc: ControlRpc;
    }).rpc(name, args), 'Historische Maßnahmenänderungen', 20000); return { ...r, error: r.error ? { ...r.error, message: toGermanSupabaseError(r.error) } : null }; };
    return readPlanAmendmentHistory(rpc, tenant, assessment, client);
}
