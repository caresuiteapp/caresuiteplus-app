import { EMPTY_CLIENT_INTAKE_FORM, type ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { getIntakeSectionsForForm } from '@/lib/clients/clientIntakePlan';
import { validateIntakeStep } from '@/lib/clients/clientIntakeValidation';
import { isCostBearerTypeKey } from '@/lib/clients/clientIntakeCostBearerConfig';
import { CLIENT_FUNDING_SOURCE_KEYS } from '@/types/clients/clientFundingSource';
import { getSystemCatalog } from '@/lib/catalogs/systemCatalogs';
import { buildIntakePlaceholderContext, resolveContractTemplateKeys, type IntakeTenantDisplay } from './buildIntakeDocumentContext';
import { finalizeIntakeDocumentHtml, renderIntakeDocumentHtml } from './renderIntakeDocumentPreview';
import { mapSystemRow, mapTenantRow, type SystemTemplateRow, type TenantTemplateRow } from './intakeTemplateMapping';
import { getIntakeRenderBindingError, isIntakeRenderTimestamp } from './intakeDocumentRenderBinding';
import { ASSIGNMENT_TEMPLATE_KEY, OPTIONAL_CONSENT_TEMPLATE_KEYS, PRIVACY_TEMPLATE_KEY, type IntakeDocumentState, type IntakeDocumentTemplate, type IntakeSignatureRole } from './intakeDocumentTypes';

export type IntakeTemplateRow = Record<string, unknown>;
export type VerifiedIntakeDocument = IntakeDocumentState & {
  contentHash: string; templateUpdatedAt: string; systemTemplateUpdatedAt: string;
  systemTemplateSnapshot: IntakeTemplateRow; tenantTemplateSnapshot: IntakeTemplateRow | null; tenantDisplaySnapshot?: IntakeTemplateRow;
};
const roles: IntakeSignatureRole[] = ['client', 'employee', 'legal_representative'];
function fail(message: string): never { throw new Error(message); }
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
export async function intakeSha256(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  return 'sha256:' + [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

/** Full draft data is preserved; this function validates without normalizing it. */
export function requireCompleteIntakeForm(value: unknown): ClientIntakeFormData {
  if (!record(value) || JSON.stringify(value).length > 24 * 1024 * 1024) fail('Der gespeicherte Aufnahmeentwurf ist ungültig oder zu groß.');
  for (const [key, initial] of Object.entries(EMPTY_CLIENT_INTAKE_FORM)) {
    const field = value[key];
    if (key === 'intakeDocumentHistory' && field === undefined) continue;
    if (typeof initial === 'string' && (typeof field !== 'string' || field.length > 20000)
      || typeof initial === 'boolean' && typeof field !== 'boolean') fail('Der gespeicherte Aufnahmeentwurf enthält ungültige Angaben.');
    if (Array.isArray(initial)) {
      if (!Array.isArray(field) || field.length > (key === 'intakeDocumentHistory' ? 64 : 128)) fail('Die gespeicherte Auswahl ist ungültig.');
      if (key !== 'intakeDocuments' && key !== 'intakeDocumentHistory' && field.some((item) => typeof item !== 'string' || item.length > 2000)) fail('Die gespeicherte Auswahl ist ungültig.');
    } else if (record(initial) && (!record(field) || Object.keys(field).length > 64 || Object.values(field).some((item) => typeof item !== 'string' || item.length > 2000))) fail('Eine gespeicherte Zuordnung ist ungültig.');
  }
  const form = value as unknown as ClientIntakeFormData;
  if (form.intakeWorkflowVersion !== undefined && form.intakeWorkflowVersion !== 2) fail('Die Version des Aufnahmeablaufs wird nicht unterstützt.');
  if (form.intakeStage === 'first_contact') fail('Bitte den Erstkontakt zuerst zur vollständigen Aufnahme ergänzen.');
  if (!form.careContexts.length || form.careContexts.some((key) => !getSystemCatalog('leistungsart').entries.some((entry) => entry.key === key))
    || form.costBearerTypes.some((key) => !isCostBearerTypeKey(key))
    || form.fundingSources.some((key) => !(CLIENT_FUNDING_SOURCE_KEYS as readonly string[]).includes(key))
    || form.intakeOptionalConsents.some((key) => !(OPTIONAL_CONSENT_TEMPLATE_KEYS as readonly string[]).includes(key))) fail('Leistungsart, Kostenträger oder Einwilligung ist nicht mehr verfügbar. Bitte die Auswahl prüfen.');
  if (new Set(form.careContexts).size !== form.careContexts.length || new Set(form.costBearerTypes).size !== form.costBearerTypes.length || new Set(form.fundingSources).size !== form.fundingSources.length) fail('Eine Auswahl ist mehrfach enthalten. Bitte den Entwurf erneut prüfen.');
  const selfPay = form.fundingSources.includes('selbstzahler');
  const statutory = form.fundingSources.some((key) => key !== 'selbstzahler');
  const expectedBilling = selfPay && statutory ? 'kombi' : selfPay ? 'selbstzahler' : statutory ? 'pflegekasse' : '';
  if (form.selfPay !== selfPay || form.billingType !== expectedBilling || form.billingTypes.length !== (expectedBilling ? 1 : 0) || expectedBilling && form.billingTypes[0] !== expectedBilling) fail('Die Finanzierungsarten und Abrechnung stimmen nicht überein. Bitte die Finanzierung erneut auswählen.');
  if (form.hourlyRate && (!/^\d{1,5}([.,]\d{1,2})?$/.test(form.hourlyRate.trim()) || Number(form.hourlyRate.replace(',', '.')) < 0)) fail('Der vereinbarte Stundensatz ist ungültig.');
  for (const section of getIntakeSectionsForForm(form)) {
    // Document obligations use the actual current database template below.
    if (section === 'vertraege_einwilligungen') continue;
    const errors = Object.values(validateIntakeStep(section, form));
    if (errors.length) fail(errors.filter(Boolean).join(' '));
  }
  return form;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
/** Original PNG bytes, no conversion or fabricated signature. */
export function requireIntakePng(dataUrl: unknown): Uint8Array {
  if (typeof dataUrl !== 'string' || dataUrl.length > 2_800_000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl)) fail('Eine Originalunterschrift muss als gültiges PNG vorliegen.');
  const encoded = dataUrl.slice(22);
  let bytes: Uint8Array;
  try { const binary = atob(encoded); if (btoa(binary) !== encoded) fail('Ungültige Signaturkodierung.'); bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0)); } catch { return fail('Ungültige Signaturkodierung.'); }
  if (bytes.length < 57 || bytes.length > 2 * 1024 * 1024 || ![137,80,78,71,13,10,26,10].every((byte, index) => bytes[index] === byte)) fail('Das Originalbild der Unterschrift ist unvollständig.');
  const view = new DataView(bytes.buffer); let offset = 8; let header = false; let image = false; let end = false;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset); if (length > bytes.length - offset - 12) fail('Das Originalbild der Unterschrift ist abgeschnitten.');
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== view.getUint32(offset + 8 + length)) fail('Das Originalbild der Unterschrift ist beschädigt.');
    if (!header && type !== 'IHDR') fail('Die Signaturbildstruktur ist ungültig.');
    if (type === 'IHDR') {
      if (header || length !== 13) fail('Die Signaturbildstruktur ist ungültig.'); header = true;
      const width = view.getUint32(offset + 8), height = view.getUint32(offset + 12);
      if (!width || !height || width > 4096 || height > 4096 || width * height > 4_000_000) fail('Die Abmessungen der Unterschrift sind ungültig.');
    }
    if (type === 'IDAT' && length > 0) image = true;
    if (type === 'IEND') { if (length || !image || offset + 12 !== bytes.length) fail('Die Signaturbildstruktur ist ungültig.'); end = true; break; }
    offset += 12 + length;
  }
  if (!header || !image || !end) fail('Das Originalbild der Unterschrift ist unvollständig.');
  return bytes;
}

