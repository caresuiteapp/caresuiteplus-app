import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,writeFileSync} from 'node:fs';
import {stripTypeScriptTypes,createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
const runtime=createRequire(`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/package.json`);
const pdfLib=runtime('pdf-lib');
const context=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,DataView,Date,Array,Blob,Request,Response,btoa,atob,console});
// pdf-lib and the isolated source share array identity, as in the Edge runtime.
vm.runInContext("Object.setPrototypeOf(Object.getPrototypeOf([]), Array.prototype)",context);
const modules=new Map();
async function load(url){
 if(modules.has(url.href))return modules.get(url.href);
 const m=new vm.SourceTextModule(stripTypeScriptTypes(readFileSync(url,'utf8')),{context,identifier:url.href});modules.set(url.href,m);
 await m.link(async(specifier,parent)=>{
  if(specifier.startsWith('npm:pdf-lib')){const p=new vm.SyntheticModule(['PDFDocument','StandardFonts','rgb'],function(){for(const key of ['PDFDocument','StandardFonts','rgb'])this.setExport(key,pdfLib[key]);},{context});return p;}
  return load(new URL(specifier,parent.identifier));
 });await m.evaluate();return m;
}
const base=new URL('../supabase/functions/complete-assist-service-record/',import.meta.url);
const bytes=(await load(new URL('proofBytes.ts',base))).namespace;
const {renderVisitProofPdf}=(await load(new URL('visitProofPdf.ts',base))).namespace;
const {createProofCompletionHandler}=(await load(new URL('handler.ts',base))).namespace;
const png=Uint8Array.from(Buffer.from('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','base64'));
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const tenant=id(1),assignment=id(5),visit=id(6),client=id(7),proof=id(8),signatureId=id(9);
const at='2026-10-12T09:03:00.000Z';
const snapshot={visitId:visit,clientId:client,employeeId:id(2),title:'Alltagsbegleitung',serviceName:'Alltagsbegleitung',tasks:[],
 plannedStartAt:'2026-10-12T08:00:00.000Z',plannedEndAt:'2026-10-12T09:00:00.000Z',
 documentationNote:'Synthetische Prüfdaten: Unterstützung durchgeführt. Keine echte Leistung.',
 signature:{signerName:'Testperson',signerRole:'client',signedAt:at},visitTimes:{serviceStartedAt:'2026-10-12T08:00:00.000Z',serviceEndedAt:'2026-10-12T09:00:00.000Z',serviceSeconds:3600},generatedAt:at};
const source={receipt:{version:'workflow-assignment-record-v1',tenant_id:tenant,assignment_id:assignment,visit_id:visit,proof_id:proof,signature_id:signatureId,
 actual_minutes:60,service_started_at:snapshot.visitTimes.serviceStartedAt,service_ended_at:snapshot.visitTimes.serviceEndedAt,
 proof_payload_hash:await bytes.hashBytes(new TextEncoder().encode(bytes.canonicalJson(snapshot)))},snapshot,signature_id:signatureId,
 signature_storage_path:`tenant/${tenant}/assist/visits/${visit}/signatures/${signatureId}.png`,
 signature_hash:await bytes.hashBytes(new TextEncoder().encode(`data:image/png;base64,${Buffer.from(png).toString('base64')}`)),
 tenant_name:'CareSuite Testmandant',client_name:'Testperson',employee_name:'Testkraft'};
