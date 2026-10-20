import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { buildCareInvoiceFoundationGroups, requireCompleteCareInvoiceFoundationSelection } from '../../src/lib/pflege/careInvoiceFoundationDomain.ts';

const candidate = (overrides = {}) => ({
  billingCaseId: 'case-1', serviceProofId: 'proof-1', tenantId: 'tenant-1', clientId: 'client-1',
  serviceDate: '2026-10-05', amountCents: 1250, billingStatus: 'released', invoiceFoundationId: null,
  payerType: 'krankenkasse', recipientName: 'Kasse Nord', recipientIk: '123456789',
  proofStatus: 'approved', proofFingerprint: 'md5:proof-1', proofApprovedAt: '2026-10-06T10:11:12.123456Z',
  logicalContractId: 'contract-logical-1', contractEventId: 'contract-event-2', contractVersion: 2,
  contractFingerprint: 'sha256:contract-v2', ...overrides,
});
const scope = { tenantId: 'tenant-1', clientId: 'client-1', periodFrom: '2026-10-01', periodTo: '2026-10-31' };

test('vollständig gebundener Fall wird gruppiert und Originalidentitäten bleiben erhalten', () => {
  const [group] = buildCareInvoiceFoundationGroups([candidate()], scope);
  assert.deepEqual(group.billingCaseIds, ['case-1']); assert.deepEqual(group.serviceProofIds, ['proof-1']);
  assert.deepEqual(group.proofFingerprints, ['md5:proof-1']); assert.equal(group.contractEventId, 'contract-event-2');
  assert.equal(group.totalAmountCents, 1250);
});

test('gleicher Empfänger und dieselbe Vertragsfassung werden summiert', () => {
  const groups = buildCareInvoiceFoundationGroups([candidate(), candidate({ billingCaseId: 'case-2', serviceProofId: 'proof-2', proofFingerprint: 'md5:proof-2', amountCents: 750 })], scope);
  assert.equal(groups.length, 1); assert.equal(groups[0].proofCount, 2); assert.equal(groups[0].totalAmountCents, 2000);
});

test('unterschiedliche Kostenträger-IK bleiben getrennt', () => {
  const groups = buildCareInvoiceFoundationGroups([candidate(), candidate({ billingCaseId:'case-2',serviceProofId:'proof-2',proofFingerprint:'fp-2',recipientIk:'987654321',recipientName:'Kasse Süd' })], scope);
  assert.equal(groups.length, 2);
});

test('Selbstzahler werden an den Pflegefall statt an eine erfundene IK gebunden', () => {
  const [group] = buildCareInvoiceFoundationGroups([candidate({ payerType:'self_payer',recipientName:'Pflegefall',recipientIk:'' })], scope);
  assert.equal(group.recipientKey, 'self:client-1');
});

test('Kostenträgerarten bleiben getrennte Gruppen', () => {
  const groups = buildCareInvoiceFoundationGroups([candidate(), candidate({ billingCaseId:'case-2',serviceProofId:'proof-2',proofFingerprint:'fp-2',payerType:'pflegekasse' })], scope);
  assert.equal(groups.length, 2);
});

test('logische Verträge bleiben getrennt', () => {
  const groups = buildCareInvoiceFoundationGroups([candidate(),candidate({billingCaseId:'case-2',serviceProofId:'proof-2',proofFingerprint:'fp-2',logicalContractId:'contract-logical-2'})],scope);
  assert.equal(groups.length,2);
});

test('konkrete Vertragsereignisse bleiben getrennt', () => {
  const groups = buildCareInvoiceFoundationGroups([candidate(),candidate({billingCaseId:'case-2',serviceProofId:'proof-2',proofFingerprint:'fp-2',contractEventId:'contract-event-3'})],scope);
  assert.equal(groups.length,2);
});

test('Vertragsversion und Vertragsfingerprint bleiben gemeinsam exakt', () => {
  const groups = buildCareInvoiceFoundationGroups([candidate(),candidate({billingCaseId:'case-2',serviceProofId:'proof-2',proofFingerprint:'fp-2',contractVersion:3,contractFingerprint:'sha256:v3'})],scope);
  assert.equal(groups.length,2);
});

test('Fall außerhalb des gewählten Zeitraums wird verworfen', () => {
  assert.throws(()=>buildCareInvoiceFoundationGroups([candidate({serviceDate:'2026-11-01'})],scope),/außerhalb/);
});

test('kalenderwidriger Zeitraum wird verworfen', () => {
  assert.throws(()=>buildCareInvoiceFoundationGroups([candidate()],{...scope,periodFrom:'2026-02-30'}),/Zeitraumbeginn/);
});

test('fremder Mandant wird verworfen', () => {
  assert.throws(()=>buildCareInvoiceFoundationGroups([candidate({tenantId:'tenant-2'})],scope),/Mandant oder Pflegefall/);
});

test('fremder Pflegefall wird verworfen', () => {
  assert.throws(()=>buildCareInvoiceFoundationGroups([candidate({clientId:'client-2'})],scope),/Mandant oder Pflegefall/);
});

test('nicht freigegebener oder schon zugeordneter Abrechnungsfall wird verworfen', () => {
  assert.throws(()=>buildCareInvoiceFoundationGroups([candidate({billingStatus:'ready'})],scope),/nicht frei/);
  assert.throws(()=>buildCareInvoiceFoundationGroups([candidate({invoiceFoundationId:'foundation-1'})],scope),/nicht frei/);
});

test('nicht tatsächlich freigegebener Originalnachweis wird verworfen', () => {
  assert.throws(()=>buildCareInvoiceFoundationGroups([candidate({proofStatus:'signed'})],scope),/nicht tatsächlich freigegeben/);
});

