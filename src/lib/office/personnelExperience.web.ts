import type { EmployeeListItem } from '@/types/modules/employeeList';
import { resolveEmployeeCatalogLabel, resolveEmployeeDepartmentLabel, resolveEmployeeRoleLabel } from './employeeCatalogLabels';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';

export function employeeDisplayName(employee: Pick<EmployeeListItem, 'firstName' | 'lastName'>) {
  return [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim() || 'Name noch offen';
}

export function employeeStatusLabel(status: string) {
  return WORKFLOW_STATUS_LABELS[status as keyof typeof WORKFLOW_STATUS_LABELS] ?? resolveEmployeeCatalogLabel('employee_status', status);
}

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('de-DE');

export function selectPersonnel(items: EmployeeListItem[], search: string, status: string, department: string, sort: string) {
  const words = normalize(search.trim()).split(/\s+/).filter(Boolean);
  return items.filter(employee => {
    if (status !== 'all' && employee.status !== status) return false;
    if (department !== 'all' && employee.department !== department) return false;
    const text = normalize([employeeDisplayName(employee), employee.email, employee.phone,
      resolveEmployeeRoleLabel(employee.jobTitle), resolveEmployeeDepartmentLabel(employee.department)].filter(Boolean).join(' '));
    return words.every(word => text.includes(word));
  }).sort((a, b) => {
    const left = sort === 'role_asc' ? resolveEmployeeRoleLabel(a.jobTitle) : `${a.lastName} ${a.firstName}`;
    const right = sort === 'role_asc' ? resolveEmployeeRoleLabel(b.jobTitle) : `${b.lastName} ${b.firstName}`;
    return left.localeCompare(right, 'de', { sensitivity: 'base', numeric: true }) * (sort === 'name_desc' ? -1 : 1)
      || a.id.localeCompare(b.id);
  });
}

export function personnelDate(value?: string | null) {
  if (!value) return 'Nicht hinterlegt';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Nicht hinterlegt' : new Intl.DateTimeFormat('de-DE').format(date);
}
