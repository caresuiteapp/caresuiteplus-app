import type { PdfClient } from './pdfUploadHandler.ts';

type Row = Record<string, unknown>;
type Dependencies = { serviceClient: () => PdfClient; respond: (body: unknown, status?: number) => Response; fetch?: typeof fetch };
const VALIDATOR_URL = 'https://www.caresuiteplus.app/api/einvoice/validate';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const row = (value: unknown): Row => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const one = (value: unknown): Row => row(Array.isArray(value) ? value[0] : value);
class ValidationResponseError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
async function boundedJson(response: Response): Promise<Row> {
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Die vollständige Formatprüfung ist gerade nicht erreichbar. Bitte erneut versuchen.');
  const reader = response.body?.getReader(); if (!reader) throw new Error('Die Formatprüfung hat kein Ergebnis geliefert.');
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const part = await reader.read(); if (part.done) break;
    length += part.value.length;
    if (length > 4 * 1024 * 1024) { await reader.cancel(); throw new Error('Das Prüfergebnis mit Anlagen überschreitet die zulässige Größe.'); }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let result: Row;
  try { result = row(JSON.parse(new TextDecoder().decode(bytes))); }
  catch { throw new Error('Die Formatprüfung hat kein lesbares Ergebnis geliefert. Bitte erneut versuchen.'); }
  if (!response.ok) {
    // Only this fixed, authenticated first-party endpoint supplies these bounded
    // user-facing errors. Never relay infrastructure HTML or unexpected bodies.
    if ([400, 403, 404, 409, 422].includes(response.status) && result.ok === false && typeof result.error === 'string' && result.error.length > 0 && result.error.length <= 4000) {
      throw new ValidationResponseError(result.error, response.status);
    }
    throw new Error('Die vollständige Formatprüfung ist gerade nicht erreichbar. Bitte erneut versuchen.');
  }
  return result;
}
/** The caller is authenticated by the existing PDF handler; only this server invokes the trusted validation write RPCs. */
export function createEInvoiceValidationHandler(dependencies: Dependencies) {
  return async (input: Row, authorization: string, userId: string, userClient: PdfClient): Promise<Response> => {
    const respond = dependencies.respond;
    try {
      const tenantId = text(input.tenantId), incoming = input.action === 'validate_einvoice_inbox';
      const entityId = text(incoming ? input.documentId : input.invoiceId);
      if (!UUID.test(tenantId) || !UUID.test(entityId) || (!incoming && !Number.isFinite(Date.parse(text(input.expectedUpdatedAt))))) return respond({ ok: false, error: 'Die Rechnungsauswahl oder ihr Bearbeitungsstand ist ungültig.' }, 400);
      const service = dependencies.serviceClient();
      const actor = await service.from('profiles').select('id,tenant_id,role_id,is_active,status,auth_user_id')
        .or(`auth_user_id.eq.${userId},and(auth_user_id.is.null,id.eq.${userId})`).maybeSingle();
      if (actor.error || !actor.data || actor.data.tenant_id !== tenantId || actor.data.is_active !== true || actor.data.status !== 'active') return respond({ ok: false, error: 'Keine aktive Berechtigung für diesen Mandanten.' }, 403);
      const role = await service.from('roles').select('*').eq('id', actor.data.role_id).single();
      if (role.error || !role.data || ['employee_portal','client_portal','family_portal','employee','caregiver','nurse','client','family','relative'].includes(text(role.data.key).toLowerCase()) || role.data.tenant_id != null && role.data.tenant_id !== tenantId) return respond({ ok: false, error: 'Die Verwaltungsberechtigung fehlt.' }, 403);
      const permission = await userClient.rpc('has_permission', { p_permission_key: incoming ? 'office.invoices.create' : 'office.invoices.status_change' });
      const administrator = role.data.is_admin_role === true || ['owner','admin','business_admin'].includes(text(role.data.key));
      if (permission.error || permission.data !== true && !administrator) return respond({ ok: false, error: 'Die Berechtigung zur Rechnungsprüfung fehlt.' }, 403);
      let preview: Row = {}, original: Row = {};
      if (incoming) {
        const read = await userClient.rpc('office_einvoice_inbox_read', { p_tenant_id: tenantId, p_document_id: entityId, p_limit: 1, p_offset: 0, p_include_original: false });
        const items = one(read.data).items;
        if (read.error || !Array.isArray(items) || items.length !== 1 || row(items[0]).id !== entityId || row(items[0]).tenant_id !== tenantId) return respond({ ok: false, error: 'Der Rechnungseingang wurde nicht gefunden.' }, 404);
        original = row(items[0]);
      } else {
        const read = await userClient.rpc('office_invoice_issue_preview', { p_tenant_id: tenantId, p_invoice_id: entityId, p_expected_updated_at: input.expectedUpdatedAt });
        preview = one(read.data);
        if (read.error || !text(preview.source_revision) || preview.source_revision !== input.sourceRevision || preview.invoice_number !== input.invoiceNumber) return respond({ ok: false, error: 'Die Rechnung wurde inzwischen geändert. Bitte die Vorschau erneut vorbereiten.' }, 409);
      }
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 45000);
      let checked: Row;
      try {
        const response = await (dependencies.fetch ?? fetch)(VALIDATOR_URL, { method: 'POST', redirect: 'error', signal: controller.signal,
          headers: { Authorization: authorization, 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId, ...(incoming ? { documentId: entityId } : { invoiceId: entityId, expectedUpdatedAt: input.expectedUpdatedAt, sourceRevision: preview.source_revision, invoiceNumber: preview.invoice_number }) }) });
        checked = await boundedJson(response);
      } finally { clearTimeout(timeout); }
      const report = row(checked.validation);
      if (checked.ok !== true || report.source !== 'server' || !HASH.test(text(report.documentSha256)) || checked.xmlSha256 !== report.documentSha256) return respond({ ok: false, error: text(checked.error) || 'Das Ergebnis der Formatprüfung konnte nicht bestätigt werden.' }, 503);
      if (incoming) {
        if (checked.originalSha256 !== original.original_sha256 || checked.xmlSha256 !== original.extracted_xml_sha256) return respond({ ok: false, error: 'Das Prüfergebnis gehört nicht zur gespeicherten Originaldatei.' }, 409);
        const recorded = await service.rpc('office_einvoice_inbox_validation', { p_tenant_id: tenantId, p_document_id: entityId,
          p_original_sha256: original.original_sha256, p_report: report, p_actor_id: userId });
        if (recorded.error) return respond({ ok: false, error: 'Das Prüfergebnis konnte nicht gespeichert werden. Bitte erneut prüfen.' }, 503);
        return respond({ ok: true, documentId: entityId, validation: report });
      }
      if (report.status !== 'valid') {
        const messages = Array.isArray(report.findings) ? report.findings.map(finding => text(row(finding).message)).filter(Boolean).slice(0, 12) : [];
        return respond({ ok: false, error: messages.join(' ') || 'Die vollständige Formatprüfung wurde nicht bestanden. Die Rechnung wurde nicht ausgestellt.', validation: report }, 422);
      }
      if (checked.sourceRevision !== preview.source_revision || checked.invoiceNumber !== preview.invoice_number || typeof checked.xmlBase64 !== 'string' || checked.xmlBase64.length > 3500000) return respond({ ok: false, error: 'Die geprüften Ausstellungsdaten stimmen nicht überein.' }, 409);
      let xmlBytes: Uint8Array;
      try { xmlBytes = Uint8Array.from(atob(checked.xmlBase64), character => character.charCodeAt(0)); } catch { return respond({ ok: false, error: 'Die geprüfte XML-Datei ist beschädigt.' }, 503); }
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(xmlBytes))), value => value.toString(16).padStart(2, '0')).join('');
      if (hash !== checked.xmlSha256) return respond({ ok: false, error: 'Die XML-Prüfsumme stimmt nicht mit dem Prüfergebnis überein.' }, 409);
      const recorded = await service.rpc('office_einvoice_record_validation', { p_tenant_id: tenantId, p_invoice_id: entityId,
        p_expected_updated_at: input.expectedUpdatedAt, p_source_revision: preview.source_revision, p_invoice_number: preview.invoice_number,
        p_xml_base64: checked.xmlBase64, p_report: report, p_actor_id: userId });
      const receipt = one(recorded.data);
      if (recorded.error || receipt.xml_sha256 !== hash) return respond({ ok: false, error: 'Die geprüfte XML-Datei konnte nicht für diesen Rechnungsstand gesichert werden. Bitte erneut versuchen.' }, 409);
      return respond({ ok: true, invoiceId: entityId, xmlSha256: hash, invoiceNumber: preview.invoice_number, sourceRevision: preview.source_revision, validation: report });
    } catch (error) {
      if (error instanceof ValidationResponseError) return respond({ ok: false, error: error.message }, error.status);
      return respond({ ok: false, error: error instanceof Error && error.name !== 'AbortError' ? error.message : 'Die Formatprüfung konnte nicht abgeschlossen werden. Bitte erneut versuchen.' }, 503);
    }
  };
}
