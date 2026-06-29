/**
 * LT.GMAPS.4 — Read persisted employee-portal location consent via canonical live context.
 */
import type { ServiceResult } from '@/types';
import type { EmployeePortalLocationConsent } from '@/types/modules/employeePortalTracking';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { liveTrackingErrorFromSupabase, liveTrackingErrorToServiceResult } from './liveTrackingErrors';
import { resolveEmployeeLiveContext } from './resolveEmployeeLiveContext';

export type GetEmployeeLocationConsentInput = {
  tenantId: string;
  employeeId: string;
  routeParamId: string;
  portalAccountId?: string | null;
  localConsent?: EmployeePortalLocationConsent;
};

export async function getEmployeeLocationConsent(
  input: GetEmployeeLocationConsentInput,
): Promise<ServiceResult<EmployeePortalLocationConsent>> {
  const ctxResult = await resolveEmployeeLiveContext({
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    routeParamId: input.routeParamId,
    portalAccountId: input.portalAccountId,
    localConsent: input.localConsent,
  });

  if (!ctxResult.ok) return ctxResult;

  const ctx = ctxResult.data;
  const fromContext: EmployeePortalLocationConsent = {
    granted: ctx.consentStatus.granted,
    grantedAt: ctx.consentStatus.grantedAt,
    explainedAt: ctx.consentStatus.explainedAt,
  };

  if (fromContext.granted) return { ok: true, data: fromContext };

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, data: fromContext };

  const { data, error } = await fromUnknownTable(supabase, 'assist_tracking_sessions')
    .select('consent_granted_at, consent_explained_at')
    .eq('tenant_id', input.tenantId)
    .eq('visit_id', ctx.assistVisitId)
    .not('consent_granted_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    const err = liveTrackingErrorFromSupabase(error, {
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      assignmentId: ctx.assignmentId,
      assistVisitId: ctx.assistVisitId,
      tableOrRpc: 'assist_tracking_sessions',
      operation: 'getEmployeeLocationConsent',
    });
    return liveTrackingErrorToServiceResult(err);
  }

  if (!data) return { ok: true, data: fromContext };

  const row = data as { consent_granted_at: string; consent_explained_at: string | null };
  return {
    ok: true,
    data: {
      granted: true,
      grantedAt: row.consent_granted_at,
      explainedAt: row.consent_explained_at,
    },
  };
}
