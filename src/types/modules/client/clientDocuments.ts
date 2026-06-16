import type { TenantScopedEntity } from '../../core/base';
import type { WorkflowStatus } from '../../core/base';
import type { SensitivityLevel } from '../../portal/visibility';

export type ClientDocumentSource = 'upload' | 'intake' | 'generated';

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
  previewHtml?: string | null;
  documentSource?: ClientDocumentSource;
  intakeDocumentId?: string | null;
  intakeDocumentType?: string | null;
  intakeStatus?: string | null;
};

export const CLIENT_DOCUMENT_STATUS_LABELS: Partial<Record<WorkflowStatus, string>> = {
  entwurf: 'Entwurf',
  in_bearbeitung: 'In Bearbeitung',
  abgeschlossen: 'Finalisiert',
  aktiv: 'Aktiv',
  archiviert: 'Archiviert',
};

export const CLIENT_DOCUMENT_CATEGORY_LABELS: Record<ClientDocumentRecord['category'], string> = {
  vertrag: 'Vertrag',
  pflegeplan: 'Pflegeplan',
  arztbrief: 'Arztbrief',
  md_gutachten: 'MD-Gutachten',
  einwilligung: 'Einwilligung',
  sonstige: 'Sonstige',
};
