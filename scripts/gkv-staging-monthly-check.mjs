// Existing private host implementation against real hosted Auth and RPC.
// Synthetic signature only; no XML/CMS, TI card, real provider registration,
// deployed mTLS endpoint or browser acceptance is asserted by this run.
import {s,save,q,rpc} from './gkv-staging-auth-check.mjs';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {MonthlyOriginalStore} from '../services/gkv/monthly-original-store.mjs';
import {MonthlyOriginalHost} from '../services/gkv/monthly-host.mjs';
import {signingPng} from '../tests/gkv-exchange/monthly-host-fixture.mjs';
const mode=process.argv[2],hash=b=>createHash('sha256').update(b).digest('hex');
async function ok(check){s.checks.push({check,passed:true,at:new Date().toISOString()});await save(s);console.log(JSON.stringify({check,passed:true}));}
if(mode==='--key-sql'){
 s.monthlyHost??={keyId:randomUUID(),workerKey:randomBytes(32).toString('hex'),storeKey:randomBytes(32).toString('hex'),captureId:randomUUID()};await save(s);
 const k=s.monthlyHost;
 const sql="BEGIN; SET LOCAL statement_timeout='15s';\nINSERT INTO care_security.gkv_monthly_worker_keys(tenant_id,key_id,key_bytes,valid_until,revoked_at) SELECT "+q(s.tenant)+","+q(k.keyId)+",decode("+q(k.workerKey)+",'hex'),now()+interval '2 hours',NULL WHERE EXISTS(SELECT FROM public.tenants WHERE id="+q(s.tenant)+" AND name="+q('GKV TEST '+s.runId)+");\nCOMMIT;";
 await writeFile(new URL('../../gkv-stage-monthly-key.sql',import.meta.url),sql,{mode:0o600});console.log('Prepared scoped temporary staging worker key');
}
if(mode==='--confirm'){
 if(!s.monthly||s.monthly.status!=='open'||s.monthly.payload.xmlFacts)throw Error('Expected unfinalized source aggregation without normative XML facts');
 const k=s.monthlyHost;if(!k)throw Error('Provision temporary test key first');
 await mkdir(new URL('../../gkv-stage-private/',import.meta.url),{recursive:true,mode:0o700});
 const store=new MonthlyOriginalStore({path:fileURLToPath(new URL('../../gkv-stage-private/monthly.sqlite',import.meta.url)),key:Buffer.from(k.storeKey,'hex')});
 const host=new MonthlyOriginalHost({tenantId:s.tenant,store,supabase:{url:s.url,key:s.key},workerKeyId:k.keyId,workerKey:Buffer.from(k.workerKey,'hex')});
 const input={tenantId:s.tenant,proofId:s.monthly.id,revision:s.monthly.revision,captureId:k.captureId};
 const send=command=>host.execute({...input,...command},'Bearer '+s.users.office.token);
 try{
  const original=await send({action:'prepare'}),read=await send({action:'read'});
  const bytes=Buffer.from(read.pdfBase64,'base64');
  if(hash(bytes)!==original.original.originalSha256||read.pdfBase64!==original.pdfBase64)throw Error('Monthly original readback differs');
  await send({action:'acknowledge',originalSha256:hash(bytes)});await ok('monthly_original_retrieved_and_acknowledged_against_live_session');
  const verified=await send({action:'verify',pngBase64:signingPng(19)});
  s.monthlyReceipt=verified.receipt;await save(s);
  s.monthlyFinal=await rpc('office','gkv_monthly_proof_command',{p_tenant_id:s.tenant,p_request_id:randomUUID(),p_action:'confirm',p_input:{id:s.monthly.id,revision:s.monthly.revision,content_sha256:s.monthly.content_sha256,receipt_id:verified.receipt.receiptId}});
  if(s.monthlyFinal.status!=='final')throw Error('Monthly confirmation failed');await ok('monthly_confirmation_consumed_host_verified_receipt');
  const archived=await send({action:'archive',revision:s.monthlyFinal.revision});
  if(archived.pdfBase64!==original.pdfBase64)throw Error('Archive differs from acknowledged original');
  await ok('confirmed_monthly_original_retrieved_unchanged');
 }finally{host.close()}
}
