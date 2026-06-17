import type { ServiceResult } from '@/types';
import { getDemoEmployeePersonnelFile } from '@/data/demo/employeePersonnelFile';
import { getServiceMode } from '@/lib/services/mode';
import { employeeSupabaseRepository } from '@/lib/services/repositories/employeeRepository.supabase';

export type ResolvedOffboardingEmployee = {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
};

export function formatOffboardingEmployeeName(employee: ResolvedOffboardingEmployee): string {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

export async function resolveOffboardingEmployee(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<ResolvedOffboardingEmployee>> {
  if (getServiceMode() === 'supabase') {
    const result = await employeeSupabaseRepository.getById(tenantId, employeeId);
    if (!result.ok) return result;
    if (!result.data) {
      return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };
    }
    return {
      ok: true,
      data: {
        id: result.data.id,
        tenantId: result.data.tenantId,
        firstName: result.data.firstName,
        lastName: result.data.lastName,
      },
    };
  }

  const file = getDemoEmployeePersonnelFile(employeeId);
  if (!file) return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };
  if (file.tenantId !== tenantId) {
    return { ok: false, error: 'Kein mandantenübergreifender Zugriff auf Personalakten.' };
  }

  return {
    ok: true,
    data: {
      id: file.employeeId,
      tenantId: file.tenantId,
      firstName: file.masterData.firstName,
      lastName: file.masterData.lastName,
    },
  };
}
