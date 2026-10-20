import type { RoleKey, ServiceResult } from '@/types';
import type { EmployeePortalAccessCandidate } from '@/types/modules/employeePortalAccess';
import { demoEmployees } from '@/data/demo/employees';
import { getEmployeePortalAccounts } from '@/lib/auth/accessStore';
import { resolveEmployeeRoleLabel } from '@/lib/office/employeeCatalogLabels';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { isDemoEmployeeDeleted } from '@/lib/office/demoDeleteStore';

function matchesSearch(candidate: EmployeePortalAccessCandidate, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    candidate.fullName,
    candidate.employeeNumber ?? '',
    candidate.email ?? '',
    candidate.jobTitle ?? '',
  ].some((term) => term.toLowerCase().includes(q));
}

function sortCandidates(a: EmployeePortalAccessCandidate, b: EmployeePortalAccessCandidate): number {
  const numberA = a.employeeNumber?.trim() ?? '';
  const numberB = b.employeeNumber?.trim() ?? '';
  if (numberA && numberB && numberA !== numberB) {
    return numberA.localeCompare(numberB, 'de', { numeric: true });
  }
  if (numberA && !numberB) return -1;
  if (!numberA && numberB) return 1;
  return a.fullName.localeCompare(b.fullName, 'de');
}

export async function fetchEmployeePortalAccessCandidates(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  searchQuery = '',
): Promise<ServiceResult<EmployeePortalAccessCandidate[]>> {
  const denied = enforcePermission<EmployeePortalAccessCandidate[]>(
    actorRoleKey,
    'office.access' as never,
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const portalEmployeeIds = new Set<string>();

  if (getServiceMode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'Supabase ist nicht verfügbar.' };

    const { data: portalRows, error: portalError } = await fromUnknownTable(
      supabase,
      'employee_portal_accounts',
    )
      .select('employee_id')
      .eq('tenant_id', tenantId);

    if (portalError) return { ok: false, error: toGermanSupabaseError(portalError) };
    for (const row of portalRows ?? []) {
      const employeeId = String((row as { employee_id?: string }).employee_id ?? '');
      if (employeeId) portalEmployeeIds.add(employeeId);
    }

    const { data, error } = await supabase
      .from('employees')
      .select('id, first_name, last_name, employee_number, email, role_title, status')
      .eq('tenant_id', tenantId)
      .neq('status', 'deleted')
      .order('last_name', { ascending: true });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    const rows = (data ?? [])
      .map((row) => {
        const id = String(row.id);
        const firstName = String(row.first_name ?? '').trim();
        const lastName = String(row.last_name ?? '').trim();
        const roleTitle = String(row.role_title ?? '').trim();
        return {
          id,
          fullName: `${firstName} ${lastName}`.trim(),
          employeeNumber: String(row.employee_number ?? '').trim() || null,
          email: String(row.email ?? '').trim() || null,
          jobTitle: roleTitle ? resolveEmployeeRoleLabel(roleTitle) : null,
        } satisfies EmployeePortalAccessCandidate;
      })
      .filter((row) => !portalEmployeeIds.has(row.id))
      .filter((row) => matchesSearch(row, searchQuery))
      .sort(sortCandidates);

    return { ok: true, data: rows };
  }

  for (const account of getEmployeePortalAccounts(tenantId)) {
    portalEmployeeIds.add(account.employeeId);
  }

  const rows = demoEmployees
    .filter((employee) => !isDemoEmployeeDeleted(employee.id))
    .filter((employee) => !portalEmployeeIds.has(employee.id))
    .map((employee, index) => ({
      id: employee.id,
      fullName: `${employee.firstName} ${employee.lastName}`.trim(),
      employeeNumber: `MA-${String(index + 1).padStart(3, '0')}`,
      email: employee.email,
      jobTitle: resolveEmployeeRoleLabel(employee.jobTitle),
    }))
    .filter((row) => matchesSearch(row, searchQuery))
    .sort(sortCandidates);

  return { ok: true, data: rows };
}
