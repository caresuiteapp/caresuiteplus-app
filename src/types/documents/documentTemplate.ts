import type { DocumentTemplateTypeKey, TemplateRequiredFieldInput } from '@/features/documents/templateEngine/types';

export type DocumentTemplateVersionStatus =
  | 'draft'
  | 'active'
  | 'inactive'
  | 'archived'
  | 'deprecated';

export type DocumentTemplateStatus = 'draft' | 'active' | 'archived';

export type DocumentTemplateRecord = {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  templateType: DocumentTemplateTypeKey;
  templateStatus: DocumentTemplateStatus;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentTemplateVersionRecord = {
  id: string;
  tenantId: string;
  templateId: string;
  versionNumber: number;
  htmlTemplate: string;
  cssTemplate: string;
  requiredFields: TemplateRequiredFieldInput[];
  versionStatus: DocumentTemplateVersionStatus;
  lastPreviewAt: string | null;
  lastPreviewValid: boolean;
  activatedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentTemplateDetail = DocumentTemplateRecord & {
  versions: DocumentTemplateVersionRecord[];
  activeVersion: DocumentTemplateVersionRecord | null;
  draftVersion: DocumentTemplateVersionRecord | null;
};

export type DocumentTemplateVersionInput = {
  htmlTemplate: string;
  cssTemplate?: string;
  requiredFields?: TemplateRequiredFieldInput[];
};

export type PreviewViewMode = 'mobile' | 'desktop' | 'print';

export type PreviewSampleKind = 'demo_full' | 'client' | 'invoice' | 'visit' | 'contract';

export type PreviewSampleOption = {
  id: string;
  kind: PreviewSampleKind;
  label: string;
  entityType: 'invoice' | 'client' | 'service_record' | 'contract' | 'care_documentation';
  entityId: string;
};

export type LivePreviewRequest = {
  tenantId: string;
  templateId: string;
  versionId?: string;
  sampleId: string;
  viewMode?: PreviewViewMode;
  showDraftWatermark?: boolean;
};

export type LivePreviewResult = {
  html: string;
  renderResult: import('@/features/documents/templateEngine/types').RenderTemplateResult;
  viewMode: PreviewViewMode;
  sampleLabel: string;
  pdfPrepared: boolean;
  pdfEngineAvailable: boolean;
  source: 'demo' | 'repository';
};
