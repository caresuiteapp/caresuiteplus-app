import type {
  EmployeeDocumentCategory,
  EmployeePersonnelTabKey,
  EmployeeQualificationType,
} from '@/types/modules/employeePersonnelFile';
import type { RoleKey } from '@/types/core/auth';

export const EMPLOYEE_PERSONNEL_TAB_LABELS: Record<EmployeePersonnelTabKey, string> = {
  overview: 'Übersicht',
  personnel_file: 'Personalakte',
  master_data: 'Stammdaten',
  employment: 'Anstellung',
  roles_permissions: 'Rollen & Rechte',
  qualifications: 'Qualifikationen',
  background_check: 'Führungszeugnis',
  documents: 'Dokumente',
  deployability: 'Einsatzfähigkeit',
  work_materials: 'Arbeitsmaterial',
  audit: 'Verlauf',
};

export const ALL_EMPLOYEE_PERSONNEL_TABS: EmployeePersonnelTabKey[] = [
  'overview',
  'personnel_file',
  'master_data',
  'employment',
  'roles_permissions',
  'qualifications',
  'background_check',
  'documents',
  'deployability',
  'work_materials',
  'audit',
];

export const EMPLOYEE_PORTAL_VISIBLE_TABS: EmployeePersonnelTabKey[] = [
  'overview',
  'master_data',
  'qualifications',
  'documents',
  'work_materials',
];

export const QUALIFICATION_TYPE_LABELS: Record<EmployeeQualificationType, string> = {
  nursing_qualification: 'Pflegequalifikation',
  first_aid: 'Erste Hilfe',
  hygiene_training: 'Hygieneunterweisung',
  medication_administration: 'Medikamentengabe',
  dementia_care: 'Demenzbetreuung',
  driving_license: 'Führerschein',
  professional_development: 'Fortbildung',
  other: 'Sonstige',
};

export const REQUIRED_QUALIFICATIONS_BY_ROLE: Partial<Record<string, EmployeeQualificationType[]>> = {
  Pflegefachkraft: ['nursing_qualification', 'first_aid', 'hygiene_training'],
  Betreuungskraft: ['first_aid', 'hygiene_training'],
  Alltagsbegleiter: ['first_aid'],
  'Auszubildende Pflege': ['hygiene_training'],
};

export const SENSITIVE_DOCUMENT_CATEGORIES = new Set<EmployeeDocumentCategory>([
  'background_check',
  'warning',
  'termination',
  'confidentiality',
]);

export const PORTAL_RELEASED_DOCUMENT_CATEGORIES = new Set<EmployeeDocumentCategory>([
  'contract',
  'agreement',
  'privacy',
  'briefing',
  'qualification',
  'certificate',
]);

export const ADMIN_ROLES_FOR_SENSITIVE_PERSONNEL: RoleKey[] = ['business_admin', 'business_manager'];

export const ASSIGNABLE_EMPLOYMENT_STATUSES = new Set(['active', 'onboarding']);

export const INACTIVE_EMPLOYMENT_STATUSES = new Set([
  'applicant',
  'paused',
  'sick_long_term',
  'on_leave',
  'suspended',
  'terminated',
  'archived',
]);

export const QUALIFICATION_EXPIRY_WARNING_DAYS = 30;

export const BACKGROUND_CHECK_VALIDITY_MONTHS = 24;

export function getEmployeePersonnelTabsForRole(roleKey: RoleKey | null): EmployeePersonnelTabKey[] {
  if (roleKey === 'employee_portal') return EMPLOYEE_PORTAL_VISIBLE_TABS;
  return ALL_EMPLOYEE_PERSONNEL_TABS;
}

export function getRequiredQualificationsForRole(roleTitle: string | null): EmployeeQualificationType[] {
  if (!roleTitle?.trim()) return ['first_aid'];
  return REQUIRED_QUALIFICATIONS_BY_ROLE[roleTitle] ?? ['first_aid'];
}