async function verifyPngPixels(bytes: Uint8Array): Promise<void> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16), height = view.getUint32(20), depth = bytes[24], color = bytes[25];
  const depths: Record<number, number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
  if (!depths[color]?.includes(depth) || bytes[26] || bytes[27] || bytes[28]) fail('Das PNG-Format der Originalunterschrift wird nicht unterstützt. Bitte die Unterschrift neu erfassen.');
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[color];
  const rowLength = 1 + Math.ceil(width * channels * depth / 8), expectedLength = height * rowLength;
  const chunks: Uint8Array[] = []; let palette = false;
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = view.getUint32(offset), type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (type === 'PLTE') palette = length > 0 && length <= 768 && length % 3 === 0;
    if (type === 'IDAT') chunks.push(bytes.slice(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  if (color === 3 && !palette) fail('Die Farbpalette der Originalunterschrift fehlt.');
  try {
    const stream = new Blob(chunks.map((chunk) => chunk.slice().buffer)).stream().pipeThrough(new DecompressionStream('deflate'));
    const reader = stream.getReader(); let decoded = 0;
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      if (decoded + value.length > expectedLength) { await reader.cancel(); fail('Ungültige Signaturbilddaten.'); }
      for (let index = 0; index < value.length; index++) if ((decoded + index) % rowLength === 0 && value[index] > 4) { await reader.cancel(); fail('Ungültiger Signaturbildfilter.'); }
      decoded += value.length;
    }
    if (decoded !== expectedLength) fail('Unvollständige Signaturbilddaten.');
  } catch { fail('Die Bilddaten der Originalunterschrift sind beschädigt. Bitte die Unterschrift neu erfassen.'); }
}

