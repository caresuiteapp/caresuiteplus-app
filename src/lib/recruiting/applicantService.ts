import type { RoleKey, ServiceResult } from '@/types';
import type {
  ApplicantCommunication,
  ApplicantCommunicationType,
  ApplicantConversionResult,
  ApplicantDocument,
  ApplicantDocumentType,
  ApplicantInterview,
  ApplicantListFilters,
  ApplicantPrivacyRecord,
  ApplicantRecord,
  ApplicantStatus,
  ApplicantStatusEvent,
  ApplicationProcessStepKey,
  ConvertApplicantInput,
  CreateApplicantInput,
  RecruitingDashboardSummary,
} from '@/types/modules/recruiting';
import {
  CONVERTIBLE_APPLICANT_STATUSES,
  TERMINAL_APPLICANT_STATUSES,
} from '@/types/modules/recruiting';
import { appendEmployeeAuditEvent } from '@/lib/office/employeePersonnelAuditService';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';
import {
  assertApplicantTenantScope,
  canConvertApplicantToEmployee,
  canManageApplicants,
  canViewApplicantList,
  canViewSensitiveApplicantData,
  filterApplicantForViewer,
  isApplicantAssignable,
} from './applicantAccess';
import {
  buildApplicantPrivacyRecord,
  computeDeletionDueAt,
  markApplicantArchived,
  prepareApplicantDataExport,
  prepareApplicantSubjectAccess,
  scheduleApplicantDeletion,
} from './applicantPrivacyService';
import { startEmployeeOnboardingFromApplicant } from './employeeOnboardingService';
import {
  APPLICANT_DEFAULT_RETENTION_DAYS,
  DEFAULT_REQUIRED_APPLICANT_DOCUMENT_TYPES,
} from './recruitingModuleConfig';
import {
  filterApplicantsByTenant,
  getApplicantById,
  listApplicantDocuments,
  listOnboardingSessionsForTenant,
  nextApplicantCommunicationId,
  nextApplicantDocumentId,
  nextApplicantId,
  nextApplicantInterviewId,
  nextApplicantStatusEventId,
  nextEmployeeIdFromConversion,
  RECRUITING_STORE,
} from './recruitingStore';

const REQUIRED_DOCUMENT_TYPES: ApplicantDocumentType[] = [
  'cv',
  'cover_letter',
  'qualifications',
];

function nowIso(): string {
  return new Date().toISOString();
}

