import type { WorkflowStatus } from '@/types/core/base';
import type { ClientDocumentRecord } from '@/types/modules/client';

type IntakeDocumentRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  template_key: string;
  document_type: string;
  title: string;
  status: string;
  finalized_html: string | null;
  preview_html: string | null;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
};

type StoredDocumentRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  title: string;
  file_name: string;
  mime_type: string;
  category: ClientDocumentRecord['category'];
  storage_path: string | null;
  status: WorkflowStatus;
  sensitivity: ClientDocumentRecord['sensitivity'];
  uploaded_by: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
  intake_document_id?: string | null;
  source?: string | null;
};

function mapIntakeDocumentTypeToCategory(documentType: string): ClientDocumentRecord['category'] {
  if (documentType === 'privacy_consent' || documentType === 'additional_consent') return 'einwilligung';
  if (documentType === 'client_contract' || documentType === 'assignment_declaration') return 'vertrag';
  return 'sonstige';
}

function mapIntakeStatusToWorkflow(status: string): WorkflowStatus {
  if (status === 'finalized') return 'abgeschlossen';
  if (status === 'signed' || status === 'pending_signature') return 'in_bearbeitung';
  if (status === 'skipped_optional') return 'archiviert';
  return 'entwurf';
}

export function mapIntakeDocumentRow(row: IntakeDocumentRow): ClientDocumentRecord {
  const html = row.finalized_html ?? row.preview_html;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    title: row.title,
    fileName: `${row.template_key}.html`,
    mimeType: 'text/html',
    category: mapIntakeDocumentTypeToCategory(row.document_type),
    storagePath: null,
    status: mapIntakeStatusToWorkflow(row.status),
    sensitivity: 'care',
    uploadedBy: null,
    validUntil: null,
    createdAt: row.created_at,
    updatedAt: row.finalized_at ?? row.updated_at,
    previewHtml: html,
    documentSource: 'intake',
    intakeDocumentId: row.id,
    intakeDocumentType: row.document_type,
    intakeStatus: row.status,
  };
}

export function mapStoredDocumentRow(row: StoredDocumentRow): ClientDocumentRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    title: row.title,
    fileName: row.file_name,
    mimeType: row.mime_type,
    category: row.category,
    storagePath: row.storage_path,
    status: row.status,
    sensitivity: row.sensitivity,
    uploadedBy: row.uploaded_by,
    validUntil: row.valid_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    documentSource: row.source === 'intake' ? 'intake' : 'upload',
    intakeDocumentId: row.intake_document_id ?? null,
  };
}

export function mergeClientRecordDocuments(
  stored: ClientDocumentRecord[],
  intakeRows: IntakeDocumentRow[],
): ClientDocumentRecord[] {
  const promotedIntakeIds = new Set(
    stored.map((doc) => doc.intakeDocumentId).filter(Boolean) as string[],
  );
  const promotedTemplateKeys = new Set(
    stored
      .filter((doc) => doc.documentSource === 'intake')
      .map((doc) => doc.fileName.replace(/\.html$/, '')),
  );

  const intakeDocs = intakeRows
    .filter((row) => !['not_started', 'declined', 'revoked', 'replaced'].includes(row.status))
    .filter((row) => !promotedIntakeIds.has(row.id))
    .filter((row) => !promotedTemplateKeys.has(row.template_key))
    .map(mapIntakeDocumentRow);

  return [...stored, ...intakeDocs].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}