function timestamp(value: unknown, title: string, now: number): number {
  if (!isIntakeRenderTimestamp(value) || Date.parse(value) > now + 300000) fail(`${title} ist ungültig. Bitte das Dokument erneut prüfen.`);
  return Date.parse(value);
}
function currentTemplate(system: IntakeTemplateRow, tenant: IntakeTemplateRow | undefined): IntakeDocumentTemplate {
  const required = ['template_key','title','document_type','html_content','plain_text_content','updated_at'];
  if (required.some((key) => typeof system[key] !== 'string') || system.is_active !== true || !Number.isInteger(system.version) || !record(system.placeholder_schema) || !Array.isArray(system.signature_slots)) fail('Die aktuelle Aufnahmedokumentvorlage ist unvollständig.');
  const slots = system.signature_slots as IntakeDocumentTemplate['signatureSlots'];
  if (slots.some((slot) => !record(slot) || !roles.includes(slot.role) || typeof slot.required !== 'boolean' || typeof slot.placeholder !== 'string')) fail('Die Unterschriftsfelder der Vorlage sind ungültig.');
  if (Object.values(system.placeholder_schema).some((field) => !record(field) || typeof field.label !== 'string' || field.required !== undefined && typeof field.required !== 'boolean')) fail('Die Pflichtangaben der Vorlage sind ungültig.');
  if (tenant && (tenant.is_active !== true || tenant.template_key !== system.template_key || typeof tenant.updated_at !== 'string' || tenant.html_content != null && typeof tenant.html_content !== 'string')) fail('Die eigene Aufnahmedokumentvorlage wurde geändert.');
  const base = mapSystemRow(system as unknown as SystemTemplateRow);
  return tenant ? mapTenantRow(tenant as unknown as TenantTemplateRow, base)! : base;
}

