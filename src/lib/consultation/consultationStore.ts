import type {
  ConsultationAssessment,
  ConsultationAuditEvent,
  ConsultationCase,
  ConsultationDocument,
  ConsultationDocumentVersion,
  ConsultationFollowUp,
  ConsultationRecommendation,
  ConsultationSession,
} from '@/types/modules/consultation';

export type ConsultationStoreState = {
  cases: ConsultationCase[];
  sessions: ConsultationSession[];
  assessments: ConsultationAssessment[];
  recommendations: ConsultationRecommendation[];
  documents: ConsultationDocument[];
  documentVersions: ConsultationDocumentVersion[];
  followUps: ConsultationFollowUp[];
  auditEvents: ConsultationAuditEvent[];
};

const stores = new Map<string, ConsultationStoreState>();

function emptyStore(): ConsultationStoreState {
  return {
    cases: [],
    sessions: [],
    assessments: [],
    recommendations: [],
    documents: [],
    documentVersions: [],
    followUps: [],
    auditEvents: [],
  };
}

export function getConsultationStore(tenantId: string): ConsultationStoreState {
  let store = stores.get(tenantId);
  if (!store) {
    store = emptyStore();
    stores.set(tenantId, store);
  }
  return store;
}

export function resetConsultationStore(tenantId?: string): void {
  if (tenantId) {
    stores.delete(tenantId);
    return;
  }
  stores.clear();
}

let idCounter = 0;

export function nextConsultationId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

let auditCounter = 0;

export function appendConsultationAuditEvent(
  tenantId: string,
  event: Omit<ConsultationAuditEvent, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
): ConsultationAuditEvent {
  auditCounter += 1;
  const full: ConsultationAuditEvent = {
    ...event,
    id: `con-audit-${auditCounter}`,
    tenantId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  getConsultationStore(tenantId).auditEvents.unshift(full);
  return full;
}

export function getConsultationAuditTrail(tenantId: string, caseId?: string): ConsultationAuditEvent[] {
  const events = getConsultationStore(tenantId).auditEvents;
  return caseId ? events.filter((e) => e.caseId === caseId) : events;
}
