import type { TenantScopedEntity, WorkflowStatus } from '../core/base';
import type { PortalScopedEntity } from './visibility';

export type PortalDocumentCategory =
  | 'care_plan'
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
>;

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
  other: 'Sonstiges',
};
