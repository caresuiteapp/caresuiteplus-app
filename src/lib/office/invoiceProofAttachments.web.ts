import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { fetchAllPortalRows } from '@/lib/portal/portalRowPagination';
import { isTenantStoragePath } from '@/lib/storage/storagePaths';
import { isOfficeInvoiceDate } from './invoiceWorkspaceTypes.web';

export type InvoiceProofAttachment = {
  id: string; title: string; serviceDate: string; status: string;
  available: boolean; unavailableReason: string | null;
};
type ProofSource = InvoiceProofAttachment & { storagePath: string; expectedHash: string | null; invoiceId: string | null };
export type InvoiceProofPage = { title: string; sourcePage: number; sourcePages: number; dataUrl: string; width: number; height: number };
type Renderer = { render: (bytes: Uint8Array, title: string, remainingPages: number) => Promise<InvoiceProofPage[]> };
declare global { interface Window { CareSuiteInvoicePdfV1?: Renderer } }

const text = (input: unknown) => typeof input === 'string' ? input.trim() : '';
const object = (input: unknown): Record<string, unknown> => input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};

/** Only stored signed PDFs are annex candidates. No generation, release or uploads. */
async function readProofSources(tenantId: string, clientId: string, start: string, end: string, actorRoleKey?: RoleKey | null): Promise<ServiceResult<ProofSource[]>> {
  const denied = enforcePermission<ProofSource[]>(actorRoleKey, 'office.invoices.view');
  if (denied) return denied;
  if (!tenantId || !clientId || !isOfficeInvoiceDate(start) || !isOfficeInvoiceDate(end) || end < start) return { ok: false, error: 'Bitte Klient:in und einen gültigen Leistungszeitraum auswählen.' };
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Die Leistungsnachweise können gerade nicht geladen werden.' };
  const result = await fetchAllPortalRows<Record<string, unknown> & { id: string }>((from, to) => fromUnknownTable(client, 'service_records')
    .select('id,tenant_id,client_id,assignment_id,record_number,service_date,status,source_receipt,billed_invoice_id', { count: 'exact' })
    .eq('tenant_id', tenantId).eq('client_id', clientId).gte('service_date', start).lte('service_date', end)
    .order('service_date').order('id').range(from, to));
  if (!result.ok) return { ok: false, error: 'Leistungsnachweise konnten nicht vollständig geprüft werden. Bitte erneut laden.' };
  if (result.data.some(row => row.tenant_id !== tenantId || row.client_id !== clientId)) return { ok: false, error: 'Die Zuordnung eines Leistungsnachweises ist ungültig.' };
  const sources = result.data.map(row => {
    const receipt = object(row.source_receipt);
    const storagePath = text(receipt.pdf_storage_path);
    const status = text(row.status);
    const serviceDate = text(row.service_date).slice(0, 10);
    const signed = ['signed', 'approved', 'billable', 'billed'].includes(status);
    const correctScope = receipt.tenant_id === tenantId && receipt.client_id === clientId;
    const attested = Boolean(text(row.assignment_id)) && receipt.assignment_id === row.assignment_id &&
      receipt.version === 'workflow-assignment-record-v1' && /^(sha256:)?[0-9a-f]{64}$/.test(text(receipt.pdf_sha256));
    const unavailableReason = !signed ? 'Der Leistungsnachweis ist noch nicht unterschrieben oder freigegeben.'
      : !attested || !correctScope || !storagePath ? 'Die Original-PDF ist nicht verlässlich bestätigt. Bitte den Einsatzabschluss prüfen.'
      : !isOfficeInvoiceDate(serviceDate) || serviceDate < start || serviceDate > end ? 'Der Leistungsnachweis liegt außerhalb des Rechnungszeitraums.'
      : !isTenantStoragePath(storagePath, tenantId) ? 'Der gespeicherte PDF-Verweis ist ungültig.' : null;
    return { id: `record:${row.id}`, title: text(row.record_number) ? `Leistungsnachweis ${text(row.record_number)}` : `Leistungsnachweis ${serviceDate}`,
      serviceDate, status, storagePath, expectedHash: text(receipt.pdf_sha256) || null, invoiceId: text(row.billed_invoice_id) || null,
      available: unavailableReason === null, unavailableReason };
  });
  return { ok: true, data: sources };
}

export async function listInvoiceProofAttachments(tenantId: string, clientId: string, start: string, end: string, actorRoleKey?: RoleKey | null, invoiceId?: string): Promise<ServiceResult<InvoiceProofAttachment[]>> {
  const result = await readProofSources(tenantId, clientId, start, end, actorRoleKey);
  return result.ok ? { ok: true, data: result.data.map(({ storagePath: _path, expectedHash: _hash, invoiceId: linked, ...item }) => linked && linked !== invoiceId ? { ...item, available: false, unavailableReason: 'Dieser Nachweis ist bereits einer anderen Rechnung zugeordnet.' } : item) } : result;
}

