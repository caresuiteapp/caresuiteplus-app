// Local isolated byte evidence using the already available pdf-lib 1.17.1,
// identical to the Edge pin. No installation, remote writes or real patient data.
import '../tests/gkv-exchange/register.mjs';
import {createRequire,registerHooks} from 'node:module';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
assert.equal(require('pdf-lib/package.json').version,'1.17.1');
registerHooks({resolve(s,c,next){return next(s==='npm:pdf-lib@1.17.1'?require.resolve('pdf-lib'):s,c);}});
const {renderVisitProofPdf}=await import('../supabase/functions/complete-assist-service-record/visitProofPdf.ts');
const {assistOriginalFixture}=await import('../tests/gkv-exchange/monthly-assist-fixture.mjs');
const {assistDeferredFixture}=await import('../tests/gkv-exchange/monthly-assist-deferred-fixture.mjs');
for(const deferred of [false,true]){
 const x=await (deferred?assistDeferredFixture:assistOriginalFixture)({render:renderVisitProofPdf});
 try{
 await x.approve(await x.submit());let visit;
 if(deferred){visit=await x.prepareDeferred();await x.releaseDeferred(visit);await x.closeVisit(visit);await x.ageDeferred(visit);await x.signDeferred(visit);}
 else{visit=await x.start();await x.finish(visit);}
 const before=await x.context(visit),sealed=await x.seal(visit,before.draft);
 const response=await x.complete(visit);assert.equal(response.status,200,await response.clone().text());
 const result=await response.json();assert.equal(result.data.proofId,sealed.original.proofId);
 const monthly=await x.monthly(visit);await x.freeze(monthly);await x.prepare(monthly);
 assert.equal(monthly.p.payload.xmlFacts.captureProvenance,'personally-bound');
 assert.equal(monthly.p.payload.xmlFacts.sources[0].personalCapture.proofId,sealed.original.proofId);
 assert.equal((await x.complete(visit)).status,200);
 const flow=deferred?'deferred':'on-site',output=process.env.GKV_ASSIST_TEST_EVIDENCE_DIR;
 if(output){await mkdir(output,{recursive:true});await writeFile(join(output,flow+'-assist.pdf'),x.storage.get(result.data.pdfPath));await writeFile(join(output,flow+'-monthly.pdf'),monthly.original.bytes);}
 console.log(JSON.stringify({result:'passed',flow,renderer:'Edge pdf-lib 1.17.1',assistPdfBytes:x.storage.get(result.data.pdfPath).length,
  monthlyPdfBytes:monthly.original.bytes.length,provenance:'personally-bound',monthlyConfirmation:'still-required',hardwareEvidence:false}));
 }finally{await x.close();}
}
