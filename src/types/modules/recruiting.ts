/** Prompt 76 — Bewerbermanagement & Onboarding Mitarbeitende */

import type { EntityId, ISODateTime, TenantScopedEntity } from '@/types/core/base';
import type { RoleKey } from '@/types/core/auth';
import type { EmployeeEmploymentStatus } from './employeePersonnelFile';

/** A) 16 Bewerberstatus */
export type ApplicantStatus =
  | 'received'
  | 'in_review'
  | 'documents_requested'
  | 'documents_incomplete'
  | 'documents_complete'
  | 'screening_passed'
  | 'interview_scheduled'
  | 'interview_completed'
  | 'assessment_pending'
  | 'offer_preparation'
  | 'offer_sent'
  | 'offer_accepted'
  | 'offer_declined'
  | 'rejected'
  | 'withdrawn'
  | 'converted';

export const APPLICANT_STATUS_LABELS: Record<ApplicantStatus, string> = {
  received: 'Eingegangen',
  in_review: 'In Prüfung',
  documents_requested: 'Unterlagen angefordert',
  documents_incomplete: 'Unterlagen unvollständig',
  documents_complete: 'Unterlagen vollständig',
  screening_passed: 'Vorselektion bestanden',
  interview_scheduled: 'Gespräch terminiert',
  interview_completed: 'Gespräch durchgeführt',
  assessment_pending: 'Bewertung ausstehend',
  offer_preparation: 'Angebot in Vorbereitung',
  offer_sent: 'Angebot versendet',
  offer_accepted: 'Angebot angenommen',
  offer_declined: 'Angebot abgelehnt',
  rejected: 'Abgelehnt',
  withdrawn: 'Zurückgezogen',
  converted: 'In Mitarbeitende:r umgewandelt',
};

export const TERMINAL_APPLICANT_STATUSES: ReadonlySet<ApplicantStatus> = new Set([
  'offer_declined',
  'rejected',
  'withdrawn',
  'converted',
]);

export const CONVERTIBLE_APPLICANT_STATUSES: ReadonlySet<ApplicantStatus> = new Set([
  'offer_accepted',
]);

/** D) 16 Bewerbungsprozessschritte */
export type ApplicationProcessStepKey =
  | 'application_received'
  | 'initial_review'
  | 'document_request'
  | 'document_intake'
  | 'document_verification'
  | 'qualification_screening'
  | 'interview_invitation'
  | 'interview_execution'
  | 'reference_check'
  | 'hiring_decision'
  | 'offer_creation'
  | 'offer_delivery'
  | 'offer_follow_up'
  | 'pre_onboarding'
  | 'employee_conversion'
  | 'onboarding_handover';

export const APPLICATION_PROCESS_STEP_ORDER: ApplicationProcessStepKey[] = [
  'application_received',
  'initial_review',
  'document_request',
  'document_intake',
  'document_verification',
  'qualification_screening',
  'interview_invitation',
  'interview_execution',
  'reference_check',
  'hiring_decision',
  'offer_creation',
  'offer_delivery',
  'offer_follow_up',
  'pre_onboarding',
  'employee_conversion',
  'onboarding_handover',
];

export const APPLICATION_PROCESS_STEP_LABELS: Record<ApplicationProcessStepKey, string> = {
  application_received: 'Bewerbung eingegangen',
  initial_review: 'Erstsichtung',
  document_request: 'Unterlagen anfordern',
  document_intake: 'Unterlagen erfassen',
  document_verification: 'Unterlagen prüfen',
  qualification_screening: 'Qualifikation prüfen',
  interview_invitation: 'Gespräch einladen',
  interview_execution: 'Gespräch führen',
  reference_check: 'Referenzen prüfen',
  hiring_decision: 'Entscheidung',
  offer_creation: 'Angebot erstellen',
  offer_delivery: 'Angebot versenden',
  offer_follow_up: 'Angebotsrückmeldung',
  pre_onboarding: 'Vor-Onboarding',
  employee_conversion: 'Mitarbeiter anlegen',
  onboarding_handover: 'Onboarding übergeben',
};

export type ApplicationProcessStepStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'skipped'
  | 'not_applicable';

/** C) Bewerbungsdokumente */
export type ApplicantDocumentType =
  | 'cv'
  | 'cover_letter'
  | 'qualifications'
  | 'license'
  | 'background_check'
  | 'certificate'
  | 'work_permit';

export type ApplicantDocumentStatus =
  | 'requested'
  | 'received'
  | 'pending_review'
  | 'verified'
  | 'rejected'
  | 'expired'
  | 'archived';

export const APPLICANT_DOCUMENT_TYPE_LABELS: Record<ApplicantDocumentType, string> = {
  cv: 'Lebenslauf',
  cover_letter: 'Anschreiben',
  qualifications: 'Qualifikationsnachweise',
  license: 'Führerschein',
  background_check: 'Führungszeugnis (später)',
  certificate: 'Zertifikate',
  work_permit: 'Arbeitserlaubnis (optional)',
};

