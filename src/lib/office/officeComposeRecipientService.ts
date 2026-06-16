import type { RoleKey, ServiceResult } from '@/types';
import type { OfficeRecipientOption, OfficeRecipientType } from '@/types/office/officeCompose';
import { OFFICE_INTERNAL_RECIPIENT_ID } from '@/types/office/officeCompose';
import { fetchClientList } from '@/lib/office/clientListService';
import { fetchEmployeeList } from '@/lib/office/employeeListService';

function formatPersonLabel(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export async function fetchOfficeComposeRecipients(
  tenantId: string,
  recipientType: OfficeRecipientType,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<OfficeRecipientOption[]>> {
  if (recipientType === 'internal') {
    return {
      ok: true,
      data: [{ id: OFFICE_INTERNAL_RECIPIENT_ID, label: 'Büro (alle)' }],
    };
  }

  if (recipientType === 'client') {
    const result = await fetchClientList(tenantId, actorRoleKey, { lifecycleFilter: 'active' });
    if (!result.ok) return result;
    return {
      ok: true,
      data: result.data.map((client) => ({
        id: client.id,
        label: formatPersonLabel(client.firstName, client.lastName),
      })),
    };
  }

  if (recipientType === 'employee') {
    const result = await fetchEmployeeList(tenantId, actorRoleKey);
    if (!result.ok) return result;
    return {
      ok: true,
      data: result.data.map((employee) => ({
        id: employee.id,
        label: formatPersonLabel(employee.firstName, employee.lastName),
      })),
    };
  }

  const result = await fetchEmployeeList(tenantId, actorRoleKey);
  if (!result.ok) return result;

  const departments = new Map<string, string>();
  for (const employee of result.data) {
    const department = employee.department?.trim();
    if (!department) continue;
    const key = department.toLowerCase();
    if (!departments.has(key)) {
      departments.set(key, department);
    }
  }

  const options = [...departments.values()]
    .sort((a, b) => a.localeCompare(b, 'de'))
    .map((department) => ({
      id: `team:${department.toLowerCase()}`,
      label: department,
    }));

  if (options.length === 0) {
    return {
      ok: true,
      data: [{ id: 'team:allgemein', label: 'Allgemein' }],
    };
  }

  return { ok: true, data: options };
}
