import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {assistDeferredFixture} from './monthly-assist-deferred-fixture.mjs';
import {signingPng} from './monthly-host-fixture.mjs';
import {readMonthlyProof} from '../../src/lib/gkvExchange/monthlyProof.ts';
import {monthlyDifferences} from '../../src/lib/gkvExchange/monthlyWorkspace.ts';
import {readAmendmentState} from '../../src/lib/gkvExchange/assistAmendment.ts';

const draft=new URL('../../docs/gkv/sql/monthly-assist-amendments-draft.sql',import.meta.url);
const conflict=e=>e.code==='40001',denied=e=>e.code==='42501',invalid=e=>e.code==='22023';
async function fixture(deferred=false){
 const x=await assistDeferredFixture(),{f}=x;
 try{
  await f.db.exec(await readFile(draft,'utf8'));await x.approve(await x.submit());
  let v;
  if(deferred){v=await x.prepareDeferred();await x.releaseDeferred(v);await x.closeVisit(v);await x.signDeferred(v);}
  else{v=await x.start();await x.finish(v);}
  const sealed=await x.seal(v,(await x.context(v)).draft);
  const scope={tenantId:f.tenant,assignmentId:v.assignment,employeeId:x.employee,actorId:f.actorId,proofId:sealed.original.proofId,proofHash:sealed.original.payloadHash};
  const state=async(before=null,lookup=null,identity=x.personal())=>
   readAmendmentState((await f.as(identity,'SELECT public.gkv_assist_amendment_state($1,$2,$3,$4) v',[f.tenant,v.assignment,before,lookup])).rows[0].v,scope,before,lookup);
  const save=async(input,id=randomUUID(),identity=x.personal(),tenant=f.tenant)=>(await f.as(identity,
   'SELECT public.gkv_assist_amend_description($1,$2,$3,$4::jsonb) v',[tenant,v.assignment,id,JSON.stringify(input)])).rows[0].v;
  const input=(revision=0,previousId=null)=>({proofId:scope.proofId,proofHash:scope.proofHash,revision,previousId,
   description:'Berichtigte synthetische Beschreibung '+(revision+1)+'.',reason:'Schreibfehler im ursprünglichen Freitext.'});
  const row=async id=>readMonthlyProof((await f.db.query('SELECT to_jsonb(p) v FROM public.gkv_monthly_proofs p WHERE id=$1',[id])).rows[0].v,f.tenant);
  return {x,f,v,scope,state,save,input,row};
 }catch(e){await x.close();throw e;}
}

