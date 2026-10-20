import type { RoleKey } from '../core/auth';
import type { EmployeeEmploymentStatus } from './employeePersonnelFile';

/** Prompt 79 — Personal-Compliance-Cockpit KPI-Schlüssel (14 Kennzahlen) */
export type PersonalComplianceKpiKey =
  | 'active_employees'
  | 'deployable'
  | 'not_deployable'
  | 'qualification_missing'
  | 'qualification_expiring'
  | 'background_check_missing'
  | 'background_check_expired'
  | 'briefing_missing'
  | 'required_document_missing'
  | 'return_open'
  | 'offboarding_open'
  | 'sick_absent'
  | 'open_corrections'
  | 'open_personnel_tasks';

export type PersonalComplianceDataSource =
  | 'employees'
  | 'employee_qualifications'
  | 'employee_background_checks'
  | 'employee_training_records'
  | 'compliance_training'
  | 'employee_absences'
  | 'inventory_assignments'
  | 'employee_documents'
  | 'employee_offboarding_sessions'
  | 'management_tasks';

export const PERSONAL_COMPLIANCE_KPI_LABELS: Record<PersonalComplianceKpiKey, string> = {
  active_employees: 'Aktive Mitarbeitende',
  deployable: 'Einsatzfähig',
  not_deployable: 'Nicht einsatzfähig',
  qualification_missing: 'Qualifikation fehlt',
  qualification_expiring: 'Qualifikation läuft ab',
  background_check_missing: 'Führungszeugnis fehlt',
  background_check_expired: 'Führungszeugnis abgelaufen',
  briefing_missing: 'Unterweisung fehlt',
  required_document_missing: 'Pflichtdokument fehlt',
  return_open: 'Rückgabe offen',
  offboarding_open: 'Offboarding offen',
  sick_absent: 'Krank / abwesend',
  open_corrections: 'Offene Korrekturen',
  open_personnel_tasks: 'Offene Personalaufgaben',
};

export const PERSONAL_COMPLIANCE_KPI_DATA_SOURCES: Record<
  PersonalComplianceKpiKey,
  PersonalComplianceDataSource
> = {
  active_employees: 'employees',
  deployable: 'employees',
  not_deployable: 'employees',
  qualification_missing: 'employee_qualifications',
  qualification_expiring: 'employee_qualifications',
  background_check_missing: 'employee_background_checks',
  background_check_expired: 'employee_background_checks',
  briefing_missing: 'compliance_training',
  required_document_missing: 'employee_documents',
  return_open: 'inventory_assignments',
  offboarding_open: 'employee_offboarding_sessions',
  sick_absent: 'employee_absences',
  open_corrections: 'management_tasks',
  open_personnel_tasks: 'management_tasks',
};

export type PersonalComplianceRiskSeverity = 'critical' | 'warning' | 'info';

export type PersonalComplianceRiskCode =
  | 'qualification_missing'
  | 'qualification_expiring'
  | 'background_check_missing'
  | 'background_check_expired'
  | 'briefing_missing'
  | 'document_missing'
  | 'return_open'
  | 'offboarding_open'
  | 'absent'
  | 'not_deployable'
  | 'open_correction'
  | 'personnel_task';

export type PersonalComplianceRiskItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  roleTitle: string | null;
  code: PersonalComplianceRiskCode;
  title: string;
  message: string;
  severity: PersonalComplianceRiskSeverity;
  dataSource: PersonalComplianceDataSource;
  relatedEntityId: string | null;
  dueAt: string | null;
  sensitive: boolean;
};

export type PersonalComplianceKpiTile = {
  key: PersonalComplianceKpiKey;
  label: string;
  value: number;
  dataSource: PersonalComplianceDataSource;
  accentColor: string;
  drilldownFilter: PersonalComplianceListFilter;
};

export type PersonalComplianceEmployeeRow = {
  employeeId: string;
  fullName: string;
  roleTitle: string | null;
  employmentStatus: EmployeeEmploymentStatus;
  deployable: boolean;
  deployabilityResult: 'assignable' | 'warning' | 'blocked';
  riskCount: number;
  criticalRiskCount: number;
  topRisks: string[];
  personnelFileRoute: string;
};

export type PersonalComplianceListFilter = {
  kpiKey?: PersonalComplianceKpiKey;
  riskCode?: PersonalComplianceRiskCode;
  employmentStatus?: EmployeeEmploymentStatus;
  deployable?: boolean;
  roleTitle?: string;
  search?: string;
};

export type PersonalComplianceSnapshot = {
  tenantId: string;
  generatedAt: string;
  kpis: PersonalComplianceKpiTile[];
  risks: PersonalComplianceRiskItem[];
  employees: PersonalComplianceEmployeeRow[];
  preparedOnly: boolean;
  availableDataSources: PersonalComplianceDataSource[];
};

export type PersonalComplianceAuditEvent = {
  id: string;
  tenantId: string;
  action: string;
  employeeId: string | null;
  actorId: string | null;
  actorRole: RoleKey | null;
  summary: string;
  metadata?: Record<string, string>;
  createdAt: string;
};

export type CreatePersonalComplianceTaskInput = {
  tenantId: string;
  employeeId: string;
  title: string;
  description: string;
  dueAt?: string | null;
  actorId?: string | null;
  actorRole?: RoleKey | null;
};
