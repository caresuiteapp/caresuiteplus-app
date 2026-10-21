import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { buildCareInvoiceDraft } from '../../src/lib/pflege/careInvoiceDraftDomain.ts';

const line=(overrides={})=>({billingCaseId:'11111111-1111-4111-8111-111111111111',serviceProofId:'22222222-2222-4222-8222-222222222222',serviceDate:'2026-10-05',serviceCode:'SGBXI-01',quantityMilli:1000,unitAmountCents:1250,amountCents:1250,proofFingerprint:'proof-fp-1',...overrides});
const source=(overrides={})=>({foundationId:'33333333-3333-4333-8333-333333333333',foundationNumber:'PF-1',tenantId:'tenant-1',clientId:'client-1',status:'validated',recipientName:'Kasse Nord',recipientKey:'ik:123456789',recipientIk:'123456789',totalAmountCents:1250,lines:[line()],...overrides});

test('validierte Grundlage wird als Entwurf mit unveränderten Identitäten aufgebaut',()=>{
  const draft=buildCareInvoiceDraft(source(),14);
  assert.equal(draft.status,'draft'); assert.equal(draft.foundationId,source().foundationId);
  assert.equal(draft.positions[0].billingCaseId,line().billingCaseId); assert.equal(draft.positions[0].serviceProofId,line().serviceProofId);
});
test('mehrere Einzelpositionen werden exakt in Cent summiert',()=>{
  const draft=buildCareInvoiceDraft(source({totalAmountCents:2000,lines:[line(),line({billingCaseId:'case-2',serviceProofId:'proof-2',unitAmountCents:750,amountCents:750,proofFingerprint:'fp-2'})]}),30);
  assert.equal(draft.positions.length,2); assert.equal(draft.totalAmountCents,2000); assert.equal(draft.paymentTermDays,30);
});
test('Menge in Tausendsteln und Einzelpreis ergeben den Positionsbetrag exakt',()=>{
  const draft=buildCareInvoiceDraft(source({totalAmountCents:1875,lines:[line({quantityMilli:1500,unitAmountCents:1250,amountCents:1875})]}),14);
  assert.equal(draft.positions[0].amountCents,1875);
});
test('nicht auf Cent teilbares Produkt wird nicht gerundet',()=>assert.throws(()=>buildCareInvoiceDraft(source({lines:[line({quantityMilli:333,unitAmountCents:100})]}),14),/keinen exakten Centbetrag/));
test('abweichender Positionsbetrag wird verworfen',()=>assert.throws(()=>buildCareInvoiceDraft(source({lines:[line({amountCents:1249})]}),14),/Positionsbetrag/));
test('abweichende Gesamtsumme wird verworfen',()=>assert.throws(()=>buildCareInvoiceDraft(source({totalAmountCents:1249}),14),/Rechnungssumme/));
test('leere Positionsliste wird verworfen',()=>assert.throws(()=>buildCareInvoiceDraft(source({lines:[]}),14),/mindestens eine Einzelposition/));
test('doppelte Abrechnungsfall-ID wird verworfen',()=>assert.throws(()=>buildCareInvoiceDraft(source({totalAmountCents:2500,lines:[line(),line({serviceProofId:'proof-2',proofFingerprint:'fp-2'})]}),14),/Abrechnungsfall-ID ist doppelt/));
test('doppelte Leistungsnachweis-ID wird verworfen',()=>assert.throws(()=>buildCareInvoiceDraft(source({totalAmountCents:2500,lines:[line(),line({billingCaseId:'case-2',proofFingerprint:'fp-2'})]}),14),/Leistungsnachweis-ID ist doppelt/));
test('nicht validierte Grundlage wird nicht still als Rechnung behandelt',()=>assert.throws(()=>buildCareInvoiceDraft(source({status:'released'}),14),/Nur eine validierte/));
test('Zahlungsziel muss eine ganze Zahl zwischen 1 und 365 sein',()=>{
  for(const days of [0,366,1.5,Number.NaN]) assert.throws(()=>buildCareInvoiceDraft(source(),days),/Zahlungsziel/);
});
test('fehlender Empfänger oder Empfängerschlüssel wird nicht rekonstruiert',()=>{
  assert.throws(()=>buildCareInvoiceDraft(source({recipientName:' '}),14),/Empfänger fehlt/);
  assert.throws(()=>buildCareInvoiceDraft(source({recipientKey:''}),14),/Empfängerschlüssel fehlt/);
});
test('fehlende native Fall- und Nachweisidentitäten werden verworfen',()=>{
  assert.throws(()=>buildCareInvoiceDraft(source({lines:[line({billingCaseId:''})]}),14),/Abrechnungsfall-ID/);
  assert.throws(()=>buildCareInvoiceDraft(source({lines:[line({serviceProofId:''})]}),14),/Leistungsnachweis-ID/);
});
test('fehlender Freigabefingerprint wird nicht aus dem Betrag abgeleitet',()=>assert.throws(()=>buildCareInvoiceDraft(source({lines:[line({proofFingerprint:''})]}),14),/Freigabe-Fingerprint/));
test('kalenderwidriges Leistungsdatum wird verworfen',()=>assert.throws(()=>buildCareInvoiceDraft(source({lines:[line({serviceDate:'2026-02-30'})]}),14),/Leistungsdatum/));
test('negative oder nichtganzzahlige Mengen werden verworfen',()=>{
  assert.throws(()=>buildCareInvoiceDraft(source({lines:[line({quantityMilli:-1})]}),14),/Positionsmenge/);
  assert.throws(()=>buildCareInvoiceDraft(source({lines:[line({quantityMilli:1.5})]}),14),/Positionsmenge/);
});
test('negative oder nicht sichere Einzelpreise werden verworfen',()=>{
  assert.throws(()=>buildCareInvoiceDraft(source({lines:[line({unitAmountCents:-1})]}),14),/Einzelpreis/);
  assert.throws(()=>buildCareInvoiceDraft(source({lines:[line({unitAmountCents:Number.MAX_SAFE_INTEGER})]}),14),/sicheren|Centbetrag/);
});
test('überlaufende Summen werden verworfen',()=>assert.throws(()=>buildCareInvoiceDraft(source({totalAmountCents:Number.MAX_SAFE_INTEGER,lines:[line({unitAmountCents:Number.MAX_SAFE_INTEGER,amountCents:Number.MAX_SAFE_INTEGER})]}),14),/sicheren|Centbetrag/));

