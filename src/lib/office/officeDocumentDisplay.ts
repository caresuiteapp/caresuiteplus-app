import { getSystemIntakeTemplateByKey } from '@/features/intakeDocuments/intakeDocumentSystemTemplates';
import type { ClientDocumentRecord } from '@/types/modules/client';
import { CLIENT_DOCUMENT_CATEGORY_LABELS } from '@/types/modules/client/clientDocuments';
import {
  PORTAL_DOCUMENT_CATEGORY_LABELS,
  type PortalDocumentCategory,
  type PortalDocumentListItem,
} from '@/types/portal/documents';

const INTAKE_TEMPLATE_FILE_PATTERN = /^[a-z0-9_]+\.html$/i;

export function isIntakeTemplateFileName(fileName: string): boolean {
  const trimmed = fileName.trim();
  if (!INTAKE_TEMPLATE_FILE_PATTERN.test(trimmed)) return false;
  const templateKey = trimmed.replace(/\.html$/i, '');
  return Boolean(getSystemIntakeTemplateByKey(templateKey));
}

export function resolveOfficeDocumentTitle(doc: Pick<ClientDocumentRecord, 'title' | 'fileName' | 'documentSource'>): string {
  const title = doc.title?.trim();
  if (title) return title;

  if (doc.documentSource === 'intake' || isIntakeTemplateFileName(doc.fileName)) {
    const templateKey = doc.fileName.replace(/\.html$/i, '');
    const template = getSystemIntakeTemplateByKey(templateKey);
    if (template?.title) return template.title;
  }

  return doc.fileName;
}

export function mapIntakeDocumentTypeToPortalCategory(documentType: string | null | undefined): PortalDocumentCategory | null {
  if (!documentType) return null;
  if (documentType === 'privacy_consent' || documentType === 'additional_consent') return 'consent';
  if (documentType === 'client_contract') return 'contract';
  if (documentType === 'assignment_declaration') return 'assignment';
  return null;
}

export function mapClientCategoryToPortalCategory(
  category: ClientDocumentRecord['category'],
): PortalDocumentCategory {
  switch (category) {
    case 'pflegeplan':
      return 'care_plan';
    case 'einwilligung':
      return 'consent';
    case 'vertrag':
      return 'contract';
    case 'arztbrief':
    case 'md_gutachten':
      return 'report';
    default:
      return 'other';
  }
}

export function resolvePortalDocumentCategory(doc: ClientDocumentRecord): PortalDocumentCategory {
  if (doc.documentSource === 'intake' && doc.intakeDocumentType) {
    return mapIntakeDocumentTypeToPortalCategory(doc.intakeDocumentType) ?? mapClientCategoryToPortalCategory(doc.category);
  }
  return mapClientCategoryToPortalCategory(doc.category);
}

