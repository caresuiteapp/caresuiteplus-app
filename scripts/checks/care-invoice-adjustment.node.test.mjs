import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { buildCareInvoiceAdjustmentRecord } from '../../src/lib/pflege/careInvoiceAdjustmentDomain.ts';

const positions=()=>[
  {positionNo:1,billingCaseId:'case-1',serviceProofId:'proof-1',amountCents:500},
  {positionNo:2,billingCaseId:'case-2',serviceProofId:'proof-2',amountCents:750},
];
const invoice=(overrides={})=>({invoiceApprovalId:'approval-1',invoiceDraftId:'draft-1',invoiceNumber:'RE-2026-100',tenantId:'tenant-1',clientId:'client-1',claimLineageId:'claim-1',documentFingerprint:'1'.repeat(32),createdByUserId:'author-1',approvedByUserId:'reviewer-1',approvedAt:'2026-10-13T10:15:12.123456Z',approvalState:'approved',totalAmountCents:1250,positions:positions(),...overrides});
const fullCredits=()=>positions().map((position)=>({originalPositionNo:position.positionNo,billingCaseId:position.billingCaseId,serviceProofId:position.serviceProofId,creditAmountCents:position.amountCents}));
const replacement=(overrides={})=>({...invoice({invoiceApprovalId:'approval-2',invoiceDraftId:'draft-2',invoiceNumber:'RE-2026-101',documentFingerprint:'2'.repeat(32),createdByUserId:'author-2',approvedByUserId:'reviewer-2',approvedAt:'2026-10-13T10:17:12.123456Z',totalAmountCents:1200,positions:[{...positions()[0],amountCents:450},positions()[1]]}),replacesInvoiceApprovalId:'approval-1',...overrides});
const request=(overrides={})=>({clientRequestId:'request-1',adjustmentId:'adjustment-1',adjustmentNumber:'GS-2026-100',adjustmentKind:'full_cancellation',adjustmentBasis:'documented_billing_correction',reason:'Dokumentierte fehlerhafte Leistungsposition.',createdByUserId:'author-3',approvedByUserId:'reviewer-3',approvedAt:'2026-10-13T10:16:12.123456Z',documentFingerprint:'3'.repeat(32),creditPositions:fullCredits(),creditTotalCents:1250,replacementInvoice:null,...overrides});

test('Vollstorno bildet Original, Gegenbuchung und exakten Nullsaldo ab',()=>{
  const record=buildCareInvoiceAdjustmentRecord(invoice(),request());
  assert.deepEqual(record.ledger,{originalDebitCents:1250,counterEntryCents:-1250,replacementDebitCents:0,resultingBalanceCents:0});
  assert.equal(record.chainAction,'append_only_invoice_adjustment');assert.equal(record.carrierReturnEffect,'none');assert.equal(record.transmissionStatus,'not_inferred');assert.equal(record.paymentStatus,'not_inferred');
});

test('Teil-Gutschrift berechnet den verbleibenden Saldo ohne Neurechnung',()=>{
  const record=buildCareInvoiceAdjustmentRecord(invoice(),request({adjustmentKind:'partial_credit',creditPositions:[{...fullCredits()[0],creditAmountCents:200}],creditTotalCents:200}));
  assert.deepEqual(record.ledger,{originalDebitCents:1250,counterEntryCents:-200,replacementDebitCents:0,resultingBalanceCents:1050});
});

test('Storno und Neurechnung ergeben den Saldo nur aus der neuen freigegebenen Rechnung',()=>{
  const record=buildCareInvoiceAdjustmentRecord(invoice(),request({adjustmentKind:'cancel_and_rebill',replacementInvoice:replacement()}));
  assert.equal(record.ledger.resultingBalanceCents,1200);assert.equal(record.replacementInvoice?.replacesInvoiceApprovalId,'approval-1');
});

test('Rückläufer und Folgeversuch dürfen keine Gegenbuchung auslösen',()=>assert.throws(()=>buildCareInvoiceAdjustmentRecord(invoice(),request({adjustmentBasis:'carrier_return'})),/Rückläufer oder Folgeversuch/));

test('Originalrechnung muss freigegeben, rechnerisch vollständig und von zweiter Identität geprüft sein',()=>{
  assert.throws(()=>buildCareInvoiceAdjustmentRecord(invoice({approvalState:'draft'}),request()),/nicht freigegeben/);
  assert.throws(()=>buildCareInvoiceAdjustmentRecord(invoice({createdByUserId:'reviewer-1'}),request()),/getrennte prüfende Identität/);
  assert.throws(()=>buildCareInvoiceAdjustmentRecord(invoice({totalAmountCents:1249}),request()),/Positionssumme/);
});

test('Originalpositionen bleiben lückenlos sowie fall- und nachweisbezogen eindeutig',()=>{
  assert.throws(()=>buildCareInvoiceAdjustmentRecord(invoice({positions:[{...positions()[0],positionNo:2},positions()[1]]}),request()),/lückenlos/);
  assert.throws(()=>buildCareInvoiceAdjustmentRecord(invoice({positions:[positions()[0],{...positions()[1],serviceProofId:'proof-1'}]}),request()),/doppelte Originalpositionen/);
});