/** F) Kommunikation — nur Entwurf/In-App */
export type ApplicantCommunicationType =
  | 'application_received'
  | 'documents_requested'
  | 'interview_invitation'
  | 'interview_reminder'
  | 'offer_letter'
  | 'rejection_notice'
  | 'withdrawal_acknowledgement'
  | 'onboarding_welcome';

export type ApplicantCommunicationChannel = 'in_app' | 'draft_email' | 'draft_sms';

export type ApplicantCommunicationStatus = 'draft' | 'prepared' | 'sent_in_app' | 'cancelled';

/** E) Interviewfelder */
export type ApplicantInterviewFormat = 'in_person' | 'video' | 'phone';

export type ApplicantInterviewOutcome =
  | 'pending'
  | 'positive'
  | 'neutral'
  | 'negative'
  | 'no_show'
  | 'cancelled';

/** B) Bewerbungsstammdaten */
export type ApplicantRecord = TenantScopedEntity & {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  appliedRole: string;
  appliedAt: ISODateTime;
  source: string | null;
  desiredStartDate: string | null;
  availabilityNote: string | null;
  weeklyHoursDesired: number | null;
  experienceYears: number | null;
  previousEmployer: string | null;
  qualificationSummary: string | null;
  status: ApplicantStatus;
  currentProcessStep: ApplicationProcessStepKey;
  internalNotes: string;
  rejectionReason: string | null;
  offerSentAt: ISODateTime | null;
  offerAcceptedAt: ISODateTime | null;
  offerRejectedAt: ISODateTime | null;
  privacyConsentAt: ISODateTime | null;
  extendedStorageConsent: boolean;
  extendedStorageConsentAt: ISODateTime | null;
  archivedAt: ISODateTime | null;
  deletionDueAt: ISODateTime | null;
  deletionScheduled: boolean;
  convertedEmployeeId: EntityId | null;
  assignedRecruiterId: EntityId | null;
  createdBy: EntityId | null;
  updatedBy: EntityId | null;
};

export type ApplicantDocument = TenantScopedEntity & {
  applicantId: EntityId;
  documentType: ApplicantDocumentType;
  title: string;
  fileName: string | null;
  storagePath: string | null;
  status: ApplicantDocumentStatus;
  required: boolean;
  sensitive: boolean;
  verifiedBy: EntityId | null;
  verifiedAt: ISODateTime | null;
  rejectionReason: string | null;
  validUntil: ISODateTime | null;
};

export type ApplicantInterview = TenantScopedEntity & {
  applicantId: EntityId;
  scheduledAt: ISODateTime;
  durationMinutes: number;
  format: ApplicantInterviewFormat;
  location: string | null;
  meetingLink: string | null;
  interviewerIds: EntityId[];
  interviewerNames: string[];
  outcome: ApplicantInterviewOutcome;
  rating: number | null;
  notes: string;
  nextSteps: string | null;
  completedAt: ISODateTime | null;
  cancelledAt: ISODateTime | null;
};

export type ApplicantCommunication = TenantScopedEntity & {
  applicantId: EntityId;
  messageType: ApplicantCommunicationType;
  channel: ApplicantCommunicationChannel;
  status: ApplicantCommunicationStatus;
  subject: string;
  body: string;
  preparedOnly: boolean;
  createdBy: EntityId | null;
};

export type ApplicantStatusEvent = TenantScopedEntity & {
  applicantId: EntityId;
  previousStatus: ApplicantStatus | null;
  newStatus: ApplicantStatus;
  processStep: ApplicationProcessStepKey | null;
  actorId: EntityId | null;
  actorRole: RoleKey | null;
  summary: string;
  metadata?: Record<string, string>;
};

/** H) Mitarbeiter-Onboarding (unterscheidet sich von Mandanten-Onboarding Prompt 67) */
export type EmployeeOnboardingOverallStatus =
  | 'not_started'
  | 'in_progress'
  | 'blocked'
  | 'deployable'
  | 'completed'
  | 'cancelled';

export type EmployeeOnboardingStepStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'skipped'
  | 'not_applicable';

export type EmployeeOnboardingStepKey =
  | 'employee_record_created'
  | 'master_data_complete'
  | 'employment_contract_signed'
  | 'required_documents_collected'
  | 'background_check_complete'
  | 'qualifications_verified'
  | 'mandatory_trainings_assigned'
  | 'work_equipment_issued'
  | 'portal_invite_prepared'
  | 'role_permissions_assigned'
  | 'deployability_verified'
  | 'first_assignment_prepared'
  | 'active_status_ready';

export const EMPLOYEE_ONBOARDING_STEP_ORDER: EmployeeOnboardingStepKey[] = [
  'employee_record_created',
  'master_data_complete',
  'employment_contract_signed',
  'required_documents_collected',
  'background_check_complete',
  'qualifications_verified',
  'mandatory_trainings_assigned',
  'work_equipment_issued',
  'portal_invite_prepared',
  'role_permissions_assigned',
  'deployability_verified',
  'first_assignment_prepared',
  'active_status_ready',
];

