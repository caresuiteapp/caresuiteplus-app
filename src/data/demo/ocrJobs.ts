import type { OcrJobListItem } from '@/types/modules/platform';
import { DEMO_TENANT_ID } from './tenant';

export const demoOcrJobs: OcrJobListItem[] = [
  {
    id: 'ocr-001',
    tenantId: DEMO_TENANT_ID,
    sourceDocumentId: 'doc-office-001',
    sourceDocumentTitle: 'Pflegeplan Juni 2026',
    providerKey: 'azure-document-intelligence',
    extractedText: 'Pflegeplan für Helga Schneider. Mobilisation 2× täglich. Medikamentengabe morgens.',
    confidence: 0.94,
    status: 'abgeschlossen',
    completedAt: '2026-06-10T14:30:00.000Z',
    createdAt: '2026-06-10T14:28:00.000Z',
    updatedAt: '2026-06-10T14:30:00.000Z',
  },
  {
    id: 'ocr-002',
    tenantId: DEMO_TENANT_ID,
    sourceDocumentId: 'doc-office-002',
    sourceDocumentTitle: 'MDK-Unterlagen',
    providerKey: 'azure-document-intelligence',
    extractedText: null,
    confidence: null,
    status: 'in_bearbeitung',
    completedAt: null,
    createdAt: '2026-06-11T09:00:00.000Z',
    updatedAt: '2026-06-11T09:00:00.000Z',
  },
  {
    id: 'ocr-003',
    tenantId: DEMO_TENANT_ID,
    sourceDocumentId: 'doc-001',
    sourceDocumentTitle: 'Einsatzprotokoll Mai',
    providerKey: 'azure-document-intelligence',
    extractedText: null,
    confidence: null,
    status: 'fehlerhaft',
    completedAt: null,
    createdAt: '2026-06-09T16:00:00.000Z',
    updatedAt: '2026-06-09T16:05:00.000Z',
  },
];

let ocrStore = demoOcrJobs.map((j) => ({ ...j }));

export function getDemoOcrJobs(): OcrJobListItem[] {
  return ocrStore.map((j) => ({ ...j }));
}

export function getDemoOcrJobById(id: string): OcrJobListItem | null {
  const job = ocrStore.find((j) => j.id === id);
  return job ? { ...job } : null;
}

export function retryDemoOcrJob(id: string): OcrJobListItem | null {
  const index = ocrStore.findIndex((j) => j.id === id);
  if (index < 0) return null;
  const now = new Date().toISOString();
  ocrStore[index] = {
    ...ocrStore[index],
    status: 'in_bearbeitung',
    extractedText: null,
    confidence: null,
    completedAt: null,
    updatedAt: now,
  };
  return { ...ocrStore[index] };
}

export function createDemoOcrJob(documentId: string, title: string): OcrJobListItem {
  const now = new Date().toISOString();
  const job: OcrJobListItem = {
    id: `ocr-${Date.now()}`,
    tenantId: DEMO_TENANT_ID,
    sourceDocumentId: documentId,
    sourceDocumentTitle: title,
    providerKey: 'azure-document-intelligence',
    extractedText: null,
    confidence: null,
    status: 'entwurf',
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  ocrStore = [job, ...ocrStore];
  return job;
}
