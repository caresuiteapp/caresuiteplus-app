import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

const root=new URL('../..',import.meta.url);
const evidence=JSON.parse(fs.readFileSync(new URL('./fixtures/wound-staging-synthetic-20261022.json',import.meta.url),'utf8'));
const moduleUrl=source=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source,{mode:'strip'})).toString('base64');
const packetUrl=new URL('src/lib/pflege/woundPathPacket.web.ts',root).href;
const authorityUrl=new URL('src/lib/pflege/careWorkspaceAuthority.web.ts',root).href;
const nativeOriginalUrl=new URL('src/lib/clients/clientRecordNativeOriginal.web.ts',root).href;
const reviewUrl=moduleUrl(fs.readFileSync(new URL('src/lib/pflege/woundPathReview.web.ts',root),'utf8').replace("from './woundPathPacket.web'",`from '${packetUrl}'`));
const cases=[
 {name:'path commit',file:'woundPathRepository.supabase.web.ts',method:'commitWoundPathPacket',rpc:'web_commit_wound_path_packet',packet:'pathPacket',receipt:'pathReceipt',commit:true},
 {name:'path confirm',file:'woundPathRepository.supabase.web.ts',method:'confirmWoundPathPacket',rpc:'web_confirm_wound_path_packet',packet:'pathPacket',receipt:'pathReceipt',commit:false},
 {name:'review commit',file:'woundPathReviewRepository.supabase.web.ts',method:'commitWoundPathReview',rpc:'web_commit_wound_path_review',packet:'decisionPacket',receipt:'decisionReceipt',commit:true},
 {name:'review confirm',file:'woundPathReviewRepository.supabase.web.ts',method:'confirmWoundPathReview',rpc:'web_confirm_wound_path_review',packet:'decisionPacket',receipt:'decisionReceipt',commit:false},
];
let sequence=0;
async function run(spec,field=null){
 const key=`__woundResponseEnvelope${sequence++}`,packet=structuredClone(evidence[spec.packet]),receipt=structuredClone(evidence[spec.receipt]);
 let current=true,getterCalls=0;
 const calls=[],envelope={data:receipt,error:null,status:200};
 if(field!==null){
  const value=envelope[field];
  Object.defineProperty(envelope,field,{enumerable:true,configurable:true,get(){getterCalls++;current=false;return value;}});
 }
 const userId='12345678-1234-4234-8234-123456789013';
 const db={auth:{
  getSession:async()=>({data:{session:{user:{id:userId},access_token:'synthetic-token-not-an-Auth-proof',expires_at:Math.floor(Date.now()/1000)+3600}},error:null}),
  getUser:async()=>({data:{user:{id:userId}},error:null}),
 },rpc:async(name,args)=>{
  if(name==='resolve_current_profile_id')return {data:packet.actorId,error:null};
  if(name==='current_tenant_id')return {data:packet.tenantId,error:null};
  assert.equal(name,spec.rpc);assert.deepEqual(args.p_packet,packet);calls.push({name,args:structuredClone(args)});
  return envelope;
 }};
 globalThis[key]={db};
 const source=fs.readFileSync(new URL(`src/lib/pflege/${spec.file}`,root),'utf8')
  .replace("import {getSupabaseClient} from '@/lib/supabase/client';",`const getSupabaseClient=()=>globalThis['${key}'].db;`)
  .replace("import {toGermanSupabaseError} from '@/lib/supabase/errors';","const toGermanSupabaseError=()=> 'synthetic service error';")
  .replace("import {withServiceQueryTimeout} from '@/lib/services/queryTimeout';","const withServiceQueryTimeout=async request=>await request;")
  .replace("from '../clients/clientRecordNativeOriginal.web.ts'",`from '${nativeOriginalUrl}'`)
  .replace("from './careWorkspaceAuthority.web'",`from '${authorityUrl}'`)
  .replace("from './woundPathPacket.web'",`from '${packetUrl}'`)
  .replace("from './woundPathReview.web'",`from '${reviewUrl}'`);
 try{
  const repository=await import(moduleUrl(source));
  const result=await repository[spec.method](packet,()=>current);
  return {result,calls,receipt,getterCalls,current};
 }finally{delete globalThis[key];}
}

for(const spec of cases){
 test(`${spec.name}: plain actual SQL retained receipt succeeds`,async()=>{
  const {result,calls,receipt}=await run(spec);
  assert.deepEqual(result,{ok:true,data:receipt.original});assert.equal(calls.length,1);
 });
 for(const field of ['data','error','status'])test(`${spec.name}: ${field} response getter cannot revoke scope after a guard and confirm an old result`,async()=>{
  const {result,calls,getterCalls,current}=await run(spec,field);
  assert.equal(result.ok,false);assert.equal('data' in result,false);assert.equal(calls.length,1);
  assert.equal(getterCalls,0,'response descriptor must be rejected before executing getter code');
  assert.equal(current,true,'the getter was never allowed to replace the active scope');
  if(spec.commit)assert.equal(result.uncertain,true,'a dispatched write remains unresolved');
 });
}