test('Personal Assist amendment: retained original, open month, stale capture and fresh confirmation',async t=>{
 const {x,f,v,scope,state,save,input,row}=await fixture();let one,two,monthly,oldReceipt,old,archive;
 try{
  await t.test('amend before monthly handoff; replay and scoped status recover exactly one entry',async()=>{
   const head=await state();assert.equal(head.revision,0);assert.equal(head.originalText,v.snapshot.documentationNote);
   const id=randomUUID();one=await save(input(),id);assert.equal(one.id,id);assert.equal(one.previousId,null);
   assert.deepEqual(await save(input(),id),one);assert.deepEqual((await state(null,id)).lookup,one);
   await assert.rejects(save({...input(),reason:'Anderer Auftrag'},id),conflict);
   await assert.rejects(save(input()),conflict);
   const response=await x.complete(v);assert.equal(response.status,200,await response.clone().text());
   monthly=await x.monthly(v);
   const record=monthly.p.payload.records[0];assert.deepEqual(record.amendment,one);assert.equal(record.description,head.originalText);
   assert.equal(record.sourceReceipt.proof_id,scope.proofId);assert.equal(record.sourceReceipt.proof_payload_hash,scope.proofHash);
   await x.freeze(monthly);await x.prepare(monthly);old=monthly.p;
   oldReceipt=await x.worker.verify(monthly.input,Buffer.from(signingPng(7),'base64'));
  });
  await t.test('open month changes atomically; old capture, missing-signature fallback and stale revision cannot finalize it',async()=>{
   two=await save(input(1,one.id));monthly.p=await row(old.id);assert.equal(monthly.p.revision,old.revision+1);
   assert.notEqual(monthly.p.content_sha256,old.content_sha256);assert.equal(monthly.p.payload.xmlFacts,undefined);assert.equal(monthly.p.confirmation,null);
   assert.equal(monthly.p.payload.schema,'gkv-monthly-amended-source-v1');
   assert.throws(()=>readMonthlyProof({...monthly.p,payload:{...monthly.p.payload,schema:'gkv-monthly-source-v1'}},f.tenant));
   await assert.rejects(x.worker.prepare({tenantId:f.tenant,proofId:monthly.p.id,revision:monthly.p.revision,captureId:randomUUID()}));
   assert.deepEqual(monthly.p.payload.records[0].amendment,two);assert.ok(monthlyDifferences(old,monthly.p).some(d=>d.key.endsWith(':amendment')));
   const confirm=(p)=>f.command('confirm',{id:p.id,revision:p.revision,content_sha256:p.content_sha256,receipt_id:oldReceipt.receiptId});
   await assert.rejects(confirm(old),conflict);await assert.rejects(confirm(monthly.p));await assert.rejects(x.worker.status(monthly.input));
   await assert.rejects(f.command('finalize_missing',{id:monthly.p.id,revision:monthly.p.revision,content_sha256:monthly.p.content_sha256,reason:'Keine neue Unterschrift'}),invalid);
   const active=(await x.context(v)).original;assert.equal(active.proofId,scope.proofId);assert.equal(active.payloadHash,scope.proofHash);
  });
  await t.test('new PDF contains the original, corrected description and reason; a fresh signature confirms only this revision',async()=>{
   monthly.input={tenantId:f.tenant,proofId:monthly.p.id,revision:monthly.p.revision,captureId:randomUUID()};
   await x.freeze(monthly);await x.prepare(monthly);
   const pdf=await getDocument({data:new Uint8Array(monthly.original.bytes),useSystemFonts:true,disableFontFace:true}).promise;
   try{let actual='';for(let i=1;i<=pdf.numPages;i++)actual+=' '+(await(await pdf.getPage(i)).getTextContent()).items.map(r=>r.str).join(' ');
    for(const value of [v.snapshot.documentationNote,'Berichtigung 2',two.description,two.reason])assert.ok(actual.replace(/\s+/g,' ').includes(value),value);}
   finally{await pdf.destroy();}
   const final=await x.confirm(monthly);assert.equal(final.confirmation.kind,'signature');assert.notEqual(final.confirmation.receiptId,oldReceipt.receiptId);
   archive=await x.worker.readArchivedOriginal({tenantId:f.tenant,proofId:final.id,captureId:monthly.input.captureId});assert.equal(archive.status,'final');
  });
  await t.test('another correction invalidates the signed predecessor, opens an unsigned replacement and preserves original PDF bytes',async()=>{
   const final=monthly.p,three=await save(input(2,two.id)),invalidated=await row(final.id);
   assert.equal(invalidated.status,'invalidated');assert.deepEqual(invalidated.confirmation,final.confirmation);
   assert.deepEqual(invalidated.payload,final.payload);assert.equal(invalidated.content_sha256,final.content_sha256);
   const id=(await f.db.query("SELECT id FROM public.gkv_monthly_proofs WHERE series_id=$1 AND status='open'",[final.series_id])).rows[0].id;
   const next=await row(id);assert.equal(next.predecessor_id,final.id);assert.equal(next.version,final.version+1);
   assert.equal(next.confirmation,null);assert.equal(next.payload.xmlFacts,undefined);assert.deepEqual(next.payload.records[0].amendment,three);
   assert.deepEqual(next.payload.records[0].sourceReceipt,final.payload.records[0].sourceReceipt);
   const reread=await x.worker.readArchivedOriginal({tenantId:f.tenant,proofId:final.id,captureId:monthly.input.captureId});
   assert.equal(reread.status,'invalidated');assert.deepEqual(reread.bytes,archive.bytes);
   assert.equal((await f.db.query("SELECT count(*)::int n FROM public.gkv_monthly_proof_events WHERE action='invalidate_for_amendment' AND proof_id=$1",[final.id])).rows[0].n,1);
  });
 }finally{await x.close();}
});

