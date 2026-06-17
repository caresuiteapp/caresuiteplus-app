import { mapCatalogStatusToDbStatus } from './employeeStatusMapping';

export type EmployeeWriteInput = {
  firstName: string;
  lastName: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  department?: string;
  status?: string;
  notes?: string | null;
  avatarUrl?: string | null;
};

/** INSERT/UPDATE payload aligned with live Supabase schema (role_title + employee_status enum). */
export function buildEmployeeInsertPayload(
  tenantId: string,
  input: EmployeeWriteInput,
): Record<string, unknown> {
  return {
    tenant_id: tenantId,
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    role_title: input.jobTitle?.trim() ?? null,
    email: input.email?.trim() ?? null,
    phone: input.phone?.trim() || null,
    department: input.department?.trim() || null,
    status: mapCatalogStatusToDbStatus(input.status),
    avatar_url: input.avatarUrl?.trim() || null,
  };
}

export function buildEmployeeUpdatePayload(
  input: Partial<EmployeeWriteInput>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (input.jobTitle !== undefined) patch.role_title = input.jobTitle?.trim() || null;
  if (input.department !== undefined) patch.department = input.department?.trim() || null;
  if (input.phone !== undefined) patch.phone = input.phone?.trim() || null;
  if (input.notes !== undefined) patch.internal_notes = input.notes?.trim() || null;
  if (input.status !== undefined) patch.status = mapCatalogStatusToDbStatus(input.status);
  if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl?.trim() || null;

  return patch;
}