export async function downloadInvoiceProofAttachment(tenantId: string, clientId: string, start: string, end: string, actorRoleKey: RoleKey | null | undefined, proofId: string, invoiceId?: string): Promise<ServiceResult<{ fileName: string; bytes: Uint8Array; validation: { errors: string[]; warnings: string[] } }>> {
  try {
    const result = await readProofSources(tenantId, clientId, start, end, actorRoleKey);
    if (!result.ok) return result;
    const proof = result.data.find(item => item.id === proofId);
    if (!proof || !proof.available || proof.invoiceId && proof.invoiceId !== invoiceId) return { ok: false, error: proof?.unavailableReason || 'Der Leistungsnachweis ist nicht für diese Rechnung verfügbar.' };
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: 'Die PDF-Verbindung ist nicht verfügbar.' };
    const downloaded = await client.storage.from('office-documents').download(proof.storagePath);
    if (downloaded.error || !downloaded.data) return { ok: false, error: 'Die Original-PDF konnte nicht geladen werden.' };
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    await validateInvoicePdfBytes(bytes, proof.expectedHash);
    return { ok: true, data: { fileName: `${proof.title.replace(/[^a-zA-Z0-9ÄÖÜäöüß._-]+/g, '_')}.pdf`, bytes, validation: { errors: [], warnings: [] } } };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Die Original-PDF konnte nicht geladen werden.' }; }
}

let pending: Promise<Renderer> | undefined;
async function renderer(): Promise<Renderer> {
  if (typeof document === 'undefined') throw new Error('Die Anlagenvorschau benötigt einen Webbrowser.');
  if (!pending) pending = new Promise<Renderer>((resolve, reject) => {
    if (window.CareSuiteInvoicePdfV1) { resolve(window.CareSuiteInvoicePdfV1); return; }
    const script = document.createElement('script');
    script.type = 'module'; script.src = '/calendar-reader/v1/invoice-pdf.mjs';
    const fail = () => { clearTimeout(timer); script.remove(); pending = undefined; reject(new Error('Die PDF-Anlagen konnten nicht vorbereitet werden. Bitte erneut versuchen.')); };
    const timer = window.setTimeout(fail, 30_000);
    script.onerror = fail;
    script.onload = () => { clearTimeout(timer); if (window.CareSuiteInvoicePdfV1) resolve(window.CareSuiteInvoicePdfV1); else fail(); };
    document.head.appendChild(script);
  });
  return pending;
}

export async function validateInvoicePdfBytes(bytes: Uint8Array, expectedHash?: string | null): Promise<void> {
  if (!bytes.length || bytes.length > 20 * 1024 * 1024 || !new TextDecoder().decode(bytes.slice(0, 1024)).includes('%PDF-')) throw new Error('Eine gespeicherte Datei ist keine gültige PDF oder überschreitet 20 MB.');
  if (expectedHash) {
    const hash = expectedHash.replace(/^sha256:/, '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('Der Prüfnachweis der gespeicherten PDF ist ungültig.');
    const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
    const actual = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    if (actual !== hash) throw new Error('Die gespeicherte PDF stimmt nicht mit dem bestätigten Leistungsnachweis überein.');
  }
}

export async function loadInvoiceProofPages(input: { tenantId: string; clientId: string; start: string; end: string; invoiceId: string; proofIds: string[]; actorRoleKey?: RoleKey | null }): Promise<InvoiceProofPage[]> {
  if (!input.proofIds.length) return [];
  if (input.proofIds.length > 30 || new Set(input.proofIds).size !== input.proofIds.length) throw new Error('Bitte höchstens 30 unterschiedliche Leistungsnachweise auswählen.');
  const result = await readProofSources(input.tenantId, input.clientId, input.start, input.end, input.actorRoleKey);
  if (!result.ok) throw new Error(result.error);
  const selected = input.proofIds.map(id => {
    const proof = result.data.find(row => row.id === id);
    if (!proof) throw new Error('Ein ausgewählter Leistungsnachweis ist nicht mehr für diese Rechnung verfügbar. Bitte die Auswahl neu laden.');
    if (!proof.available) throw new Error(`${proof.title}: ${proof.unavailableReason}`);
    if (proof.invoiceId && proof.invoiceId !== input.invoiceId) throw new Error(`${proof.title} ist bereits einer anderen Rechnung zugeordnet.`);
    return proof;
  });
  const client = getSupabaseClient();
  if (!client) throw new Error('Die gespeicherten PDFs können gerade nicht geladen werden.');
  const pages: InvoiceProofPage[] = [];
  const seenPaths = new Set<string>();
  let totalBytes = 0;
  for (const proof of selected) {
    if (seenPaths.has(proof.storagePath)) continue;
    seenPaths.add(proof.storagePath);
    const download = await client.storage.from('office-documents').download(proof.storagePath);
    if (download.error || !download.data) throw new Error(`${proof.title}: Die gespeicherte PDF ist nicht zugänglich. Bitte den Nachweis in der Akte prüfen.`);
    if (download.data.size > 20 * 1024 * 1024) throw new Error(`${proof.title}: Die PDF überschreitet 20 MB.`);
    const bytes = new Uint8Array(await download.data.arrayBuffer());
    totalBytes += bytes.length;
    if (totalBytes > 50 * 1024 * 1024) throw new Error('Die ausgewählten Anlagen überschreiten zusammen 50 MB. Bitte die Auswahl verkleinern.');
    await validateInvoicePdfBytes(bytes, proof.expectedHash);
    pages.push(...await (await renderer()).render(bytes, proof.title, 100 - pages.length));
  }
  return pages;
}
