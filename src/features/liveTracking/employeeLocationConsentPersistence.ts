/**
 * LT.GMAPS.5 — Permanent employee-level location consent (tenant + employee scope).
 */
import type { ServiceResult } from '@/types';
import type { EmployeePortalLocationConsent } from '@/types/modules/employeePortalTracking';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { liveTrackingErrorFromSupabase, liveTrackingErrorToServiceResult } from './liveTrackingErrors';

const TABLE = 'employee_location_consents';

type ConsentRow = {
  consent_granted_at: string;
  consent_explained_at: string | null;
  revoked_at: string | null;
};

function toConsent(row: ConsentRow): EmployeePortalLocationConsent {
  return {
    granted: !row.revoked_at,
    grantedAt: row.consent_granted_at,
    explainedAt: row.consent_explained_at,
  };
}

/** Read permanent employee consent — null when never granted or revoked. */
export async function fetchEmployeeLocationConsentRecord(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<EmployeePortalLocationConsent | null>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, data: null };

  const { data, error } = await fromUnknownTable(supabase, TABLE)
    .select('consent_granted_at, consent_explained_at, revoked_at')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .is('revoked_at', null)
    .maybeSingle();

  if (error) {
    if (error.code === '42P01' || error.message?.includes('employee_location_consents')) {
      return { ok: true, data: null };
    }
    const err = liveTrackingErrorFromSupabase(error, {
      tenantId,
      employeeId,
      tableOrRpc: TABLE,
      operation: 'fetchEmployeeLocationConsentRecord',
    });
    return liveTrackingErrorToServiceResult(err);
  }

  if (!data) return { ok: true, data: null };
  return { ok: true, data: toConsent(data as ConsentRow) };
}

/** Idempotent upsert — safe on reload and double-click. */
export async function upsertEmployeeLocationConsentRecord(
  tenantId: string,
  employeeId: string,
  grantedAt: string,
  explainedAt: string | null,
): Promise<ServiceResult<EmployeePortalLocationConsent>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase ist nicht verfügbar.' };

  const now = new Date().toISOString();
  const { data, error } = await fromUnknownTable(supabase, TABLE)
    .upsert(
      {
        tenant_id: tenantId,
        employee_id: employeeId,
        consent_granted_at: grantedAt,
        consent_explained_at: explainedAt,
        revoked_at: null,
        updated_at: now,
      },
      { onConflict: 'tenant_id,employee_id' },
    )
    .select('consent_granted_at, consent_explained_at, revoked_at')
    .single();

  if (error) {
    if (error.code === '42P01' || error.message?.includes('employee_location_consents')) {
      return {
        ok: true,
        data: { granted: true, grantedAt, explainedAt },
      };
    }
    const err = liveTrackingErrorFromSupabase(error, {
      tenantId,
      employeeId,
      tableOrRpc: TABLE,
      operation: 'upsertEmployeeLocationConsentRecord',
    });
    return liveTrackingErrorToServiceResult(err);
  }

  return { ok: true, data: toConsent(data as ConsentRow) };
}
