import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createGkvTestExportHandler } from '../../api/_lib/gkv-test-export.ts';
import { fixture, tenantId, batchId, userId, invoiceId } from './fixtures.mjs';

function setup(options = {}) {
  const draft = options.draft || fixture(); let reads = 0; const calls = [];
  const base = { id: batchId, tenant_id: tenantId, revision: 2, status: 'draft', draft };
  const fetcher = async (url, init) => {
    calls.push({url,init});
    if (options.networkError) throw new Error('Private upstream detail');
    if (url.endsWith('/auth/v1/user')) return Response.json({id:options.badUser?'invalid':userId});
    if (url.endsWith('/rpc/gkv_exchange_export_allowed')) return Response.json(options.denied ? false : true);
    if (url.includes('/gkv_exchange_batches?')) return Response.json(options.hidden ? [] : [{ ...base, ...options.row, revision:options.changed && reads++ > 0 ? 3 : options.row?.revision || 2 }]);
    if (url.includes('/invoices?')) return Response.json(options.invoices || []);
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
  const d=fixture();Object.assign(d.cases[0],{sourceInvoiceId:invoiceId,sourceUpdatedAt:'2026-10-18T10:00:00Z',clientId:userId});
  const invoice={id:invoiceId,tenant_id:tenantId,updated_at:'2026-10-18T10:00:00Z',status:'issued',invoice_number:'RE2026-1',total_amount:'80.00',client_id:userId};
  assert.equal((await setup({draft:d,invoices:[invoice]}).request()).code,200);
  for(const changed of [{tenant_id:batchId},{updated_at:'2026-10-18T11:00:00Z'},{status:'cancelled'},{invoice_number:'OTHER'},{total_amount:'79.99'},{client_id:batchId}]){
    const r=await setup({draft:d,invoices:[{...invoice,...changed}]}).request();assert.equal(r.code,409);assert.equal(r.body.dataBase64,undefined);
  }
});
test('network errors are redacted and do not trigger another recipient or send', async () => {
  const r=await setup({networkError:true}).request();assert.equal(r.code,503);assert.ok(!JSON.stringify(r.body).includes('Private upstream'));assert.equal(r.calls.length,1);
});
