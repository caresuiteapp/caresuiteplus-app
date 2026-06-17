import type { EmployeeDetail } from '@/types/modules/employeeDetail';
import { demoEmployees } from './employees';

const DEPARTMENTS: Record<string, string> = {
  'employee-001': 'Ambulante Pflege',
  'employee-002': 'Ambulante Pflege',
  'employee-003': 'Betreuung',
  'employee-004': 'Verwaltung',
  'employee-005': 'Ausbildung',
  'employee-006': 'Ambulante Pflege',
};

function buildDetail(
  base: (typeof demoEmployees)[number],
): EmployeeDetail {
  return {
    id: base.id,
    tenantId: base.tenantId,
    firstName: base.firstName,
    lastName: base.lastName,
    jobTitle: base.jobTitle,
    email: base.email,
    phone: base.phone,
    status: base.status,
    updatedAt: base.updatedAt,
    createdAt: base.createdAt,
    department: DEPARTMENTS[base.id] ?? 'Allgemein',
    startDate: base.createdAt.slice(0, 10),
    notes:
      base.status === 'gesperrt'
        ? 'Zugang vorübergehend gesperrt — HR kontaktieren.'
        : base.status === 'entwurf'
          ? 'Onboarding noch nicht abgeschlossen.'
          : null,
    avatarUrl: null,
  };
}

const detailMap = new Map(demoEmployees.map((e) => [e.id, buildDetail(e)]));

export function getDemoEmployeeDetail(id: string): EmployeeDetail | null {
  return detailMap.get(id) ?? null;
}

export function updateDemoEmployeeDetail(
  id: string,
  patch: Partial<Pick<EmployeeDetail, 'jobTitle' | 'phone' | 'department' | 'notes' | 'avatarUrl'>>,
): EmployeeDetail | null {
  const current = detailMap.get(id);
  if (!current) return null;
  const updated = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  detailMap.set(id, updated);
  return updated;
}
