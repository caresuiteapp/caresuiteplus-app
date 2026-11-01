// Local isolated byte evidence using the already available pdf-lib 1.17.1,
// identical to the Edge pin. No installation, remote writes or real patient data.
import '../tests/gkv-exchange/register.mjs';
import {createRequire,registerHooks} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
assert.equal(require('pdf-lib/package.json').version,'1.17.1');
registerHooks({resolve(s,c,next){return next(s==='npm:pdf-lib@1.17.1'?require.resolve('pdf-lib'):s,c);}});
const {renderVisitProofPdf}=await import('../supabase/functions/complete-assist-service-record/visitProofPdf.ts');
const {assistOriginalFixture}=await import('../tests/gkv-exchange/monthly-assist-fixture.mjs');
const x=await assistOriginalFixture({render:renderVisitProofPdf});
try{
 await x.approve(await x.submit());const visit=await x.start();await x.finish(visit);
 const before=await x.context(visit),sealed=await x.seal(visit,before.draft);
 const response=await x.complete(visit);assert.equal(response.status,200,await response.clone().text());
 const result=await response.json();assert.equal(result.data.proofId,sealed.original.proofId);
 const monthly=await x.monthly(visit);await x.freeze(monthly);await x.prepare(monthly);
 assert.equal(monthly.p.payload.xmlFacts.captureProvenance,'personally-bound');
 assert.equal(monthly.p.payload.xmlFacts.sources[0].personalCapture.proofId,sealed.original.proofId);
 assert.equal((await x.complete(visit)).status,200);
 console.log(JSON.stringify({result:'passed',renderer:'Edge pdf-lib 1.17.1',assistPdfBytes:x.storage.get(result.data.pdfPath).length,
  monthlyPdfBytes:monthly.original.bytes.length,provenance:'personally-bound',monthlyConfirmation:'still-required',hardwareEvidence:false}));
}finally{await x.close();}
