import type { RoleKey } from '@/types/core/auth';
import type { TenantScopedEntity } from '../core/base';

/** 11 Bereiche — Navigation: Mehr → Personal → Personalvorgänge */
export type EmployeeHrCaseAreaKey =
  | 'mitarbeitergespraech'
  | 'probezeitgespraech'
  | 'kritik_feedbackgespraech'
  | 'zielvereinbarung'
  | 'abmahnung'
  | 'ermahnung'
  | 'kuendigung'
  | 'aufhebungsvereinbarung'
  | 'arbeitszeugnis'
  | 'rueckgabe_uebergabeprotokoll'
  | 'dokumentenarchiv_personal';

export type EmployeeHrCaseStatus =
  | 'draft'
  | 'scheduled'
  | 'open'
  | 'in_review'
  | 'finalized'
  | 'delivered'
  | 'acknowledged'
  | 'corrected'
  | 'archived'
  | 'cancelled';

export type EmployeeConversationType =
  | 'general'
  | 'probation'
  | 'feedback'
  | 'goal_agreement';

export type EmployeeWarningType = 'formal_warning' | 'admonition';

export type EmployeeTerminationType =
  | 'ordinary'
  | 'extraordinary'
  | 'mutual_termination'
  | 'fixed_term_end';

export type EmployeeReferenceType = 'interim' | 'simple' | 'qualified';

export type EmployeeHrDeliveryMethod = 'personal' | 'registered_mail' | 'email' | 'portal';

export type EmployeeHrParticipant = {
  name: string;
  role: string;
};

export type EmployeeConversationPayload = {
  conversationType: EmployeeConversationType;
  scheduledAt: string | null;
  participants: EmployeeHrParticipant[];
  topics: string;
  summary: string;
  agreements: string;
  nextSteps: string;
  followUpAt: string | null;
  documentId: string | null;
};

export type EmployeeWarningPayload = {
  warningType: EmployeeWarningType;
  incidentDate: string | null;
  incidentDescription: string;
  breachedDuties: string;
  priorDiscussion: string | null;
  expectedBehavior: string;
  consequencesNotice: string;
  deliveryMethod: EmployeeHrDeliveryMethod | null;
  deliveredAt: string | null;
  acknowledgedAt: string | null;
  documentId: string | null;
};

export type EmployeeTerminationPayload = {
  terminationType: EmployeeTerminationType;
  terminationDate: string | null;
  effectiveDate: string | null;
  reasonInternal: string;
  noticePeriod: string;
  probationPeriod: boolean;
  propertyReturnDueAt: string | null;
  returnProtocolCaseId: string | null;
  portalBlockAt: string | null;
  finalPayrollCheckStatus: 'pending' | 'in_review' | 'completed' | null;
  documentId: string | null;
};

export type EmployeeReferencePayload = {
  referenceType: EmployeeReferenceType;
  employmentPeriod: string;
  roleDescription: string;
  tasks: string;
  performanceAssessment: string;
  conductAssessment: string;
  closingFormula: string;
  gradeInternal: string | null;
  documentId: string | null;
};

export type EmployeeReturnProtocolPayload = {
  handoverDate: string | null;
  itemsDescription: string;
  conditionNotes: string;
  receivedBy: string;
  linkedTerminationCaseId: string | null;
  documentId: string | null;
};

export type EmployeeHrCase = TenantScopedEntity & {
  employeeId: string;
  areaKey: EmployeeHrCaseAreaKey;
  status: EmployeeHrCaseStatus;
  caseNumber: string | null;
  title: string;
  templateId: string | null;
  lifecycleDocumentId: string | null;
  previewConfirmed: boolean;
  lockedAt: string | null;
  contentHash: string | null;
  version: number;
  correctedFromCaseId: string | null;
  releasedToPortal: boolean;
  releasedToPortalAt: string | null;
  conversation: EmployeeConversationPayload | null;
  warning: EmployeeWarningPayload | null;
  termination: EmployeeTerminationPayload | null;
  reference: EmployeeReferencePayload | null;
  returnProtocol: EmployeeReturnProtocolPayload | null;
};

