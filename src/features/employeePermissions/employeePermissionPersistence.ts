/**
 * ASSIST.PERMISSIONS.1 — DB persistence for permission states and consent bundle.
 */
import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import type {
  EmployeeBrowserPermissionStatus,
  EmployeePermissionKind,
} from './employeePermissionCenter';

const STATES_TABLE = 'employee_permission_states';
const BUNDLE_TABLE = 'employee_consent_bundle';

export type EmployeePermissionStateRow = {
  permissionKind: EmployeePermissionKind;
  browserStatus: EmployeeBrowserPermissionStatus;
  lastCheckedAt: string | null;
  lastRequestedAt: string | null;
  explainedAt: string | null;
};

export type EmployeeConsentBundleRow = {
  bundleVersion: number;
  completedAt: string;
  explainedPermissions: EmployeePermissionKind[];
  locationInternalAt: string | null;
};

type StateDbRow = {
  permission_kind: string;
  browser_status: string;
  last_checked_at: string | null;
  last_requested_at: string | null;
  explained_at: string | null;
};

type BundleDbRow = {
  bundle_version: number;
  completed_at: string;
  explained_permissions: string[] | null;
  location_internal_at: string | null;
};

function isMissingTable(error: { code?: string; message?: string }): boolean {
  return error.code === '42P01' || Boolean(error.message?.includes(STATES_TABLE) || error.message?.includes(BUNDLE_TABLE));
}

export async function fetchEmployeePermissionStates(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<EmployeePermissionStateRow[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, data: [] };

  const { data, error } = await fromUnknownTable(supabase, STATES_TABLE)
    .select('permission_kind, browser_status, last_checked_at, last_requested_at, explained_at')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId);

  if (error) {
    if (isMissingTable(error)) return { ok: true, data: [] };
    return { ok: false, error: error.message };
  }

  const rows = (data as StateDbRow[] | null) ?? [];
  return {
    ok: true,
    data: rows.map((row) => ({
      permissionKind: row.permission_kind as EmployeePermissionKind,
      browserStatus: row.browser_status as EmployeeBrowserPermissionStatus,
      lastCheckedAt: row.last_checked_at,
      lastRequestedAt: row.last_requested_at,
      explainedAt: row.explained_at,
    })),
  };
}

export async function upsertEmployeePermissionState(
  tenantId: string,
  employeeId: string,
  input: {
    permissionKind: EmployeePermissionKind;
    browserStatus: EmployeeBrowserPermissionStatus;
    lastCheckedAt?: string | null;
    lastRequestedAt?: string | null;
    explainedAt?: string | null;
  },
): Promise<ServiceResult<EmployeePermissionStateRow>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, data: { ...input, lastCheckedAt: input.lastCheckedAt ?? null, lastRequestedAt: input.lastRequestedAt ?? null, explainedAt: input.explainedAt ?? null } };

  const now = new Date().toISOString();
  const { data, error } = await fromUnknownTable(supabase, STATES_TABLE)
    .upsert(
      {
        tenant_id: tenantId,
        employee_id: employeeId,
        permission_kind: input.permissionKind,
        browser_status: input.browserStatus,
        last_checked_at: input.lastCheckedAt ?? now,
        last_requested_at: input.lastRequestedAt ?? null,
        explained_at: input.explainedAt ?? null,
        updated_at: now,
      },
      { onConflict: 'tenant_id,employee_id,permission_kind' },
    )
    .select('permission_kind, browser_status, last_checked_at, last_requested_at, explained_at')
    .single();

  if (error) {
    if (isMissingTable(error)) {
      return {
        ok: true,
        data: {
          permissionKind: input.permissionKind,
          browserStatus: input.browserStatus,
          lastCheckedAt: input.lastCheckedAt ?? now,
          lastRequestedAt: input.lastRequestedAt ?? null,
          explainedAt: input.explainedAt ?? null,
        },
      };
    }
    return { ok: false, error: error.message };
  }

  const row = data as StateDbRow;
  return {
    ok: true,
    data: {
      permissionKind: row.permission_kind as EmployeePermissionKind,
      browserStatus: row.browser_status as EmployeeBrowserPermissionStatus,
      lastCheckedAt: row.last_checked_at,
      lastRequestedAt: row.last_requested_at,
      explainedAt: row.explained_at,
    },
  };
}

export async function fetchEmployeeConsentBundle(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<EmployeeConsentBundleRow | null>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, data: null };

  const { data, error } = await fromUnknownTable(supabase, BUNDLE_TABLE)
    .select('bundle_version, completed_at, explained_permissions, location_internal_at')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .eq('bundle_version', 1)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) return { ok: true, data: null };
    return { ok: false, error: error.message };
  }

  if (!data) return { ok: true, data: null };
  const row = data as BundleDbRow;
  return {
    ok: true,
    data: {
      bundleVersion: row.bundle_version,
      completedAt: row.completed_at,
      explainedPermissions: (row.explained_permissions ?? []) as EmployeePermissionKind[],
      locationInternalAt: row.location_internal_at,
    },
  };
}

export async function upsertEmployeeConsentBundle(
  tenantId: string,
  employeeId: string,
  input: {
    bundleVersion: number;
    completedAt: string;
    explainedPermissions: EmployeePermissionKind[];
    locationInternalAt?: string | null;
  },
): Promise<ServiceResult<{ completedAt: string }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, data: { completedAt: input.completedAt } };

  const now = new Date().toISOString();
  const { error } = await fromUnknownTable(supabase, BUNDLE_TABLE)
    .upsert(
      {
        tenant_id: tenantId,
        employee_id: employeeId,
        bundle_version: input.bundleVersion,
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

  return { ok: true, data: { completedAt: input.completedAt } };
}
