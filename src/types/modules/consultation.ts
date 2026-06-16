import type { TenantScopedEntity } from '../core/base';

/** Beratungsfall-Status — vollständiger Workflow bis Abrechnung */
export type ConsultationCaseStatus =
  | 'draft'
  | 'scheduled'
  | 'in_progress'
  | 'documentation_pending'
  | 'signature_pending'
  | 'completed'
  | 'review_pending'
  | 'billing_ready'
  | 'archived';

export const CONSULTATION_CASE_STATUS_LABELS: Record<ConsultationCaseStatus, string> = {
  draft: 'Entwurf',
  scheduled: 'Terminiert',
  in_progress: 'In Bearbeitung',
  documentation_pending: 'Dokumentation ausstehend',
  signature_pending: 'Unterschrift ausstehend',
  completed: 'Abgeschlossen',
  review_pending: 'Prüfung ausstehend',
  billing_ready: 'Abrechnung vorbereitet',
  archived: 'Archiviert',
};

/** Beratungsanlass (Pflegeberatung §37.3, Entlastung, Angehörige, …) */
export type ConsultationOccasionKey =
  | 'pflegeberatung_37_3'
  | 'pflegegrad_antrag'
  | 'entlastungsleistung'
  | 'angehoerigenberatung'
  | 'massnahmenplanung'
  | 'widerspruch'
  | 'allgemein';

export const CONSULTATION_OCCASION_LABELS: Record<ConsultationOccasionKey, string> = {
  pflegeberatung_37_3: 'Pflegeberatung § 37 Abs. 3 SGB XI',
  pflegegrad_antrag: 'Pflegegrad / Antrag',
  entlastungsleistung: 'Entlastungsleistungen',
  angehoerigenberatung: 'Angehörigenberatung',
  massnahmenplanung: 'Maßnahmenplanung',
  widerspruch: 'Widerspruch / Klärung',
  allgemein: 'Allgemeine Beratung',
};

export type ConsultationCareGrade = 'pg1' | 'pg2' | 'pg3' | 'pg4' | 'pg5' | 'none' | 'unknown';

export type ConsultationCase = TenantScopedEntity & {
  clientId: string;
  assignedProfileId: string | null;
  occasionKey: ConsultationOccasionKey;
  title: string;
  status: ConsultationCaseStatus;
  scheduledAt: string | null;
  completedAt: string | null;
  containsHealthData: boolean;
  billingPreparedAt: string | null;
  legalDisclaimerAcknowledged: boolean;
};

export type ConsultationSession = TenantScopedEntity & {
  caseId: string;
  sessionAt: string;
  durationMinutes: number | null;
  counselorProfileId: string | null;
  occasionKey: ConsultationOccasionKey;
  notes: string | null;
  status: 'planned' | 'held' | 'cancelled' | 'no_show';
};

/** Assessment — Pflegegrad, häusliche Situation, Unterstützungsbedarf, Entlastung, Angehörige */
export type ConsultationAssessment = TenantScopedEntity & {
  caseId: string;
  sessionId: string | null;
  careGrade: ConsultationCareGrade | null;
  careGradeValidFrom: string | null;
  homeSituationSummary: string | null;
  supportNeedsSummary: string | null;
  reliefServicesNotes: string | null;
  relativeConsultationNotes: string | null;
  containsHealthData: boolean;
  recordedAt: string;
};

export type ConsultationRecommendationStatus = 'draft' | 'proposed' | 'accepted' | 'rejected' | 'archived';

/** Maßnahmenplan — keine automatische Rechts-/Medizinkorrektheit */
export type ConsultationRecommendation = TenantScopedEntity & {
  caseId: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: ConsultationRecommendationStatus;
  isInformationalOnly: boolean;
  dueAt: string | null;
};

export type ConsultationDocumentType = 'protocol' | 'measure_plan' | 'consent' | 'signature' | 'attachment';

export type ConsultationDocumentStatus = 'draft' | 'finalized' | 'signed' | 'archived';

export type ConsultationDocument = TenantScopedEntity & {
  caseId: string;
  sessionId: string | null;
  documentType: ConsultationDocumentType;
  title: string;
  status: ConsultationDocumentStatus;
  currentVersion: number;
  contentHash: string | null;
  storageReference: string | null;
  signedAt: string | null;
  signedByProfileId: string | null;
  containsHealthData: boolean;
};

export type ConsultationDocumentVersion = TenantScopedEntity & {
  documentId: string;
  versionNumber: number;
  contentHash: string;
  storageReference: string;
  changeReason: string | null;
  isCorrection: boolean;
  createdByProfileId: string | null;
};

export type ConsultationFollowUpStatus = 'open' | 'scheduled' | 'completed' | 'cancelled';

export type ConsultationFollowUp = TenantScopedEntity & {
  caseId: string;
  dueAt: string;
  assigneeProfileId: string | null;
  status: ConsultationFollowUpStatus;
  note: string | null;
  reminderSentAt: string | null;
};

export type ConsultationAuditEventType =
  | 'case_created'
  | 'case_status_changed'
  | 'session_recorded'
  | 'assessment_saved'
  | 'recommendation_added'
  | 'protocol_version_created'
  | 'document_signed'
  | 'followup_created'
  | 'billing_prep_started'
  | 'billing_prep_blocked'
  | 'billing_prep_ready'
  | 'health_data_accessed';

export type ConsultationAuditEvent = TenantScopedEntity & {
  caseId: string | null;
  eventType: ConsultationAuditEventType;
  summary: string;
  actorProfileId: string | null;
  oldStatus: string | null;
  newStatus: string | null;
  metadata: Record<string, string> | null;
};

export type ConsultationBillingPrepInput = {
  tenantId: string;
  caseId: string;
  clientId: string | null;
  careGrade: ConsultationCareGrade | null;
  hasFinalizedProtocol: boolean;
  hasSignature: boolean;
  occasionKey: ConsultationOccasionKey | null;
  serviceAreaKey?: string | null;
  durationMinutes?: number | null;
  costCarrierProfileId?: string | null;
};

export type ConsultationBillingPrepCheckKey =
  | 'klient'
  | 'pflegegrad'
  | 'protokoll'
  | 'unterschrift'
  | 'beratungsanlass'
  | 'leistungsdauer'
  | 'kostentraeger';

export type ConsultationValidationCheckResult = {
  checkKey: ConsultationBillingPrepCheckKey;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  message: string;
};

export type ConsultationBillingPrepReport = {
  validationRunId: string;
  tenantId: string;
  caseId: string;
  checks: ConsultationValidationCheckResult[];
  passed: boolean;
  blockedReason: string | null;
  checkedAt: string;
};

export const CONSULTATION_LEGAL_DISCLAIMER =
  'Hinweis: Empfehlungen und Maßnahmen ersetzen keine Rechts- oder Medizinberatung. Prüfung durch qualifizierte Fachkraft erforderlich.';

export const CONSULTATION_BILLABLE_OCCASIONS: ReadonlySet<ConsultationOccasionKey> = new Set([
  'pflegeberatung_37_3',
  'entlastungsleistung',
]);
