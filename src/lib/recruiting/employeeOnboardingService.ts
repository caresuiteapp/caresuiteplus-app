import type { RoleKey, ServiceResult } from '@/types';
import type {
  ApplicantRecord,
  EmployeeOnboardingCheckResult,
  EmployeeOnboardingOverallStatus,
  EmployeeOnboardingSession,
  EmployeeOnboardingStep,
  EmployeeOnboardingStepKey,
  EmployeeOnboardingStepStatus,
  OnboardingAuditEvent,
} from '@/types/modules/recruiting';
import {
  EMPLOYEE_ONBOARDING_STEP_LABELS,
  EMPLOYEE_ONBOARDING_STEP_ORDER,
} from '@/types/modules/recruiting';
import type { EmployeeDeployabilityCheck } from '@/types/modules/employeePersonnelFile';
import { evaluateEmployeeDeployability } from '@/lib/office/employeeDeployabilityService';
import { getRequiredQualificationsForRole } from '@/lib/office/employeePersonnelFieldRules';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';
import { canManageEmployeeOnboarding } from './applicantAccess';
import {
  DEFAULT_MANDATORY_TRAINING_KEYS_ON_HIRE,
  DEFAULT_REQUIRED_APPLICANT_DOCUMENT_TYPES,
} from './recruitingModuleConfig';
import {
  getOnboardingSessionByEmployeeId,
  listOnboardingSessionsForTenant,
  listOnboardingSteps,
  nextOnboardingAuditId,
  nextOnboardingCheckId,
  nextOnboardingSessionId,
  nextOnboardingStepId,
  RECRUITING_STORE,
} from './recruitingStore';

function nowIso(): string {
  return new Date().toISOString();
}

