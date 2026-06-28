import { EMPLOYEE_OFFICE_CATALOGS } from '@/data/demo/templates/catalogs/employeeOffice';
import { EMPLOYEE_PAYROLL_CATALOGS } from '@/data/demo/templates/catalogs/employeePayroll';
import { GLOBAL_STATUS_CATALOGS } from '@/data/demo/templates/catalogs/globalStatuses';
import { formatGermanCatalogKey } from '@/lib/formatters/germanLabelFormatters';
import type { CatalogType } from '@/types/templates';

const labelMaps = new Map<CatalogType, Map<string, string>>();

function ensureLabelMaps(): void {
  if (labelMaps.size > 0) return;
  for (const entry of [...EMPLOYEE_OFFICE_CATALOGS, ...EMPLOYEE_PAYROLL_CATALOGS, ...GLOBAL_STATUS_CATALOGS]) {
    const map = labelMaps.get(entry.catalogType) ?? new Map<string, string>();
    map.set(entry.valueKey, entry.label);
    labelMaps.set(entry.catalogType, map);
  }
}

export function resolveEmployeeCatalogLabel(
  catalogType: CatalogType,
  key: string | null | undefined,
): string {
  if (!key?.trim()) return '—';
  ensureLabelMaps();
  return labelMaps.get(catalogType)?.get(key.trim()) ?? formatGermanCatalogKey(key);
}

/** Display label for employee role keys (catalog mapping + German umlaut fallback). */
export function formatRoleLabel(roleKey: string | null | undefined): string {
  return resolveEmployeeRoleLabel(roleKey);
}

export function resolveEmployeeDepartmentLabel(departmentKey: string | null | undefined): string {
  return resolveEmployeeCatalogLabel('employee_department', departmentKey);
}

export function resolveEmployeeRoleLabel(roleKey: string | null | undefined): string {
  return resolveEmployeeCatalogLabel('employee_role', roleKey);
}

export const EMPLOYMENT_TYPE_OPTIONS = [
  { key: 'full_time', label: 'Vollzeit' },
  { key: 'part_time', label: 'Teilzeit' },
  { key: 'mini_job', label: 'Minijob' },
  { key: 'freelancer', label: 'Freiberuflich' },
  { key: 'temporary', label: 'Befristet' },
  { key: 'intern', label: 'Praktikum' },
  { key: 'other', label: 'Sonstige' },
] as const;

export function resolveEmploymentTypeLabel(value: string | null | undefined): string {
  if (!value?.trim()) return '—';
  return EMPLOYMENT_TYPE_OPTIONS.find((option) => option.key === value.trim())?.label ?? value.trim();
}