export const EMPLOYEE_ONBOARDING_STEP_LABELS: Record<EmployeeOnboardingStepKey, string> = {
  employee_record_created: 'Mitarbeiterdatensatz angelegt',
  master_data_complete: 'Stammdaten vollständig',
  employment_contract_signed: 'Arbeitsvertrag',
  required_documents_collected: 'Pflichtdokumente',
  background_check_complete: 'Führungszeugnis',
  qualifications_verified: 'Qualifikationen',
  mandatory_trainings_assigned: 'Pflichtschulungen',
  work_equipment_issued: 'Arbeitsmaterial',
  portal_invite_prepared: 'Portal-Einladung',
  role_permissions_assigned: 'Rollen & Rechte',
  deployability_verified: 'Einsatzfähigkeit',
  first_assignment_prepared: 'Erster Einsatz vorbereitet',
  active_status_ready: 'Aktiv freigeben',
};

export type EmployeeOnboardingSession = TenantScopedEntity & {
  employeeId: EntityId;
  applicantId: EntityId | null;
  overallStatus: EmployeeOnboardingOverallStatus;
  currentStepKey: EmployeeOnboardingStepKey;
  targetEmploymentStatus: EmployeeEmploymentStatus;
  startedAt: ISODateTime | null;
  completedAt: ISODateTime | null;
  deployableAt: ISODateTime | null;
  portalInvitePrepared: boolean;
  backgroundCheckStatus: string;
  mandatoryTrainingKeys: string[];
  requiredDocumentTypes: ApplicantDocumentType[];
};

export type EmployeeOnboardingStep = TenantScopedEntity & {
  sessionId: EntityId;
  employeeId: EntityId;
  stepKey: EmployeeOnboardingStepKey;
  status: EmployeeOnboardingStepStatus;
  completedAt: ISODateTime | null;
  notes: string | null;
};

export type EmployeeOnboardingCheckResult = TenantScopedEntity & {
  sessionId: EntityId;
  employeeId: EntityId;
  checkKey: EmployeeOnboardingStepKey;
  status: 'passed' | 'warning' | 'failed';
  message: string;
  evaluatedAt: ISODateTime;
};

export type OnboardingAuditEvent = TenantScopedEntity & {
  sessionId: EntityId;
  employeeId: EntityId | null;
  applicantId: EntityId | null;
  action: string;
  actorId: EntityId | null;
  actorRole: RoleKey | null;
  summary: string;
  metadata?: Record<string, string>;
};

/** J) UI-Ansichten */
export type RecruitingViewKey =
  | 'dashboard'
  | 'applicant_list'
  | 'applicant_detail'
  | 'documents'
  | 'interviews'
  | 'communications'
  | 'offer_decision'
  | 'conversion'
  | 'onboarding_list'
  | 'onboarding_detail'
  | 'privacy';

export const RECRUITING_VIEW_LABELS: Record<RecruitingViewKey, string> = {
  dashboard: 'Übersicht',
  applicant_list: 'Bewerberliste',
  applicant_detail: 'Bewerberdetail',
  documents: 'Unterlagen',
  interviews: 'Gespräche',
  communications: 'Kommunikation',
  offer_decision: 'Angebot/Absage',
  conversion: 'Umwandlung',
  onboarding_list: 'Onboarding-Liste',
  onboarding_detail: 'Onboarding-Detail',
  privacy: 'Datenschutz/Löschung',
};

/** K) Datenschutz */
export type ApplicantPrivacyStatus = 'active' | 'archived' | 'deletion_due' | 'deleted_prepared';

export type ApplicantPrivacyRecord = {
  applicantId: EntityId;
  tenantId: EntityId;
  status: ApplicantPrivacyStatus;
  deletionDeadlineDays: number;
  deletionDueAt: ISODateTime | null;
  archivedAt: ISODateTime | null;
  extendedStorageConsent: boolean;
  exportPrepared: boolean;
  subjectAccessPrepared: boolean;
};

export type CreateApplicantInput = {
  tenantId: EntityId;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  appliedRole: string;
  source?: string | null;
  desiredStartDate?: string | null;
  qualificationSummary?: string | null;
  privacyConsentAt?: ISODateTime | null;
  actorProfileId?: EntityId | null;
  actorRole?: RoleKey | null;
};

export type ConvertApplicantInput = {
  tenantId: EntityId;
  applicantId: EntityId;
  roleTitle: string;
  employmentType?: string | null;
  weeklyHours?: number | null;
  actorProfileId?: EntityId | null;
  actorRole?: RoleKey | null;
};

export type ApplicantConversionResult = {
  applicant: ApplicantRecord;
  employeeId: EntityId;
  onboardingSession: EmployeeOnboardingSession;
};

export type RecruitingDashboardSummary = {
  tenantId: EntityId;
  totalApplicants: number;
  openApplicants: number;
  inInterview: number;
  offersPending: number;
  onboardingInProgress: number;
  deletionDueCount: number;
  recentApplicants: ApplicantRecord[];
};

export type ApplicantListFilters = {
  status?: ApplicantStatus;
  appliedRole?: string;
  includeArchived?: boolean;
};
