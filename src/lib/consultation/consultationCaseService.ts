import type { RoleKey, ServiceResult } from '@/types';
import type {
  ConsultationAssessment,
  ConsultationCase,
  ConsultationCaseStatus,
  ConsultationFollowUp,
  ConsultationOccasionKey,
  ConsultationRecommendation,
} from '@/types/modules/consultation';
import { CONSULTATION_LEGAL_DISCLAIMER } from '@/types/modules/consultation';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { canUseDemoFallback } from '@/lib/environment';
import { getServiceMode } from '@/lib/services/mode';
import {
  canViewConsultationCase,
  canViewConsultationHealthData,
  filterConsultationCasesForActor,
} from './consultationAccessGuard';
import {
  appendConsultationAuditEvent,
  getConsultationStore,
  nextConsultationId,
  resetConsultationStore,
} from './consultationStore';

const VALID_STATUS_TRANSITIONS: Partial<Record<ConsultationCaseStatus, ConsultationCaseStatus[]>> = {
  draft: ['scheduled', 'in_progress', 'archived'],
  scheduled: ['in_progress', 'archived'],
  in_progress: ['documentation_pending', 'archived'],
  documentation_pending: ['signature_pending', 'review_pending', 'archived'],
  signature_pending: ['completed', 'documentation_pending'],
  review_pending: ['billing_ready', 'completed', 'archived'],
  completed: ['review_pending', 'billing_ready', 'archived'],
  billing_ready: ['archived'],
  archived: [],
};

