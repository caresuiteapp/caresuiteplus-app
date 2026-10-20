import type { AiJobListItem } from '@/types/modules/platform';
import { DEMO_TENANT_ID } from './tenant';

export const demoAiJobs: AiJobListItem[] = [
  {
    id: 'ai-001',
    tenantId: DEMO_TENANT_ID,
    jobType: 'document_summary',
    promptSummary: 'Pflegeplan Juni zusammenfassen',
    resultSummary: 'Fokus auf Mobilisation und Medikamentengabe. Wöchentliche Hautinspektion empfohlen.',
    providerKey: 'openai',
    status: 'abgeschlossen',
    completedAt: '2026-06-10T15:00:00.000Z',
    createdAt: '2026-06-10T14:55:00.000Z',
    updatedAt: '2026-06-10T15:00:00.000Z',
  },
  {
    id: 'ai-002',
    tenantId: DEMO_TENANT_ID,
    jobType: 'care_note_assist',
    promptSummary: 'Einsatznotiz strukturieren',
    resultSummary: null,
    providerKey: 'openai',
    status: 'in_bearbeitung',
    completedAt: null,
    createdAt: '2026-06-11T08:30:00.000Z',
    updatedAt: '2026-06-11T08:30:00.000Z',
  },
];

let aiStore = demoAiJobs.map((j) => ({ ...j }));

export function getDemoAiJobs(): AiJobListItem[] {
  return aiStore.map((j) => ({ ...j }));
}

export function getDemoAiJobById(id: string): AiJobListItem | null {
  const job = aiStore.find((j) => j.id === id);
  return job ? { ...job } : null;
}
