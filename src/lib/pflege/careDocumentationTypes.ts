import type { WorkflowStatus } from '@/types/core/base';

/** Pflege-branded care documentation list item (maps from Assist care_records demo/live). */
export type CareDocumentationListItem = {
  id: string;
  tenantId: string;
  title: string;
  clientName: string;
  employeeName: string;
  recordedAt: string;
  status: WorkflowStatus;
  updatedAt: string;
  hasSignature: boolean;
  pdfReady: boolean;
  contentPreview: string;
};

export type CareDocumentationDetail = CareDocumentationListItem & {
  content: string;
  durationMinutes: number | null;
  location: string | null;
};
