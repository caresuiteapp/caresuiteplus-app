import type { RoleKey } from '@/types/core/auth';
import type { TenantScopedEntity } from '../core/base';

/** Prompt 75 — Schulungsarten (5 Gruppen) */
export type TrainingTypeGroup =
  | 'mandatory_briefing'
  | 'care_support'
  | 'system_training'
  | 'legal_organizational'
  | 'academy_prepared';

export type TrainingRecordStatus =
  | 'not_required'
  | 'required'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'passed'
  | 'failed'
  | 'expired'
  | 'expires_soon'
  | 'waived'
  | 'pending_review'
  | 'rejected'
  | 'archived';

export type CertificateVerificationStatus =
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'expired'
  | 'needs_review';

export type TrainingExpiryAction = 'block' | 'warn';

export type TrainingCourse = TenantScopedEntity & {
  courseKey: string;
  title: string;
  description: string;
  trainingTypeGroup: TrainingTypeGroup;
  category: string;
  durationMinutes: number;
  validityMonths: number | null;
  isMandatory: boolean;
  blocksDeploymentOnExpiry: boolean;
  expiryAction: TrainingExpiryAction;
  requiresProof: boolean;
  requiresQuiz: boolean;
  academyCourseId: string | null;
  moduleKeys: string[];
  roleKeys: string[];
  status: 'prepared' | 'active' | 'archived';
};

export type TrainingCourseModule = TenantScopedEntity & {
  courseId: string;
  moduleKey: string;
  required: boolean;
};

export type TrainingRequirement = TenantScopedEntity & {
  courseId: string;
  roleKey: string | null;
  moduleKey: string | null;
  jobTitle: string | null;
  mandatory: boolean;
  effectiveFrom: string | null;
};

export type EmployeeTrainingRecord = TenantScopedEntity & {
  employeeId: string;
  courseId: string;
  status: TrainingRecordStatus;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  passedAt: string | null;
  validUntil: string | null;
  proofDocumentId: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  waivedBy: string | null;
  waivedReason: string | null;
  progressPercent: number;
  scorePercent: number | null;
  absenceId: string | null;
  academyEnrollmentId: string | null;
  rejectionReason: string | null;
};

export type EmployeeTrainingCertificate = TenantScopedEntity & {
  employeeId: string;
  trainingRecordId: string;
  courseId: string;
  title: string;
  certificateNumber: string | null;
  issuedAt: string | null;
  validUntil: string | null;
  documentId: string | null;
  verificationStatus: CertificateVerificationStatus;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
};

export type TrainingAssignment = TenantScopedEntity & {
  employeeId: string;
  courseId: string;
  assignedBy: string | null;
  dueAt: string | null;
  status: 'open' | 'completed' | 'cancelled';
};

export type TrainingReminderLevel = 'info_90d' | 'urgent_30d' | 'expired' | 'review_due';

export type TrainingReminder = TenantScopedEntity & {
  employeeId: string;
  courseId: string;
  trainingRecordId: string | null;
  reminderLevel: TrainingReminderLevel;
  dueAt: string;
  acknowledgedAt: string | null;
  adminTaskCreated: boolean;
};

export type TrainingAuditEvent = TenantScopedEntity & {
  employeeId: string | null;
  courseId: string | null;
  trainingRecordId: string | null;
  certificateId: string | null;
  action: string;
  actorId: string | null;
  actorRole: RoleKey | null;
  summary: string;
  metadata?: Record<string, string>;
};

export type TrainingQuizResult = TenantScopedEntity & {
  trainingRecordId: string;
  scorePercent: number;
  passed: boolean;
  attemptedAt: string;
};

export type TrainingContentItem = TenantScopedEntity & {
  courseId: string;
  contentType: 'document' | 'video' | 'scorm_package' | 'xapi_activity' | 'external_link';
  title: string;
  externalRef: string | null;
  sortOrder: number;
  academyPreparedOnly: boolean;
};

