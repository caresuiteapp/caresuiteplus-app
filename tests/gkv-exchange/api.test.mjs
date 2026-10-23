import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createGkvTestExportHandler } from '../../api/_lib/gkv-test-export.ts';
import { emptyAid } from '../../src/lib/gkvExchange/special.ts';
import { fixture, tenantId, batchId, userId, invoiceId, linkedFixture, pdfBytes } from './fixtures.mjs';

function setup(options = {}) {
  const draft = options.draft || fixture(); let reads = 0; let sourceReads=0; const calls = [];
  const base = { id: batchId, tenant_id: tenantId, revision: 2, status: 'draft', draft };
  const fetcher = async (url, init) => {
    calls.push({url,init});
    if (options.networkError) throw new Error('Private upstream detail');
    if (url.endsWith('/auth/v1/user')) return Response.json({id:options.badUser?'invalid':userId});
    if (url.endsWith('/rpc/gkv_exchange_export_allowed')) return Response.json(options.denied ? false : true);
    if (url.includes('/gkv_exchange_batches?')) return Response.json(options.hidden ? [] : [{ ...base, ...options.row, revision:options.changed && reads++ > 0 ? 3 : options.row?.revision || 2 }]);
    if (url.includes('/invoices?')) return Response.json(options.invoices || []);
    if (url.endsWith('/rpc/gkv_invoice_source_snapshot')) {
      if(options.sourceDenied)return Response.json({code:'P0001',message:'Private signature detail'},{status:400});
      const invoices=structuredClone(options.invoices||[]);
      if(options.sourceChanged && sourceReads++>0)invoices[0].items[0].updated_at='2026-10-19T12:00:00Z';
      return Response.json({version:'gkv-invoice-source-v1',invoices});
    }
    if(url.includes('/storage/v1/object/authenticated/office-documents/'))return new Response(options.pdf||pdfBytes,{status:options.pdfMissing?404:200});
    throw new Error('Unexpected destination');
  };
  const handler = createGkvTestExportHandler({ fetch:fetcher,env:{EXPO_PUBLIC_SUPABASE_URL:'https://example.supabase.co',EXPO_PUBLIC_SUPABASE_ANON_KEY:'public-anon-key'} });
  async function request(overrides = {}) {
    let code; let body; const headers = {};
    const res = {status(value){code=value;return this;},setHeader(key,value){headers[key]=value;},json(value){body=value;}};
    await handler({method:'POST',headers:{authorization:'Bearer test.jwt.token'},body:{tenantId,batchId,revision:2},...overrides},res);
    return {code,body,headers,calls};
  }
  return { request, calls };
}

