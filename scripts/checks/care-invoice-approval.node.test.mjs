import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { buildCareInvoiceApprovalSnapshot, validateCareInvoiceApprovalRequest } from '../../src/lib/pflege/careInvoiceApprovalDomain.ts';

const position=(overrides={})=>({positionNo:1,billingCaseId:'case-1',serviceProofId:'proof-1',serviceDate:'2026-10-05',serviceCode:'SGBXI-01',quantityMilli:1000,unitAmountCents:1250,amountCents:1250,proofFingerprint:'proof-fp-1',...overrides});
const candidate=(overrides={})=>({invoiceDraftId:'draft-1',invoiceNumber:'RE-202610130001',tenantId:'tenant-1',clientId:'client-1',draftVersion:1,status:'draft',createdBy:'author-1',createdAt:'2026-10-13T10:11:12.123456Z',issuedAt:'2026-10-13T10:11:12.123456Z',dueDate:'2026-10-27',issuerName:'Pflegedienst Nord GmbH',issuerAddress:'Hauptstraße 1, 10115 Berlin, DE',issuerTaxReference:'12/345/67890',recipientName:'Kasse Nord',recipientKey:'ik:123456789',recipientAddress:'Kassenweg 2, 10117 Berlin, DE',totalAmountCents:1250,positions:[position()],...overrides});
const input=(overrides={})=>({taxTreatment:'tax_exempt_healthcare',taxRateBasisPoints:0,netAmountCents:1250,taxAmountCents:0,taxLegalReference:'§ 4 Nr. 14 UStG – ausdrücklich geprüft',reviewerNote:'Pflichtangaben und Positionen geprüft.',...overrides});