export async function verifyIntakeCompletionDocuments(input: { form: unknown; systemTemplates: IntakeTemplateRow[]; tenantTemplates: IntakeTemplateRow[]; tenantDisplay: IntakeTenantDisplay; now?: number }): Promise<VerifiedIntakeDocument[]> {
  const form = requireCompleteIntakeForm(input.form), now = input.now ?? Date.now();
  const contracts = resolveContractTemplateKeys(form);
  if (!contracts.length) fail('Für die ausgewählte Unterstützung fehlt ein gültiger Aufnahmevertrag.');
  const expected = [PRIVACY_TEMPLATE_KEY, ...contracts, ...(form.intakeAssignmentEnabled ? [ASSIGNMENT_TEMPLATE_KEY] : []), ...form.intakeOptionalConsents];
  if (form.intakeDocuments.length !== expected.length || new Set(expected).size !== expected.length) fail('Die Dokumentauswahl wurde geändert. Bitte Verträge und Einwilligungen erneut prüfen.');
  const verified: VerifiedIntakeDocument[] = [];
  for (const key of expected) {
    const matches = form.intakeDocuments.filter((doc) => record(doc) && doc.templateKey === key);
    if (matches.length !== 1) fail('Eine erforderliche Dokumentfassung fehlt oder ist doppelt vorhanden.');
    const doc = matches[0];
    const bindingError = getIntakeRenderBindingError(doc); if (bindingError) fail(bindingError);
    const systems = input.systemTemplates.filter((row) => row.template_key === key && row.is_active === true);
    if (systems.length !== 1) fail('Die aktuelle Systemvorlage ist nicht eindeutig verfügbar.');
    const system = systems[0];
    const tenant = input.tenantTemplates.find((row) => row.template_key === key && row.is_active === true);
    if (doc.source !== 'system' && doc.source !== 'tenant' || doc.source === 'tenant' && !tenant || doc.source === 'system' && tenant || tenant && tenant.id !== doc.tenantTemplateId) fail('Die verwendete Dokumentvorlage ist nicht verfügbar.');
    const template = currentTemplate(system, tenant);
    if (doc.version !== template.version || doc.documentType !== template.documentType || doc.title !== template.title || doc.tenantTemplateId != null && doc.tenantTemplateId !== template.tenantTemplateId || doc.status !== 'finalized') fail('Die Dokumentfassung oder Vorlage hat sich geändert. Bitte erneut prüfen und unterschreiben.');
    if (typeof doc.previewHtml !== 'string' || typeof doc.finalizedHtml !== 'string' || doc.finalizedHtml.length > 8 * 1024 * 1024 || doc.previewHtml !== doc.finalizedHtml || doc.renderedPdfPath != null || !Array.isArray(doc.missingPlaceholders) || doc.missingPlaceholders.length || !record(doc.signatures)) fail('Die unveränderte unterschriebene Originalfassung fehlt. Bitte erneut prüfen.');
    const renderedAt = timestamp(doc.renderedAt, 'Vorschauzeitpunkt', now), finalizedAt = timestamp(doc.finalizedAt, 'Abschlusszeitpunkt', now);
    if (finalizedAt < renderedAt) fail('Die Zeitpunkte der Dokumentfassung stimmen nicht überein.');
    const requiredRoles = new Set(template.signatureSlots.filter((slot) => slot.required).map((slot) => slot.role));
    if (template.requiresClientSignature) requiredRoles.add('client'); if (template.requiresEmployeeSignature) requiredRoles.add('employee'); if (template.requiresRepresentativeSignature) requiredRoles.add('legal_representative');
    for (const role of requiredRoles) if (!doc.signatures[role]) fail('Eine erforderliche Unterschrift fehlt.');
    for (const [role, signature] of Object.entries(doc.signatures)) {
      if (!roles.includes(role as IntakeSignatureRole) || !template.signatureSlots.some((slot) => slot.role === role) || !record(signature) || signature.role !== role || signature.signerName != null && (typeof signature.signerName !== 'string' || signature.signerName.length > 200 || /[\u0000-\u001f]/.test(signature.signerName))) fail('Eine Unterschriftsrolle oder Namensangabe ist ungültig.');
      await verifyPngPixels(requireIntakePng(signature.dataUrl));
      const signedAt = timestamp(signature.signedAt, 'Unterschriftszeitpunkt', now);
      if (signedAt < renderedAt - 60000 || signedAt > finalizedAt + 1000) fail('Die Unterschrift gehört zeitlich nicht zur geprüften Dokumentfassung.');
    }
    const context = buildIntakePlaceholderContext(form, input.tenantDisplay, { renderedAt: doc.renderedAt! });
    const preview = renderIntakeDocumentHtml(template, context, doc.signatures);
    if (preview.missingPlaceholders.length) fail('Die tatsächliche Vorlage enthält noch offene Pflichtangaben.');
    const reference = finalizeIntakeDocumentHtml(template, context, doc.signatures, doc.finalizedAt!);
    if (reference.html !== doc.finalizedHtml) fail('Das unterschriebene Original stimmt nicht mehr mit Formular und Vorlage überein. Bitte eine neue Fassung prüfen; das bisherige Original bleibt erhalten.');
    // Return the submitted original unchanged. The reference is only a comparator.
    verified.push({ ...doc, contentHash: await intakeSha256(new TextEncoder().encode(doc.finalizedHtml)), templateUpdatedAt: String(tenant?.updated_at ?? system.updated_at), systemTemplateUpdatedAt: String(system.updated_at), systemTemplateSnapshot: system, tenantTemplateSnapshot: tenant ?? null });
  }
  return verified;
}