test('Gegenbuchung braucht getrennte Identitäten, neue Fassung und spätere Mikrosekundenzeit',()=>{
  assert.throws(()=>buildCareInvoiceAdjustmentRecord(invoice(),request({createdByUserId:'reviewer-3'})),/getrennte prüfende Identität/);
  assert.throws(()=>buildCareInvoiceAdjustmentRecord(invoice(),request({documentFingerprint:'1'.repeat(32)})),/neuen Dokumentfingerprint/);
  assert.throws(()=>buildCareInvoiceAdjustmentRecord(invoice(),request({approvedAt:'2026-10-13T10:15:12.123456+00:00'})),/nach der Originalfreigabe/);
  assert.throws(()=>buildCareInvoiceAdjustmentRecord(invoice(),request({approvedAt:'2026-10-13T10:16:12.123Z'})),/sechs UTC-Mikrosekundenstellen/);
});

test('Gegenbuchungsposition bindet exakt Originalposition, Fall und Leistungsnachweis',()=>{
  assert.throws(()=>buildCareInvoiceAdjustmentRecord(invoice(),request({creditPositions:[{...fullCredits()[0],billingCaseId:'case-x'},fullCredits()[1]]})),/nicht exakt/);
  assert.throws(()=>buildCareInvoiceAdjustmentRecord(invoice(),request({creditPositions:[fullCredits()[0],{...fullCredits()[0]}]})),/doppelt gegengebucht/);
  assert.throws(()=>buildCareInvoiceAdjustmentRecord(invoice(),request({creditPositions:[{...fullCredits()[0],creditAmountCents:501},fullCredits()[1]],creditTotalCents:1251})),/übersteigt/);
});

test('Positionssumme und Gegenbuchungsbetrag müssen centgenau übereinstimmen',()=>assert.throws(()=>buildCareInvoiceAdjustmentRecord(invoice(),request({creditTotalCents:1249})),/stimmen nicht/));

test('Teil-Gutschrift darf weder Vollstorno noch Neurechnung vortäuschen',()=>{
  assert.throws(()=>buildCareInvoiceAdjustmentRecord(invoice(),request({adjustmentKind:'partial_credit'})),/weder vollständig/);
  assert.throws(()=>buildCareInvoiceAdjustmentRecord(invoice(),request({adjustmentKind:'partial_credit',creditPositions:[{...fullCredits()[0],creditAmountCents:200}],creditTotalCents:200,replacementInvoice:replacement()})),/automatisch neu berechnen/);
});

test('Vollstorno muss jede Originalposition centgenau gegenbuchen',()=>assert.throws(()=>buildCareInvoiceAdjustmentRecord(invoice(),request({creditPositions:[{...fullCredits()[0],creditAmountCents:499},fullCredits()[1]],creditTotalCents:1249})),/exakte Gegenbuchung/));

test('Neurechnung ist nur beim kombinierten Vorgang und dort zwingend erlaubt',()=>{
  assert.throws(()=>buildCareInvoiceAdjustmentRecord(invoice(),request({replacementInvoice:replacement()})),/Reines Vollstorno/);
  assert.throws(()=>buildCareInvoiceAdjustmentRecord(invoice(),request({adjustmentKind:'cancel_and_rebill'})),/benötigt eine neue/);
});

test('Neurechnung bewahrt Mandant, Pflegefall und Forderungshistorie',()=>{
  for(const [field,value] of [['tenantId','tenant-x'],['clientId','client-x'],['claimLineageId','claim-x']])assert.throws(()=>buildCareInvoiceAdjustmentRecord(invoice(),request({adjustmentKind:'cancel_and_rebill',replacementInvoice:replacement({[field]:value})})),/Mandant, Pflegefall und Forderungshistorie/);
  assert.throws(()=>buildCareInvoiceAdjustmentRecord(invoice(),request({adjustmentKind:'cancel_and_rebill',replacementInvoice:replacement({replacesInvoiceApprovalId:'approval-x'})})),/referenziert nicht/);
});

test('Neurechnung benötigt neue native Dokumentidentitäten und spätere Freigabe',()=>{
  for(const [field,value] of [['invoiceApprovalId','approval-1'],['invoiceDraftId','draft-1'],['invoiceNumber','RE-2026-100'],['documentFingerprint','1'.repeat(32)]])assert.throws(()=>buildCareInvoiceAdjustmentRecord(invoice(),request({adjustmentKind:'cancel_and_rebill',replacementInvoice:replacement({[field]:value})})),/neue native Dokumentidentitäten/);
  assert.throws(()=>buildCareInvoiceAdjustmentRecord(invoice(),request({adjustmentKind:'cancel_and_rebill',replacementInvoice:replacement({approvedAt:request().approvedAt})})),/nach der freigegebenen Gegenbuchung/);
});