export type EmployeeHrCaseEvent = TenantScopedEntity & {
  caseId: string;
  eventType: string;
  summary: string;
  actorId: string | null;
  actorRole: RoleKey | null;
  oldStatus: EmployeeHrCaseStatus | null;
  newStatus: EmployeeHrCaseStatus | null;
  metadata?: Record<string, string>;
};

export type EmployeeHrAuditEvent = TenantScopedEntity & {
  caseId: string;
  eventType: EmployeeHrAuditEventType;
  summary: string;
  actorId: string | null;
  actorRole: RoleKey | null;
  metadata?: Record<string, string>;
};

export type EmployeeHrAuditEventType =
  | 'hr_case_created'
  | 'hr_case_updated'
  | 'hr_case_validated'
  | 'hr_case_validation_failed'
  | 'hr_case_preview_confirmed'
  | 'hr_case_finalized'
  | 'hr_case_locked'
  | 'hr_case_edit_blocked'
  | 'hr_case_correction_created'
  | 'hr_case_released_to_portal'
  | 'hr_case_acknowledged';

export type EmployeePortalHrDocumentView = Pick<
  EmployeeHrCase,
  'id' | 'tenantId' | 'employeeId' | 'areaKey' | 'status' | 'caseNumber' | 'title' | 'version' | 'releasedToPortalAt'
> & {
  lifecycleDocumentId: string | null;
};

export type CreateEmployeeHrCaseInput = {
  tenantId: string;
  employeeId: string;
  areaKey: EmployeeHrCaseAreaKey;
  title?: string;
  templateId?: string | null;
  conversation?: Partial<EmployeeConversationPayload>;
  warning?: Partial<EmployeeWarningPayload>;
  termination?: Partial<EmployeeTerminationPayload>;
  reference?: Partial<EmployeeReferencePayload>;
  returnProtocol?: Partial<EmployeeReturnProtocolPayload>;
  actorProfileId?: string | null;
};

export const EMPLOYEE_HR_AREA_LABELS: Record<EmployeeHrCaseAreaKey, string> = {
  mitarbeitergespraech: 'Mitarbeitergespräch',
  probezeitgespraech: 'Probezeitgespräch',
  kritik_feedbackgespraech: 'Kritik-/Feedbackgespräch',
  zielvereinbarung: 'Zielvereinbarung',
  abmahnung: 'Abmahnung',
  ermahnung: 'Ermahnung',
  kuendigung: 'Kündigung',
  aufhebungsvereinbarung: 'Aufhebungsvereinbarung',
  arbeitszeugnis: 'Arbeitszeugnis',
  rueckgabe_uebergabeprotokoll: 'Rückgabe-/Übergabeprotokoll',
  dokumentenarchiv_personal: 'Dokumentenarchiv Personal',
};

export const EMPLOYEE_HR_STATUS_LABELS: Record<EmployeeHrCaseStatus, string> = {
  draft: 'Entwurf',
  scheduled: 'Geplant',
  open: 'Offen',
  in_review: 'In Prüfung',
  finalized: 'Finalisiert',
  delivered: 'Zugestellt',
  acknowledged: 'Bestätigt',
  corrected: 'Korrigiert',
  archived: 'Archiviert',
  cancelled: 'Storniert',
};

export const HR_CONVERSATION_AREAS: EmployeeHrCaseAreaKey[] = [
  'mitarbeitergespraech',
  'probezeitgespraech',
  'kritik_feedbackgespraech',
  'zielvereinbarung',
];

export const HR_LEGAL_DISCLAIMER =
  'Diese Vorlage ersetzt keine anwaltliche Prüfung. CareSuite+ erhebt keinen Anspruch auf vollständige arbeitsrechtliche Korrektheit.';
