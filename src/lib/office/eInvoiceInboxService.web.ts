import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';
import { isOfficeInvoiceUuid } from './invoiceWorkspaceTypes.web';
import type { OfficeEInvoiceImportInspection, OfficeEInvoiceXmlPreview } from './eInvoiceImport.web';
import type { OfficeEInvoiceInboxRecord, OfficeEInvoiceInboxReview, OfficeEInvoiceOriginal } from './eInvoiceInboxTypes.web';

type Row = Record<string, unknown>;
const MAX_ORIGINAL = 10 * 1024 * 1024;
const MAX_XML = 5 * 1024 * 1024;
const HASH = /^[a-f0-9]{64}$/;
const string = (value: unknown) => typeof value === 'string' ? value : '';
const row = (value: unknown): Row => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const fail = (error: unknown): { ok: false; error: string } => ({ ok: false, error: error instanceof Error ? error.message : 'Der Rechnungseingang konnte nicht verarbeitet werden.' });
function access<T>(tenantId: string, role: RoleKey | null | undefined, permission: 'office.invoices.view' | 'office.invoices.create' | 'office.invoices.status_change'): ServiceResult<T> | null {
  const denied = enforcePermission<T>(role, permission); if (denied) return denied;
  const blocked = guardServiceTenant(tenantId); if (blocked) return blocked;
  if (getServiceMode() !== 'supabase') return { ok: false, error: 'Der Rechnungseingang benötigt eine verbundene Datenbank.' };
  return null;
}
async function rpc(name: string, parameters: Row): Promise<Row> {
  const db = getSupabaseClient(); if (!db) throw new Error('Die Datenbank ist nicht erreichbar.');
  const client = db as unknown as { rpc: (name: string, args: Row) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }> };
  const result = await client.rpc(name, parameters);
  if (result.error) {
    if (result.error.code === 'PGRST202' || result.error.code === '42883') throw new Error('Der Rechnungseingang ist noch nicht freigeschaltet. Bitte nach der Aktualisierung erneut laden.');
    throw new Error(result.error.message || 'Der Vorgang konnte nicht gespeichert werden.');
  }
  const resultRow = row(Array.isArray(result.data) ? result.data[0] : result.data);
  if (!Object.keys(resultRow).length) throw new Error('Die Serverantwort ist unvollständig. Bitte erneut laden.');
  return resultRow;
}
function mapRecord(input: unknown, tenantId: string): OfficeEInvoiceInboxRecord {
  const value = row(input), inspection = row(value.inspection), preview = row(inspection.preview);
  if (!isOfficeInvoiceUuid(string(value.id)) || value.tenant_id !== tenantId ||
    !HASH.test(string(value.original_sha256)) || !HASH.test(string(value.extracted_xml_sha256)) ||
    !Number.isFinite(Date.parse(string(value.updated_at))) || !Number.isFinite(Date.parse(string(value.created_at))) ||
    !['unreviewed', 'reviewed', 'rejected'].includes(string(value.business_status)) ||
    !['ubl_invoice', 'ubl_credit_note', 'cii'].includes(string(preview.syntax)) ||
    !['supported', 'excluded', 'unknown'].includes(string(preview.profileSupport)) ||
    !Array.isArray(preview.lines) || !Array.isArray(preview.warnings) ||
    !Object.keys(row(preview.seller)).length || !Object.keys(row(preview.buyer)).length ||
    !Object.keys(row(preview.totals)).length || !['xml', 'hybrid_pdf'].includes(string(inspection.sourceKind))) {
    throw new Error('Ein Rechnungseingang enthält unvollständige Daten. Bitte erneut laden.');
  }
  const textFields = (entry: unknown, keys: string[]): boolean => keys.every(key => typeof row(entry)[key] === 'string');
  const texts = (entry: unknown): boolean => Array.isArray(entry) && entry.every(part => typeof part === 'string');
  if (!textFields(preview, ['rootNamespace','profileId','profileLabel','processId','invoiceNumber','invoiceTypeCode','issueDate','currency']) ||
    ['dueDate','buyerReference','paymentReference'].some(key => preview[key] !== undefined && typeof preview[key] !== 'string') ||
    ![preview.seller, preview.buyer].every(party => textFields(party, ['name','postalCode','city','country','taxId','vatId','endpointId','endpointScheme']) && texts(row(party).addressLines)) ||
    !textFields(preview.totals, ['payable','taxExclusive','taxInclusive','tax']) || !texts(preview.warnings) ||
    !(preview.lines as unknown[]).every(line => textFields(line, ['id','name','quantity','unitCode','unitPrice','lineTotal','taxCategory','taxRate']) && ['priceBaseQuantity','priceBaseUnitCode'].every(key => row(line)[key] === undefined || typeof row(line)[key] === 'string'))) {
    throw new Error('Die gespeicherte Rechnungsvorschau ist unvollständig. Das Original bleibt erhalten.');
  }
  const report = row(value.validation_report);
  const validStatuses = ['valid', 'invalid', 'unsupported', 'pending_validation', 'error'];
  const validationStatus = validStatuses.includes(string(value.format_status)) ? value.format_status as OfficeEInvoiceInboxRecord['validationStatus'] : 'pending_validation';
  const validationFindings = Array.isArray(report.findings) ? report.findings.map(finding => string(row(finding).message)).filter(Boolean) : [];
  const validationMessage = validationStatus === 'valid' ? 'Die gespeicherten XML-Daten haben die Schema- und Geschäftsregelprüfung bestanden. Die fachliche Prüfung erfolgt getrennt.'
    : validationStatus === 'invalid' ? 'Die XML-Formatprüfung hat Fehler gefunden. Bitte die Beanstandungen prüfen.'
    : validationStatus === 'unsupported' ? 'Für das erkannte Profil steht noch keine vollständige Normprüfung bereit.'
    : validationStatus === 'error' ? 'Die Formatprüfung konnte nicht abgeschlossen werden. Bitte erneut versuchen.'
    : 'Die Datei wurde eingelesen. Die vollständige XML-Formatprüfung steht noch aus.';
  // Imported preview metadata never supplies the format status. Only the server validation record does.
  return { id: string(value.id), tenantId, createdAt: string(value.created_at), updatedAt: string(value.updated_at),
    originalFileName: string(value.file_name), originalMimeType: string(value.mime_type), originalSha256: string(value.original_sha256),
    originalSize: Number(value.original_size), xmlSha256: string(value.extracted_xml_sha256), xmlFileName: string(inspection.xmlFileName) || 'rechnung.xml',
    sourceKind: inspection.sourceKind as 'xml' | 'hybrid_pdf', preview: preview as unknown as OfficeEInvoiceXmlPreview,
    reviewStatus: value.business_status as OfficeEInvoiceInboxRecord['reviewStatus'], reviewNote: string(value.review_note),
    validationStatus, validationMessage, validationFindings };
}
async function readOne(tenantId: string, id: string, includeOriginal = false): Promise<Row> {
  const result = await rpc('office_einvoice_inbox_read', { p_tenant_id: tenantId, p_document_id: id, p_limit: 1, p_offset: 0, p_include_original: includeOriginal });
  if (!Array.isArray(result.items) || result.items.length !== 1 || row(result.items[0]).id !== id) throw new Error('Der Rechnungseingang wurde nicht gefunden oder ist nicht mehr zugänglich.');
  return row(result.items[0]);
}
export async function fetchOfficeEInvoiceInbox(tenantId: string, role?: RoleKey | null): Promise<ServiceResult<OfficeEInvoiceInboxRecord[]>> {
  const denied = access<OfficeEInvoiceInboxRecord[]>(tenantId, role, 'office.invoices.view'); if (denied) return denied;
  try {
    const records: OfficeEInvoiceInboxRecord[] = [], seen = new Set<string>();
    let expectedTotal: number | undefined;
    for (let offset = 0; offset < 10000; offset += 100) {
      const page = await rpc('office_einvoice_inbox_read', { p_tenant_id: tenantId, p_document_id: null, p_limit: 100, p_offset: offset, p_include_original: false });
      if (!Array.isArray(page.items) || !Number.isSafeInteger(page.total) || Number(page.total) < 0) throw new Error('Die Liste konnte nicht vollständig geladen werden.');
      if (expectedTotal !== undefined && expectedTotal !== page.total) throw new Error('Der Rechnungseingang hat sich beim Laden geändert. Bitte erneut laden.');
      expectedTotal = Number(page.total);
      for (const item of page.items) {
        const mapped = mapRecord(item, tenantId);
        if (seen.has(mapped.id)) throw new Error('Der Rechnungseingang hat sich beim Laden geändert. Bitte erneut laden.');
        seen.add(mapped.id); records.push(mapped);
      }
      if (records.length === expectedTotal) return { ok: true, data: records };
      if (page.items.length < 100) throw new Error('Der Rechnungseingang wurde nicht vollständig übertragen. Bitte erneut laden.');
    }
    throw new Error('Der Rechnungseingang ist zu umfangreich für diese Ansicht.');
  } catch (error) { return fail(error); }
}
async function digest(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Die sichere Dateiprüfung ist in diesem Browser nicht verfügbar.');
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), n => n.toString(16).padStart(2, '0')).join('');
}
function encode(bytes: Uint8Array): string {
  let value = ''; for (let offset = 0; offset < bytes.length; offset += 8192) value += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(value);
}
function decode(value: unknown, max: number): Uint8Array {
  if (typeof value !== 'string' || value.length > Math.ceil(max / 3) * 4 + 300000 || !/^[A-Za-z0-9+/=\r\n]+$/.test(value)) throw new Error('Die gespeicherte Originaldatei ist unvollständig.');
  const binary = atob(value.replace(/[\r\n]/g, ''));
  if (!binary.length || binary.length > max) throw new Error('Die gespeicherte Originaldatei hat eine ungültige Größe.');
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
export async function saveOfficeEInvoiceImport(tenantId: string, inspection: OfficeEInvoiceImportInspection, role?: RoleKey | null): Promise<ServiceResult<{ record: OfficeEInvoiceInboxRecord; duplicate: boolean }>> {
  const denied = access<{ record: OfficeEInvoiceInboxRecord; duplicate: boolean }>(tenantId, role, 'office.invoices.create'); if (denied) return denied;
  try {
    if (!inspection.originalBytes.length || inspection.originalBytes.length > MAX_ORIGINAL || !inspection.xmlBytes.length || inspection.xmlBytes.length > MAX_XML) throw new Error('Die Originaldatei darf höchstens 10 MB und der XML-Inhalt höchstens 5 MB groß sein.');
    const [originalHash, xmlHash] = await Promise.all([digest(inspection.originalBytes), digest(inspection.xmlBytes)]);
    if (originalHash !== inspection.originalSha256 || xmlHash !== inspection.xmlSha256) throw new Error('Die Datei hat sich seit dem Einlesen geändert. Bitte erneut auswählen.');
    const { originalBytes: _original, xmlBytes: _xml, ...metadata } = inspection;
    const saved = await rpc('office_einvoice_inbox_mutation', { p_tenant_id: tenantId, p_request_id: crypto.randomUUID(), p_document_id: null,
      p_expected_updated_at: null, p_operation: 'import', p_payload: { file_name: inspection.originalFileName,
        mime_type: inspection.sourceKind === 'hybrid_pdf' ? 'application/pdf' : 'application/xml', original_base64: encode(inspection.originalBytes),
        original_sha256: originalHash, extracted_xml_base64: encode(inspection.xmlBytes), inspection: metadata } });
    if (!isOfficeInvoiceUuid(string(saved.document_id))) throw new Error('Die Speicherbestätigung ist unvollständig. Bitte die Liste neu laden.');
    return { ok: true, data: { record: mapRecord(await readOne(tenantId, string(saved.document_id)), tenantId), duplicate: saved.duplicate === true } };
  } catch (error) { return fail(error); }
}
export async function reviewOfficeEInvoiceInbox(tenantId: string, id: string, input: OfficeEInvoiceInboxReview, role?: RoleKey | null): Promise<ServiceResult<OfficeEInvoiceInboxRecord>> {
  const denied = access<OfficeEInvoiceInboxRecord>(tenantId, role, 'office.invoices.status_change'); if (denied) return denied;
  try {
    if (!isOfficeInvoiceUuid(id) || !Number.isFinite(Date.parse(input.expectedUpdatedAt)) || !['unreviewed', 'reviewed', 'rejected'].includes(input.status) || input.note.length > 4000) throw new Error('Die Prüfentscheidung ist unvollständig oder der Hinweis ist zu lang.');
    if (input.status === 'rejected' && input.note.trim().length < 5) throw new Error('Bitte den Grund für die Beanstandung angeben.');
    await rpc('office_einvoice_inbox_mutation', { p_tenant_id: tenantId, p_request_id: crypto.randomUUID(), p_document_id: id,
      p_expected_updated_at: input.expectedUpdatedAt, p_operation: 'review', p_payload: { business_status: input.status, review_note: input.note.trim() } });
    return { ok: true, data: mapRecord(await readOne(tenantId, id), tenantId) };
  } catch (error) { return fail(error); }
}
export async function downloadOfficeEInvoiceOriginal(tenantId: string, id: string, part: 'original' | 'xml', role?: RoleKey | null): Promise<ServiceResult<OfficeEInvoiceOriginal>> {
  const denied = access<OfficeEInvoiceOriginal>(tenantId, role, 'office.invoices.view'); if (denied) return denied;
  try {
    if (!isOfficeInvoiceUuid(id) || !['original', 'xml'].includes(part)) throw new Error('Die Dateiauswahl ist ungültig.');
    const value = await readOne(tenantId, id, true), record = mapRecord(value, tenantId);
    const bytes = decode(part === 'original' ? value.original_base64 : value.extracted_xml_base64, part === 'original' ? MAX_ORIGINAL : MAX_XML);
    if (await digest(bytes) !== (part === 'original' ? record.originalSha256 : record.xmlSha256)) throw new Error('Die Dateiprüfsumme stimmt nicht überein. Der Download wurde abgebrochen.');
    return { ok: true, data: { bytes, mimeType: part === 'original' ? record.originalMimeType : 'application/xml', fileName: part === 'original' ? record.originalFileName : record.xmlFileName } };
  } catch (error) { return fail(error); }
}
export async function validateOfficeEInvoiceInbox(tenantId: string, id: string, role?: RoleKey | null): Promise<ServiceResult<OfficeEInvoiceInboxRecord>> {
  const denied = access<OfficeEInvoiceInboxRecord>(tenantId, role, 'office.invoices.create'); if (denied) return denied;
  try {
    if (!isOfficeInvoiceUuid(id)) throw new Error('Die Rechnungskennung ist ungültig.');
    const result = await invokeEdgeFunction<{ documentId: string }>('render-document-pdf', { action: 'validate_einvoice_inbox', tenantId, documentId: id });
    if (!result.ok) return result;
    if (result.data.documentId !== id) throw new Error('Das Prüfergebnis gehört nicht zur ausgewählten Rechnung.');
    return { ok: true, data: mapRecord(await readOne(tenantId, id), tenantId) };
  } catch (error) { return fail(error); }
}
