import {createHash} from 'node:crypto';
import {readMonthlyProof} from '../../src/lib/gkvExchange/monthlyProof.ts';
import {monthlyXmlLocalTime} from '../../src/lib/gkvExchange/monthlyXml.ts';
import {inspectMonthlySignature} from './monthly-signature-png.mjs';
import {generateMonthlyXml} from './monthly-xml.mjs';
import {isUuid} from './storage.mjs';
import {renderMonthlyOriginalDocument} from './monthly-original-pdf.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const fail=()=>{throw Error('MONTHLY_XML_CAPTURE_BINDING');};
const candidates=new WeakMap();
/** Only the actual completed XML worker can authorize an embedded-only write.
 * A copied object, altered bytes or caller-supplied success flags cannot. */
export function assertCapturedMonthlyXml(candidate,receipt){
 const known=candidates.get(candidate);
 if(!known||JSON.stringify(receipt)!==known.receipt||hash(candidate.bytes)!==known.sha256
  ||JSON.stringify(candidate.verification)!==known.verification
  ||JSON.stringify(candidate.captureBinding)!==known.binding)fail();
 return {...known.signature};
}
/** Host-internal conversion, called only after current SQL context, displayed
 * original, personal review and encrypted read-back. Not a browser endpoint.
 * Frozen mappings still lack upstream personal GKV-number capture attestation.
 * This helper returns a checked unsigned candidate. The configured host binds
 * it to monthly-component-signer before issuing a confirmation receipt. */
export async function generateCapturedMonthlyXml(value,scanInput,options={}){
 const stored=structuredClone(value),scan=scanInput&&structuredClone(scanInput);
 let inspected;
 try{
 const s=stored?.snapshot,r=stored?.receipt;
 if(!s||!r)fail();
 const p=readMonthlyProof(s.proof,r.tenant_id),facts=p.payload.xmlFacts;
 const prefix=`tenant/${p.tenant_id}/gkv/monthly/${p.id}/captures/${s.captureId}`;
 if(!facts||p.status!=='open'||r.proof_id!==p.id||r.proof_revision!==p.revision||r.content_sha256!==p.content_sha256
  ||r.capture_id!==s.captureId||r.actor_id!==s.actorId||!stored.acknowledgedAt
  ||!(stored.original instanceof Uint8Array)||!(stored.signature instanceof Uint8Array)
  ||hash(stored.original)!==stored.originalSha256||r.original_sha256!==stored.originalSha256
  ||r.original_version!==stored.originalVersion||r.original_path!==prefix+'/original.pdf'
  ||r.signature_path!==prefix+'/signature.png'||!isUuid(r.signature_version)||!isUuid(r.id)
  ||typeof r.captured_at!=='string'||typeof r.verified_at!=='string'
  ||![s.preparedAt,stored.acknowledgedAt,r.captured_at,r.verified_at].every(v=>typeof v==='string'&&Number.isFinite(Date.parse(v)))
  ||Date.parse(facts.boundAt)>Date.parse(s.preparedAt)||Date.parse(p.updated_at)>Date.parse(s.preparedAt)
  ||Date.parse(stored.acknowledgedAt)<Date.parse(s.preparedAt)||Date.parse(r.captured_at)<Date.parse(stored.acknowledgedAt)
  ||Date.parse(r.verified_at)<Date.parse(r.captured_at))fail();
 // Reproduce the server-owned display from the frozen snapshot. A caller's
 // changed model with the same claimed hash must never reuse an unseen original.
 if(hash(renderMonthlyOriginalDocument(s).bytes)!==stored.originalSha256)fail();
 inspected=inspectMonthlySignature(stored.signature);
 if(inspected.sha256!==r.signature_sha256||inspected.inkSha256!==r.signature_ink_sha256)fail();
 if(r.signer_role==='representative'){
  if(!s.authority||s.authority.id!==r.authority_reference||s.authority.signer_name!==r.signer_name
   ||s.authority.tenant_id!==p.tenant_id||s.authority.client_id!==p.payload.clientId||s.authority.service_type!==p.payload.serviceType)fail();
 }else if(r.signer_role!=='patient'||s.authority||r.authority_reference!==null||r.signer_name!==p.payload.clientName)fail();
 let signature;
 if(r.paper){
  const paper=r.paper;
  if(s.method!=='paper'||!s.paper||r.signer_role!=='representative'||!scan
   ||!(scan.bytes instanceof Uint8Array)||hash(scan.bytes)!==paper.scanSha256
   ||scan.meta.scanSha256!==paper.scanSha256||scan.meta.scanVersion!==paper.scanVersion
   ||scan.meta.renderSha256!==paper.renderSha256||paper.scanPath!==prefix+'/scan.pdf'
   ||JSON.stringify(scan.meta.pages.map(p=>p.sha256))!==JSON.stringify(paper.pageSha256)
   ||scan.meta.pages.length!==s.paper.pageCount||paper.reviewedBy!==s.actorId
   ||Date.parse(paper.reviewedAt)!==Date.parse(r.verified_at)||Date.parse(paper.issuedAt)!==Date.parse(s.preparedAt)
   ||!Number.isFinite(Date.parse(paper.signedAt))||Date.parse(paper.signedAt)<Date.parse(s.preparedAt)
   ||Date.parse(paper.signedAt)>Date.parse(r.captured_at))fail();
  signature={type:'3',fileType:'2',signedLocalTime:monthlyXmlLocalTime(new Date(paper.signedAt).toISOString()),base64:Buffer.from(scan.bytes).toString('base64')};
 }else{
  if(s.method||s.paper||scan)fail();
  signature={type:'1',fileType:'3',signedLocalTime:monthlyXmlLocalTime(new Date(r.captured_at).toISOString()),base64:Buffer.from(stored.signature).toString('base64')};
 }
 const result=await generateMonthlyXml({proofId:p.id,...facts.content,signature},{...options,checkedAt:new Date(r.verified_at).toISOString()});
 const candidate={...result,captureBinding:Object.freeze({schema:'gkv-monthly-capture-xml-v1',proofId:p.id,revision:p.revision,
  contentSha256:p.content_sha256,captureId:s.captureId,originalSha256:stored.originalSha256,xmlSha256:result.verification.sha256,
  displayedContentMatches:true,upstreamEmployeeCaptureVerified:false,componentSignatureVerified:false,dispatchReady:false})};
 candidates.set(candidate,{receipt:JSON.stringify(r),sha256:hash(candidate.bytes),verification:JSON.stringify(candidate.verification),
  binding:JSON.stringify(candidate.captureBinding),signature:{sha256:inspected.sha256,inkSha256:inspected.inkSha256,size:stored.signature.length}});
 return candidate;
 }finally{if(stored?.signature instanceof Uint8Array)stored.signature.fill(0);inspected?.bytes.fill(0);}
}
