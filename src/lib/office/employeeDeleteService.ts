import type { RoleKey, ServiceResult } from '@/types';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { demoEmployees } from '@/data/demo/employees';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { employeeSupabaseRepository } from '@/lib/services/repositories/employeeRepository.supabase';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { markDemoEmployeeDeleted } from './demoDeleteStore';
import { assertNoActiveAssignmentsForEmployee } from './officeDeleteGuard';
import { resetEmployeePersonnelFileLiveCache } from './employeePersonnelFileLiveLoader';

export async function deleteEmployee(
  employeeId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
  actorDisplayName?: string | null,
): Promise<ServiceResult<void>> {
  const denied = enforcePermission<void>(actorRoleKey, 'office.employees.delete');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'Die sichere Live-Datenbank ist nicht verfügbar.' };
    const [employeeResult, offboardingResult] = await Promise.all([
      fromUnknownTable(supabase, 'employees')
        .select('status')
        .eq('tenant_id', tenantId)
        .eq('id', employeeId)
        .maybeSingle(),
      fromUnknownTable(supabase, 'employee_offboarding_sessions')
        .select('id,overall_status')
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .maybeSingle(),
    ]);
    if (employeeResult.error || offboardingResult.error) {
      return {
        ok: false,
        error: employeeResult.error?.message ?? offboardingResult.error?.message ?? 'Löschschutz konnte nicht geprüft werden.',
      };
    }
    const employeeStatus = String((employeeResult.data as Record<string, unknown> | null)?.status ?? '').toLowerCase();
    if (offboardingResult.data || ['inactive', 'terminated', 'archived'].includes(employeeStatus)) {
      return {
        ok: false,
        error: 'Ehemalige oder im Offboarding befindliche Mitarbeitende werden nicht gelöscht. Die Personalakte bleibt revisionssicher erhalten.',
      };
    }

    const result = await employeeSupabaseRepository.delete(tenantId, employeeId, {
      actorProfileId,
      actorDisplayName,
    });
    if (result.ok) resetEmployeePersonnelFileLiveCache();
    return result;
  }

  if (tenantId !== DEMO_TENANT_ID) {
    return { ok: false, error: 'Kein Zugriff auf diesen Mandanten.' };
  }

  const exists = demoEmployees.some((e) => e.id === employeeId);
  if (!exists) return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };

  const assignmentBlock = await assertNoActiveAssignmentsForEmployee(tenantId, employeeId);
  if (assignmentBlock) return assignmentBlock;

  markDemoEmployeeDeleted(employeeId);
  return { ok: true, data: undefined };
}
