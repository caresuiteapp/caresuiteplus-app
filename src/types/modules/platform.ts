import type { TenantScopedEntity, WorkflowStatus } from '../core/base';

export type AiJobType = 'document_summary' | 'care_note_assist' | 'classification';

export type AiJob = TenantScopedEntity & {
  jobType: AiJobType;
  promptSummary: string;
  resultSummary: string | null;
  providerKey: string;
  status: WorkflowStatus;
  completedAt: string | null;
};

export type AiJobListItem = Pick<
  AiJob,
  | 'id'
  | 'tenantId'
  | 'jobType'
  | 'promptSummary'
  | 'resultSummary'
  | 'providerKey'
  | 'status'
  | 'completedAt'
  | 'createdAt'
  | 'updatedAt'
>;

export type OcrJob = TenantScopedEntity & {
  sourceDocumentId: string;
  sourceDocumentTitle: string;
  providerKey: string;
  extractedText: string | null;
  confidence: number | null;
  status: WorkflowStatus;
  completedAt: string | null;
};

export type OcrJobListItem = Pick<
  OcrJob,
  | 'id'
  | 'tenantId'
  | 'sourceDocumentId'
  | 'sourceDocumentTitle'
  | 'providerKey'
  | 'extractedText'
  | 'confidence'
  | 'status'
  | 'completedAt'
  | 'createdAt'
  | 'updatedAt'
>;

export const AI_JOB_TYPE_LABELS: Record<AiJobType, string> = {
  document_summary: 'Dokumentenzusammenfassung',
  care_note_assist: 'Pflegenotiz-Assistenz',
  classification: 'Klassifikation',
};

export type TelemedicineSession = TenantScopedEntity & {
  clientId: string;
  providerProfileId: string;
  scheduledAt: string;
  durationMinutes: number;
  meetingUrl: string | null;
  status: WorkflowStatus;
};
