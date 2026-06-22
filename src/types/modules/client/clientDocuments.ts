import type { TenantScopedEntity } from '../../core/base';
import type { WorkflowStatus } from '../../core/base';
import type { SensitivityLevel } from '../../portal/visibility';

export type ClientDocumentRecord = TenantScopedEntity & {
  clientId: string;
  title: string;
  fileName: string;
  mimeType: string;
  category: 'vertrag' | 'pflegeplan' | 'arztbrief' | 'md_gutachten' | 'einwilligung' | 'sonstige';
  storagePath: string | null;
  status: WorkflowStatus;
  sensitivity: SensitivityLevel;
  uploadedBy: string | null;
  validUntil: string | null;
  /** Intake-/Upload-Herkunft (Merge-Schicht, nicht DB-Pflichtfeld) */
  documentSource?: 'intake' | 'upload' | null;
  intakeDocumentId?: string | null;
  intakeDocumentType?: string | null;
  intakeStatus?: string | null;
  previewHtml?: string | null;
};

export const CLIENT_DOCUMENT_CATEGORY_LABELS: Record<ClientDocumentRecord['category'], string> = {
  vertrag: 'Vertrag',
  pflegeplan: 'Pflegeplan',
  arztbrief: 'Arztbrief',
  md_gutachten: 'MD-Gutachten',
  einwilligung: 'Einwilligung',
  sonstige: 'Sonstige',
};