function auditStatusChange(input: Omit<ApplicantStatusEvent, 'id' | 'createdAt' | 'updatedAt'>): void {
  RECRUITING_STORE.statusEvents.unshift({
    ...input,
    id: nextApplicantStatusEventId(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
}

function seedRequiredDocuments(tenantId: string, applicantId: string): void {
  for (const documentType of REQUIRED_DOCUMENT_TYPES) {
    RECRUITING_STORE.documents.push({
      id: nextApplicantDocumentId(),
      tenantId,
      applicantId,
      documentType,
      title: documentType,
      fileName: null,
      storagePath: null,
      status: 'requested',
      required: true,
      sensitive: documentType === 'background_check',
      verifiedBy: null,
      verifiedAt: null,
      rejectionReason: null,
      validUntil: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }
}

function permissionDenied<T>(permission: string): ServiceResult<T> {
  return { ok: false, error: `Keine Berechtigung (${permission}).` };
}

export function createApplicant(
  input: CreateApplicantInput,
  actorRoleKey?: RoleKey | null,
): ServiceResult<ApplicantRecord> {
  const liveBlock = guardLiveDemoFeature<ApplicantRecord>(
    input.tenantId,
    'Bewerbermanagement',
  );
  if (liveBlock) return liveBlock;

  if (!canManageApplicants(actorRoleKey)) {
    return permissionDenied('office.recruiting.manage');
  }

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim();
  if (!firstName || !lastName || !email.includes('@')) {
    return { ok: false, error: 'Vorname, Nachname und gültige E-Mail sind Pflicht.' };
  }
  if (!input.appliedRole.trim()) {
    return { ok: false, error: 'Beworbene Rolle ist Pflicht.' };
  }

  const applicant: ApplicantRecord = {
    id: nextApplicantId(),
    tenantId: input.tenantId,
    firstName,
    lastName,
    email,
    phone: input.phone?.trim() ?? null,
    dateOfBirth: null,
    street: null,
    postalCode: null,
    city: null,
    appliedRole: input.appliedRole.trim(),
    appliedAt: nowIso(),
    source: input.source?.trim() ?? null,
    desiredStartDate: input.desiredStartDate ?? null,
    availabilityNote: null,
    weeklyHoursDesired: null,
    experienceYears: null,
    previousEmployer: null,
    qualificationSummary: input.qualificationSummary?.trim() ?? null,
    status: 'received',
    currentProcessStep: 'application_received',
    internalNotes: '',
    rejectionReason: null,
    offerSentAt: null,
    offerAcceptedAt: null,
    offerRejectedAt: null,
    privacyConsentAt: input.privacyConsentAt ?? nowIso(),
    extendedStorageConsent: false,
    extendedStorageConsentAt: null,
    archivedAt: null,
    deletionDueAt: computeDeletionDueAt(nowIso(), APPLICANT_DEFAULT_RETENTION_DAYS),
    deletionScheduled: false,
    convertedEmployeeId: null,
    assignedRecruiterId: input.actorProfileId ?? null,
    createdBy: input.actorProfileId ?? null,
    updatedBy: input.actorProfileId ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  RECRUITING_STORE.applicants.unshift(applicant);
  seedRequiredDocuments(input.tenantId, applicant.id);

  auditStatusChange({
    tenantId: input.tenantId,
    applicantId: applicant.id,
    previousStatus: null,
    newStatus: 'received',
    processStep: 'application_received',
    actorId: input.actorProfileId ?? null,
    actorRole: actorRoleKey ?? input.actorRole ?? null,
    summary: 'Bewerbung eingegangen',
  });

  return { ok: true, data: applicant };
}

export function listApplicants(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  filters?: ApplicantListFilters,
): ServiceResult<Array<ReturnType<typeof filterApplicantForViewer>>> {
  const liveBlock = guardLiveDemoFeature<Array<ReturnType<typeof filterApplicantForViewer>>>(
    tenantId,
    'Bewerbermanagement',
  );
  if (liveBlock) return liveBlock;

  if (!canViewApplicantList(actorRoleKey)) {
    return permissionDenied('office.recruiting.view');
  }

  let rows = filterApplicantsByTenant(tenantId);
  if (filters?.status) rows = rows.filter((a) => a.status === filters.status);
  if (filters?.appliedRole) {
    rows = rows.filter((a) => a.appliedRole === filters.appliedRole);
  }
  if (!filters?.includeArchived) {
    rows = rows.filter((a) => !a.archivedAt);
  }

  return { ok: true, data: rows.map((a) => filterApplicantForViewer(a, actorRoleKey)) };
}

export function getApplicantDetail(
  tenantId: string,
  applicantId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<ReturnType<typeof filterApplicantForViewer>> {
  const liveBlock = guardLiveDemoFeature<ReturnType<typeof filterApplicantForViewer>>(
    tenantId,
    'Bewerbermanagement',
  );
  if (liveBlock) return liveBlock;

  if (!canViewApplicantList(actorRoleKey)) {
    return permissionDenied('office.recruiting.view');
  }

  const applicant = getApplicantById(tenantId, applicantId);
  if (!applicant) return { ok: false, error: 'Bewerbung nicht gefunden.' };

  return { ok: true, data: filterApplicantForViewer(applicant, actorRoleKey) };
}

export function updateApplicantStatus(
  tenantId: string,
  applicantId: string,
  newStatus: ApplicantStatus,
  actorRoleKey?: RoleKey | null,
  options?: {
    actorProfileId?: string | null;
    processStep?: ApplicationProcessStepKey;
    rejectionReason?: string | null;
    summary?: string;
  },
): ServiceResult<ApplicantRecord> {
  const liveBlock = guardLiveDemoFeature<ApplicantRecord>(tenantId, 'Bewerbermanagement');
  if (liveBlock) return liveBlock;

  if (!canManageApplicants(actorRoleKey)) {
    return permissionDenied('office.recruiting.manage');
  }

  const applicant = getApplicantById(tenantId, applicantId);
  if (!applicant) return { ok: false, error: 'Bewerbung nicht gefunden.' };

  const scope = assertApplicantTenantScope(applicant.tenantId, tenantId);
  if (scope) return { ok: false, error: scope.reason };

  if (applicant.status === 'converted') {
    return { ok: false, error: 'Umgewandelte Bewerbung kann nicht mehr geändert werden.' };
  }

  const previousStatus = applicant.status;
  applicant.status = newStatus;
  applicant.updatedAt = nowIso();
  applicant.updatedBy = options?.actorProfileId ?? null;
  if (options?.processStep) applicant.currentProcessStep = options.processStep;
  if (options?.rejectionReason) applicant.rejectionReason = options.rejectionReason;

  auditStatusChange({
    tenantId,
    applicantId,
    previousStatus,
    newStatus,
    processStep: options?.processStep ?? applicant.currentProcessStep,
    actorId: options?.actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    summary: options?.summary ?? `Status geändert: ${previousStatus} → ${newStatus}`,
    metadata: options?.rejectionReason ? { rejectionReason: options.rejectionReason } : undefined,
  });

  return { ok: true, data: applicant };
}

/** Regel 5 — Angebot/Absage auditierbar */
export function recordOfferSent(
  tenantId: string,
  applicantId: string,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): ServiceResult<ApplicantRecord> {
  const result = updateApplicantStatus(tenantId, applicantId, 'offer_sent', actorRoleKey, {
    actorProfileId,
    processStep: 'offer_delivery',
    summary: 'Angebot versendet (auditierbar)',
  });
  if (!result.ok) return result;
  result.data.offerSentAt = nowIso();
  return result;
}

export function recordOfferAccepted(
  tenantId: string,
  applicantId: string,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): ServiceResult<ApplicantRecord> {
  const result = updateApplicantStatus(tenantId, applicantId, 'offer_accepted', actorRoleKey, {
    actorProfileId,
    processStep: 'offer_follow_up',
    summary: 'Angebot angenommen (auditierbar)',
  });
  if (!result.ok) return result;
  result.data.offerAcceptedAt = nowIso();
  return result;
}

export function recordApplicantRejection(
  tenantId: string,
  applicantId: string,
  reason: string,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): ServiceResult<ApplicantRecord> {
  return updateApplicantStatus(tenantId, applicantId, 'rejected', actorRoleKey, {
    actorProfileId,
    processStep: 'hiring_decision',
    rejectionReason: reason.trim(),
    summary: 'Bewerbung abgelehnt (auditierbar)',
  });
}

export function recordOfferDeclined(
  tenantId: string,
  applicantId: string,
  reason: string,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): ServiceResult<ApplicantRecord> {
  const result = updateApplicantStatus(tenantId, applicantId, 'offer_declined', actorRoleKey, {
    actorProfileId,
    processStep: 'offer_follow_up',
    rejectionReason: reason.trim(),
    summary: 'Angebot abgelehnt (auditierbar)',
  });
  if (!result.ok) return result;
  result.data.offerRejectedAt = nowIso();
  return result;
}

export function scheduleInterview(
  tenantId: string,
  applicantId: string,
  input: {
    scheduledAt: string;
    format: ApplicantInterview['format'];
    location?: string | null;
    interviewerNames?: string[];
    actorProfileId?: string | null;
  },
  actorRoleKey?: RoleKey | null,
): ServiceResult<ApplicantInterview> {
  const liveBlock = guardLiveDemoFeature<ApplicantInterview>(tenantId, 'Bewerbermanagement');
  if (liveBlock) return liveBlock;

  if (!canManageApplicants(actorRoleKey)) {
    return permissionDenied('office.recruiting.manage');
  }

  const applicant = getApplicantById(tenantId, applicantId);
  if (!applicant) return { ok: false, error: 'Bewerbung nicht gefunden.' };

  const interview: ApplicantInterview = {
    id: nextApplicantInterviewId(),
    tenantId,
    applicantId,
    scheduledAt: input.scheduledAt,
    durationMinutes: 45,
    format: input.format,
    location: input.location ?? null,
    meetingLink: null,
    interviewerIds: [],
    interviewerNames: input.interviewerNames ?? [],
    outcome: 'pending',
    rating: null,
    notes: '',
    nextSteps: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  RECRUITING_STORE.interviews.unshift(interview);
  updateApplicantStatus(tenantId, applicantId, 'interview_scheduled', actorRoleKey, {
    actorProfileId: input.actorProfileId,
    processStep: 'interview_invitation',
    summary: 'Gespräch terminiert',
  });

  return { ok: true, data: interview };
}

export function prepareApplicantCommunication(
  tenantId: string,
  applicantId: string,
  messageType: ApplicantCommunicationType,
  subject: string,
  body: string,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): ServiceResult<ApplicantCommunication> {
  const liveBlock = guardLiveDemoFeature<ApplicantCommunication>(tenantId, 'Bewerber-Kommunikation');
  if (liveBlock) return liveBlock;

  if (!canManageApplicants(actorRoleKey)) {
    return permissionDenied('office.recruiting.manage');
  }

  const applicant = getApplicantById(tenantId, applicantId);
  if (!applicant) return { ok: false, error: 'Bewerbung nicht gefunden.' };

  const communication: ApplicantCommunication = {
    id: nextApplicantCommunicationId(),
    tenantId,
    applicantId,
    messageType,
    channel: 'draft_email',
    status: 'draft',
    subject: subject.trim(),
    body: body.trim(),
    preparedOnly: true,
    createdBy: actorProfileId ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  RECRUITING_STORE.communications.unshift(communication);
  return { ok: true, data: communication };
}

/** Regel 6 — Umwandlung nur durch autorisierte Rollen, nur bei offer_accepted */
export function convertApplicantToEmployee(
  input: ConvertApplicantInput,
  actorRoleKey?: RoleKey | null,
): ServiceResult<ApplicantConversionResult> {
  const liveBlock = guardLiveDemoFeature<ApplicantConversionResult>(
    input.tenantId,
    'Bewerber-Umwandlung',
  );
  if (liveBlock) return liveBlock;

  if (!canConvertApplicantToEmployee(actorRoleKey)) {
    return permissionDenied('office.recruiting.convert');
  }

  const applicant = getApplicantById(input.tenantId, input.applicantId);
  if (!applicant) return { ok: false, error: 'Bewerbung nicht gefunden.' };

  if (!CONVERTIBLE_APPLICANT_STATUSES.has(applicant.status)) {
    return {
      ok: false,
      error: 'Umwandlung nur bei angenommenem Angebot (offer_accepted) möglich.',
    };
  }

  const employeeId = nextEmployeeIdFromConversion();
  applicant.convertedEmployeeId = employeeId;
  applicant.status = 'converted';
  applicant.currentProcessStep = 'employee_conversion';
  applicant.updatedAt = nowIso();
  applicant.updatedBy = input.actorProfileId ?? null;

  auditStatusChange({
    tenantId: input.tenantId,
    applicantId: applicant.id,
    previousStatus: 'offer_accepted',
    newStatus: 'converted',
    processStep: 'employee_conversion',
    actorId: input.actorProfileId ?? null,
    actorRole: actorRoleKey ?? input.actorRole ?? null,
    summary: `In Mitarbeitenden-Datensatz umgewandelt (${employeeId})`,
    metadata: { employeeId, roleTitle: input.roleTitle },
  });

  appendEmployeeAuditEvent({
    tenantId: input.tenantId,
    employeeId,
    action: 'created_from_applicant',
    actorId: input.actorProfileId ?? null,
    actorRole: actorRoleKey ?? input.actorRole ?? null,
    summary: `Personalakte aus Bewerbung ${applicant.id} angelegt (Status onboarding).`,
  });

  const onboardingSession = startEmployeeOnboardingFromApplicant({
    tenantId: input.tenantId,
    employeeId,
    applicant,
    roleTitle: input.roleTitle,
    actorProfileId: input.actorProfileId ?? null,
    actorRole: actorRoleKey ?? input.actorRole ?? null,
  });

  return {
    ok: true,
    data: { applicant, employeeId, onboardingSession },
  };
}

export function fetchRecruitingDashboard(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<RecruitingDashboardSummary> {
  const liveBlock = guardLiveDemoFeature<RecruitingDashboardSummary>(tenantId, 'Bewerbermanagement');
  if (liveBlock) return liveBlock;

  if (!canViewApplicantList(actorRoleKey)) {
    return permissionDenied('office.recruiting.view');
  }

  const applicants = filterApplicantsByTenant(tenantId).filter((a) => !a.archivedAt);
  const openApplicants = applicants.filter((a) => !TERMINAL_APPLICANT_STATUSES.has(a.status));
  const inInterview = applicants.filter((a) =>
    ['interview_scheduled', 'interview_completed', 'assessment_pending'].includes(a.status),
  ).length;
  const offersPending = applicants.filter((a) =>
    ['offer_preparation', 'offer_sent'].includes(a.status),
  ).length;
  const onboardingInProgress = listOnboardingSessionsForTenant(tenantId).filter(
    (s) => s.overallStatus === 'in_progress' || s.overallStatus === 'blocked',
  ).length;

  const deletionDueCount = applicants.filter((a) => {
    if (!a.deletionDueAt) return false;
    return new Date(a.deletionDueAt).getTime() <= Date.now();
  }).length;

  return {
    ok: true,
    data: {
      tenantId,
      totalApplicants: applicants.length,
      openApplicants: openApplicants.length,
      inInterview,
      offersPending,
      onboardingInProgress,
      deletionDueCount,
      recentApplicants: applicants.slice(0, 5),
    },
  };
}

export function getApplicantStatusAuditTrail(
  tenantId: string,
  applicantId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<ApplicantStatusEvent[]> {
  const liveBlock = guardLiveDemoFeature<ApplicantStatusEvent[]>(tenantId, 'Bewerber-Audit');
  if (liveBlock) return liveBlock;

  if (!canViewSensitiveApplicantData(actorRoleKey)) {
    return permissionDenied('office.recruiting.view_sensitive');
  }

  const events = RECRUITING_STORE.statusEvents.filter(
    (e) => e.tenantId === tenantId && e.applicantId === applicantId,
  );
  return { ok: true, data: events };
}

export function verifyApplicantNotAssignable(
  tenantId: string,
  applicantId: string,
): ServiceResult<{ assignable: false; reason: string }> {
  const applicant = getApplicantById(tenantId, applicantId);
  if (!applicant) return { ok: false, error: 'Bewerbung nicht gefunden.' };
  return { ok: true, data: isApplicantAssignable(applicant) };
}

export function getApplicantPrivacyInfo(
  tenantId: string,
  applicantId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<ApplicantPrivacyRecord> {
  const liveBlock = guardLiveDemoFeature<ApplicantPrivacyRecord>(tenantId, 'Bewerber-Datenschutz');
  if (liveBlock) return liveBlock;

  if (!canViewSensitiveApplicantData(actorRoleKey)) {
    return permissionDenied('office.recruiting.view_sensitive');
  }

  const applicant = getApplicantById(tenantId, applicantId);
  if (!applicant) return { ok: false, error: 'Bewerbung nicht gefunden.' };

  return { ok: true, data: buildApplicantPrivacyRecord(applicant) };
}

export function archiveApplicantRecord(
  tenantId: string,
  applicantId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<ApplicantPrivacyRecord> {
  const liveBlock = guardLiveDemoFeature<ApplicantPrivacyRecord>(tenantId, 'Bewerber-Archiv');
  if (liveBlock) return liveBlock;

  if (!canManageApplicants(actorRoleKey)) {
    return permissionDenied('office.recruiting.manage');
  }

  const applicant = getApplicantById(tenantId, applicantId);
  if (!applicant) return { ok: false, error: 'Bewerbung nicht gefunden.' };

  markApplicantArchived(applicant);
  return { ok: true, data: buildApplicantPrivacyRecord(applicant) };
}

export function requestApplicantDeletion(
  tenantId: string,
  applicantId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<ApplicantPrivacyRecord> {
  const liveBlock = guardLiveDemoFeature<ApplicantPrivacyRecord>(tenantId, 'Bewerber-Löschung');
  if (liveBlock) return liveBlock;

  if (!canViewSensitiveApplicantData(actorRoleKey)) {
    return permissionDenied('office.recruiting.view_sensitive');
  }

  const applicant = getApplicantById(tenantId, applicantId);
  if (!applicant) return { ok: false, error: 'Bewerbung nicht gefunden.' };

  scheduleApplicantDeletion(applicant);
  return { ok: true, data: buildApplicantPrivacyRecord(applicant) };
}

export function prepareApplicantPrivacyExport(
  tenantId: string,
  applicantId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<{ exportPrepared: true; payload: Record<string, unknown> }> {
  const liveBlock = guardLiveDemoFeature<{ exportPrepared: true; payload: Record<string, unknown> }>(
    tenantId,
    'Bewerber-Export',
  );
  if (liveBlock) return liveBlock;

  if (!canViewSensitiveApplicantData(actorRoleKey)) {
    return permissionDenied('office.recruiting.view_sensitive');
  }

  const applicant = getApplicantById(tenantId, applicantId);
  if (!applicant) return { ok: false, error: 'Bewerbung nicht gefunden.' };

  const documents = listApplicantDocuments(tenantId, applicantId);
  return {
    ok: true,
    data: prepareApplicantDataExport(applicant, documents),
  };
}

export function prepareApplicantSubjectAccessPackage(
  tenantId: string,
  applicantId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<{ subjectAccessPrepared: true; sections: string[] }> {
  const liveBlock = guardLiveDemoFeature<{ subjectAccessPrepared: true; sections: string[] }>(
    tenantId,
    'Betroffenenanfrage Bewerbung',
  );
  if (liveBlock) return liveBlock;

  if (!canViewSensitiveApplicantData(actorRoleKey)) {
    return permissionDenied('office.recruiting.view_sensitive');
  }

  const applicant = getApplicantById(tenantId, applicantId);
  if (!applicant) return { ok: false, error: 'Bewerbung nicht gefunden.' };

  return { ok: true, data: prepareApplicantSubjectAccess(applicant) };
}

export function listRequiredDocumentTypesForRole(_roleTitle: string): ApplicantDocumentType[] {
  return [...DEFAULT_REQUIRED_APPLICANT_DOCUMENT_TYPES];
}

export { resetRecruitingStore } from './recruitingStore';