test('Personal Assist amendment: authorization, rollback, immutable paginated audit and scoped source guard',async t=>{
 const {x,f,v,scope,state,save,input}=await fixture(true);let previous=null;
 try{
  await t.test('foreign or expired accounts, other tenants, wrong original and injected fields fail before any change',async()=>{
   for(const identity of [x.reviewClaims(),x.clientClaims(v),{...x.personal(),session_id:randomUUID()},{...x.personal(),account_id:randomUUID()}]){
    await assert.rejects(save(input(),randomUUID(),identity));await assert.rejects(state(null,null,identity));}
   await assert.rejects(save(input(),randomUUID(),x.personal(),randomUUID()),denied);
   for(const bad of [{proofHash:'sha256:'+'a'.repeat(64)},{proofId:randomUUID()},{revision:1}])await assert.rejects(save({...input(),...bad}),conflict);
   for(const bad of [{serviceSeconds:2},{reason:'x'},{description:v.snapshot.documentationNote},{description:'a\u0007b'},{description:'x'.repeat(1501)}])await assert.rejects(save({...input(),...bad}),invalid);
   assert.equal((await state()).revision,0);
  });
  await t.test('a failed monthly change rolls back the new amendment as well',async()=>{
   assert.equal((await x.complete(v)).status,200);const m=await x.monthly(v);
   await f.db.exec("CREATE FUNCTION public.fixture_block_amendment() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic month failure';END $$; CREATE TRIGGER fixture_block_amendment BEFORE UPDATE ON public.gkv_monthly_proofs FOR EACH ROW EXECUTE FUNCTION public.fixture_block_amendment()");
   try{await assert.rejects(save(input()),/synthetic month failure/);}finally{await f.db.exec('DROP TRIGGER fixture_block_amendment ON public.gkv_monthly_proofs');}
   assert.equal((await state()).revision,0);assert.equal((await f.db.query('SELECT revision FROM public.gkv_monthly_proofs WHERE id=$1',[m.p.id])).rows[0].revision,m.p.revision);
  });
  await t.test('eleven revisions retain the entire ordered chain and old request lookups across pages',async()=>{
   let first;for(let i=0;i<11;i++){const a=await save(input(i,previous));assert.equal(a.previousId,previous);previous=a.id;first??=a;}
   const head=await state(null,first.id);assert.equal(head.revision,11);assert.equal(head.entries.length,10);assert.equal(head.nextBefore,2);assert.deepEqual(head.lookup,first);
   const last=await state(head.nextBefore);assert.equal(last.nextBefore,null);assert.deepEqual(last.entries,[first]);assert.equal(head.entries.at(-1).previousId,first.id);
   assert.equal(head.originalText,v.snapshot.documentationNote);assert.equal((await x.context(v)).original.proofId,scope.proofId);
   assert.equal((await x.captured(v)).payload_snapshot.documentationNote,v.snapshot.documentationNote);
  });
  await t.test('table and internal month updater are private; history resists updates and deletion',async()=>{
   await assert.rejects(f.as(x.personal(),'SELECT * FROM care_security.gkv_assist_amendments'),denied);
   await assert.rejects(f.as(x.personal(),'SELECT care_security.gkv_assist_amend_months(NULL)'),denied);
   await assert.rejects(f.db.query('UPDATE care_security.gkv_assist_amendments SET reason=$1 WHERE id=$2',['Manipulierte Begründung',previous]),denied);
   await assert.rejects(f.db.query('DELETE FROM care_security.gkv_assist_amendments WHERE id=$1',[previous]),denied);
   assert.equal((await state()).revision,11);
  });
 }finally{await x.close();}
});