test('gesamte Kette und ihre Positionen sind unveränderlich',()=>{
  const record=buildCareInvoiceAdjustmentRecord(invoice(),request({adjustmentKind:'cancel_and_rebill',replacementInvoice:replacement()}));
  assert.ok(Object.isFrozen(record));assert.ok(Object.isFrozen(record.ledger));assert.ok(Object.isFrozen(record.originalInvoice));assert.ok(Object.isFrozen(record.originalInvoice.positions));assert.ok(Object.isFrozen(record.creditPositions));assert.ok(Object.isFrozen(record.replacementInvoice));assert.ok(Object.isFrozen(record.replacementInvoice?.positions));
});

test('SQL schützt beide Tabellen append-only, mit RLS und expliziten Leserechten',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_invoice_adjustments.sql',import.meta.url),'utf8');
  assert.equal((sql.match(/BEFORE UPDATE OR DELETE/g)??[]).length,2);assert.equal((sql.match(/ENABLE ROW LEVEL SECURITY/g)??[]).length,2);
  assert.match(sql,/REVOKE ALL ON public\.pfleger_invoice_adjustments, public\.pfleger_invoice_adjustment_positions FROM PUBLIC, anon, authenticated/);assert.match(sql,/FOR SELECT TO authenticated/);assert.match(sql,/current_tenant_id\(\)/);assert.match(sql,/pflege\.billing\.view/);
});

test('SQL-Funktion ist gehärtet, qualifiziert, berechtigt und nicht öffentlich ausführbar',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_invoice_adjustments.sql',import.meta.url),'utf8');
  assert.equal((sql.match(/SECURITY DEFINER SET search_path = ''/g)??[]).length,2);assert.match(sql,/has_permission\('pflege\.billing\.release'\)/);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.record_pfleger_invoice_adjustment\(uuid,jsonb,uuid\) FROM PUBLIC, anon, authenticated/);assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.record_pfleger_invoice_adjustment\(uuid,jsonb,uuid\) TO authenticated/);
});

test('SQL serialisiert idempotent und sperrt Original wie Neurechnung',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_invoice_adjustments.sql',import.meta.url),'utf8');
  assert.ok((sql.match(/pg_advisory_xact_lock/g)??[]).length>=3);assert.match(sql,/client_request_id = p_client_request_id/);assert.match(sql,/original_invoice_approval_id = original_approval\.id/);
});

test('SQL rechnet Original, negative Gegenbuchung, Neurechnung und Saldo erneut',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_invoice_adjustments.sql',import.meta.url),'utf8');
  for(const token of [/counter_entry_cents = -credit_total_cents/,/resulting_balance_cents = original_total_amount_cents - credit_total_cents \+ replacement_total_amount_cents/,/credit_total <> original_approval\.total_amount_cents/,/creditAmountCents.*p\.amount_cents/])assert.match(sql,token);
});

test('SQL leitet aus Gegenbuchung weder Rückläuferwirkung noch Versand oder Zahlung ab',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_invoice_adjustments.sql',import.meta.url),'utf8');
  assert.match(sql,/carrier_return_effect text NOT NULL DEFAULT 'none'/);assert.match(sql,/transmission_status text NOT NULL DEFAULT 'not_inferred'/);assert.match(sql,/payment_status text NOT NULL DEFAULT 'not_inferred'/);
  assert.doesNotMatch(sql,/payment_status[^\n]*'paid'/);assert.doesNotMatch(sql,/transmission_status[^\n]*'transmitted'/);
});

test('Service validiert vor separatem RPC und prüft den gespeicherten Saldo',async()=>{
  const service=await fs.readFile(new URL('../../src/lib/pflege/careBillingLiveService.ts',import.meta.url),'utf8');
  for(const token of [/listCareInvoiceAdjustments/,/pfleger_invoice_adjustments/,/buildCareInvoiceAdjustmentRecord/,/record_pfleger_invoice_adjustment/,/Gespeicherter Saldo weicht/])assert.match(service,token);
  assert.match(service,/'pflege\.billing\.release'/);assert.match(service,/p_original_invoice_approval_id:record\.originalInvoice\.invoiceApprovalId/);
});

test('Web zeigt die Saldo-Kette; Native bleibt leer und Abrechnungspanel bindet sie ein',async()=>{
  const web=await fs.readFile(new URL('../../src/components/office/ClientInvoiceAdjustmentSummary.web.tsx',import.meta.url),'utf8');
  const native=await fs.readFile(new URL('../../src/components/office/ClientInvoiceAdjustmentSummary.tsx',import.meta.url),'utf8');
  const panel=await fs.readFile(new URL('../../src/components/office/ClientBillingPrepPanel.tsx',import.meta.url),'utf8');
  for(const token of [/Original/,/Gegenbuchung/,/Neurechnung/,/Saldo/,/Rückläufer oder Folgeversuch/,/nicht abgeleitet/])assert.match(web,token);
  assert.match(native,/return null/);assert.match(panel,/ClientInvoiceAdjustmentSummary/);
});
