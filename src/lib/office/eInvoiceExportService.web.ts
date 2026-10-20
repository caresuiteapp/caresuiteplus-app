import type { RoleKey, ServiceResult } from '@/types';
import type { OfficeInvoice } from './invoiceWorkspaceTypes.web';
import type { OfficeEInvoiceAttachment } from './eInvoiceTypes.web';
import { fetchOfficeInvoice, fetchOfficeInvoiceIssuePreview } from './invoiceWorkspaceService.web';
import { downloadInvoiceProofAttachment } from './invoiceProofAttachments.web';
import { prepareOfficeInvoiceUbl } from './eInvoiceUbl.web';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isOfficeInvoiceUuid } from './invoiceWorkspaceTypes.web';

export async function prepareOfficeEInvoiceDraft(tenantId: string, invoice: OfficeInvoice, role?: RoleKey | null): Promise<ServiceResult<{ xml: string; fileName: string; findings: string[]; sha256: string }>> {
  try {
    if (invoice.tenantId !== tenantId || invoice.status !== 'draft' || !invoice.officeManaged) return { ok: false, error: 'Nur gespeicherte Rechnungsentwürfe können als XML vorbereitet werden.' };
    const fresh = await fetchOfficeInvoice(tenantId, invoice.id, role); if (!fresh.ok) return fresh;
    if (fresh.data.id !== invoice.id || fresh.data.tenantId !== tenantId || !fresh.data.officeManaged || fresh.data.status !== 'draft' || fresh.data.updatedAt !== invoice.updatedAt) return { ok: false, error: 'Die Rechnung wurde geändert. Bitte neu laden und die Vorschau erneut vorbereiten.' };
    const metadata = fresh.data.eInvoice;
    if (!metadata || metadata.format !== 'xrechnung') return { ok: false, error: 'Bitte im Rechnungsentwurf XRechnung auswählen und die Angaben speichern.' };
    const preview = await fetchOfficeInvoiceIssuePreview(tenantId, invoice.id, invoice.updatedAt, role); if (!preview.ok) return preview;
    const attachments: OfficeEInvoiceAttachment[] = [];
    for (const id of fresh.data.includeProofs ? fresh.data.selectedProofIds : []) {
      const proof = await downloadInvoiceProofAttachment(tenantId, fresh.data.clientId || '', fresh.data.servicePeriodStart || '', fresh.data.servicePeriodEnd || '', role, id, invoice.id);
      if (!proof.ok) return proof;
      let binary = '';
      for (let offset = 0; offset < proof.data.bytes.length; offset += 8192) binary += String.fromCharCode(...proof.data.bytes.subarray(offset, offset + 8192));
      attachments.push({ id, fileName: proof.data.fileName, description: proof.data.fileName.replace(/\.pdf$/i, ''), mimeType: 'application/pdf', base64: btoa(binary) });
    }
    const prepared = prepareOfficeInvoiceUbl(fresh.data, preview.data, metadata, attachments);
    const current = await fetchOfficeInvoiceIssuePreview(tenantId, invoice.id, invoice.updatedAt, role);
    if (!current.ok) return current;
    if (current.data.sourceRevision !== preview.data.sourceRevision || current.data.invoiceNumber !== preview.data.invoiceNumber) return { ok: false, error: 'Die Rechnungsgrundlage wurde während der Vorschau geändert. Bitte erneut vorbereiten.' };
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(prepared.bytes))), value => value.toString(16).padStart(2, '0')).join('');
    return { ok: true, data: { xml: prepared.xml, fileName: prepared.fileName, sha256, findings: [prepared.validation.message, 'Die vorgeschlagene Rechnungsnummer wird erst bei erfolgreicher Ausstellung verbindlich vergeben.'] } };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Der XML-Entwurf konnte nicht vorbereitet werden.' }; }
}

export async function downloadOfficeIssuedEInvoice(tenantId: string, invoiceId: string, role?: RoleKey | null): Promise<ServiceResult<{ bytes: Uint8Array; fileName: string; validationMessage: string }>> {
  const denied = enforcePermission<{ bytes: Uint8Array; fileName: string; validationMessage: string }>(role, 'office.invoices.view'); if (denied) return denied;
  const blocked = guardServiceTenant(tenantId); if (blocked) return blocked;
  try {
    if (!isOfficeInvoiceUuid(invoiceId)) throw new Error('Die Rechnungskennung ist ungültig.');
    const db = getSupabaseClient(); if (!db) throw new Error('Die Datenbank ist nicht erreichbar.');
    const rpc = db as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }> };
    const result = await rpc.rpc('office_einvoice_artifact_read', { p_tenant_id: tenantId, p_invoice_id: invoiceId });
    if (result.error) throw new Error(result.error.message || 'Die ausgestellte XML-Datei ist nicht verfügbar.');
    const data = (Array.isArray(result.data) ? result.data[0] : result.data) as Record<string, unknown> | null;
    if (!data || typeof data.xml_base64 !== 'string' || data.xml_base64.length > Math.ceil(5 * 1024 * 1024 / 3) * 4 + 200000 || typeof data.file_name !== 'string' || typeof data.xml_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(data.xml_sha256)) throw new Error('Das Rechnungsarchiv ist unvollständig.');
    const binary = atob(data.xml_base64.replace(/[\r\n]/g, ''));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('Die XML-Datei überschreitet die zulässige Größe.');
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), n => n.toString(16).padStart(2, '0')).join('');
    if (hash !== data.xml_sha256) throw new Error('Die XML-Datei stimmt nicht mit ihrer gespeicherten Prüfsumme überein.');
    const report = data.report as Record<string, unknown> | undefined;
    if (!report || report.status !== 'valid' || report.documentSha256 !== hash || report.source !== 'server') throw new Error('Das Prüfergebnis der ausgestellten XML-Datei fehlt.');
    return { ok: true, data: { bytes, fileName: data.file_name, validationMessage: 'Die unveränderte ausgestellte XML-Datei hat die Schema- und Geschäftsregelprüfung bestanden.' } };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Die ausgestellte XML-Datei konnte nicht geladen werden.' }; }
}
