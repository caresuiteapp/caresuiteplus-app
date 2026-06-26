import type { TenantScopedEntity, WorkflowStatus } from '../core/base';
import type { PortalScopedEntity } from './visibility';

export type PortalDocumentCategory =
  | 'care_plan'
  | 'contract'
  | 'assignment'
  | 'invoice'
  | 'report'
  | 'consent'
  | 'other';

export type DocumentAudienceScope = 'portal' | 'office';

export type PortalDocument = TenantScopedEntity &
  PortalScopedEntity & {
    title: string;
    fileName: string;
    mimeType: string;
    category: PortalDocumentCategory;
    fileSizeBytes: number;
    status: WorkflowStatus;
    audienceScope: DocumentAudienceScope;
  };

export type PortalDocumentListItem = Pick<
  PortalDocument,
  | 'id'
  | 'title'
  | 'fileName'
  | 'mimeType'
  | 'category'
  | 'fileSizeBytes'
  | 'status'
  | 'updatedAt'
  | 'visibility'
  | 'sensitivity'
> & {
  clientName?: string | null;
  clientId?: string | null;
  displayFileName?: string | null;
  documentSource?: string | null;
  sizeLabel?: string | null;
  previewHtml?: string | null;
};

export type PortalDocumentDetail = PortalDocumentListItem & {
  createdAt: string;
  description: string | null;
  downloadReady: boolean;
  viewReady: boolean;
};

export const PORTAL_DOCUMENT_CATEGORY_LABELS: Record<PortalDocumentCategory, string> = {
  care_plan: 'Pflegeplan',
  contract: 'Vertrag',
  assignment: 'Einsatzvereinbarung',
  invoice: 'Rechnung',
  report: 'Bericht',
  consent: 'Einwilligung',
  other: 'Sonstiges',
};