test('SQL bindet jede Rechnung eindeutig an genau eine Grundlage und Anforderungs-ID',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_invoice_drafts.sql',import.meta.url),'utf8');
  assert.match(sql,/invoice_foundation_id uuid NOT NULL UNIQUE/); assert.match(sql,/UNIQUE \(tenant_id, client_request_id\)/); assert.match(sql,/request_fingerprint/);
});
test('SQL sperrt und serialisiert die Grundlage vor der Entwurfserzeugung',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_invoice_drafts.sql',import.meta.url),'utf8');
  assert.match(sql,/pg_advisory_xact_lock/); assert.match(sql,/FOR UPDATE/); assert.match(sql,/status<>'validated'/);
});
test('SQL erzwingt Centgleichheit je Position und für die Gesamtsumme',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_invoice_drafts.sql',import.meta.url),'utf8');
  assert.match(sql,/amount_cents = \(quantity_milli::bigint \* unit_amount_cents\) \/ 1000/);
  assert.match(sql,/sum\(amount_cents\)/); assert.match(sql,/<>draft\.total_amount_cents/);
});
test('SQL bewahrt Quell-Snapshot, Mikrosekundenzeit und Originalidentitäten',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_invoice_drafts.sql',import.meta.url),'utf8');
  assert.match(sql,/source_snapshot jsonb NOT NULL/); assert.match(sql,/SS\.US/); assert.match(sql,/billing_case_id uuid NOT NULL/); assert.match(sql,/service_proof_id uuid NOT NULL/);
});
test('SQL erteilt keinen direkten Schreibzugriff und schützt Historien',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_invoice_drafts.sql',import.meta.url),'utf8');
  assert.match(sql,/REVOKE ALL ON public\.pfleger_invoice_drafts/); assert.match(sql,/GRANT SELECT/); assert.match(sql,/BEFORE UPDATE OR DELETE/);
  assert.doesNotMatch(sql,/GRANT (?:INSERT|UPDATE|DELETE)/);
});
test('Service nutzt separaten RPC und verändert alten Android-Vertrag nicht',async()=>{
  const service=await fs.readFile(new URL('../../src/lib/pflege/careBillingLiveService.ts',import.meta.url),'utf8');
  assert.match(service,/createPflegeInvoiceDraft/); assert.match(service,/create_pfleger_invoice_draft/);
  assert.match(service,/createPflegeInvoiceFoundation\(tenantId:string,role:RoleKey\|null\|undefined,clientId:string,periodFrom:string,periodTo:string\)/);
});
test('Service bietet bereits verwendete Grundlagen nicht erneut zur Entwurfserstellung an',async()=>{
  const service=await fs.readFile(new URL('../../src/lib/pflege/careBillingLiveService.ts',import.meta.url),'utf8');
  assert.match(service,/pfleger_invoice_drafts/); assert.match(service,/invoice_foundation_id/);
  assert.match(service,/filter\(\(row\)=>!used\.has\(text\(row\.id\)\)\)/);
});
test('Web verlangt ausdrückliche Aktion und Native-Oberfläche bleibt unverändert leer',async()=>{
  const web=await fs.readFile(new URL('../../src/components/office/ClientInvoiceDraftSummary.web.tsx',import.meta.url),'utf8');
  const native=await fs.readFile(new URL('../../src/components/office/ClientInvoiceDraftSummary.tsx',import.meta.url),'utf8');
  assert.match(web,/Rechnungsentwurf erstellen/); assert.match(web,/Zahlungsziel in Tagen/); assert.match(web,/gibt keine Rechnung frei/);
  assert.match(native,/return null/);
});
