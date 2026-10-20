/**
 * ASSIST.PERMISSIONS.2 — Upsert employee consent bundle with read-back verification.
 */
import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import type { EmployeePermissionKind } from './employeePermissionCenter';
import { EMPLOYEE_CONSENT_BUNDLE_VERSION } from './permissionConsentVersion';

const BUNDLE_TABLE = 'employee_consent_bundle';

export type SaveEmployeeConsentBundleInput = {
  completedAt: string;
  explainedPermissions: EmployeePermissionKind[];
  locationInternalAt?: string | null;
};

function isMissingTable(error: { code?: string; message?: string }): boolean {
  return error.code === '42P01' || Boolean(error.message?.includes(BUNDLE_TABLE));
}

/** Persist onboarding bundle — idempotent upsert with read-back. */
export async function saveEmployeeConsentBundle(
  tenantId: string,
  employeeId: string,
  input: SaveEmployeeConsentBundleInput,
): Promise<ServiceResult<{ completedAt: string }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, data: { completedAt: input.completedAt } };

  const now = new Date().toISOString();
  const { error } = await fromUnknownTable(supabase, BUNDLE_TABLE)
    .upsert(
      {
        tenant_id: tenantId,
        employee_id: employeeId,
        bundle_version: EMPLOYEE_CONSENT_BUNDLE_VERSION,
        completed_at: input.completedAt,
        explained_permissions: input.explainedPermissions,
        location_internal_at: input.locationInternalAt ?? null,
        updated_at: now,
      },
      { onConflict: 'tenant_id,employee_id,bundle_version' },
    );

  if (error) {
    if (isMissingTable(error)) return { ok: true, data: { completedAt: input.completedAt } };
    return { ok: false, error: error.message };
  }

  const { data: readBack, error: readError } = await fromUnknownTable(supabase, BUNDLE_TABLE)
    .select('completed_at')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .eq('bundle_version', EMPLOYEE_CONSENT_BUNDLE_VERSION)
    .maybeSingle();

  if (readError) {
    if (isMissingTable(readError)) return { ok: true, data: { completedAt: input.completedAt } };
    return { ok: false, error: readError.message };
  }

  if (!readBack?.completed_at) {
    return { ok: false, error: 'Einwilligungs-Bundle konnte nicht verifiziert werden (RLS/Read-back).' };
  }

  return { ok: true, data: { completedAt: String(readBack.completed_at) } };
}
