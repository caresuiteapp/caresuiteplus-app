/** Prompt — Pflichtunterweisungs- und Compliance-Modul */

import type { RoleKey } from '../core/auth';
import type { TenantScopedEntity } from '../core/base';

export type ComplianceTrainingAreaKey =
  | 'datenschutz'
  | 'schweigepflicht'
  | 'dsgvo_grundlagen'
  | 'verhalten_haushalt'
  | 'dokumentationspflicht'
  | 'schluessel_zugang'
  | 'notfallverhalten'
  | 'app_nutzung'
  | 'kommunikationsregeln'
  | 'dienstanweisungen';

export type ComplianceTrainingStatus =
  | 'required'
  | 'assigned'
  | 'viewed'
  | 'acknowledged'
  | 'quiz_required'
  | 'passed'
  | 'failed'
  | 'expired'
  | 'overdue'
  | 'waived'
  | 'archived';

export type ComplianceRoleGroup =
  | 'caregiver_employee'
  | 'office'
  | 'billing'
  | 'qm'
  | 'admin_owner';

export type ComplianceTrainingItem = TenantScopedEntity & {
  areaKey: ComplianceTrainingAreaKey;
  title: string;
  description: string;
  mandatory: boolean;
  requiresQuiz: boolean;
  requiresSignature: boolean;
  validityMonths: number | null;
  documentId: string | null;
  policyDocumentId: string | null;
  linkedCourseId: string | null;
  assignedRoleGroups: ComplianceRoleGroup[];
  status: 'active' | 'archived';
};

export type ComplianceTrainingAssignment = TenantScopedEntity & {
  employeeId: string;
  trainingItemId: string;
  status: ComplianceTrainingStatus;
  mandatory: boolean;
  assignedAt: string;
  dueAt: string | null;
  expiresAt: string | null;
  viewedAt: string | null;
  acknowledgedAt: string | null;
  waivedAt: string | null;
  waivedBy: string | null;
  waiverReason: string | null;
};

export type ComplianceTrainingAcknowledgement = TenantScopedEntity & {
  assignmentId: string;
  employeeId: string;
  trainingItemId: string;
  viewedDocument: boolean;
  viewedAt: string | null;
  signatureName: string;
  signatureCapturedAt: string;
  quizScore: number | null;
  quizPassed: boolean | null;
  proofExportPath: string | null;
};

export type CompliancePolicyDocument = TenantScopedEntity & {
  title: string;
  areaKey: ComplianceTrainingAreaKey | null;
  storagePath: string | null;
  versionLabel: string;
  effectiveFrom: string | null;
  status: 'active' | 'archived';
};

export type EmployeePolicyAcknowledgement = TenantScopedEntity & {
  employeeId: string;
  policyDocumentId: string;
  acknowledgedAt: string;
  signatureName: string;
};

export type ComplianceTrainingAuditEvent = TenantScopedEntity & {
  employeeId: string | null;
  trainingItemId: string | null;
  assignmentId: string | null;
  action: string;
  actorId: string | null;
  actorRole: RoleKey | null;
  summary: string;
  metadata?: Record<string, string>;
};

export type CreateComplianceTrainingItemInput = {
  tenantId: string;
  areaKey: ComplianceTrainingAreaKey;
  title: string;
  description?: string;
  mandatory?: boolean;
  requiresQuiz?: boolean;
  requiresSignature?: boolean;
  validityMonths?: number | null;
  documentId?: string | null;
  policyDocumentId?: string | null;
  linkedCourseId?: string | null;
  assignedRoleGroups: ComplianceRoleGroup[];
  actorProfileId?: string | null;
};

export type AssignComplianceTrainingInput = {
  tenantId: string;
  employeeId: string;
  trainingItemId: string;
  mandatory?: boolean;
  dueAt?: string | null;
  actorProfileId?: string | null;
};

export type AcknowledgeComplianceTrainingInput = {
  tenantId: string;
  assignmentId: string;
  employeeId: string;
  signatureName: string;
  viewedDocument: boolean;
  quizScore?: number | null;
  actorProfileId?: string | null;
};

export type ComplianceProofExport = {
  employeeId: string;
  employeeName: string | null;
  trainingItemId: string;
  trainingTitle: string;
  areaKey: ComplianceTrainingAreaKey;
  status: ComplianceTrainingStatus;
  acknowledgedAt: string | null;
  signatureName: string | null;
  expiresAt: string | null;
  proofAvailable: boolean;
};

export type ComplianceEmployeeStatusRow = {
  employeeId: string;
  assignmentId: string;
  trainingItemId: string;
  areaKey: ComplianceTrainingAreaKey;
  title: string;
  status: ComplianceTrainingStatus;
  mandatory: boolean;
  dueAt: string | null;
  expiresAt: string | null;
  blocking: boolean;
};

export const COMPLIANCE_TRAINING_AREA_LABELS: Record<ComplianceTrainingAreaKey, string> = {
  datenschutz: 'Datenschutzunterweisung',
  schweigepflicht: 'Schweigepflichtunterweisung',
  dsgvo_grundlagen: 'DSGVO-Grundlagen',
  verhalten_haushalt: 'Verhalten im Haushalt von Klient:innen',
  dokumentationspflicht: 'Dokumentationspflicht',
  schluessel_zugang: 'Umgang mit Schlüssel/Zugang',
  notfallverhalten: 'Notfallverhalten',
  app_nutzung: 'App-Nutzung',
  kommunikationsregeln: 'Kommunikationsregeln',
  dienstanweisungen: 'Dienstanweisungen',
};

export const COMPLIANCE_TRAINING_STATUS_LABELS: Record<ComplianceTrainingStatus, string> = {
  required: 'Erforderlich',
  assigned: 'Zugewiesen',
  viewed: 'Gelesen',
  acknowledged: 'Bestätigt',
  quiz_required: 'Quiz erforderlich',
  passed: 'Bestanden',
  failed: 'Nicht bestanden',
  expired: 'Abgelaufen',
  overdue: 'Überfällig',
  waived: 'Freigestellt',
  archived: 'Archiviert',
};

export const ALL_COMPLIANCE_TRAINING_AREAS: ComplianceTrainingAreaKey[] = [
  'datenschutz',
  'schweigepflicht',
  'dsgvo_grundlagen',
  'verhalten_haushalt',
  'dokumentationspflicht',
  'schluessel_zugang',
  'notfallverhalten',
  'app_nutzung',
  'kommunikationsregeln',
  'dienstanweisungen',
];

export const COMPLIANCE_COMPLETED_STATUSES: ReadonlySet<ComplianceTrainingStatus> = new Set([
  'acknowledged',
  'passed',
  'waived',
]);

export const COMPLIANCE_BLOCKING_STATUSES: ReadonlySet<ComplianceTrainingStatus> = new Set([
  'required',
  'assigned',
  'viewed',
  'quiz_required',
  'failed',
  'expired',
  'overdue',
]);
