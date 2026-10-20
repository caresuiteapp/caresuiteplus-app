import type {
  ApplicantCommunication,
  ApplicantDocument,
  ApplicantInterview,
  ApplicantRecord,
  ApplicantStatusEvent,
  EmployeeOnboardingCheckResult,
  EmployeeOnboardingSession,
  EmployeeOnboardingStep,
  OnboardingAuditEvent,
} from '@/types/modules/recruiting';

export type RecruitingStoreState = {
  applicants: ApplicantRecord[];
  documents: ApplicantDocument[];
  interviews: ApplicantInterview[];
  communications: ApplicantCommunication[];
  statusEvents: ApplicantStatusEvent[];
  onboardingSessions: EmployeeOnboardingSession[];
  onboardingSteps: EmployeeOnboardingStep[];
  onboardingChecks: EmployeeOnboardingCheckResult[];
  onboardingAuditEvents: OnboardingAuditEvent[];
};

export const RECRUITING_STORE: RecruitingStoreState = {
  applicants: [],
  documents: [],
  interviews: [],
  communications: [],
  statusEvents: [],
  onboardingSessions: [],
  onboardingSteps: [],
  onboardingChecks: [],
  onboardingAuditEvents: [],
};

let applicantCounter = 0;
let documentCounter = 0;
let interviewCounter = 0;
let communicationCounter = 0;
let statusEventCounter = 0;
let onboardingSessionCounter = 0;
let onboardingStepCounter = 0;
let onboardingCheckCounter = 0;
let onboardingAuditCounter = 0;
let employeeCounter = 0;

export function resetRecruitingStore(): void {
  RECRUITING_STORE.applicants = [];
  RECRUITING_STORE.documents = [];
  RECRUITING_STORE.interviews = [];
  RECRUITING_STORE.communications = [];
  RECRUITING_STORE.statusEvents = [];
  RECRUITING_STORE.onboardingSessions = [];
  RECRUITING_STORE.onboardingSteps = [];
  RECRUITING_STORE.onboardingChecks = [];
  RECRUITING_STORE.onboardingAuditEvents = [];
  applicantCounter = 0;
  documentCounter = 0;
  interviewCounter = 0;
  communicationCounter = 0;
  statusEventCounter = 0;
  onboardingSessionCounter = 0;
  onboardingStepCounter = 0;
  onboardingCheckCounter = 0;
  onboardingAuditCounter = 0;
  employeeCounter = 0;
}

export function nextApplicantId(): string {
  applicantCounter += 1;
  return `applicant-${applicantCounter}`;
}

export function nextEmployeeIdFromConversion(): string {
  employeeCounter += 1;
  return `employee-onb-${employeeCounter}`;
}

export function nextApplicantDocumentId(): string {
  documentCounter += 1;
  return `applicant-doc-${documentCounter}`;
}

export function nextApplicantInterviewId(): string {
  interviewCounter += 1;
  return `applicant-int-${interviewCounter}`;
}

export function nextApplicantCommunicationId(): string {
  communicationCounter += 1;
  return `applicant-comm-${communicationCounter}`;
}

export function nextApplicantStatusEventId(): string {
  statusEventCounter += 1;
  return `applicant-status-${statusEventCounter}`;
}

export function nextOnboardingSessionId(): string {
  onboardingSessionCounter += 1;
  return `emp-onb-session-${onboardingSessionCounter}`;
}

export function nextOnboardingStepId(): string {
  onboardingStepCounter += 1;
  return `emp-onb-step-${onboardingStepCounter}`;
}

export function nextOnboardingCheckId(): string {
  onboardingCheckCounter += 1;
  return `emp-onb-check-${onboardingCheckCounter}`;
}

export function nextOnboardingAuditId(): string {
  onboardingAuditCounter += 1;
  return `emp-onb-audit-${onboardingAuditCounter}`;
}

export function filterApplicantsByTenant(tenantId: string): ApplicantRecord[] {
  return RECRUITING_STORE.applicants.filter((a) => a.tenantId === tenantId);
}

export function getApplicantById(tenantId: string, applicantId: string): ApplicantRecord | null {
  return (
    RECRUITING_STORE.applicants.find((a) => a.tenantId === tenantId && a.id === applicantId) ?? null
  );
}

export function listApplicantDocuments(tenantId: string, applicantId: string): ApplicantDocument[] {
  return RECRUITING_STORE.documents.filter(
    (d) => d.tenantId === tenantId && d.applicantId === applicantId,
  );
}

export function listOnboardingSessionsForTenant(tenantId: string): EmployeeOnboardingSession[] {
  return RECRUITING_STORE.onboardingSessions.filter((s) => s.tenantId === tenantId);
}

export function getOnboardingSessionByEmployeeId(
  tenantId: string,
  employeeId: string,
): EmployeeOnboardingSession | null {
  return (
    RECRUITING_STORE.onboardingSessions.find(
      (s) => s.tenantId === tenantId && s.employeeId === employeeId,
    ) ?? null
  );
}

export function listOnboardingSteps(sessionId: string): EmployeeOnboardingStep[] {
  return RECRUITING_STORE.onboardingSteps.filter((s) => s.sessionId === sessionId);
}
