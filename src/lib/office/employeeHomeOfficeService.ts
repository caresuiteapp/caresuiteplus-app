import type { RoleKey } from '@/types/core/auth';
import type { ServiceResult } from '@/types';
import { getPermissionsForRole } from '@/lib/permissions/staticRolePermissions';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';

export type EmployeeTimeTrackingMode = 'field' | 'homeoffice' | 'hybrid' | 'none';

/** Per-employee override: null = derive from role, true/false = explicit Homeoffice-Zeiterfassung. */
const homeOfficeOverrideStore = new Map<string, boolean | null>();

function storeKey(tenantId: string, employeeId: string): string {
  return `${tenantId}:${employeeId}`;
}

export function resetEmployeeHomeOfficeOverrideStore(): void {
  homeOfficeOverrideStore.clear();
}

export function getEmployeeHomeOfficeOverride(employeeId: string, tenantId?: string): boolean | null {
  if (tenantId) {
    return homeOfficeOverrideStore.get(storeKey(tenantId, employeeId)) ?? null;
  }
  for (const [key, value] of homeOfficeOverrideStore.entries()) {
    if (key.endsWith(`:${employeeId}`)) return value;
  }
  return null;
}

export function setEmployeeHomeOfficeOverride(
  employeeId: string,
  value: boolean | null,
  tenantId?: string,
): void {
  if (tenantId) {
    const key = storeKey(tenantId, employeeId);
    if (value === null) {
      homeOfficeOverrideStore.delete(key);
      return;
    }
    homeOfficeOverrideStore.set(key, value);
    return;
  }

  if (value === null) {
    for (const key of [...homeOfficeOverrideStore.keys()]) {
      if (key.endsWith(`:${employeeId}`)) homeOfficeOverrideStore.delete(key);
    }
    return;
  }

  homeOfficeOverrideStore.set(employeeId, value);
}

export async function loadEmployeeHomeOfficeOverride(
  tenantId: string,
  employeeId: string,
): Promise<boolean | null> {
  if (getServiceMode() !== 'supabase') {
    return getEmployeeHomeOfficeOverride(employeeId, tenantId);
  }

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await fromUnknownTable(supabase, 'employee_work_settings')
    .select('home_office_enabled')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .maybeSingle();

  if (error) {
    if (isSupabaseMissingTableError(error)) return null;
    return null;
  }

  if (!data) {
    setEmployeeHomeOfficeOverride(employeeId, null, tenantId);
    return null;
  }

  const enabled = (data as { home_office_enabled?: boolean | null }).home_office_enabled ?? null;
  setEmployeeHomeOfficeOverride(employeeId, enabled, tenantId);
  return enabled;
}

export async function persistEmployeeHomeOfficeOverride(
  tenantId: string,
  employeeId: string,
  value: boolean | null,
): Promise<ServiceResult<void>> {
  setEmployeeHomeOfficeOverride(employeeId, value, tenantId);

  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: undefined };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  }

  if (value === null) {
    const { error } = await fromUnknownTable(supabase, 'employee_work_settings')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId);

    if (error && !isSupabaseMissingTableError(error)) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }
    return { ok: true, data: undefined };
  }

  const { error } = await fromUnknownTable(supabase, 'employee_work_settings').upsert(
    {
      tenant_id: tenantId,
      employee_id: employeeId,
      home_office_enabled: value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,employee_id' },
  );

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: true, data: undefined };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: undefined };
}

export function roleHasFieldTimeTracking(roleKey: RoleKey | null): boolean {
  if (!roleKey) return false;
  return getPermissionsForRole(roleKey).includes('assist.execution.manage');
}

export function roleHasHomeOfficeTimeTracking(roleKey: RoleKey | null): boolean {
  if (!roleKey) return false;
  return getPermissionsForRole(roleKey).includes('time.tracking.own.view');
}

/** Whether the Rollen & Rechte tab should show the Homeoffice toggle. */
export function roleQualifiesForHomeOfficeSetting(roleKey: RoleKey | null): boolean {
  return roleHasHomeOfficeTimeTracking(roleKey);
}

export function resolveEmployeeTimeTrackingMode(
  roleKey: RoleKey | null,
  homeOfficeOverride: boolean | null = null,
): EmployeeTimeTrackingMode {
  if (!roleKey) return 'none';

  const hasField = roleHasFieldTimeTracking(roleKey);
  const hasHomeOffice = roleHasHomeOfficeTimeTracking(roleKey);

  if (homeOfficeOverride === true) {
    if (hasField && hasHomeOffice) return 'hybrid';
    if (hasHomeOffice) return 'homeoffice';
    return hasField ? 'field' : 'none';
  }

  if (homeOfficeOverride === false) {
    if (hasField) return 'field';
    return 'none';
  }

  if (hasField && hasHomeOffice) return 'hybrid';
  if (hasHomeOffice) return 'homeoffice';
  if (hasField) return 'field';
  return 'none';
}

export const EMPLOYEE_TIME_TRACKING_MODE_LABELS: Record<EmployeeTimeTrackingMode, string> = {
  field: 'Einsatz-Zeiterfassung (Assist)',
  homeoffice: 'Homeoffice-Zeiterfassung',
  hybrid: 'Einsatz + Homeoffice',
  none: 'Keine Zeiterfassung',
};

export function describeEmployeeTimeTrackingMode(mode: EmployeeTimeTrackingMode): string {
  return EMPLOYEE_TIME_TRACKING_MODE_LABELS[mode];
}

export const EMPLOYEE_ASSIGNABLE_ROLE_KEYS: RoleKey[] = [
  'caregiver',
  'nurse',
  'dispatch',
  'counselor',
  'employee_portal',
  'business_manager',
];
