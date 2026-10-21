import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = '2026-10-15T09:40:00.123456+00:00';
const source = stripTypeScriptTypes(readFileSync(new URL(
  '../../src/features/intakeDocuments/intakeDocumentRepository.ts', import.meta.url,
), 'utf8').replace(/^import[\s\S]*?;\n/gm, '').replace(/\bexport /g, ''));
const signature = (role, name) => ({ role, dataUrl: `data:image/png;base64,${role}`, signedAt: at, signerName: name });
const document = (templateKey, documentType, signatures) => ({
  templateKey, documentType, title: templateKey, isRequired: true, status: 'finalized', source: 'system',
  tenantTemplateId: null, version: 1, missingPlaceholders: [], unresolvedKeys: [], previewHtml: '<p>preview</p>',
  finalizedHtml: '<p>final</p>', renderedPdfPath: null, signatures, previewOpenedAt: at, finalizedAt: at,
});
const form = () => ({ intakeAssignmentEnabled: false, intakeContractType: 'ambulant', intakeDocuments: [
  document('privacy_consent_default', 'privacy_consent', { client: signature('client', 'Anna') }),
  document('client_contract_default', 'client_contract', { client: signature('client', 'Anna'), employee: signature('employee', 'Eva') }),
] });
const documentRow = (doc, index) => ({ id: id(20 + index), tenant_id: id(1), client_id: id(3), template_key: doc.templateKey,
  document_type: doc.documentType, title: doc.title, status: doc.status, is_required: doc.isRequired, version: doc.version,
  source: doc.source, tenant_template_id: doc.tenantTemplateId, preview_html: doc.previewHtml, finalized_html: doc.finalizedHtml,
  rendered_pdf_path: doc.renderedPdfPath, missing_placeholders: doc.missingPlaceholders, preview_opened_at: doc.previewOpenedAt,
  finalized_at: doc.finalizedAt, updated_by: id(2) });

function database(input, mutate = () => {}) {
  const docs = input.intakeDocuments.map(documentRow);
  const signatures = input.intakeDocuments.flatMap((doc, index) => Object.entries(doc.signatures).map(([role, value]) => ({
    document_id: id(20 + index), tenant_id: id(1), client_id: id(3), signer_role: role,
    signature_data: value.dataUrl, signed_at: value.signedAt, signer_name: value.signerName,
  })));
  const state = { docs, signatures, consent: { tenant_id: id(1), client_id: id(3), privacy_status: 'finalized', contract_status: 'finalized',
    assignment_status: 'skipped_optional', privacy_finalized_at: at, contract_finalized_at: at, updated_by: id(2) },
    selection: { tenant_id: id(1), client_id: id(3), contract_type: 'ambulant', selected_template_key: 'client_contract_default', updated_by: id(2) } };
  mutate(state);
  return { from(table) {
    const filters = []; let ids = null;
    const q = { select() { return q; }, eq(key, value) { filters.push([key, value]); return q; }, in(_key, values) { ids = values; return q; },
      maybeSingle: async () => execute(true), then: (resolve, reject) => execute(false).then(resolve, reject) };
    async function execute(single) {
      let rows = table === 'client_intake_documents' ? state.docs : table === 'client_document_signatures' ? state.signatures
        : table === 'client_consent_status' ? [state.consent] : table === 'client_contract_selection' ? [state.selection] : [];
      rows = rows.filter(row => filters.every(([key, value]) => row?.[key] === value));
      if (ids) rows = rows.filter(row => ids.includes(row.document_id));
      return { data: single ? structuredClone(rows[0] ?? null) : structuredClone(rows), error: null };
    }
    return q;
  } };
}

function confirm(input, db) {
  return new Function('getSupabaseClient', 'toGermanSupabaseError', 'SERVICE_ERRORS',
    `${source};return confirmPersistedIntakeDocumentsForClient;`)(() => db, error => error?.message ?? 'error', { supabaseUnavailable: 'offline' })(id(1), id(3), input, id(2));
}

test('read-back confirmation requires every captured document, signature, consent and contract original', async () => {
  const input = form(); assert.deepEqual(await confirm(input, database(input)), { ok: true, data: undefined });
});

for (const [label, mutate] of [
  ['duplicate document', state => state.docs.push(structuredClone(state.docs[0]))],
  ['changed document bytes', state => { state.docs[0].finalized_html = '<p>changed</p>'; }],
  ['extra signature', state => state.signatures.push({ ...state.signatures[0], signer_role: 'representative' })],
  ['changed signature time', state => { state.signatures[0].signed_at = '2026-10-15T09:40:00.123457+00:00'; }],
  ['changed consent actor', state => { state.consent.updated_by = id(9); }],
  ['changed contract basis', state => { state.selection.contract_type = 'stationaer'; }],
]) test(`${label} cannot confirm an uncertain document write`, async () => {
  const input = form(); assert.equal((await confirm(input, database(input, mutate))).ok, false);
});
