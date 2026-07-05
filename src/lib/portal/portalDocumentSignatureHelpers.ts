import type {
  PortalSignatureDocument,
  PortalSignatureDocumentStatus,
  PortalSignatureFilterTab,
} from '@/types/portal/documentSignatures';

export const PORTAL_SIGNATURE_TABLES = {
  documents: 'portal_signature_documents',
  captures: 'portal_signature_captures',
  audit: 'portal_signature_audit_events',
} as const;

export const PORTAL_SIGNATURE_STORAGE_BUCKET = 'office-documents';

export function buildPortalSignatureCaptureStoragePath(
  tenantId: string,
  documentId: string,
  captureId: string,
): string {
  return `tenant/${tenantId}/portal/signatures/${documentId}/${captureId}.png`;
}

export function buildPortalSignatureFinalPdfPath(
  tenantId: string,
  documentId: string,
): string {
  return `tenant/${tenantId}/portal/signatures/${documentId}/final.pdf`;
}

export function parseSignatureDataUrl(dataUrl: string): { bytes: Uint8Array; mimeType: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  try {
    const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    return { bytes, mimeType: match[1] };
  } catch {
    return null;
  }
}

export function isOpenSignatureStatus(status: PortalSignatureDocumentStatus): boolean {
  return ['new', 'open', 'in_progress', 'partially_signed'].includes(status);
}

export function resolveNextSignerRole(
  doc: Pick<
    PortalSignatureDocument,
    'signatureRequirement' | 'employeeSigned' | 'clientSigned' | 'status'
  >,
): PortalSignatureDocument['nextSignerRole'] {
  if (doc.status === 'completed' || doc.status === 'withdrawn') return null;
  if (doc.signatureRequirement === 'employee') {
    return doc.employeeSigned ? null : 'employee';
  }
  if (doc.signatureRequirement === 'client') {
    return doc.clientSigned ? null : 'client';
  }
  if (!doc.employeeSigned) return 'employee';
  if (!doc.clientSigned) return 'client';
  return null;
}

export function resolveStatusAfterCapture(
  doc: Pick<
    PortalSignatureDocument,
    'signatureRequirement' | 'employeeSigned' | 'clientSigned'
  >,
): PortalSignatureDocumentStatus {
  const needsEmployee =
    doc.signatureRequirement === 'employee' || doc.signatureRequirement === 'both_sequential';
  const needsClient =
    doc.signatureRequirement === 'client' || doc.signatureRequirement === 'both_sequential';
  const employeeDone = !needsEmployee || doc.employeeSigned;
  const clientDone = !needsClient || doc.clientSigned;
  if (employeeDone && clientDone) return 'completed';
  if (doc.employeeSigned || doc.clientSigned) return 'partially_signed';
  return 'in_progress';
}

function isSameDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function isOverdue(doc: PortalSignatureDocument, ref: Date): boolean {
  if (!doc.dueDate || !isOpenSignatureStatus(doc.status)) return false;
  const due = new Date(doc.dueDate);
  due.setHours(23, 59, 59, 999);
  return due < ref;
}

function isDueToday(doc: PortalSignatureDocument, ref: Date): boolean {
  if (!doc.dueDate || !isOpenSignatureStatus(doc.status)) return false;
  return isSameDay(doc.dueDate, ref);
}

export function filterPortalSignatureDocuments(
  docs: PortalSignatureDocument[],
  tab: PortalSignatureFilterTab,
  ref = new Date(),
): PortalSignatureDocument[] {
  switch (tab) {
    case 'open':
      return docs.filter((d) => isOpenSignatureStatus(d.status));
    case 'due_today':
      return docs.filter((d) => isDueToday(d, ref));
    case 'overdue':
      return docs.filter((d) => isOverdue(d, ref));
    case 'completed':
      return docs.filter((d) => d.status === 'completed');
    default:
      return docs;
  }
}

export function countPortalSignatureDashboard(
  docs: PortalSignatureDocument[],
  ref = new Date(),
): { openCount: number; overdueCount: number; dueTodayCount: number } {
  const open = docs.filter((d) => isOpenSignatureStatus(d.status));
  return {
    openCount: open.length,
    overdueCount: open.filter((d) => isOverdue(d, ref)).length,
    dueTodayCount: open.filter((d) => isDueToday(d, ref)).length,
  };
}

export function mapPortalSignatureDocumentRow(row: Record<string, unknown>): PortalSignatureDocument {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    title: String(row.title),
    documentType: row.document_type as PortalSignatureDocument['documentType'],
    recipientType: row.recipient_type as PortalSignatureDocument['recipientType'],
    employeeId: row.employee_id ? String(row.employee_id) : null,
    clientId: row.client_id ? String(row.client_id) : null,
    clientName: row.client_name ? String(row.client_name) : null,
    signatureRequirement: row.signature_requirement as PortalSignatureDocument['signatureRequirement'],
    dueDate: row.due_date ? String(row.due_date) : null,
    priority: (row.priority as PortalSignatureDocument['priority']) ?? 'normal',
    requiredBeforeAssignment: Boolean(row.required_before_assignment),
    assignmentId: row.assignment_id ? String(row.assignment_id) : null,
    status: row.status as PortalSignatureDocument['status'],
    creatorName: String(row.creator_name ?? 'Office'),
    createdAt: String(row.created_at),
    sentAt: row.sent_at ? String(row.sent_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    allowDownload: row.allow_download !== false,
    previewHtml: row.preview_html ? String(row.preview_html) : null,
    previewPdfUrl: row.final_storage_path ? String(row.final_storage_path) : null,
    versionNumber: Number(row.version_number ?? 1),
    employeeSigned: Boolean(row.employee_signed),
    clientSigned: Boolean(row.client_signed),
    nextSignerRole: row.next_signer_role as PortalSignatureDocument['nextSignerRole'],
  };
}

export function mapPortalSignatureCaptureRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    tenantId: String(row.tenant_id),
    signerRole: row.signer_role as 'employee' | 'client',
    signerName: String(row.signer_name),
    signedAt: String(row.signed_at),
    signatureHash: String(row.signature_hash),
    auditId: String(row.audit_id),
    deviceInfo: row.device_info ? String(row.device_info) : null,
    browser: row.browser ? String(row.browser) : null,
    capturedIp: row.captured_ip ? String(row.captured_ip) : null,
    storagePath: row.storage_path ? String(row.storage_path) : null,
  };
}

export function mapPortalSignatureAuditRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    documentId: String(row.document_id),
    eventType: String(row.event_type),
    summary: String(row.summary),
    actorName: row.actor_name ? String(row.actor_name) : null,
    metadata: (row.metadata_json as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  };
}

export function resolveInitialNextSignerRole(
  signatureRequirement: PortalSignatureDocument['signatureRequirement'],
): PortalSignatureDocument['nextSignerRole'] {
  if (signatureRequirement === 'employee' || signatureRequirement === 'both_sequential') {
    return 'employee';
  }
  if (signatureRequirement === 'client') return 'client';
  return null;
}
