import { SIS_TOPIC_FIELDS, type SisFormDetail, type SisTopicEntry, type SisTopicKey } from '@/types/modules/sisForm';
import { createDemoSisAssessment, getDemoSisById } from './sisAssessments';
import { DEMO_TENANT_ID } from './tenant';

function emptyTopic(): SisTopicEntry {
  return {
    resources: '',
    problems: '',
    wishes: '',
    habits: '',
    observations: '',
    actionNeeded: '',
  };
}

function buildTopics(seed?: Partial<Record<SisTopicKey, Partial<SisTopicEntry>>>): Record<SisTopicKey, SisTopicEntry> {
  const topics = {} as Record<SisTopicKey, SisTopicEntry>;
  for (const field of SIS_TOPIC_FIELDS) {
    topics[field] = { ...emptyTopic(), ...(seed?.[field] ?? {}) };
  }
  return topics;
}

const store = new Map<string, SisFormDetail>();

export function getDemoSisFormDetail(id: string): SisFormDetail | null {
  const item = store.get(id);
  return item ? { ...item, topics: { ...item.topics }, risks: item.risks.map((r) => ({ ...r })) } : null;
}

export function createDemoSisFormDetail(input: {
  clientId: string;
  clientName: string;
  assessorName: string;
}): SisFormDetail {
  const base = createDemoSisAssessment(input);
  const detail: SisFormDetail = {
    id: base.id,
    tenantId: DEMO_TENANT_ID,
    clientId: input.clientId,
    clientName: input.clientName,
    assessorName: input.assessorName,
    status: 'entwurf',
    topics: buildTopics(),
    risks: [],
    overallScore: 0,
    assessedAt: base.assessedAt,
    nextReviewAt: base.nextReviewAt,
  };
  store.set(detail.id, detail);
  return { ...detail, topics: { ...detail.topics }, risks: [...detail.risks] };
}

export function saveDemoSisFormDetail(detail: SisFormDetail): SisFormDetail {
  const saved = {
    ...detail,
    topics: { ...detail.topics },
    risks: detail.risks.map((r) => ({ ...r })),
  };
  store.set(saved.id, saved);
  return { ...saved, topics: { ...saved.topics }, risks: [...saved.risks] };
}

export function ensureDemoSisFormDetail(id: string): SisFormDetail | null {
  const existing = getDemoSisFormDetail(id);
  if (existing) return existing;
  const base = getDemoSisById(id);
  if (!base) return null;
  const detail: SisFormDetail = {
    id: base.id,
    tenantId: base.tenantId,
    clientId: base.clientId,
    clientName: base.clientName,
    assessorName: base.assessorName,
    status: base.status === 'aktiv' ? 'freigegeben' : 'in_bearbeitung',
    topics: buildTopics({
      'Mobilität und Beweglichkeit': {
        resources: 'Gehstock, Rollator verfügbar',
        problems: 'Gangunsicherheit bei Nässe',
        actionNeeded: 'Sturzprophylaxe prüfen',
      },
    }),
    risks: [
      {
        id: `risk-${base.id}-1`,
        riskType: 'Sturz',
        level: 'mittel',
        measureRef: 'Mobilitätsplan MP-12',
        notes: 'Nachts Toilettengang begleiten',
      },
    ],
    overallScore: base.overallScore,
    assessedAt: base.assessedAt,
    nextReviewAt: base.nextReviewAt,
  };
  store.set(detail.id, detail);
  return getDemoSisFormDetail(id);
}
