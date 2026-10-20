import { createHash } from 'node:crypto';
import { prepareOfficeInvoiceUbl, OFFICE_XRECHNUNG_CUSTOMIZATION, type OfficeEInvoiceUblSource } from '../../src/lib/office/eInvoiceUbl.web';
import { normalizeOfficeEInvoiceLineTax, normalizeOfficeEInvoiceMetadata } from '../../src/lib/office/eInvoiceModel.web';
import { calculateOfficeInvoiceLines, type OfficeInvoiceDraftLine, type OfficeInvoiceIssuePreview } from '../../src/lib/office/invoiceWorkspaceTypes.web';
import type { OfficeEInvoiceAttachment } from '../../src/lib/office/eInvoiceTypes.web';

type Row = Record<string, unknown>;
export type EInvoiceValidationRequest = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
export type EInvoiceValidationResponse = { status(code: number): EInvoiceValidationResponse; setHeader(name: string, value: string): void; json(body: unknown): unknown };
type ValidatorResult = { status: string; documentSha256: string; source: string };
type Dependencies = { fetch: typeof fetch; validate: (input: { xml: Uint8Array; expectedProfileId?: string }) => Promise<ValidatorResult>;
  extractPdfXml: (original: Uint8Array) => Promise<Uint8Array>;
  env: { EXPO_PUBLIC_SUPABASE_URL?: string; EXPO_PUBLIC_SUPABASE_ANON_KEY?: string } };
