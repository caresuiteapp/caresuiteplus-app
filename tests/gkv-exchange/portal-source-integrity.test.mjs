import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {assistDeferredFixture} from './monthly-assist-deferred-fixture.mjs';
const wrong='sha256:'+'0'.repeat(64);
test('Portal binds the released preview, recorded signature and signed snapshot before writing a receipt', async t=>{
 const x=await assistDeferredFixture({monthlyCapture:false}),{db,as}=x.f;
 try {
  const v=await x.prepareDeferred();
  const release=(snap,h)=>as(x.personal(),'SELECT public.employee_portal_release_deferred_signature($1,$2,$3,$4,$5::jsonb,$6)',[x.f.tenant,v.draft,v.client,'Prüfung',JSON.stringify(snap),h]);
  await t.test('hash of a different preview and correctly hashed foreign identities cannot release a document',async()=>{
   await assert.rejects(release(v.snapshot,wrong),e=>e.code==='22023');
   for(const key of ['visitId','employeeId','clientId']){
    const foreign={...v.snapshot,[key]:randomUUID()};await assert.rejects(release(foreign,await x.jsonHash(foreign)),e=>e.code==='22023');
   }
   assert.equal((await db.query('SELECT id FROM public.client_documents WHERE id=$1',[v.draft])).rows.length,0);
  });
  await t.test('database and JS agree on nested German text, order, bare and prefixed SHA-256',async()=>{
   const obj={z:'Ärztliche Hilfe 🖊',items:[{z:2,a:true},null],a:'Zeile 1\nZeile 2'};
   const wire=JSON.stringify({a:obj.a,items:[{a:true,z:2},null],z:obj.z});
   const h=createHash('sha256').update(wire).digest('hex');
   const check=async(s,h)=>(await db.query('SELECT care_security.gkv_portal_snapshot_matches($1::jsonb,$2) AS ok',[JSON.stringify(s),h])).rows[0].ok;
   assert.ok(await check(obj,h));assert.ok(await check(obj,'sha256:'+h));assert.equal(await check({...obj,items:[null,{a:true,z:2}]},h),false);
   assert.equal(await check(null,h),false);assert.equal(await check({...obj,z:'x'.repeat(256001)},h),false);
  });
  for(const [description,opts] of [
    ['wrong full signed hash',{signedHash:wrong}],
    ['missing link to the original release',{signatureMetadata:{proofPayloadHash:null}}],
    ['link to a different release',{signatureMetadata:{proofPayloadHash:wrong}}],
    ['signature of other service content',{signaturePayloadHash:wrong}],
    ['signature image belonging to a different capture',{signaturePath:'tenant/foreign/assist/visits/foreign/signatures/other.png'}],
  ]) await t.test(description+' leaves the document open and audit empty',async()=>{
    const z=await x.prepareDeferred(); await x.releaseDeferred(z);await x.closeVisit(z);
    await assert.rejects(x.signDeferred(z,opts),e=>e.code==='22023');
    const p=(await db.query('SELECT portal_release_status,signature_id,pdf_storage_path FROM public.assist_visit_proofs WHERE id=$1',[z.draft])).rows[0];
    assert.deepEqual(p,{portal_release_status:'pending_client_signature',signature_id:null,pdf_storage_path:null});
    assert.equal((await db.query('SELECT signature_required FROM public.client_documents WHERE id=$1',[z.draft])).rows[0].signature_required,true);
    assert.equal((await db.query('SELECT 1 FROM public.audit_logs WHERE record_id=$1',[z.draft])).rows.length,0);
  });
  await t.test('a legitimate completion is idempotent; a false replay hash or changed persisted evidence does not confirm it',async()=>{
    await x.releaseDeferred(v);await x.closeVisit(v);const ok=await x.signDeferred(v);
    assert.deepEqual(await x.signDeferred(v),ok);
    await assert.rejects(x.signDeferred(v,{signedHash:wrong}),e=>e.code==='22023');
    await db.query("UPDATE public.assist_visit_proofs SET payload_snapshot=jsonb_set(payload_snapshot,'{title}',to_jsonb('Geändert'::text)) WHERE id=$1",[v.draft]);
    await assert.rejects(x.signDeferred(v),e=>e.code==='22023');
    assert.equal((await db.query('SELECT 1 FROM public.audit_logs WHERE record_id=$1',[v.draft])).rows.length,1);
  });
  await t.test('neither helper is executable by an app role',async()=>{
   const r=await db.query(`SELECT bool_or(has_function_privilege(role,sig,'EXECUTE')) granted FROM unnest(ARRAY['anon','authenticated','service_role']) role
   CROSS JOIN unnest(ARRAY['care_security.gkv_portal_snapshot_matches(jsonb,text)','care_security.gkv_portal_signature_matches(jsonb,uuid,uuid,text)']) sig`);
   assert.equal(r.rows[0].granted,false);
  });
 }finally{await x.close();}
});
