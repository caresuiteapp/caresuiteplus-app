import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { getSupabaseClient } from '@/lib/supabase/client';
import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';
import { fetchOfficeInvoice, fetchOfficeInvoiceIssuePreview, finalizeOfficeInvoiceIssue } from './invoiceWorkspaceService.web';
import type { OfficeInvoice, OfficeInvoiceMutationResult } from './invoiceWorkspaceTypes.web';
import { generateInvoicePdf, normalizeInvoiceCompanySnapshot, officeInvoiceToPdfInvoice, validateInvoicePdf } from './invoicePdfService.web';
import { loadInvoiceProofPages } from './invoiceProofAttachments.web';

const inFlight = new Map<string, Promise<ServiceResult<OfficeInvoiceMutationResult>>>();
type Attempt = { requestId: string; invoiceNumber: string; companySnapshot: Record<string, unknown>; sourceRevision: string; pdfFilePath: string; pdfSha256: string };
const uploadedAttempts = new Map<string, Attempt>();
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

async function performIssue(tenantId: string, invoice: OfficeInvoice, role: RoleKey | null | undefined, requestId: string | undefined, actor: string): Promise<ServiceResult<OfficeInvoiceMutationResult>> {
  const db = getSupabaseClient();
  if (!db) return fail('Die Datenbank ist nicht erreichbar.');
  const key = `${actor}:${tenantId}:${invoice.id}:${invoice.updatedAt}`;
  const sameActor = async () => {
    const current = await db.auth.getUser();
    if (current.error || current.data.user?.id !== actor) throw new Error('Die Anmeldung hat sich geändert. Bitte die Rechnung erneut öffnen.');
  };
  try {
    const existing = uploadedAttempts.get(key);
    if (existing) {
      await sameActor();
      const result = await finalizeOfficeInvoiceIssue(tenantId, invoice.id, invoice.updatedAt, existing, role);
      if (result.ok) uploadedAttempts.delete(key);
      else if (!/verbind|unterbrech|bestätigt/i.test(result.error)) uploadedAttempts.delete(key);
      return result;
    }
    const fresh = await fetchOfficeInvoice(tenantId, invoice.id, role);
    if (!fresh.ok) return fresh;
    if (fresh.data.updatedAt !== invoice.updatedAt || fresh.data.status !== 'draft') return fail('Die Rechnung wurde inzwischen geändert oder ausgestellt. Bitte neu laden.');
    const preview = await fetchOfficeInvoiceIssuePreview(tenantId, invoice.id, invoice.updatedAt, role);
    if (!preview.ok) return preview;
    const pdfInvoice = { ...officeInvoiceToPdfInvoice(fresh.data), invoiceNumber: preview.data.invoiceNumber, status: 'ready' as const };
    const company = normalizeInvoiceCompanySnapshot(preview.data.companySnapshot);
    const validation = validateInvoicePdf({ invoice: pdfInvoice, company });
    if (validation.errors.length) return fail(validation.errors.join(' '));
    if (pdfInvoice.lineItems.some(line => (line.taxRatePercent ?? 0) === 0) && !pdfInvoice.taxNotice?.trim()) return fail('Für Positionen mit 0 % Umsatzsteuer fehlt die Begründung. Bitte vor der Ausstellung den Steuerhinweis ergänzen.');
    const proofIds = fresh.data.includeProofs ? fresh.data.selectedProofIds : [];
    if (fresh.data.includeProofs && !proofIds.length) return fail('Bitte Leistungsnachweise auswählen oder die Rechnung ohne Anlagen speichern.');
    const annexPages = await loadInvoiceProofPages({ tenantId, clientId: fresh.data.clientId || '', start: fresh.data.servicePeriodStart || '',
      end: fresh.data.servicePeriodEnd || '', invoiceId: fresh.data.id, proofIds, actorRoleKey: role });
    const prepared = await generateInvoicePdf({ invoice: pdfInvoice, company, annexPages });
    if (prepared.bytes.length > 20 * 1024 * 1024) return fail('Die Rechnung mit Anlagen überschreitet 20 MB. Bitte die Anlagenauswahl verkleinern.');
    const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(prepared.bytes));
    const pdfSha256 = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    let binary = '';
    for (let offset = 0; offset < prepared.bytes.length; offset += 8192) binary += String.fromCharCode(...prepared.bytes.subarray(offset, offset + 8192));
    await sameActor();
    const upload = await invokeEdgeFunction<{ pdfPath?: string; sha256?: string }>('render-document-pdf', {
      tenantId, clientId: fresh.data.clientId, documentId: `invoice-${invoice.id}`, expectedUpdatedAt: invoice.updatedAt,
      pdfBase64: btoa(binary), storeOnly: true,
    });
    if (!upload.ok) return upload;
    const pdfFilePath = `tenant/${tenantId}/generated/invoice-${invoice.id}/${pdfSha256}.pdf`;
    if (upload.data.pdfPath !== pdfFilePath || upload.data.sha256 !== pdfSha256) return fail('Der gespeicherte PDF-Inhalt wurde nicht bestätigt. Die Rechnung wurde nicht ausgestellt.');
    const attempt = { ...preview.data, requestId: requestId || crypto.randomUUID(), pdfFilePath, pdfSha256 };
    uploadedAttempts.set(key, attempt);
    await sameActor();
    const result = await finalizeOfficeInvoiceIssue(tenantId, invoice.id, invoice.updatedAt, attempt, role);
    if (result.ok) uploadedAttempts.delete(key);
    else if (!/verbind|unterbrech|bestätigt/i.test(result.error)) uploadedAttempts.delete(key);
    return result;
  } catch (error) { return fail(error instanceof Error ? error.message : 'Die Rechnung konnte nicht ausgestellt werden. Bitte neu laden.'); }
}

/** No invoice number is consumed until the server atomically confirms this exact PDF and source revision. */
export async function issueOfficeInvoicePdf(tenantId: string, invoice: OfficeInvoice, role?: RoleKey | null, requestId?: string): Promise<ServiceResult<OfficeInvoiceMutationResult>> {
  const denied = enforcePermission<OfficeInvoiceMutationResult>(role, 'office.invoices.status_change');
  if (denied) return denied;
  if (invoice.tenantId !== tenantId || invoice.status !== 'draft' || !invoice.officeManaged) return fail('Nur ein gespeicherter bearbeitbarer Rechnungsentwurf kann ausgestellt werden.');
  if (!globalThis.crypto?.subtle || !globalThis.crypto.randomUUID) return fail('Die sichere PDF-Verarbeitung ist in diesem Browser nicht verfügbar.');
  const db = getSupabaseClient();
  if (!db) return fail('Die Datenbank ist nicht erreichbar.');
  const actor = await db.auth.getUser().catch(() => null);
  if (!actor || actor.error || !actor.data.user?.id) return fail('Bitte erneut anmelden.');
  const key = `${actor.data.user.id}:${tenantId}:${invoice.id}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const task = performIssue(tenantId, invoice, role, requestId, actor.data.user.id).finally(() => { if (inFlight.get(key) === task) inFlight.delete(key); });
  inFlight.set(key, task);
  return task;
}