const MAX_OUTGOING_XML = 2.5 * 1024 * 1024;
const MAX_INCOMING_XML = 5 * 1024 * 1024;
const MAX_ORIGINAL = 10 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const text = (value: unknown) => typeof value === 'string' ? value : '';
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
class RequestError extends Error { constructor(readonly status: number, message: string) { super(message); } }
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function money(value: unknown): number {
  if (typeof value !== 'number' && typeof value !== 'string' || value === '') throw new RequestError(422, 'Ein gespeicherter Geldbetrag fehlt.');
  const number = Number(value); const cents = Math.round(number * 100);
  if (!Number.isFinite(number) || number < 0 || !Number.isSafeInteger(cents) || Math.abs(number * 100 - cents) > 0.0001) throw new RequestError(422, 'Ein gespeicherter Geldbetrag ist ungültig.');
  return cents;
}
function number(value: unknown): number {
  if (typeof value !== 'number' && typeof value !== 'string' || value === '' || !Number.isFinite(Number(value))) throw new RequestError(422, 'Eine gespeicherte Rechnungsposition ist ungültig.');
  return Number(value);
}
function decodeBase64(value: unknown, maxBytes: number): Uint8Array {
  // PostgreSQL encode(bytea, 'base64') inserts line breaks every 76 characters.
  // Accept only CR/LF wrapping, never arbitrary ignored characters.
  if (typeof value !== 'string' || !value || value.length > Math.ceil(maxBytes / 3) * 4 * 1.04 + 2) throw new RequestError(422, 'Die gespeicherte Originaldatei ist beschädigt oder zu groß.');
  const canonical = value.replace(/[\r\n]/g, '');
  if (canonical.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(canonical)) throw new RequestError(422, 'Die gespeicherte Originaldatei ist beschädigt oder zu groß.');
  const bytes = Buffer.from(canonical, 'base64');
  if (!bytes.length || bytes.length > maxBytes || bytes.toString('base64') !== canonical) throw new RequestError(422, 'Die gespeicherte Originaldatei ist beschädigt oder zu groß.');
  return bytes;
}
async function readLimited(response: Response, maxBytes: number): Promise<Uint8Array> {
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > maxBytes) { await response.body?.cancel(); throw new RequestError(413, 'Die geladenen Rechnungsdaten überschreiten die Verarbeitungsgrenze.'); }
  if (!response.body) throw new RequestError(502, 'Die Rechnungsdaten konnten nicht vollständig geladen werden.');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      total += part.value.length;
      if (total > maxBytes) { await reader.cancel(); throw new RequestError(413, 'Die geladenen Rechnungsdaten überschreiten die Verarbeitungsgrenze.'); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
function requestInput(body: unknown): { tenantId: string; documentId?: string; invoiceId?: string; expectedUpdatedAt?: string; sourceRevision?: string; invoiceNumber?: string } {
  let input: Row;
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > 8192) throw new RequestError(413, 'Die Prüfanfrage ist zu groß.');
    try { input = object(JSON.parse(body)); } catch { throw new RequestError(400, 'Die Prüfanfrage ist ungültig.'); }
  } else input = object(body);
  if (Object.keys(input).some(key => !['tenantId', 'documentId', 'invoiceId', 'expectedUpdatedAt', 'sourceRevision', 'invoiceNumber'].includes(key))) throw new RequestError(400, 'Die Prüfung akzeptiert ausschließlich gespeicherte Rechnungskennungen.');
  const tenantId = text(input.tenantId); const documentId = text(input.documentId); const invoiceId = text(input.invoiceId);
  if (!UUID.test(tenantId) || Boolean(documentId) === Boolean(invoiceId)) throw new RequestError(400, 'Die Rechnungszuordnung fehlt oder ist ungültig.');
  if (documentId) {
    if (!UUID.test(documentId) || Object.keys(input).some(key => !['tenantId', 'documentId'].includes(key))) throw new RequestError(400, 'Die Eingangsrechnungskennung ist ungültig.');
    return { tenantId, documentId };
  }
  const expectedUpdatedAt = text(input.expectedUpdatedAt); const sourceRevision = text(input.sourceRevision); const invoiceNumber = text(input.invoiceNumber);
  if (!UUID.test(invoiceId) || expectedUpdatedAt.length > 50 || !Number.isFinite(Date.parse(expectedUpdatedAt)) || !/^[0-9a-f]{32}$/.test(sourceRevision) || !invoiceNumber.trim() || invoiceNumber.length > 120) throw new RequestError(400, 'Der bestätigte Rechnungsstand fehlt. Bitte die Vorschau erneut öffnen.');
  return { tenantId, invoiceId, expectedUpdatedAt, sourceRevision, invoiceNumber };
}
function mapSource(snapshot: Row, tenantId: string, invoiceId: string): OfficeEInvoiceUblSource {
  const invoice = object(snapshot.invoice);
  if (invoice.tenant_id !== tenantId || invoice.id !== invoiceId || invoice.status !== 'draft' || invoice.office_managed !== true) throw new RequestError(409, 'Die Rechnung ist kein freigegebener Entwurf dieses Unternehmens.');
  if (!Array.isArray(snapshot.lines) || !snapshot.lines.length || snapshot.lines.length > 500) throw new RequestError(422, 'Die gespeicherten Rechnungspositionen fehlen oder sind zu umfangreich.');
  const items = snapshot.lines.map(object);
  const lines: OfficeInvoiceDraftLine[] = items.map(item => {
    if (item.tenant_id !== tenantId || item.invoice_id !== invoiceId || !UUID.test(text(item.id))) throw new RequestError(422, 'Eine Rechnungsposition gehört nicht zum bestätigten Entwurf.');
    return { id: text(item.id), description: text(item.description), quantity: number(item.quantity), unit: text(item.unit), unitPriceCents: money(item.unit_price),
      taxRatePercent: number(item.vat_rate), productKey: text(item.product_key) as OfficeInvoiceDraftLine['productKey'],
      serviceDate: text(item.service_date) || undefined, eInvoiceTax: normalizeOfficeEInvoiceLineTax(item.e_invoice_tax) };
  });
  const calculated = calculateOfficeInvoiceLines(lines);
  if (calculated.lines.some((line, index) => line.netCents !== money(items[index].net_amount) || line.taxCents !== money(items[index].vat_amount) || line.totalCents !== money(items[index].gross_amount))) throw new RequestError(422, 'Die gespeicherten Positionsbeträge stimmen nicht mit der XML-Berechnung überein.');
  if (!Array.isArray(invoice.selected_proof_ids) || invoice.selected_proof_ids.some(id => typeof id !== 'string')) throw new RequestError(422, 'Die gespeicherte Anlagenauswahl ist ungültig.');
  return { id: invoiceId, status: 'draft', invoiceDate: text(invoice.invoice_date), dueDate: text(invoice.due_date) || null,
    servicePeriodStart: text(invoice.service_period_from) || null, servicePeriodEnd: text(invoice.service_period_to) || null,
    amountCents: money(invoice.total_amount), notes: text(invoice.notes) || null, footerText: text(invoice.footer_text) || null,
    includeProofs: invoice.include_service_proofs === true, selectedProofIds: invoice.selected_proof_ids as string[], lines };
}