export function canTransitionConsultationStatus(
  from: ConsultationCaseStatus,
  to: ConsultationCaseStatus,
): boolean {
  if (from === to) return true;
  const allowed = VALID_STATUS_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

export function createConsultationCase(input: {
  tenantId: string;
  clientId: string;
  title: string;
  occasionKey: ConsultationOccasionKey;
  assignedProfileId?: string | null;
  containsHealthData?: boolean;
  actorRoleKey?: RoleKey | null;
}): ServiceResult<ConsultationCase> {
  const denied = enforcePermission<ConsultationCase>(input.actorRoleKey, 'beratung.cases.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  if (!input.clientId?.trim()) {
    return { ok: false, error: 'Klient ist erforderlich.' };
  }
  if (!input.title?.trim()) {
    return { ok: false, error: 'Titel ist erforderlich.' };
  }

  const now = new Date().toISOString();
  const consultationCase: ConsultationCase = {
    id: nextConsultationId('con-case'),
    tenantId: input.tenantId,
    clientId: input.clientId.trim(),
    assignedProfileId: input.assignedProfileId ?? null,
    occasionKey: input.occasionKey,
    title: input.title.trim(),
    status: 'draft',
    scheduledAt: null,
    completedAt: null,
    containsHealthData: input.containsHealthData ?? false,
    billingPreparedAt: null,
    legalDisclaimerAcknowledged: false,
    createdAt: now,
    updatedAt: now,
  };

  getConsultationStore(input.tenantId).cases.push(consultationCase);
  appendConsultationAuditEvent(input.tenantId, {
    caseId: consultationCase.id,
    eventType: 'case_created',
    summary: `Beratungsfall „${consultationCase.title}" angelegt.`,
    actorProfileId: null,
    oldStatus: null,
    newStatus: 'draft',
    metadata: { occasionKey: input.occasionKey },
  });

  return { ok: true, data: consultationCase };
}

export function listConsultationCases(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<ConsultationCase[]> {
  const denied = enforcePermission<ConsultationCase[]>(actorRoleKey, 'beratung.cases.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const cases = filterConsultationCasesForActor(getConsultationStore(tenantId).cases, {
    actorRole: actorRoleKey,
    tenantId,
  });

  return { ok: true, data: cases };
}

export function getConsultationCaseById(
  tenantId: string,
  caseId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<ConsultationCase> {
  const denied = enforcePermission<ConsultationCase>(actorRoleKey, 'beratung.cases.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const consultationCase = getConsultationStore(tenantId).cases.find((c) => c.id === caseId);
  if (!consultationCase) {
    return { ok: false, error: 'Beratungsfall nicht gefunden.' };
  }

  const access = canViewConsultationCase({
    actorRole: actorRoleKey,
    tenantId,
    consultationCase,
  });
  if (!access.allowed) return { ok: false, error: access.reason };

  return { ok: true, data: consultationCase };
}

export function updateConsultationCaseStatus(input: {
  tenantId: string;
  caseId: string;
  newStatus: ConsultationCaseStatus;
  actorRoleKey?: RoleKey | null;
  hasSignature?: boolean;
}): ServiceResult<ConsultationCase> {
  const caseResult = getConsultationCaseById(input.tenantId, input.caseId, input.actorRoleKey);
  if (!caseResult.ok) return caseResult;

  const consultationCase = caseResult.data;

  if (input.newStatus === 'signature_pending' && !input.hasSignature && consultationCase.status === 'documentation_pending') {
    // allow transition TO signature_pending without signature
  }

  if (input.newStatus === 'completed' && consultationCase.status === 'signature_pending' && !input.hasSignature) {
    return { ok: false, error: 'Abschluss ohne Unterschrift nicht möglich.' };
  }

  if (!canTransitionConsultationStatus(consultationCase.status, input.newStatus)) {
    return {
      ok: false,
      error: `Statuswechsel von „${consultationCase.status}" nach „${input.newStatus}" nicht erlaubt.`,
    };
  }

  const oldStatus = consultationCase.status;
  const updated: ConsultationCase = {
    ...consultationCase,
    status: input.newStatus,
    completedAt: input.newStatus === 'completed' ? new Date().toISOString() : consultationCase.completedAt,
    updatedAt: new Date().toISOString(),
  };

  const store = getConsultationStore(input.tenantId);
  const idx = store.cases.findIndex((c) => c.id === input.caseId);
  store.cases[idx] = updated;

  appendConsultationAuditEvent(input.tenantId, {
    caseId: input.caseId,
    eventType: 'case_status_changed',
    summary: `Status geändert: ${oldStatus} → ${input.newStatus}`,
    actorProfileId: null,
    oldStatus,
    newStatus: input.newStatus,
    metadata: null,
  });

  return { ok: true, data: updated };
}

export function saveConsultationAssessment(input: {
  tenantId: string;
  caseId: string;
  sessionId?: string | null;
  careGrade?: ConsultationAssessment['careGrade'];
  homeSituationSummary?: string | null;
  supportNeedsSummary?: string | null;
  reliefServicesNotes?: string | null;
  relativeConsultationNotes?: string | null;
  containsHealthData?: boolean;
  actorRoleKey?: RoleKey | null;
}): ServiceResult<ConsultationAssessment> {
  const denied = enforcePermission<ConsultationAssessment>(input.actorRoleKey, 'beratung.cases.view');
  if (denied) return denied;

  const caseResult = getConsultationCaseById(input.tenantId, input.caseId, input.actorRoleKey);
  if (!caseResult.ok) return caseResult;

  const containsHealth = input.containsHealthData ?? Boolean(
    input.homeSituationSummary || input.supportNeedsSummary,
  );

  const now = new Date().toISOString();
  const assessment: ConsultationAssessment = {
    id: nextConsultationId('con-assess'),
    tenantId: input.tenantId,
    caseId: input.caseId,
    sessionId: input.sessionId ?? null,
    careGrade: input.careGrade ?? null,
    careGradeValidFrom: null,
    homeSituationSummary: input.homeSituationSummary ?? null,
    supportNeedsSummary: input.supportNeedsSummary ?? null,
    reliefServicesNotes: input.reliefServicesNotes ?? null,
    relativeConsultationNotes: input.relativeConsultationNotes ?? null,
    containsHealthData: containsHealth,
    recordedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  getConsultationStore(input.tenantId).assessments.push(assessment);

  if (containsHealth) {
    const caseIdx = getConsultationStore(input.tenantId).cases.findIndex((c) => c.id === input.caseId);
    if (caseIdx >= 0) {
      getConsultationStore(input.tenantId).cases[caseIdx] = {
        ...getConsultationStore(input.tenantId).cases[caseIdx],
        containsHealthData: true,
        updatedAt: now,
      };
    }
  }

  appendConsultationAuditEvent(input.tenantId, {
    caseId: input.caseId,
    eventType: 'assessment_saved',
    summary: 'Beratungsassessment gespeichert.',
    actorProfileId: null,
    oldStatus: null,
    newStatus: null,
    metadata: { containsHealthData: String(containsHealth) },
  });

  return { ok: true, data: assessment };
}

export function getConsultationAssessmentForCase(
  tenantId: string,
  caseId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<ConsultationAssessment | null> {
  const caseResult = getConsultationCaseById(tenantId, caseId, actorRoleKey);
  if (!caseResult.ok) return caseResult;

  const assessment = getConsultationStore(tenantId).assessments.find((a) => a.caseId === caseId) ?? null;
  if (!assessment) return { ok: true, data: null };

  const healthAccess = canViewConsultationHealthData({
    actorRole: actorRoleKey,
    tenantId,
    resource: assessment,
  });
  if (!healthAccess.allowed) {
    return {
      ok: true,
      data: {
        ...assessment,
        homeSituationSummary: null,
        supportNeedsSummary: null,
        reliefServicesNotes: null,
        relativeConsultationNotes: null,
        careGrade: null,
      },
    };
  }

  return { ok: true, data: assessment };
}

export function addConsultationRecommendation(input: {
  tenantId: string;
  caseId: string;
  title: string;
  description: string;
  priority?: ConsultationRecommendation['priority'];
  actorRoleKey?: RoleKey | null;
}): ServiceResult<ConsultationRecommendation> {
  const denied = enforcePermission<ConsultationRecommendation>(input.actorRoleKey, 'beratung.cases.view');
  if (denied) return denied;

  const caseResult = getConsultationCaseById(input.tenantId, input.caseId, input.actorRoleKey);
  if (!caseResult.ok) return caseResult;

  const now = new Date().toISOString();
  const recommendation: ConsultationRecommendation = {
    id: nextConsultationId('con-rec'),
    tenantId: input.tenantId,
    caseId: input.caseId,
    title: input.title.trim(),
    description: `${input.description.trim()}\n\n${CONSULTATION_LEGAL_DISCLAIMER}`,
    priority: input.priority ?? 'medium',
    status: 'proposed',
    isInformationalOnly: true,
    dueAt: null,
    createdAt: now,
    updatedAt: now,
  };

  getConsultationStore(input.tenantId).recommendations.push(recommendation);

  appendConsultationAuditEvent(input.tenantId, {
    caseId: input.caseId,
    eventType: 'recommendation_added',
    summary: `Maßnahme vorgeschlagen: ${recommendation.title}`,
    actorProfileId: null,
    oldStatus: null,
    newStatus: null,
    metadata: { informationalOnly: 'true' },
  });

  return { ok: true, data: recommendation };
}

export function createConsultationFollowUp(input: {
  tenantId: string;
  caseId: string;
  dueAt: string;
  note?: string | null;
  assigneeProfileId?: string | null;
  actorRoleKey?: RoleKey | null;
}): ServiceResult<ConsultationFollowUp> {
  const denied = enforcePermission<ConsultationFollowUp>(input.actorRoleKey, 'beratung.cases.view');
  if (denied) return denied;

  const caseResult = getConsultationCaseById(input.tenantId, input.caseId, input.actorRoleKey);
  if (!caseResult.ok) return caseResult;

  const now = new Date().toISOString();
  const followUp: ConsultationFollowUp = {
    id: nextConsultationId('con-fu'),
    tenantId: input.tenantId,
    caseId: input.caseId,
    dueAt: input.dueAt,
    assigneeProfileId: input.assigneeProfileId ?? null,
    status: 'open',
    note: input.note ?? null,
    reminderSentAt: null,
    createdAt: now,
    updatedAt: now,
  };

  getConsultationStore(input.tenantId).followUps.push(followUp);

  appendConsultationAuditEvent(input.tenantId, {
    caseId: input.caseId,
    eventType: 'followup_created',
    summary: `Wiedervorlage angelegt für ${input.dueAt}`,
    actorProfileId: null,
    oldStatus: null,
    newStatus: null,
    metadata: null,
  });

  return { ok: true, data: followUp };
}

export function assertConsultationProductionMode(): ServiceResult<never> | null {
  if (!canUseDemoFallback()) {
    return {
      ok: false,
      error: 'Beratungsmodul im Live-Modus: Demo-Fallback nicht verfügbar.',
    };
  }
  if (getServiceMode() === 'supabase') {
    return {
      ok: false,
      error: 'Beratungsmodul im Live-Modus: Demo-Fallback nicht verfügbar.',
    };
  }
  return null;
}

export { resetConsultationStore };
