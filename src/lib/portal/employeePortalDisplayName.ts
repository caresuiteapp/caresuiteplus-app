import { composeUserFullName } from '@/lib/auth/userdisplayname';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { capitalizeNamePart } from './clientPortalDisplayName';

export type EmployeeNameFields = {
  firstName?: string | null;
  lastName?: string | null;
};

/** Legal/display name for employee portal greeting — Vor- und Nachname. */
export function formatEmployeePortalDisplayName(fields: EmployeeNameFields): string | null {
  const first = fields.firstName?.trim() ? capitalizeNamePart(fields.firstName) : '';
  const last = fields.lastName?.trim() ? capitalizeNamePart(fields.lastName) : '';
  return composeUserFullName(first || null, last || null);
}

/** Live read of linked employee record — RLS must allow portal actor to read own row. */
export async function fetchEmployeePortalDisplayName(
  tenantId: string,
  employeeId: string,
): Promise<string | null> {
  if (!tenantId.trim() || !employeeId.trim()) return null;

  if (getServiceMode() !== 'supabase') {
    return null;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await fromUnknownTable(supabase, 'employees')
    .select('first_name, last_name')
    .eq('tenant_id', tenantId)
    .eq('id', employeeId)
    .maybeSingle();

  if (error) {
    if (!isMissingTableError(error)) {
      console.warn('[employeePortalDisplayName] employees:', error.message);
    }
    return null;
  }

  if (!data) return null;

  const row = data as {
    first_name?: string | null;
    last_name?: string | null;
  };

  return formatEmployeePortalDisplayName({
    firstName: row.first_name ?? null,
    lastName: row.last_name ?? null,
  });
}
