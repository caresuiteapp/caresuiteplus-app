import type {
  EmployeeBackgroundCheckStatus,
  EmployeeDeployabilityResult,
  EmployeeEmploymentStatus,
  EmployeePersonnelTabKey,
  EmployeeQualificationStatus,
  EmployeeDeployabilityCheck,
} from '@/types/modules/employeePersonnelFile';
import { mapDbStatusToCatalogStatus } from './employeeStatusMapping';

export const EMPLOYEE_DEPLOYABILITY_LABELS: Record<EmployeeDeployabilityResult, string> = {
  assignable: 'Einsatzfähig',
  warning: 'Einschränkung',
  blocked: 'Gesperrt',
};

export const EMPLOYEE_BACKGROUND_CHECK_STATUS_LABELS: Record<EmployeeBackgroundCheckStatus, string> = {
  not_required: 'Nicht erforderlich',
  missing: 'Fehlt',
  requested: 'Angefordert',
  submitted: 'Eingereicht',
  verified: 'Verifiziert',
  expired: 'Abgelaufen',
  rejected: 'Abgelehnt',
};

export const EMPLOYEE_QUALIFICATION_STATUS_LABELS: Record<
  EmployeeQualificationStatus | 'mixed',
  string
> = {
  valid: 'Gültig',
  expires_soon: 'Läuft ab',
  expired: 'Abgelaufen',
  missing: 'Fehlt',
  pending_review: 'Prüfung ausstehend',
  rejected: 'Abgelehnt',
  mixed: 'Gemischt',
};

export const EMPLOYEE_EMPLOYMENT_STATUS_LABELS: Record<EmployeeEmploymentStatus, string> = {
  applicant: 'Bewerber:in',
  onboarding: 'Einarbeitung',
  active: 'Aktiv',
  paused: 'Pausiert',
  sick_long_term: 'Langzeitkrank',
  on_leave: 'Abwesend',
  suspended: 'Gesperrt',
  terminated: 'Ausgeschieden',
  archived: 'Archiviert',
};

const BLOCKER_TAB_ACTIONS: Partial<
  Record<string, { label: string; tab: EmployeePersonnelTabKey }>
> = {
  qualification_missing: { label: 'Qualifikation erfassen', tab: 'qualifications' },
  qualification_unverified: { label: 'Qualifikation prüfen', tab: 'qualifications' },
  background_check_missing: { label: 'Führungszeugnis hinterlegen', tab: 'background_check' },
  background_check_follow_up: { label: 'Führungszeugnis prüfen', tab: 'background_check' },
  required_docs_missing: { label: 'Dokument hochladen', tab: 'documents' },
  employee_blocked: { label: 'Stammdaten bearbeiten', tab: 'master_data' },
  employment_inactive: { label: 'Anstellung prüfen', tab: 'employment' },
  portal_inactive: { label: 'Portalzugang prüfen', tab: 'roles_permissions' },
  compliance_training_missing: { label: 'Pflichtunterweisung erfassen', tab: 'qualifications' },
};

export function labelEmployeeDeployability(value: EmployeeDeployabilityResult | string): string {
  return EMPLOYEE_DEPLOYABILITY_LABELS[value as EmployeeDeployabilityResult] ?? value;
}

export function labelBackgroundCheckStatus(value: EmployeeBackgroundCheckStatus | string): string {
  return EMPLOYEE_BACKGROUND_CHECK_STATUS_LABELS[value as EmployeeBackgroundCheckStatus] ?? value;
}

export function labelQualificationStatus(
  value: EmployeeQualificationStatus | 'mixed' | string,
): string {
  return EMPLOYEE_QUALIFICATION_STATUS_LABELS[value as EmployeeQualificationStatus | 'mixed'] ?? value;
}

export function labelEmploymentStatus(value: EmployeeEmploymentStatus | string): string {
  if (EMPLOYEE_EMPLOYMENT_STATUS_LABELS[value as EmployeeEmploymentStatus]) {
    return EMPLOYEE_EMPLOYMENT_STATUS_LABELS[value as EmployeeEmploymentStatus];
  }
  return mapDbStatusToCatalogStatus(value);
}

export function resolvePersonnelBlockerActions(
  deployability: EmployeeDeployabilityCheck,
): Array<{ label: string; tab: EmployeePersonnelTabKey }> {
  const actions: Array<{ label: string; tab: EmployeePersonnelTabKey }> = [];
  const seen = new Set<string>();

  for (const issue of [...deployability.blockers, ...deployability.warnings]) {
    if (seen.has(issue.code)) continue;
    const action = BLOCKER_TAB_ACTIONS[issue.code];
    if (action) {
      seen.add(issue.code);
      actions.push(action);
    }
  }

  return actions;
}

export function employeeEditRoute(employeeId: string): string {
  return `/business/office/employees/${employeeId}/edit`;
}
