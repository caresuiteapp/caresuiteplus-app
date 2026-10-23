import test from 'node:test';
import assert from 'node:assert/strict';
import { importInvoiceCase, readSourceSnapshot, verifyCaseSources } from '../../src/lib/gkvExchange/sources.ts';
import { linkedFixture, tenantId, invoiceId, userId } from './fixtures.mjs';
test('invoice import preserves amounts, item and proof revisions without inferring GKV tariff keys',()=>{
  const {source}=linkedFixture({record:true,proof:true});const c=importInvoiceCase(source,'2026-10');
  assert.equal(c.grossCents,8000);assert.equal(c.lines[0].sourceItemId,source.items[0].id);assert.equal(c.lines[0].sourceRecordUpdatedAt,source.records[0].updated_at);
  assert.equal(c.lines[0].remuneration,'');assert.equal(c.lines[0].code,'');assert.equal(c.proofConfirmed,false);assert.equal(c.sourceProofs[0].pdfSha256,source.proofs[0].sha256);
});
test('foreign, duplicate or incomplete source snapshots are rejected as a whole',()=>{
  for(const mutate of [s=>{s.items.push({...s.items[0]});},s=>{s.client.tenant_id=userId;},s=>{s.items[0].invoice_id=userId;},s=>{s.proofs=[];},s=>{s.records.push({...s.records[0]});}]){
    const {source}=linkedFixture({proof:true,record:true});mutate(source);assert.throws(()=>readSourceSnapshot({version:'gkv-invoice-source-v1',invoices:[source]},tenantId,[invoiceId]));
  }
});
test('out-of-month, taxable, imprecise and inconsistent invoices cannot be imported',()=>{
  for(const mutate of [s=>{s.items[0].service_date='2026-09-30';},s=>{s.items[0].vat_amount='0.01';},s=>{s.items[0].vat_rate=null;},s=>{s.items[0].quantity='1.001';},s=>{s.total_amount='79.99';}]){
    const {source}=linkedFixture();mutate(source);assert.throws(()=>importInvoiceCase(source,'2026-10'));
  }
});
test('proof revision, hash, selection and service-record changes invalidate a saved case',()=>{
  for(const mutate of [s=>{s.proofs[0].updated_at='2026-10-18T10:00:00Z';},s=>{s.proofs[0].sha256='c'.repeat(64);},s=>{s.selected_proof_ids=[];},s=>{s.records[0].updated_at='2026-10-18T10:00:00Z';},s=>{s.records[0].billed_invoice_id=userId;},s=>{s.client.insurance_number='OTHER';}]){
    const {draft,source}=linkedFixture({proof:true,record:true});mutate(source);assert.ok(verifyCaseSources(draft.cases[0],source).length);
  }
});
test('each invoice item must be represented once and time may not exceed the verified service',()=>{
  const {draft,source}=linkedFixture({record:true});const c=draft.cases[0];assert.deepEqual(verifyCaseSources(c,source),[]);
  c.lines.push({...c.lines[0]});assert.ok(verifyCaseSources(c,source).some(i=>i.path==='lines'));c.lines.pop();
  Object.assign(c.lines[0],{remuneration:'02',duration:'90'});assert.ok(verifyCaseSources(c,source).some(i=>i.path.endsWith('duration')));
});
