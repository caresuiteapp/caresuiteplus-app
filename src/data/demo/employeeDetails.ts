import type { EmployeeDetail } from '@/types/modules/employeeDetail';
import { demoEmployees } from './employees';

const DEPARTMENTS: Record<string, string> = {
  'employee-001': 'pflege',
  'employee-002': 'pflege',
  'employee-003': 'assist_aussendienst',
  'employee-004': 'buero_verwaltung',
  'employee-005': 'akademie',
  'employee-006': 'pflege',
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
    department: DEPARTMENTS[base.id] ?? 'assist_aussendienst',
    startDate: base.createdAt.slice(0, 10),
    notes:
      base.status === 'gesperrt'
        ? 'Zugang vorübergehend gesperrt — HR kontaktieren.'
        : base.status === 'entwurf'
          ? 'Onboarding noch nicht abgeschlossen.'
          : null,
    avatarUrl: null,
    mobile: null,
    street: null,
    houseNumber: null,
    postalCode: null,
    city: null,
    employmentType: null,
    weeklyHours: null,
    hasFirstAidCertificate: false,
    hasDriverLicense: false,
    driverLicenseClass: null,
    hasPoliceClearance: false,
    policeClearanceDate: null,
  };
}

const detailMap = new Map(demoEmployees.map((e) => [e.id, buildDetail(e)]));

export function getDemoEmployeeDetail(id: string): EmployeeDetail | null {
  return detailMap.get(id) ?? null;
}

export function updateDemoEmployeeDetail(
  id: string,
  patch: Partial<
    Pick<
      EmployeeDetail,
      | 'firstName'
      | 'lastName'
      | 'email'
      | 'jobTitle'
      | 'phone'
      | 'mobile'
      | 'department'
      | 'status'
      | 'notes'
      | 'avatarUrl'
      | 'startDate'
      | 'employmentType'
      | 'weeklyHours'
      | 'street'
      | 'houseNumber'
      | 'postalCode'
      | 'city'
      | 'hasFirstAidCertificate'
      | 'hasDriverLicense'
      | 'driverLicenseClass'
      | 'hasPoliceClearance'
      | 'policeClearanceDate'
    >
  >,
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