test('export endpoint generates deterministic Latin-1 bytes from the canonical saved revision', async () => {
  const {code,body,headers,calls} = await setup().request();
  assert.equal(code,200); assert.equal(body.kind,'unencrypted_test'); assert.equal(body.name,'TPFL0001'); assert.equal(body.revision,2);
  const bytes=Buffer.from(body.dataBase64,'base64'); assert.equal(createHash('sha256').update(bytes).digest('hex'),body.sha256); assert.equal(Buffer.from(body.orderBase64,'base64').length,348);
  assert.equal(headers['Cache-Control'],'private, no-store'); assert.equal(calls.length,4);
  assert.ok(calls.every(call => call.url.startsWith('https://example.supabase.co/')));
  assert.ok(calls.every(call => call.init.headers.Authorization==='Bearer test.jwt.token'));
  assert.ok(calls.filter(c=>c.url.includes('/gkv_exchange_batches')).every(c=>c.url.includes(`tenant_id=eq.${tenantId}`)));
});
test('GET and anonymous requests cannot read any billing record', async () => {
  const s=setup(); assert.equal((await s.request({method:'GET'})).code,405); assert.equal((await s.request({headers:{}})).code,401); assert.equal(s.calls.length,0);
});
test('missing export permission is enforced server-side before loading a batch', async () => {
  const r=await setup({denied:true}).request(); assert.equal(r.code,403); assert.ok(!r.calls.some(c=>c.url.includes('/gkv_exchange_batches')));
});
test('caller-supplied draft content and malformed requests are rejected', async () => {
  const s=setup(); assert.equal((await s.request({body:{tenantId,batchId,revision:2,draft:fixture()}})).code,400);
  assert.equal((await s.request({body:'{'})).code,400); assert.equal((await s.request({body:'x'.repeat(4097)})).code,413); assert.equal(s.calls.length,0);
});
test('a hidden or foreign-tenant batch never leaks payload bytes', async () => {
  const hidden=await setup({hidden:true}).request(); assert.equal(hidden.code,503); assert.equal(hidden.body.dataBase64,undefined);
  const foreign=await setup({row:{tenant_id:userId}}).request(); assert.equal(foreign.code,409); assert.equal(foreign.body.dataBase64,undefined);
});
test('stale and concurrently edited revisions fail without returning artifacts', async () => {
  for(const options of [{row:{revision:3}},{changed:true},{row:{status:'cancelled'}}]){const r=await setup(options).request();assert.equal(r.code,409);assert.equal(r.body.dataBase64,undefined);}
});
test('server validation catches corrupt drafts and refuses production mode', async () => {
  const malformed=await setup({draft:{profile:{},cases:[{}]}}).request(); assert.equal(malformed.code,422);
  const d=fixture();d.mode='production';const production=await setup({draft:d}).request();assert.equal(production.code,422);assert.equal(production.body.dataBase64,undefined);
});
test('linked invoices must match tenant, revision, number, amount and patient', async () => {
  const {draft:d,source:invoice}=linkedFixture();
  assert.equal((await setup({draft:d,invoices:[invoice]}).request()).code,200);
  for(const changed of [{tenant_id:batchId},{updated_at:'2026-10-18T11:00:00Z'},{status:'cancelled'},{invoice_number:'OTHER'},{total_amount:'79.99'},{client_id:batchId}]){
    const r=await setup({draft:d,invoices:[{...invoice,...changed}]}).request();assert.equal(r.code,409);assert.equal(r.body.dataBase64,undefined);
  }
});
test('export verifies canonical line references and rejects partial or altered financial mappings',async()=>{
  for(const mutate of [s=>{s.items[0].gross_amount='79.99';},s=>{s.items[0].updated_at='2026-10-18T11:00:00Z';},s=>{s.items[0].vat_amount='1.00';},s=>{s.items[0].service_date='2026-10-15';},s=>{s.items=[];}]){
    const {draft,source}=linkedFixture();mutate(source);const r=await setup({draft,invoices:[source]}).request();assert.equal(r.code,409);assert.equal(r.body.dataBase64,undefined);
  }
});
test('taxable aid export checks canonical net, tax and gross before returning HIL bytes',async()=>{
  const {draft,source}=linkedFixture();draft.serviceType='06';
  Object.assign(draft.profile,{billingCode:'19',taxTreatment:'taxable',taxExemptionCode:'',taxNumber:'123/456/789'});
  const c=draft.cases[0],l=c.lines[0];c.grossCents=23808;
  Object.assign(l,{remuneration:'05',code:'5001010001',unitPriceCents:10003,quantityHundredths:200,totalCents:23808,contractReference:'Fiktiver Liefervertrag',aid:{...emptyAid(),kind:'technical',vatTreatment:'add',vatCode:'1',supplyCode:'00',approvalReference:'GEN-1'}});
  source.total_amount='238.08';Object.assign(source.items[0],{unit_price:'100.03',quantity:'2',net_amount:'200.06',vat_amount:'38.02',vat_rate:'19',gross_amount:'238.08'});
  const result=await setup({draft,invoices:[source]}).request();assert.equal(result.code,200);
  assert.ok(Buffer.from(result.body.dataBase64,'base64').toString('latin1').includes("HIL+1+19,01+0,00+GEN-1++00'"));
  for(const change of [{vat_amount:'38.01'},{net_amount:'200.07'},{vat_rate:'7'},{quantity:'1'},{unit_price:'100.04'}]){
    const changed=structuredClone(source);Object.assign(changed.items[0],change);
    const r=await setup({draft,invoices:[changed]}).request();assert.equal(r.code,409);assert.equal(r.body.dataBase64,undefined);
  }
});
test('upstream signature checks and mutations during PDF verification fail closed',async()=>{
  for(const option of [{sourceDenied:true},{sourceChanged:true}]){const {draft,source}=linkedFixture({record:true});const r=await setup({draft,invoices:[source],...option}).request();assert.equal(r.code,409);assert.ok(!JSON.stringify(r.body).includes('Private signature'));}
});
test('original PDF bytes are downloaded with user JWT and compared with the trusted hash',async()=>{
  const {draft,source}=linkedFixture({proof:true,record:true});
  const valid=await setup({draft,invoices:[source]}).request();assert.equal(valid.code,200);assert.equal(valid.body.sourceReport.checkedPdfFiles,1);assert.equal(valid.body.sourceReport.checkedServiceRecords,1);
  const storage=valid.calls.find(c=>c.url.includes('/storage/'));assert.equal(storage.init.headers.Authorization,'Bearer test.jwt.token');assert.equal(storage.init.redirect,'error');
  for(const option of [{pdf:Buffer.from('%PDF-1.7 changed')},{pdfMissing:true},{pdf:Buffer.alloc(20*1024*1024+1)}]){const r=await setup({draft,invoices:[source],...option}).request();assert.equal(r.code,409);assert.equal(r.body.dataBase64,undefined);}
});
test('foreign, traversal and URL proof paths cannot be fetched',async()=>{
  for(const path of ['https://external.invalid/test.pdf',`tenant/${userId}/a.pdf`,`tenant/${tenantId}/../a.pdf`,`tenant/${tenantId}/%2e%2e/a.pdf`]){const {draft,source}=linkedFixture({proof:true});source.proofs[0].path=path;const r=await setup({draft,invoices:[source]}).request();assert.equal(r.code,409);assert.ok(!r.calls.some(c=>c.url.includes('/storage/')));}
});
test('a caller cannot detach an invoice and retain unverified source references',async()=>{
  const {draft}=linkedFixture({proof:true});delete draft.cases[0].sourceInvoiceId;const r=await setup({draft}).request();assert.equal(r.code,422);
});
test('network errors are redacted and do not trigger another recipient or send', async () => {
  const r=await setup({networkError:true}).request();assert.equal(r.code,503);assert.ok(!JSON.stringify(r.body).includes('Private upstream'));assert.equal(r.calls.length,1);
});