test('original PNG bytes reproduce the stored data-URL hash',async()=>{assert.equal(await bytes.verifyOriginalSignature(png,source.signature_hash),'png');});
test('changed original bytes cannot be attested',async()=>{const changed=png.slice();changed[changed.length-1]^=1;await assert.rejects(bytes.verifyOriginalSignature(changed,source.signature_hash));});
test('signature paths reject foreign visits and traversal',()=>{for(const path of [source.signature_storage_path.replace(visit,id(30)),source.signature_storage_path.replace(signatureId,'../secret')])assert.throws(()=>bytes.requireSignaturePath(path,tenant,visit));});
test('oversized image dimensions are rejected before decoding',()=>{const changed=png.slice();new DataView(changed.buffer).setUint32(16,100000);assert.throws(()=>bytes.signatureImageKind(changed));});
const pdf=await renderVisitProofPdf(source,png);
writeFileSync('/tmp/caresuite-server-proof-qa.pdf',pdf);
test('actual PDF engine embeds the signature and produces deterministic bytes',async()=>{assert.equal(new TextDecoder().decode(pdf.slice(0,5)),'%PDF-');assert.equal(await bytes.hashBytes(pdf),await bytes.hashBytes(await renderVisitProofPdf(source,png)));const parsed=await pdfLib.PDFDocument.load(pdf);assert.equal(parsed.getPageCount(),1);assert.equal(parsed.getTitle(),'Leistungsnachweis');});
test('long documentation paginates without dropping the signature page',async()=>{const long={...source,snapshot:{...snapshot,documentationNote:'Ausführliche Prüfdokumentation. '.repeat(1200)}};const parsed=await pdfLib.PDFDocument.load(await renderVisitProofPdf(long,png));assert.ok(parsed.getPageCount()>1);});
function fixture({auth=true,allowed=true,corruptSignature=false,corruptPdf=false,stale=false,lostUpload=false}={}){
 let privileged=false,commits=0,uploads=0;const objects=new Map([[source.signature_storage_path,corruptSignature?new Uint8Array([1,2,3]):png]]);
 const handler=createProofCompletionHandler({userClient:()=>({auth:{getUser:async()=>({data:{user:auth?{id:id(3)}:null},error:null})},rpc:async()=>allowed?{data:source,error:null}:{data:null,error:{code:'42501'}}}),
 serviceClient:()=>{privileged=true;return{storage:{from:()=>({download:async path=>({data:objects.has(path)?new Blob([objects.get(path)]):null,error:objects.has(path)?null:'missing'}),upload:async(path,value)=>{uploads++;objects.set(path,corruptPdf?new Uint8Array([1,2,3]):value);return{error:lostUpload?'lost reply':null};}})},rpc:async(_name,args)=>{commits++;return stale?{error:'stale',data:null}:{error:null,data:{confirmed:true,proof_id:proof,pdf_storage_path:args.pdf_path,pdf_sha256:args.pdf_sha}};}};},render:renderVisitProofPdf});
 const call=(authorization='Bearer fake',body={tenantId:tenant,assignmentId:assignment})=>handler(new Request('https://example.invalid',{method:'POST',headers:{Authorization:authorization},body:JSON.stringify(body)}));
 return{call,status:()=>({privileged,commits,uploads})};
}
test('missing authorization never reaches privileged storage',async()=>{const f=fixture();assert.equal((await f.call('')).status,401);assert.equal(f.status().privileged,false);});
test('invalid user never reaches privileged storage',async()=>{const f=fixture({auth:false});assert.equal((await f.call()).status,401);assert.equal(f.status().privileged,false);});
test('denied or foreign assignment never reaches privileged storage',async()=>{const f=fixture({allowed:false});assert.equal((await f.call()).status,409);assert.equal(f.status().privileged,false);});
test('invalid IDs are rejected before authorization adapters',async()=>{const f=fixture();assert.equal((await f.call('Bearer fake',{tenantId:[tenant],assignmentId:assignment})).status,400);assert.equal(f.status().privileged,false);});
test('corrupt signatures never create PDFs or attestations',async()=>{const f=fixture({corruptSignature:true});assert.equal((await f.call()).status,409);assert.equal(f.status().uploads,0);assert.equal(f.status().commits,0);});
test('stored PDF corruption cannot produce an attestation',async()=>{const f=fixture({corruptPdf:true});assert.equal((await f.call()).status,409);assert.equal(f.status().commits,0);});
test('changed server version fails completion after byte checks',async()=>{const f=fixture({stale:true});assert.equal((await f.call()).status,409);assert.equal(f.status().commits,1);});
test('successful completion reads actual stored bytes before committing',async()=>{const f=fixture();const response=await f.call();assert.equal(response.status,200);assert.equal((await response.json()).ok,true);assert.equal(f.status().commits,1);});
test('a lost upload reply is recoverable only when matching bytes are stored',async()=>{const f=fixture({lostUpload:true});assert.equal((await f.call()).status,200);assert.equal(f.status().commits,1);});