function appendOnboardingAudit(
  input: Omit<OnboardingAuditEvent, 'id' | 'createdAt' | 'updatedAt'>,
): void {
  RECRUITING_STORE.onboardingAuditEvents.unshift({
    ...input,
    id: nextOnboardingAuditId(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
}

function createOnboardingSteps(
  session: EmployeeOnboardingSession,
): EmployeeOnboardingStep[] {
  return EMPLOYEE_ONBOARDING_STEP_ORDER.map((stepKey, index) => {
    const status: EmployeeOnboardingStepStatus =
      stepKey === 'employee_record_created'
        ? 'completed'
        : index === 1
          ? 'in_progress'
          : 'pending';

    const step: EmployeeOnboardingStep = {
      id: nextOnboardingStepId(),
      tenantId: session.tenantId,
      sessionId: session.id,
      employeeId: session.employeeId,
      stepKey,
      status,
      completedAt: stepKey === 'employee_record_created' ? nowIso() : null,
      notes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    RECRUITING_STORE.onboardingSteps.push(step);
    return step;
  });
}

/** Prompt 75 — Pflichtschulungen bei Einstellung (prepared, kein externes LMS) */
export function evaluateMandatoryTrainingsForOnboarding(input: {
  roleTitle: string;
  completedTrainingKeys?: string[];
}): {
  requiredTrainingKeys: string[];
  completedTrainingKeys: string[];
  missingTrainingKeys: string[];
  ok: boolean;
} {
  const requiredTrainingKeys = [...DEFAULT_MANDATORY_TRAINING_KEYS_ON_HIRE];
  const completedTrainingKeys = input.completedTrainingKeys ?? [];
  const missingTrainingKeys = requiredTrainingKeys.filter(
    (key) => !completedTrainingKeys.includes(key),
  );
  return {
    requiredTrainingKeys,
    completedTrainingKeys,
    missingTrainingKeys,
    ok: missingTrainingKeys.length === 0,
  };
}

/** Prompt 74 — Arbeitsmaterial-Schritt vorbereitet */
export function evaluateWorkEquipmentStepComplete(issuedItemCount: number): boolean {
  return issuedItemCount > 0;
}

export function evaluateOnboardingDeployability(input: {
  roleTitle: string;
  completedTrainingKeys?: string[];
  contractSigned?: boolean;
  backgroundCheckVerified?: boolean;
  portalPrepared?: boolean;
  equipmentIssued?: boolean;
}): EmployeeDeployabilityCheck {
  const training = evaluateMandatoryTrainingsForOnboarding({
    roleTitle: input.roleTitle,
    completedTrainingKeys: input.completedTrainingKeys,
  });

  const requiredQualTypes = getRequiredQualificationsForRole(input.roleTitle);

  return evaluateEmployeeDeployability({
    employment: {
      contractType: null,
      probationEndsAt: null,
      fixedTermEndsAt: null,
      noticePeriodDays: null,
      weeklyHours: null,
      deploymentArea: null,
      employmentStatus: 'onboarding',
    },
    portalAccess: {
      profileId: input.portalPrepared ? 'prepared-profile' : null,
      portalActive: Boolean(input.portalPrepared),
      roleKey: null,
      lastLoginAt: null,
      invitationSentAt: input.portalPrepared ? nowIso() : null,
      passwordConfigured: false,
      twoFactorPrepared: false,
    },
    qualifications: requiredQualTypes.map((qualificationType, index) => ({
      id: `onb-qual-${index}`,
      tenantId: 'tenant',
      employeeId: 'employee',
      qualificationType,
      title: qualificationType,
      issuingOrganization: null,
      issuedAt: null,
      validUntil: null,
      documentId: null,
      verifiedBy: null,
      verifiedAt: null,
      status: input.backgroundCheckVerified ? 'valid' : 'missing',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })),
    backgroundCheck: {
      id: 'onb-bg',
      tenantId: 'tenant',
      employeeId: 'employee',
      present: Boolean(input.backgroundCheckVerified),
      issueDate: null,
      verifiedAt: input.backgroundCheckVerified ? nowIso() : null,
      verifiedBy: null,
      followUpDueAt: null,
      status: input.backgroundCheckVerified ? 'verified' : 'missing',
      documentId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    documents: input.contractSigned
      ? [
          {
            id: 'onb-contract',
            tenantId: 'tenant',
            employeeId: 'employee',
            category: 'contract' as const,
            title: 'Arbeitsvertrag',
            fileName: 'contract.pdf',
            storagePath: '/prepared/contract.pdf',
            sensitive: false,
            releasedToPortal: false,
            validUntil: null,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          },
        ]
      : [],
    roleTitle: input.roleTitle,
    backgroundCheckRequired: true,
    portalRequired: true,
    blocked: !training.ok || !input.contractSigned,
  });
}

export function startEmployeeOnboardingFromApplicant(input: {
  tenantId: string;
  employeeId: string;
  applicant: ApplicantRecord;
  roleTitle: string;
  actorProfileId?: string | null;
  actorRole?: RoleKey | null;
}): EmployeeOnboardingSession {
  const session: EmployeeOnboardingSession = {
    id: nextOnboardingSessionId(),
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    applicantId: input.applicant.id,
    overallStatus: 'in_progress',
    currentStepKey: 'master_data_complete',
    targetEmploymentStatus: 'onboarding',
    startedAt: nowIso(),
    completedAt: null,
    deployableAt: null,
    portalInvitePrepared: false,
    backgroundCheckStatus: 'missing',
    mandatoryTrainingKeys: [...DEFAULT_MANDATORY_TRAINING_KEYS_ON_HIRE],
    requiredDocumentTypes: [...DEFAULT_REQUIRED_APPLICANT_DOCUMENT_TYPES],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  RECRUITING_STORE.onboardingSessions.unshift(session);
  createOnboardingSteps(session);

  appendOnboardingAudit({
    tenantId: input.tenantId,
    sessionId: session.id,
    employeeId: input.employeeId,
    applicantId: input.applicant.id,
    action: 'onboarding_started',
    actorId: input.actorProfileId ?? null,
    actorRole: input.actorRole ?? null,
    summary: `Onboarding gestartet für ${input.applicant.firstName} ${input.applicant.lastName}`,
    metadata: { roleTitle: input.roleTitle },
  });

  return session;
}

export function updateOnboardingStepStatus(
  tenantId: string,
  sessionId: string,
  stepKey: EmployeeOnboardingStepKey,
  status: EmployeeOnboardingStepStatus,
  actorRoleKey?: RoleKey | null,
  notes?: string | null,
): ServiceResult<EmployeeOnboardingStep> {
  const liveBlock = guardLiveDemoFeature<EmployeeOnboardingStep>(
    tenantId,
    'Mitarbeiter-Onboarding',
  );
  if (liveBlock) return liveBlock;

  if (!canManageEmployeeOnboarding(actorRoleKey)) {
    return { ok: false, error: 'Keine Berechtigung für Mitarbeiter-Onboarding.' };
  }

  const session = RECRUITING_STORE.onboardingSessions.find(
    (s) => s.tenantId === tenantId && s.id === sessionId,
  );
  if (!session) return { ok: false, error: 'Onboarding-Session nicht gefunden.' };

  const step = RECRUITING_STORE.onboardingSteps.find(
    (s) => s.sessionId === sessionId && s.stepKey === stepKey,
  );
  if (!step) return { ok: false, error: 'Onboarding-Schritt nicht gefunden.' };

  step.status = status;
  step.notes = notes ?? step.notes;
  step.completedAt = status === 'completed' ? nowIso() : step.completedAt;
  step.updatedAt = nowIso();
  session.updatedAt = nowIso();
  session.currentStepKey = stepKey;

  appendOnboardingAudit({
    tenantId,
    sessionId,
    employeeId: session.employeeId,
    applicantId: session.applicantId,
    action: 'step_updated',
    actorId: null,
    actorRole: actorRoleKey ?? null,
    summary: `${EMPLOYEE_ONBOARDING_STEP_LABELS[stepKey]}: ${status}`,
  });

  recomputeOnboardingOverallStatus(session);
  return { ok: true, data: step };
}

function recomputeOnboardingOverallStatus(session: EmployeeOnboardingSession): void {
  const steps = listOnboardingSteps(session.id);
  const blocked = steps.some((s) => s.status === 'blocked');
  const allCompleted = steps.every(
    (s) => s.status === 'completed' || s.status === 'skipped' || s.status === 'not_applicable',
  );
  const deployStep = steps.find((s) => s.stepKey === 'deployability_verified');
  const activeStep = steps.find((s) => s.stepKey === 'active_status_ready');

  if (blocked) {
    session.overallStatus = 'blocked';
    return;
  }
  if (allCompleted && activeStep?.status === 'completed') {
    session.overallStatus = 'completed';
    session.completedAt = nowIso();
    return;
  }
  if (deployStep?.status === 'completed') {
    session.overallStatus = 'deployable';
    session.deployableAt = nowIso();
    return;
  }
  session.overallStatus = 'in_progress';
}

export function runOnboardingDeployabilityCheck(
  tenantId: string,
  employeeId: string,
  roleTitle: string,
  actorRoleKey?: RoleKey | null,
  completedTrainingKeys?: string[],
): ServiceResult<EmployeeOnboardingCheckResult> {
  const liveBlock = guardLiveDemoFeature<EmployeeOnboardingCheckResult>(
    tenantId,
    'Onboarding-Einsatzfähigkeit',
  );
  if (liveBlock) return liveBlock;

  if (!canManageEmployeeOnboarding(actorRoleKey)) {
    return { ok: false, error: 'Keine Berechtigung für Mitarbeiter-Onboarding.' };
  }

  const session = getOnboardingSessionByEmployeeId(tenantId, employeeId);
  if (!session) return { ok: false, error: 'Onboarding-Session nicht gefunden.' };

  const deployability = evaluateOnboardingDeployability({
    roleTitle,
    completedTrainingKeys,
    contractSigned: listOnboardingSteps(session.id).some(
      (s) => s.stepKey === 'employment_contract_signed' && s.status === 'completed',
    ),
    backgroundCheckVerified: session.backgroundCheckStatus === 'verified',
    portalPrepared: session.portalInvitePrepared,
    equipmentIssued: evaluateWorkEquipmentStepComplete(0),
  });

  const result: EmployeeOnboardingCheckResult = {
    id: nextOnboardingCheckId(),
    tenantId,
    sessionId: session.id,
    employeeId,
    checkKey: 'deployability_verified',
    status: deployability.result === 'assignable' ? 'passed' : deployability.blockers.length ? 'failed' : 'warning',
    message:
      deployability.result === 'assignable'
        ? 'Einsatzfähigkeit geprüft — bereit nach Freigabe.'
        : deployability.blockers.map((b) => b.message).join(' '),
    evaluatedAt: nowIso(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  RECRUITING_STORE.onboardingChecks.unshift(result);

  if (deployability.result !== 'blocked') {
    updateOnboardingStepStatus(
      tenantId,
      session.id,
      'deployability_verified',
      deployability.result === 'assignable' ? 'completed' : 'blocked',
      actorRoleKey,
    );
  }

  return { ok: true, data: result };
}

export function fetchEmployeeOnboardingProgress(
  tenantId: string,
  employeeId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<{
  session: EmployeeOnboardingSession;
  steps: EmployeeOnboardingStep[];
  overallStatus: EmployeeOnboardingOverallStatus;
}> {
  const liveBlock = guardLiveDemoFeature<{
    session: EmployeeOnboardingSession;
    steps: EmployeeOnboardingStep[];
    overallStatus: EmployeeOnboardingOverallStatus;
  }>(tenantId, 'Mitarbeiter-Onboarding');
  if (liveBlock) return liveBlock;

  if (!canManageEmployeeOnboarding(actorRoleKey)) {
    return { ok: false, error: 'Keine Berechtigung für Mitarbeiter-Onboarding.' };
  }

  const session = getOnboardingSessionByEmployeeId(tenantId, employeeId);
  if (!session) return { ok: false, error: 'Onboarding-Session nicht gefunden.' };

  return {
    ok: true,
    data: {
      session,
      steps: listOnboardingSteps(session.id),
      overallStatus: session.overallStatus,
    },
  };
}

export function listEmployeeOnboardingSessions(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<EmployeeOnboardingSession[]> {
  const liveBlock = guardLiveDemoFeature<EmployeeOnboardingSession[]>(
    tenantId,
    'Mitarbeiter-Onboarding',
  );
  if (liveBlock) return liveBlock;

  if (!canManageEmployeeOnboarding(actorRoleKey)) {
    return { ok: false, error: 'Keine Berechtigung für Mitarbeiter-Onboarding.' };
  }

  return { ok: true, data: listOnboardingSessionsForTenant(tenantId) };
}