export type TrainingDashboardTile = {
  id: string;
  label: string;
  value: number;
  subValue: string;
  accentColor: string;
  routeHint: string;
};

export type TrainingViewKey =
  | 'dashboard'
  | 'mandatory_briefings'
  | 'my_trainings'
  | 'all_courses'
  | 'course_detail'
  | 'employee_status'
  | 'certificates'
  | 'certificate_review'
  | 'expiry_monitoring'
  | 'settings';

export const TRAINING_TYPE_GROUP_LABELS: Record<TrainingTypeGroup, string> = {
  mandatory_briefing: 'Pflichtunterweisung',
  care_support: 'Pflege & Betreuung',
  system_training: 'Systemschulung',
  legal_organizational: 'Recht & Organisation',
  academy_prepared: 'Akademie (vorbereitet)',
};

export const TRAINING_RECORD_STATUS_LABELS: Record<TrainingRecordStatus, string> = {
  not_required: 'Nicht erforderlich',
  required: 'Erforderlich',
  assigned: 'Zugewiesen',
  in_progress: 'In Bearbeitung',
  completed: 'Abgeschlossen',
  passed: 'Bestanden',
  failed: 'Nicht bestanden',
  expired: 'Abgelaufen',
  expires_soon: 'Läuft bald ab',
  waived: 'Erlassen',
  pending_review: 'Prüfung ausstehend',
  rejected: 'Abgelehnt',
  archived: 'Archiviert',
};

export const CERTIFICATE_VERIFICATION_LABELS: Record<CertificateVerificationStatus, string> = {
  pending: 'Ausstehend',
  verified: 'Verifiziert',
  rejected: 'Abgelehnt',
  expired: 'Abgelaufen',
  needs_review: 'Nachprüfung',
};

export const TRAINING_VIEW_LABELS: Record<TrainingViewKey, string> = {
  dashboard: 'Übersicht',
  mandatory_briefings: 'Pflichtunterweisungen',
  my_trainings: 'Meine Schulungen',
  all_courses: 'Alle Kurse',
  course_detail: 'Kursdetail',
  employee_status: 'Mitarbeiterstatus',
  certificates: 'Zertifikate',
  certificate_review: 'Zertifikatsprüfung',
  expiry_monitoring: 'Ablaufüberwachung',
  settings: 'Einstellungen',
};

export const TRAINING_EXPIRY_WARNING_DAYS = 90;
export const TRAINING_EXPIRY_URGENT_DAYS = 30;

export type TrainingDeployabilityIssue = {
  code:
    | 'mandatory_training_missing'
    | 'training_expired'
    | 'training_expires_soon'
    | 'certificate_missing'
    | 'certificate_expired'
    | 'certificate_unverified'
    | 'proof_missing';
  message: string;
  severity: 'warning' | 'error';
  courseId?: string;
  courseTitle?: string;
};

export type EmployeeTrainingDeployability = {
  deployable: boolean;
  result: 'assignable' | 'warning' | 'blocked';
  blockers: TrainingDeployabilityIssue[];
  warnings: TrainingDeployabilityIssue[];
};

export type AssignmentTrainingCheck = {
  allowed: boolean;
  conflicts: TrainingDeployabilityIssue[];
  suggestAlternativesPrepared: boolean;
};

export type CompleteTrainingInput = {
  tenantId: string;
  trainingRecordId: string;
  employeeId: string;
  proofDocumentId?: string | null;
  scorePercent?: number | null;
  actorId?: string | null;
  actorRole?: RoleKey | null;
};

export type VerifyCertificateInput = {
  tenantId: string;
  certificateId: string;
  verificationStatus: Extract<CertificateVerificationStatus, 'verified' | 'rejected' | 'needs_review'>;
  rejectionReason?: string | null;
  actorId?: string | null;
  actorRole?: RoleKey | null;
};