test('zweite Identität friert genau Entwurfs- und Freigabeversion 1 ein',()=>{
  const result=buildCareInvoiceApprovalSnapshot(candidate(),input(),'reviewer-2');
  assert.equal(result.draftVersion,1);assert.equal(result.approvalVersion,1);assert.equal(result.reviewerId,'reviewer-2');assert.equal(result.approvalStatus,'approved');
});
test('Freigabe leitet weder Übertragung noch Zahlung ab',()=>{
  const result=buildCareInvoiceApprovalSnapshot(candidate(),input(),'reviewer-2');
  assert.equal(result.transmissionStatus,'not_transmitted');assert.equal(result.paymentStatus,'not_inferred');
});
test('eigener Entwurf darf nicht selbst freigegeben werden',()=>assert.throws(()=>buildCareInvoiceApprovalSnapshot(candidate(),input(),'author-1'),/zwei verschiedene Identitäten/));
test('nur Status draft darf freigegeben werden',()=>assert.throws(()=>buildCareInvoiceApprovalSnapshot(candidate({status:'approved'}),input(),'reviewer-2'),/Nur ein unveränderter Entwurf/));
test('Entwurfsfassung muss positiv ganzzahlig sein',()=>assert.throws(()=>buildCareInvoiceApprovalSnapshot(candidate({draftVersion:0}),input(),'reviewer-2'),/Entwurfsfassung/));
test('Entwurfs- und Ausstellungszeit bewahren exakt sechs UTC-Mikrosekundenstellen',()=>{
  assert.throws(()=>buildCareInvoiceApprovalSnapshot(candidate({createdAt:'2026-10-13T10:11:12.123Z'}),input(),'reviewer-2'),/sechs UTC-Mikrosekundenstellen/);
  assert.doesNotThrow(()=>buildCareInvoiceApprovalSnapshot(candidate({createdAt:'2026-10-13T10:11:12.123456+00:00'}),input(),'reviewer-2'));
});
test('Fälligkeit darf nicht vor Ausstellung liegen',()=>assert.throws(()=>buildCareInvoiceApprovalSnapshot(candidate({dueDate:'2026-10-12'}),input(),'reviewer-2'),/vor dem Ausstellungsdatum/));
test('Freigabe benötigt mindestens eine Position',()=>assert.throws(()=>buildCareInvoiceApprovalSnapshot(candidate({positions:[]}),input(),'reviewer-2'),/mindestens eine Position/));
test('Positionsreihenfolge muss lückenlos sein',()=>assert.throws(()=>buildCareInvoiceApprovalSnapshot(candidate({positions:[position({positionNo:2})]}),input(),'reviewer-2'),/Positionsreihenfolge/));
test('doppelte Fall- oder Nachweisidentitäten werden gesperrt',()=>{
  const second=position({positionNo:2,amountCents:1250});
  assert.throws(()=>buildCareInvoiceApprovalSnapshot(candidate({totalAmountCents:2500,positions:[position(),second]}),input({netAmountCents:2500}),'reviewer-2'),/doppelte Originalidentitäten/);
});
test('Positionen müssen ohne Rundung nachrechenbar sein',()=>assert.throws(()=>buildCareInvoiceApprovalSnapshot(candidate({positions:[position({quantityMilli:333,unitAmountCents:100,amountCents:33})],totalAmountCents:33}),input({netAmountCents:33}),'reviewer-2'),/exakt nachrechenbar/));
test('Positionssumme muss dem Gesamtbetrag entsprechen',()=>assert.throws(()=>buildCareInvoiceApprovalSnapshot(candidate({totalAmountCents:1249}),input({netAmountCents:1249}),'reviewer-2'),/Rechnungssumme/));
test('steuerbefreite Rechnung verlangt null Steuer und Gesamtbetrag als Netto',()=>{
  assert.throws(()=>buildCareInvoiceApprovalSnapshot(candidate(),input({taxRateBasisPoints:700,taxAmountCents:82,netAmountCents:1168}),'reviewer-2'),/Steuerbefreite Rechnung/);
});
test('steuerpflichtige Rechnung verlangt rechnerisch passenden Steuerbetrag',()=>{
  const result=buildCareInvoiceApprovalSnapshot(candidate({totalAmountCents:1190,positions:[position({unitAmountCents:1190,amountCents:1190})]}),input({taxTreatment:'taxable',taxRateBasisPoints:1900,netAmountCents:1000,taxAmountCents:190,taxLegalReference:'19 Prozent Regelbesteuerung'}),'reviewer-2');
  assert.equal(result.taxAmountCents,190);
  assert.throws(()=>buildCareInvoiceApprovalSnapshot(candidate(),input({taxTreatment:'taxable',taxRateBasisPoints:1900,netAmountCents:1049,taxAmountCents:201}),'reviewer-2'),/Steuerbetrag/);
});
test('Netto und Steuer müssen gemeinsam den Gesamtbetrag ergeben',()=>assert.throws(()=>buildCareInvoiceApprovalSnapshot(candidate(),input({netAmountCents:1200,taxAmountCents:0}),'reviewer-2'),/Gesamtbetrag/));
test('Aussteller, Anschrift, Steuerkennung und Empfängeranschrift sind Pflichtangaben',()=>{
  for(const [field,label] of [['issuerName','Aussteller fehlt'],['issuerAddress','Ausstelleranschrift'],['issuerTaxReference','Steuerkennung'],['recipientAddress','Empfängeranschrift']])assert.throws(()=>buildCareInvoiceApprovalSnapshot(candidate({[field]:''}),input(),'reviewer-2'),new RegExp(label));
});
test('Steuer-/Rechtsgrundlage und sinnvoller Prüfvermerk sind Pflicht',()=>{
  assert.throws(()=>buildCareInvoiceApprovalSnapshot(candidate(),input({taxLegalReference:''}),'reviewer-2'),/Steuer-\/Rechtsgrundlage/);
  assert.throws(()=>buildCareInvoiceApprovalSnapshot(candidate(),input({reviewerNote:'kurz'}),'reviewer-2'),/Prüfvermerk ist zu kurz/);
});
test('Anforderungsvalidator erzwingt unveränderte Mikrosekundenfassung und Identitäten',()=>{
  const request={invoiceDraftId:'draft-1',expectedDraftVersion:1,expectedDraftCreatedAt:'2026-10-13T10:11:12.123456Z',taxTreatment:'tax_exempt_healthcare',taxRateBasisPoints:0,netAmountCents:1250,taxAmountCents:0,taxLegalReference:'§ 4 Nr. 14 UStG',reviewerNote:'Geprüft und plausibel.',clientRequestId:'request-1'};
  assert.deepEqual(validateCareInvoiceApprovalRequest(request),request);
  assert.throws(()=>validateCareInvoiceApprovalRequest({...request,expectedDraftCreatedAt:'2026-10-13T10:11:12.123Z'}),/sechs UTC-Mikrosekundenstellen/);
});

