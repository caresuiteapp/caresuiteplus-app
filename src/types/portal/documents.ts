import type { TenantScopedEntity, WorkflowStatus } from '../core/base';
import type { PortalScopedEntity } from './visibility';

export type PortalDocumentCategory =
  | 'care_plan'
  | 'invoice'
  | 'report'
  | 'consent'
  | 'contract'
  | 'assignment'
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
  clientId?: string | null;
  clientName?: string | null;
  previewHtml?: string | null;
  documentSource?: 'upload' | 'intake' | 'generated';
  sizeLabel?: string | null;
  /** User-visible file name; hidden for intake template HTML artifacts */
  displayFileName?: string | null;
};

export type PortalDocumentDetail = PortalDocumentListItem & {
  createdAt: string;
  description: string | null;
  downloadReady: boolean;
};

export const PORTAL_DOCUMENT_CATEGORY_LABELS: Record<PortalDocumentCategory, string> = {
  care_plan: 'Pflegeplan',
  invoice: 'Rechnung',
  report: 'Bericht',
  consent: 'Einwilligung',
  contract: 'Vertrag',
  assignment: 'Abtretung',
  other: 'Sonstiges',
};