/** Authenticated, read-only handler. No submitted XML or client-side validation result can be attested. */
export function createEInvoiceValidationHandler(dependencies: Dependencies) {
  return async (request: EInvoiceValidationRequest, response: EInvoiceValidationResponse): Promise<unknown> => {
    response.setHeader('Cache-Control', 'private, no-store, max-age=0'); response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return response.status(405).json({ ok: false, error: 'Die Rechnungsprüfung erfordert POST.' }); }
    try {
      const authorization = request.headers.authorization;
      if (typeof authorization !== 'string' || !/^Bearer [A-Za-z0-9._~-]+$/.test(authorization) || authorization.length > 8192) throw new RequestError(401, 'Bitte erneut anmelden.');
      const input = requestInput(request.body);
      const rawUrl = dependencies.env.EXPO_PUBLIC_SUPABASE_URL; const apiKey = dependencies.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      let base: URL;
      try { base = new URL(rawUrl || ''); } catch { throw new RequestError(503, 'Die Rechnungsprüfung ist noch nicht verfügbar.'); }
      if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/' || !apiKey) throw new RequestError(503, 'Die Rechnungsprüfung ist noch nicht verfügbar.');
      const headers = { Authorization: authorization, apikey: apiKey, 'Content-Type': 'application/json' };
      const fetchAt = async (path: string, body?: Row): Promise<Response> => dependencies.fetch(`${base.origin}${path}`, {
        method: body ? 'POST' : 'GET', headers, ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(20_000) });
      const auth = await fetchAt('/auth/v1/user');
      if (!auth.ok) throw new RequestError(401, 'Bitte erneut anmelden.');
      let user: Row;
      try { user = object(JSON.parse(new TextDecoder().decode(await readLimited(auth, 256 * 1024)))); } catch { throw new RequestError(401, 'Bitte erneut anmelden.'); }
      if (!UUID.test(text(user.id))) throw new RequestError(401, 'Bitte erneut anmelden.');
      const rpc = async (name: string, body: Row, limit = 4 * 1024 * 1024): Promise<Row> => {
        const result = await fetchAt(`/rest/v1/rpc/${name}`, body);
        if (!result.ok) {
          // Never echo response bodies: they may contain identifiers, SQL internals or data.
          if (result.status === 401 || result.status === 403) throw new RequestError(403, 'Die Rechnung ist für diesen Zugang nicht freigegeben.');
          throw new RequestError(409, 'Die gespeicherten Rechnungsdaten sind nicht mehr freigegeben oder haben sich geändert. Bitte neu laden.');
        }
        const data = JSON.parse(new TextDecoder().decode(await readLimited(result, limit)));
        return object(Array.isArray(data) ? data[0] : data);
      };
      if (input.documentId) {
        const result = await rpc('office_einvoice_inbox_read', { p_tenant_id: input.tenantId, p_document_id: input.documentId, p_limit: 1, p_offset: 0, p_include_original: true }, 22 * 1024 * 1024);
        if (!Array.isArray(result.items) || result.items.length !== 1) throw new RequestError(404, 'Die Eingangsrechnung wurde nicht gefunden.');
        const item = object(result.items[0]);
        if (item.id !== input.documentId || item.tenant_id !== input.tenantId) throw new RequestError(403, 'Die Eingangsrechnung gehört nicht zu diesem Unternehmen.');
        const xml = decodeBase64(item.extracted_xml_base64, MAX_INCOMING_XML); const original = decodeBase64(item.original_base64, MAX_ORIGINAL);
        const xmlSha256 = sha256(xml); const originalSha256 = sha256(original);
        if (!SHA256.test(text(item.extracted_xml_sha256)) || xmlSha256 !== item.extracted_xml_sha256 || originalSha256 !== item.original_sha256) throw new RequestError(422, 'Die Originaldatei stimmt nicht mit dem gespeicherten Prüfnachweis überein.');
        const isPdf = new TextDecoder('ascii').decode(original.subarray(0, 1024)).trimStart().startsWith('%PDF-');
        if (isPdf) {
          let extracted: Uint8Array;
          try { extracted = await dependencies.extractPdfXml(new Uint8Array(original)); }
          catch { throw new RequestError(422, 'Die Original-PDF enthält keine eindeutig und sicher auslesbare Rechnungs-XML. Bitte den Absender um Prüfung bitten.'); }
          if (sha256(extracted) !== xmlSha256) throw new RequestError(422, 'Die gespeicherte XML-Datei stammt nicht aus dieser Original-PDF.');
        } else if (originalSha256 !== xmlSha256) throw new RequestError(422, 'Die gespeicherte XML-Datei stimmt nicht unverändert mit dem hochgeladenen Original überein.');
        const validation = await dependencies.validate({ xml });
        if (validation.source !== 'server' || validation.documentSha256 !== xmlSha256) throw new RequestError(502, 'Die Formatprüfung hat den geprüften Dateiinhalt nicht bestätigt.');
        return response.status(200).json({ ok: true, validation, xmlSha256, originalSha256 });
      }
      const previewArgs = { p_tenant_id: input.tenantId, p_invoice_id: input.invoiceId, p_expected_updated_at: input.expectedUpdatedAt };
      const canonical = await rpc('office_invoice_issue_preview', previewArgs);
      const checkRevision = (result: Row) => {
        if (result.source_revision !== input.sourceRevision || result.invoice_number !== input.invoiceNumber) throw new RequestError(409, 'Rechnungsnummer oder Daten wurden inzwischen geändert. Bitte die Vorschau erneut laden.');
      };
      checkRevision(canonical);
      const snapshot = object(canonical.snapshot); const source = mapSource(snapshot, input.tenantId, input.invoiceId!);
      const invoice = object(snapshot.invoice);
      if (Date.parse(text(invoice.updated_at)) !== Date.parse(input.expectedUpdatedAt!)) throw new RequestError(409, 'Der Rechnungsstand hat sich geändert. Bitte neu laden.');
      const preview: OfficeInvoiceIssuePreview = { invoiceNumber: text(canonical.invoice_number), sourceRevision: text(canonical.source_revision), companySnapshot: object(canonical.company_snapshot) };
      const metadata = normalizeOfficeEInvoiceMetadata(invoice.e_invoice_metadata);
      if (!Array.isArray(snapshot.proofs) || snapshot.proofs.length > 30) throw new RequestError(422, 'Die bestätigte Anlagenauswahl ist ungültig.');
      const proofs = snapshot.proofs.map(object); const expectedIds = source.includeProofs ? source.selectedProofIds : [];
      if (proofs.length !== expectedIds.length || new Set(proofs.map(item => item.id)).size !== proofs.length || proofs.some(proof => !expectedIds.includes(text(proof.id)))) throw new RequestError(422, 'Die bestätigten Nachweise stimmen nicht mit der Rechnung überein.');
      const attachments: OfficeEInvoiceAttachment[] = []; let totalProofBytes = 0;
      for (const proof of proofs) {
        const path = text(proof.path); const hash = text(proof.sha256).replace(/^sha256:/, '');
        if (!path.startsWith(`tenant/${input.tenantId}/`) || path.split('/').some(part => !part || part === '.' || part === '..') || /[\\%?#:\u0000-\u0020]/.test(path) || !SHA256.test(hash)) throw new RequestError(422, 'Ein bestätigter Nachweis besitzt keinen sicheren Originalverweis.');
        const download = await fetchAt(`/storage/v1/object/authenticated/office-documents/${path.split('/').map(encodeURIComponent).join('/')}`);
        if (!download.ok) throw new RequestError(422, 'Ein ausgewählter Originalnachweis ist nicht mehr verfügbar.');
        const bytes = await readLimited(download, MAX_OUTGOING_XML);
        totalProofBytes += bytes.length;
        if (totalProofBytes > MAX_OUTGOING_XML * 0.70) throw new RequestError(413, 'Die Originalnachweise sind für die strukturierte Rechnung zu groß. Bitte die Anlagenauswahl verkleinern.');
        if (!bytes.length || !new TextDecoder('ascii').decode(bytes.subarray(0, 1024)).includes('%PDF-') || sha256(bytes) !== hash) throw new RequestError(422, 'Ein Originalnachweis stimmt nicht mit dem bestätigten Inhalt überein.');
        attachments.push({ id: text(proof.id), fileName: `Leistungsnachweis-${text(proof.id).replace(/^record:/, '')}.pdf`, description: `Leistungsnachweis ${text(proof.service_date)}`,
          mimeType: 'application/pdf', base64: Buffer.from(bytes).toString('base64') });
      }
      let prepared;
      try { prepared = prepareOfficeInvoiceUbl(source, preview, metadata, attachments, 'issue'); }
      catch (error) { throw new RequestError(422, error instanceof Error ? error.message.slice(0, 2000) : 'Die gespeicherten Rechnungsangaben sind unvollständig.'); }
      if (prepared.bytes.length > MAX_OUTGOING_XML) throw new RequestError(413, 'Die strukturierte Rechnung überschreitet 2,5 MB. Bitte die Anlagenauswahl verkleinern.');
      const xmlSha256 = sha256(prepared.bytes);
      const validation = await dependencies.validate({ xml: prepared.bytes, expectedProfileId: OFFICE_XRECHNUNG_CUSTOMIZATION });
      if (validation.source !== 'server' || validation.documentSha256 !== xmlSha256) throw new RequestError(502, 'Die Formatprüfung hat den geprüften Dateiinhalt nicht bestätigt.');
      // A long-running validation must not return a superseded source as the current draft.
      checkRevision(await rpc('office_invoice_issue_preview', previewArgs));
      const result = { ok: true, validation, xmlBase64: Buffer.from(prepared.bytes).toString('base64'), xmlSha256, invoiceNumber: preview.invoiceNumber, sourceRevision: preview.sourceRevision };
      if (Buffer.byteLength(JSON.stringify(result)) > 3.9 * 1024 * 1024) throw new RequestError(413, 'Der Prüfbericht mit Rechnung ist zu groß. Bitte die Anlagenauswahl verkleinern.');
      return response.status(200).json(result);
    } catch (error) {
      const known = error instanceof RequestError;
      return response.status(known ? error.status : 503).json({ ok: false, error: known ? error.message : 'Die Rechnungsprüfung konnte nicht abgeschlossen werden. Bitte erneut versuchen.' });
    }
  };
}