test('SQL speichert Freigabe als eigene versionierte append-only Historie',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_invoice_approvals.sql',import.meta.url),'utf8');
  assert.match(sql,/approval_version integer NOT NULL/);assert.match(sql,/UNIQUE \(invoice_draft_id, approval_version\)/);assert.match(sql,/BEFORE UPDATE OR DELETE/);assert.match(sql,/Freigegebene Rechnungsfassungen bleiben unverändert/);
});
test('SQL fordert Freigaberecht und eine zweite Identität',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_invoice_approvals.sql',import.meta.url),'utf8');
  assert.match(sql,/has_permission\('pflege\.billing\.release'\)/);assert.match(sql,/draft\.created_by=actor/);assert.match(sql,/zwei verschiedene Identitäten/);
});
test('SQL sperrt Entwurf, schützt erwartete Fassung und serialisiert Freigabe',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_invoice_approvals.sql',import.meta.url),'utf8');
  assert.equal((sql.match(/pg_advisory_xact_lock/g)??[]).length,2);assert.match(sql,/p_client_request_id::text/);assert.match(sql,/FOR SHARE/);assert.match(sql,/draft\.created_at IS DISTINCT FROM p_expected_draft_created_at/);assert.match(sql,/p_expected_draft_version<>1/);
});
test('SQL prüft vollständige Positionen, Beträge und Steuerbehandlung erneut',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_invoice_approvals.sql',import.meta.url),'utf8');
  assert.match(sql,/position_count IS DISTINCT FROM draft\.position_count/);assert.match(sql,/first_position<>1 OR last_position<>position_count/);assert.match(sql,/position_total IS DISTINCT FROM draft\.total_amount_cents/);assert.match(sql,/p_net_amount_cents\+p_tax_amount_cents<>draft\.total_amount_cents/);assert.match(sql,/expected_tax:=round/);
});
test('SQL friert Aussteller, Empfänger, Positionen und Fingerprints ein',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_invoice_approvals.sql',import.meta.url),'utf8');
  for(const token of [/'issuer'/,/'recipient'/,/'positions'/,/source_draft_fingerprint/,/document_fingerprint/,/SS\.US/])assert.match(sql,token);
});
test('SQL leitet weder Versand noch Zahlung aus Freigabe ab',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_invoice_approvals.sql',import.meta.url),'utf8');
  assert.match(sql,/transmission_status text NOT NULL DEFAULT 'not_transmitted'/);assert.match(sql,/payment_status text NOT NULL DEFAULT 'not_inferred'/);assert.doesNotMatch(sql,/payment_status[^\n]*'paid'/);
});
test('Service filtert bereits freigegebene Entwürfe und nutzt separaten RPC',async()=>{
  const service=await fs.readFile(new URL('../../src/lib/pflege/careBillingLiveService.ts',import.meta.url),'utf8');
  assert.match(service,/listCareInvoiceApprovalCandidates/);assert.match(service,/pfleger_invoice_approvals/);assert.match(service,/filter\(\(row\)=>!approved\.has/);assert.match(service,/approve_pfleger_invoice_draft/);assert.match(service,/'pflege\.billing\.release'/);
});
test('Web verlangt ausdrückliche Prüfeingaben und Native-Oberfläche bleibt leer',async()=>{
  const web=await fs.readFile(new URL('../../src/components/office/ClientInvoiceApprovalSummary.web.tsx',import.meta.url),'utf8');
  const native=await fs.readFile(new URL('../../src/components/office/ClientInvoiceApprovalSummary.tsx',import.meta.url),'utf8');
  assert.match(web,/Entwurfsfassung freigeben/);assert.match(web,/Steuer-\/Rechtsgrundlage/);assert.match(web,/Prüfvermerk/);assert.match(web,/belegt keinen Zahlungseingang/);assert.match(native,/return null/);
});
