import type { EntityId, ISODateTime } from '@/types/core/base';

/** Prompt 78 — Mitarbeiter-Offboarding / Austritt */
export type OffboardingOverallStatus =
  | 'not_started'
  | 'in_progress'
  | 'blocked'
  | 'ready_for_clearance'
  | 'completed'
  | 'reopened';

export type OffboardingStepStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'skipped'
  | 'not_applicable';

export type OffboardingStepKey =
  | 'exit_date'
  | 'termination_type'
  | 'open_assignments'
  | 'replacement_required'
  | 'open_documentation'
  | 'open_corrections'
  | 'open_signatures'
  | 'work_time_closure'
  | 'payroll_export_prepared'
  | 'inventory_return'
  | 'uniform'
  | 'keys_access'
  | 'devices'
  | 'lock_portal_access'
  | 'external_access_prepared'
  | 'completion_documents'
  | 'reference_prepared'
  | 'return_protocol'
  | 'final_clearance'
  | 'archiving';

export const OFFBOARDING_STEP_ORDER: OffboardingStepKey[] = [
  'exit_date',
  'termination_type',
  'open_assignments',
  'replacement_required',
  'open_documentation',
  'open_corrections',
  'open_signatures',
  'work_time_closure',
  'payroll_export_prepared',
  'inventory_return',
  'uniform',
  'keys_access',
  'devices',
  'lock_portal_access',
  'external_access_prepared',
  'completion_documents',
  'reference_prepared',
  'return_protocol',
  'final_clearance',
  'archiving',
];

export const OFFBOARDING_STEP_LABELS: Record<OffboardingStepKey, string> = {
  exit_date: 'Austrittsdatum',
  termination_type: 'Kündigungsart / interner Grund',
  open_assignments: 'Offene Einsätze',
  replacement_required: 'Vertretung planen',
  open_documentation: 'Offene Dokumentation',
  open_corrections: 'Offene Korrekturen',
  open_signatures: 'Offene Unterschriften',
  work_time_closure: 'Arbeitszeit abschließen',
  payroll_export_prepared: 'Lohnexport vorbereitet',
  inventory_return: 'Inventar-Rückgabe',
  uniform: 'Dienstkleidung',
  keys_access: 'Schlüssel / Zugänge',
  devices: 'Geräte',
  lock_portal_access: 'Portalzugang sperren',
  external_access_prepared: 'E-Mail / Telefon / Cloud vorbereitet',
  completion_documents: 'Abschlussdokumente',
  reference_prepared: 'Zeugnis vorbereitet',
  return_protocol: 'Rückgabeprotokoll',
  final_clearance: 'Endfreigabe',
  archiving: 'Personalakte archivieren',
};

export type TerminationType =
  | 'voluntary'
  | 'employer_initiated'
  | 'mutual'
  | 'contract_end'
  | 'retirement'
  | 'other';

export const TERMINATION_TYPE_LABELS: Record<TerminationType, string> = {
  voluntary: 'Eigenkündigung',
  employer_initiated: 'Arbeitgeberkündigung',
  mutual: 'Aufhebungsvertrag',
  contract_end: 'Vertragsende',
  retirement: 'Renteneintritt',
  other: 'Sonstiges',
};

export type OffboardingCheckKey =
  | 'missing_exit_date'
  | 'missing_termination_type'
  | 'open_assignments'
  | 'replacement_open'
  | 'open_documentation'
  | 'open_corrections'
  | 'open_signatures'
  | 'work_time_open'
  | 'payroll_not_prepared'
  | 'open_returns'
  | 'portal_not_locked'
  | 'external_access_not_prepared'
  | 'documents_incomplete'
  | 'reference_missing'
  | 'return_protocol_missing';

export type OffboardingCheckStatus = 'passed' | 'warning' | 'failed';

export type AccessRevocationKind = 'portal' | 'email' | 'phone' | 'cloud' | 'keys' | 'device';

export type AccessRevocationStatus = 'pending' | 'prepared' | 'locked' | 'failed';

export type EmployeeOffboardingSession = {
  id: EntityId;
  tenantId: EntityId;
  employeeId: EntityId;
  overallStatus: OffboardingOverallStatus;
  currentStepKey: OffboardingStepKey;
  exitDate: string | null;
  terminationType: TerminationType | null;
  internalReason: string | null;
  responsibleUserId: string | null;
  startedAt: ISODateTime | null;
  completedAt: ISODateTime | null;
  lastSavedAt: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type EmployeeOffboardingStep = {
  id: EntityId;
  sessionId: EntityId;
  tenantId: EntityId;
  employeeId: EntityId;
  stepKey: OffboardingStepKey;
  status: OffboardingStepStatus;
  responsibleUserId: string | null;
  completedAt: ISODateTime | null;
  notes: string | null;
  updatedAt: ISODateTime;
};

export type EmployeeOffboardingCheck = {
  id: EntityId;
  sessionId: EntityId;
  tenantId: EntityId;
  employeeId: EntityId;
  checkKey: OffboardingCheckKey;
  status: OffboardingCheckStatus;
  message: string;
  count: number | null;
  evaluatedAt: ISODateTime;
};

export type EmployeeAccessRevocation = {
  id: EntityId;
  sessionId: EntityId;
  tenantId: EntityId;
  employeeId: EntityId;
  kind: AccessRevocationKind;
  status: AccessRevocationStatus;
  providerConnected: boolean;
  preparedAt: ISODateTime | null;
  lockedAt: ISODateTime | null;
  actorId: string | null;
  notes: string | null;
  updatedAt: ISODateTime;
};

export type EmployeeFinalClearance = {
  id: EntityId;
  sessionId: EntityId;
  tenantId: EntityId;
  employeeId: EntityId;
  clearedBy: string | null;
  clearedAt: ISODateTime | null;
  protocolDocumentId: string | null;
  protocolGeneratedAt: ISODateTime | null;
  archivedAt: ISODateTime | null;
  employmentStatusAfter: 'terminated' | 'archived' | null;
  notes: string | null;
};

export type OffboardingAuditAction =
  | 'session_started'
  | 'exit_recorded'
  | 'checks_refreshed'
  | 'step_updated'
  | 'return_recorded'
  | 'access_prepared'
  | 'access_locked'
  | 'protocol_generated'
  | 'clearance_completed'
  | 'personnel_archived'
  | 'session_reopened'
  | 'status_changed';

export type OffboardingAuditEvent = {
  id: EntityId;
  tenantId: EntityId;
  sessionId: EntityId;
  employeeId: EntityId;
  action: OffboardingAuditAction;
  stepKey?: OffboardingStepKey;
  detail: string;
  actorId: string | null;
  createdAt: ISODateTime;
};

export type OffboardingBlocker = {
  checkKey: OffboardingCheckKey;
  message: string;
  count: number | null;
};

export type OffboardingProgressSummary = {
  session: EmployeeOffboardingSession;
  steps: EmployeeOffboardingStep[];
  checks: EmployeeOffboardingCheck[];
  accessRevocations: EmployeeAccessRevocation[];
  clearance: EmployeeFinalClearance | null;
  blockers: OffboardingBlocker[];
  completedStepCount: number;
  totalStepCount: number;
  progressPercent: number;
};

export type OffboardingCompletionProtocol = {
  sessionId: EntityId;
  employeeId: EntityId;
  tenantId: EntityId;
  generatedAt: ISODateTime;
  exitDate: string | null;
  terminationType: TerminationType | null;
  stepsCompleted: OffboardingStepKey[];
  blockersResolved: boolean;
  accessLocked: boolean;
  returnsCompleted: boolean;
  documentReference: string;
};
