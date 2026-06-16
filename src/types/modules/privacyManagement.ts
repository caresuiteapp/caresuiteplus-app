/** Datenschutz- und DSGVO-Management — Mehr → Datenschutz & Compliance */

import type { RoleKey } from '../core/auth';
import type { TenantScopedEntity } from '../core/base';

/** 11 Bereiche im Modul-Hub */
export type PrivacyManagementAreaKey =
  | 'processing_activities'
  | 'toms'
  | 'dpa'
  | 'data_subject_requests'
  | 'access_requests'
  | 'correction_requests'
  | 'deletion_requests'
  | 'data_export'
  | 'consents'
  | 'retention_rules'
  | 'incidents';

export type PrivacyDataSubjectRequestStatus =
  | 'received'
  | 'identity_check_required'
  | 'in_review'
  | 'processing'
  | 'completed'
  | 'rejected'
  | 'archived';

export type PrivacyRequestType =
  | 'access'
  | 'export'
  | 'correction'
  | 'deletion'
  | 'restriction'
  | 'objection'
  | 'portability'
  | 'consent_withdrawal'
  | 'other';

export type PrivacyExportJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type PrivacyDeletionReviewStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'blocked_retention'
  | 'executed';

export type PrivacyIncidentStatus = 'prepared' | 'reported' | 'investigating' | 'closed';

export type PrivacyAuditAction =
  | 'request_captured'
  | 'identity_check_prepared'
  | 'export_prepared'
  | 'deletion_reviewed'
  | 'deletion_blocked_retention'
  | 'status_changed'
  | 'task_created'
  | 'consent_updated'
  | 'record_created';

export type PrivacyProcessingActivity = TenantScopedEntity & {
  title: string;
  purpose: string;
  legalBasis: string;
  dataCategories: string[];
  dataSubjects: string[];
  recipients: string[];
  retentionReference: string | null;
  status: 'active' | 'archived';
};

export type PrivacyTomRecord = TenantScopedEntity & {
  title: string;
  category: string;
  description: string;
  implementationStatus: 'planned' | 'partial' | 'implemented';
  reviewDueAt: string | null;
  status: 'active' | 'archived';
};

export type PrivacyDpaRecord = TenantScopedEntity & {
  processorName: string;
  serviceDescription: string;
  signedAt: string | null;
  expiresAt: string | null;
  documentId: string | null;
  status: 'draft' | 'active' | 'expired' | 'archived';
};

export type PrivacyDataSubjectRequest = TenantScopedEntity & {
  requestType: PrivacyRequestType;
  status: PrivacyDataSubjectRequestStatus;
  requesterName: string;
  requesterEmail: string;
  requestNumber: string;
  clientId: string | null;
  employeeId: string | null;
  profileId: string | null;
  identityVerified: boolean;
  identityCheckPrepared: boolean;
  verificationNotes: string | null;
  receivedAt: string;
  dueAt: string;
  completedAt: string | null;
  containsHealthData: boolean;
  internalTaskId: string | null;
};

export type PrivacyDataExportJob = TenantScopedEntity & {
  requestId: string;
  status: PrivacyExportJobStatus;
  includesHealthData: boolean;
  exportPrepared: boolean;
  approvedByRole: RoleKey | null;
  resultSummary: string | null;
  completedAt: string | null;
};

export type PrivacyDeletionRequest = TenantScopedEntity & {
  requestId: string;
  targetEntityType: 'client' | 'client_care_record' | 'employee' | 'applicant' | 'profile' | 'invoice' | 'other';
  targetEntityId: string;
  reviewStatus: PrivacyDeletionReviewStatus;
  retentionBlocked: boolean;
  retentionRuleId: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  executedAt: string | null;
};

export type PrivacyConsentRecord = TenantScopedEntity & {
  subjectType: 'client' | 'employee' | 'applicant' | 'portal_user';
  subjectId: string;
  consentType: string;
  granted: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
  source: 'intake' | 'portal' | 'manual' | 'document';
};

export type PrivacyRetentionRule = TenantScopedEntity & {
  entityType: string;
  label: string;
  retentionDays: number;
  legalReference: string;
  blockDeletionUntil: boolean;
  status: 'active' | 'archived';
};

export type PrivacyIncidentReport = TenantScopedEntity & {
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: PrivacyIncidentStatus;
  reportedAt: string | null;
  preparedOnly: boolean;
};

export type PrivacyAuditEvent = TenantScopedEntity & {
  action: PrivacyAuditAction;
  entityType: string;
  entityId: string;
  actorUserId: string | null;
  actorRoleKey: RoleKey | null;
  details: string;
  metadata: Record<string, unknown>;
};

export type PrivacyComplianceDashboard = {
  processingActivitiesCount: number;
  tomRecordsCount: number;
  dpaRecordsCount: number;
  openRequestsCount: number;
  overdueRequestsCount: number;
  pendingDeletionReviews: number;
  activeRetentionRules: number;
  incidentsPrepared: number;
};

export type CapturePrivacyRequestInput = {
  tenantId: string;
  requestType: PrivacyRequestType;
  requesterName: string;
  requesterEmail: string;
  clientId?: string | null;
  employeeId?: string | null;
  profileId?: string | null;
  containsHealthData?: boolean;
  verificationNotes?: string;
};

export type CreateProcessingActivityInput = {
  tenantId: string;
  title: string;
  purpose: string;
  legalBasis: string;
  dataCategories?: string[];
  dataSubjects?: string[];
  recipients?: string[];
  retentionReference?: string | null;
};

export const PRIVACY_MANAGEMENT_AREA_LABELS: Record<PrivacyManagementAreaKey, string> = {
  processing_activities: 'Verarbeitungstätigkeiten',
  toms: 'TOMs',
  dpa: 'AVV',
  data_subject_requests: 'Betroffenenanfragen',
  access_requests: 'Auskunft',
  correction_requests: 'Berichtigung',
  deletion_requests: 'Löschung',
  data_export: 'Datenexport',
  consents: 'Einwilligungen',
  retention_rules: 'Löschfristen',
  incidents: 'Datenschutzvorfälle',
};

export const PRIVACY_REQUEST_STATUS_LABELS: Record<PrivacyDataSubjectRequestStatus, string> = {
  received: 'Eingegangen',
  identity_check_required: 'Identitätsprüfung',
  in_review: 'In Prüfung',
  processing: 'In Bearbeitung',
  completed: 'Abgeschlossen',
  rejected: 'Abgelehnt',
  archived: 'Archiviert',
};

export const PRIVACY_REQUEST_TYPE_LABELS: Record<PrivacyRequestType, string> = {
  access: 'Auskunft',
  export: 'Datenexport',
  correction: 'Berichtigung',
  deletion: 'Löschung',
  restriction: 'Einschränkung',
  objection: 'Widerspruch',
  portability: 'Datenübertragbarkeit',
  consent_withdrawal: 'Einwilligungswiderruf',
  other: 'Sonstiges',
};

export const PRIVACY_OPEN_REQUEST_STATUSES: PrivacyDataSubjectRequestStatus[] = [
  'received',
  'identity_check_required',
  'in_review',
  'processing',
];
