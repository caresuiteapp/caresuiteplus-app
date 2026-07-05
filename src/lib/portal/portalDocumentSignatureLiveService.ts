import type { ServiceResult } from '@/types';
import type {
  PortalSignatureDocument,
  PortalSignatureFilterTab,
} from '@/types/portal/documentSignatures';
import { getSupabaseClient } from '@/lib/supabase/client';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

/** Live Supabase fetch for employee portal signature documents. Falls back to demo on error. */
export async function fetchLivePortalSignatureDocuments(
  tenantId: string,
  employeeId: string,
  tab: PortalSignatureFilterTab,
): Promise<ServiceResult<PortalSignatureDocument[]>> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: 'Supabase nicht verfügbar.' };
  }

  const { data, error } = await supabase
    .from('portal_signature_documents')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .neq('status', 'withdrawn')
    .order('due_date', { ascending: true, nullsFirst: false });

  if (error) {
    return { ok: false, error: error.message };
  }

  const docs = (data ?? []).map(mapRowToDocument);
  const ref = new Date();
  const filtered = filterLiveByTab(docs, tab, ref);
  return { ok: true, data: filtered };
}

function filterLiveByTab(
  docs: PortalSignatureDocument[],
  tab: PortalSignatureFilterTab,
  ref: Date,
): PortalSignatureDocument[] {
  const openStatuses = new Set(['new', 'open', 'in_progress', 'partially_signed']);
  const isOpen = (d: PortalSignatureDocument) => openStatuses.has(d.status);
  const isSameDay = (iso: string) => {
    const d = new Date(iso);
    return (
      d.getFullYear() === ref.getFullYear() &&
      d.getMonth() === ref.getMonth() &&
      d.getDate() === ref.getDate()
    );
  };
  const isOverdue = (d: PortalSignatureDocument) => {
    if (!d.dueDate || !isOpen(d)) return false;
    return new Date(d.dueDate) < ref;
  };

  switch (tab) {
    case 'open':
      return docs.filter(isOpen);
    case 'due_today':
      return docs.filter((d) => isOpen(d) && d.dueDate && isSameDay(d.dueDate));
    case 'overdue':
      return docs.filter(isOverdue);
    case 'completed':
      return docs.filter((d) => d.status === 'completed');
    default:
      return docs;
  }
}

function mapRowToDocument(row: Record<string, unknown>): PortalSignatureDocument {
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