test('fehlender Freigabe-Fingerprint wird nicht aus anderen Feldern abgeleitet', () => {
  assert.throws(()=>buildCareInvoiceFoundationGroups([candidate({proofFingerprint:' '})],scope),/Freigabe-Fingerprint fehlt/);
});

test('Freigabezeit bleibt mit exakt sechs Mikrosekundenstellen erhalten', () => {
  assert.equal(buildCareInvoiceFoundationGroups([candidate({proofApprovedAt:'2026-10-06T10:11:12.000001Z'})],scope)[0].proofCount,1);
});

test('verkürzte oder überlange Nachkommastellen werden nicht still normalisiert', () => {
  assert.throws(()=>buildCareInvoiceFoundationGroups([candidate({proofApprovedAt:'2026-10-06T10:11:12.1Z'})],scope),/mikrosekundengenau/);
  assert.throws(()=>buildCareInvoiceFoundationGroups([candidate({proofApprovedAt:'2026-10-06T10:11:12.1234567Z'})],scope),/mikrosekundengenau/);
});

test('Kassenfall ohne IK und gemischter Kostenträger werden gesperrt', () => {
  assert.throws(()=>buildCareInvoiceFoundationGroups([candidate({recipientIk:''})],scope),/Kostenträger-IK/);
  assert.throws(()=>buildCareInvoiceFoundationGroups([candidate({payerType:'mixed'})],scope),/Gemischte Kostenträger/);
});

test('ungültiger Betrag und ungültige Vertragsversion werden gesperrt', () => {
  assert.throws(()=>buildCareInvoiceFoundationGroups([candidate({amountCents:0})],scope),/Abrechnungsbetrag/);
  assert.throws(()=>buildCareInvoiceFoundationGroups([candidate({contractVersion:0})],scope),/Vertragsversion/);
});

test('doppelte Fall- oder Nachweisidentitäten werden nicht zusammengefaltet', () => {
  assert.throws(()=>buildCareInvoiceFoundationGroups([candidate(),candidate({serviceProofId:'proof-2',proofFingerprint:'fp-2'})],scope),/Abrechnungsfall-ID ist doppelt/);
  assert.throws(()=>buildCareInvoiceFoundationGroups([candidate(),candidate({billingCaseId:'case-2'})],scope),/Leistungsnachweis-ID ist doppelt/);
});

test('nur die vollständige unveränderte Gruppe darf ausgewählt werden', () => {
  const group=buildCareInvoiceFoundationGroups([candidate(),candidate({billingCaseId:'case-2',serviceProofId:'proof-2',proofFingerprint:'fp-2'})],scope)[0];
  assert.deepEqual(requireCompleteCareInvoiceFoundationSelection(group,['case-2','case-1']),['case-1','case-2']);
  assert.throws(()=>requireCompleteCareInvoiceFoundationSelection(group,['case-1']),/vollständige/);
  assert.throws(()=>requireCompleteCareInvoiceFoundationSelection(group,['case-1','case-1']),/doppelte/);
});

test('Service hält alten Android-Vertrag unverändert und nutzt separaten gebundenen RPC', async () => {
  const service=await fs.readFile(new URL('../../src/lib/pflege/careBillingLiveService.ts',import.meta.url),'utf8');
  assert.match(service,/createPflegeInvoiceFoundation\(tenantId:string,role:RoleKey\|null\|undefined,clientId:string,periodFrom:string,periodTo:string\)/);
  assert.match(service,/createBoundPflegeInvoiceFoundation/); assert.match(service,/create_bound_pfleger_invoice_foundation/);
  assert.match(service,/approved_evidence_fingerprint/); assert.match(service,/client_contract_service_bindings/);
});

test('SQL friert Freigabebeleg ein, sperrt Teilmengen und serialisiert die Zuordnung', async () => {
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_invoice_foundation_binding.sql',import.meta.url),'utf8');
  assert.match(sql,/approved_evidence_snapshot/); assert.match(sql,/approved_evidence_fingerprint/);
  assert.match(sql,/p_billing_case_ids uuid\[\]/); assert.match(sql,/FOR UPDATE/); assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,/eligible_count<>selected_count/); assert.match(sql,/Stille Teilmenge ist gesperrt/);
  assert.match(sql,/selection_snapshot/); assert.match(sql,/contract_lifecycle_event_id/);
  assert.match(sql,/Pauschaler Sammelpfad gesperrt/); assert.doesNotMatch(sql,/UPDATE\s+public\.pfleger_service_proofs\s+SET\s+approved_evidence_fingerprint/i);
});

test('Web zeigt nur Lesebereitschaft und Native-Komponente bleibt leer', async () => {
  const web=await fs.readFile(new URL('../../src/components/office/ClientInvoiceFoundationReadinessSummary.web.tsx',import.meta.url),'utf8');
  const native=await fs.readFile(new URL('../../src/components/office/ClientInvoiceFoundationReadinessSummary.tsx',import.meta.url),'utf8');
  const panel=await fs.readFile(new URL('../../src/components/office/ClientBillingPrepPanel.tsx',import.meta.url),'utf8');
  assert.match(web,/listCareInvoiceFoundationGroups/); assert.match(web,/erstellt, genehmigt oder versendet keine Rechnung/);
  assert.doesNotMatch(web,/createBoundPflegeInvoiceFoundation/); assert.match(native,/return null/);
  assert.match(panel,/ClientInvoiceFoundationReadinessSummary clientId=\{clientId\}/);
});
