/**
 * ASSIST.PERMISSIONS.2 — Read employee consent bundle + internal location consent from Supabase.
 */
import type { ServiceResult } from '@/types';
import { fetchEmployeeLocationConsentRecord } from '@/features/liveTracking/employeeLocationConsentPersistence';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import type { EmployeePermissionKind } from './employeePermissionCenter';
import { EMPLOYEE_CONSENT_BUNDLE_VERSION } from './permissionConsentVersion';

const BUNDLE_TABLE = 'employee_consent_bundle';

export type EmployeeConsentBundle = {
  bundleVersion: string;
  completedAt: string;
  explainedPermissions: EmployeePermissionKind[];
  locationInternalAt: string | null;
};

export type EmployeeConsentBundleSnapshot = {
  bundle: EmployeeConsentBundle | null;
  locationInternalConsentGranted: boolean;
  locationInternalConsentAt: string | null;
  onboardingCompleted: boolean;
};

type BundleDbRow = {
  bundle_version: string | number;
  completed_at: string;
  explained_permissions: string[] | null;
  location_internal_at: string | null;
};

function isMissingTable(error: { code?: string; message?: string }): boolean {
  return error.code === '42P01' || Boolean(error.message?.includes(BUNDLE_TABLE));
}

function normalizeBundleVersion(value: string | number): string {
  if (value === 1 || value === '1') return EMPLOYEE_CONSENT_BUNDLE_VERSION;
  return String(value);
}

/** Load consent bundle for current version + permanent internal location consent. */
export async function getEmployeeConsentBundle(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<EmployeeConsentBundleSnapshot>> {
  const supabase = getSupabaseClient();
  const locationResult = await fetchEmployeeLocationConsentRecord(tenantId, employeeId);
  if (!locationResult.ok) return locationResult as ServiceResult<never>;

  const locationInternalConsentGranted = Boolean(locationResult.data?.granted);
  const locationInternalConsentAt = locationResult.data?.grantedAt ?? null;

  if (!supabase) {
    return {
      ok: true,
      data: {
        bundle: null,
        locationInternalConsentGranted,
        locationInternalConsentAt,
        onboardingCompleted: false,
      },
    };
  }

  const { data, error } = await fromUnknownTable(supabase, BUNDLE_TABLE)
    .select('bundle_version, completed_at, explained_permissions, location_internal_at')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .eq('bundle_version', EMPLOYEE_CONSENT_BUNDLE_VERSION)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) {
      return {
        ok: true,
        data: {
          bundle: null,
          locationInternalConsentGranted,
          locationInternalConsentAt,
          onboardingCompleted: false,
        },
      };
    }
    return { ok: false, error: error.message };
  }

  if (!data) {
    return {
      ok: true,
      data: {
        bundle: null,
        locationInternalConsentGranted,
        locationInternalConsentAt,
        onboardingCompleted: false,
      },
    };
  }

  const row = data as BundleDbRow;
  const bundle: EmployeeConsentBundle = {
    bundleVersion: normalizeBundleVersion(row.bundle_version),
    completedAt: row.completed_at,
    explainedPermissions: (row.explained_permissions ?? []) as EmployeePermissionKind[],
    locationInternalAt: row.location_internal_at,
  };

  return {
    ok: true,
    data: {
      bundle,
      locationInternalConsentGranted,
      locationInternalConsentAt,
      onboardingCompleted: Boolean(bundle.completedAt),
    },
  };
}