export function resolveOfficeDocumentSizeLabel(
  doc: Pick<ClientDocumentRecord, 'documentSource' | 'mimeType' | 'fileName'>,
  fileSizeBytes: number,
): string | null {
  const isIntakeHtml =
    doc.documentSource === 'intake' ||
    (doc.mimeType === 'text/html' && isIntakeTemplateFileName(doc.fileName));

  if (isIntakeHtml) return null;
  if (fileSizeBytes <= 0) return null;
  if (fileSizeBytes < 1024) return `${fileSizeBytes} B`;
  if (fileSizeBytes < 1024 * 1024) return `${(fileSizeBytes / 1024).toFixed(1)} KB`;
  return `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatOfficeDocumentSizeDisplay(
  sizeLabel: string | null | undefined,
  fileSizeBytes: number,
): string | null {
  if (sizeLabel?.trim()) return sizeLabel.trim();
  if (fileSizeBytes > 0) return `${fileSizeBytes} B`;
  return null;
}

export function resolveOfficeDocumentDisplayFileName(
  doc: Pick<ClientDocumentRecord, 'documentSource' | 'mimeType' | 'fileName'>,
): string | null {
  if (doc.documentSource === 'intake' || (doc.mimeType === 'text/html' && isIntakeTemplateFileName(doc.fileName))) {
    return null;
  }
  return doc.fileName;
}

export function formatOfficeDocumentDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function buildOfficeDocumentSubtitle(document: PortalDocumentListItem): string {
  const date = formatOfficeDocumentDate(document.updatedAt);
  if (document.clientName?.trim()) {
    return `${document.clientName.trim()} · ${date}`;
  }
  if (document.displayFileName?.trim()) {
    return `${document.displayFileName.trim()} · ${date}`;
  }
  return date;
}

export function formatOfficeClientName(firstName: string | null | undefined, lastName: string | null | undefined): string | null {
  const name = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(' ').trim();
  return name || null;
}

export function portalDocumentCategoryLabel(category: PortalDocumentCategory): string {
  return PORTAL_DOCUMENT_CATEGORY_LABELS[category];
}

const CONTRACT_INTAKE_DOCUMENT_TYPES = new Set([
  'client_contract',
  'assignment_declaration',
  'privacy_consent',
  'additional_consent',
]);

export function isClientContractOrConsentDocument(
  doc: Pick<ClientDocumentRecord, 'category' | 'intakeDocumentType'>,
): boolean {
  if (doc.category === 'vertrag' || doc.category === 'einwilligung') return true;
  if (doc.intakeDocumentType && CONTRACT_INTAKE_DOCUMENT_TYPES.has(doc.intakeDocumentType)) return true;
  return false;
}

export function filterClientContractDocuments(docs: ClientDocumentRecord[]): ClientDocumentRecord[] {
  return docs.filter(isClientContractOrConsentDocument);
}

export function buildDocumentPreviewFallbackLabel(
  document: Pick<
    PortalDocumentListItem,
    'displayFileName' | 'documentSource' | 'category' | 'sizeLabel' | 'fileName'
  >,
): string {
  if (document.sizeLabel?.trim()) return document.sizeLabel.trim();
  if (document.displayFileName?.trim()) return document.displayFileName.trim();
  if (document.documentSource === 'intake') return 'HTML-Dokument · Aufnahme';
  const categoryLabel = PORTAL_DOCUMENT_CATEGORY_LABELS[document.category];
  if (categoryLabel && document.category !== 'other') return categoryLabel;
  return 'Keine Vorschau verfügbar.';
}

export function buildClientDocumentPreviewFallback(doc: ClientDocumentRecord): string {
  return buildDocumentPreviewFallbackLabel(
    mapClientDocumentToPortalItemForTest(doc),
  );
}

function documentPreviewStatusLabel(
  doc: Pick<ClientDocumentRecord, 'status' | 'intakeStatus'>,
): string {
  if (doc.intakeStatus === 'finalized') return 'Finalisiert';
  if (doc.status === 'abgeschlossen') return 'Finalisiert';
  if (doc.status === 'aktiv') return 'Aktiv';
  return 'In Bearbeitung';
}

export function buildDocumentPreviewStatusSubtitle(doc: ClientDocumentRecord): string {
  const parts = [documentPreviewStatusLabel(doc), CLIENT_DOCUMENT_CATEGORY_LABELS[doc.category]];
  const displayFileName = resolveOfficeDocumentDisplayFileName(doc);
  if (displayFileName) parts.push(displayFileName);
  if (doc.documentSource === 'intake') parts.push('Aufnahme');
  return parts.join(' · ');
}

/** Test helper mirroring officeDocumentsService list mapping */
export function mapClientDocumentToPortalItemForTest(
  doc: ClientDocumentRecord,
  clientName?: string | null,
): PortalDocumentListItem {
  const fileSizeBytes = 0;
  return {
    id: doc.id,
    title: resolveOfficeDocumentTitle(doc),
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    category: resolvePortalDocumentCategory(doc),
    fileSizeBytes,
    status: doc.status,
    updatedAt: doc.updatedAt,
    visibility: 'team',
    sensitivity: doc.sensitivity,
    clientId: doc.clientId,
    clientName: clientName ?? null,
    previewHtml: doc.previewHtml ?? null,
    documentSource: doc.documentSource,
    displayFileName: resolveOfficeDocumentDisplayFileName(doc),
    sizeLabel: resolveOfficeDocumentSizeLabel(doc, fileSizeBytes),
  };
}
