import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { isUuid } from '@/lib/validation/uuid';
import { fetchEmployeePortalAccountByEmployeeId } from './accessManagementLiveRepository';

type ResolvedEmployee = {
  employeeId: string;
  firstName: string;
  lastName: string;
};

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: 'Supabase ist nicht verfügbar.' };
}

export async function resolveEmployeeIdForPortalAccess(
  tenantId: string,
  employeeRef: string,
): Promise<ServiceResult<ResolvedEmployee>> {
  const ref = employeeRef.trim();
  if (!ref) {
    return { ok: false, error: 'Bitte Personalnummer oder interne Mitarbeiter-ID angeben.' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  let query = supabase
    .from('employees')
    .select('id, first_name, last_name, employee_number')
    .eq('tenant_id', tenantId);

  if (isUuid(ref)) {
    query = query.eq('id', ref);
  } else {
    query = query.ilike('employee_number', ref);
  }

  const { data, error } = await query.maybeSingle();

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  if (!data?.id) {
    return {
      ok: false,
      error: isUuid(ref)
        ? 'Mitarbeiter:in wurde nicht gefunden.'
        : 'Mitarbeiter:in mit dieser Personalnummer wurde nicht gefunden.',
    };
  }

  const employeeId = String(data.id);
  const existingAccount = await fetchEmployeePortalAccountByEmployeeId(tenantId, employeeId);
  if (!existingAccount.ok) return existingAccount;
  if (existingAccount.data) {
    return {
      ok: false,
      error: 'Für diese:n Mitarbeiter:in existiert bereits ein Portalzugang.',
    };
  }

  return {
    ok: true,
    data: {
      employeeId,
      firstName: String(data.first_name ?? '').trim(),
      lastName: String(data.last_name ?? '').trim(),
    },
  };
}
