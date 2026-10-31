import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {woundPathOriginalIssue} from '../../src/lib/pflege/woundPathPacket.web.ts';

const root=new URL('../..',import.meta.url);
const evidence=JSON.parse(fs.readFileSync(new URL('./fixtures/wound-staging-synthetic-20261022.json',import.meta.url),'utf8'));
const packetUrl=new URL('src/lib/pflege/woundPathPacket.web.ts',root).href;
const authorityUrl=new URL('src/lib/pflege/careWorkspaceAuthority.web.ts',root).href;
const nativeOriginalUrl=new URL('src/lib/clients/clientRecordNativeOriginal.web.ts',root).href;
const moduleUrl=source=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source,{mode:'strip'})).toString('base64');
const otherId='12345678-1234-4234-8234-123456789012';
let sequence=0;

async function run(method,mutate=()=>{},isCurrent=()=>true){
 const key=`__woundActualReceipt${sequence++}`,packet=structuredClone(evidence.pathPacket),response=structuredClone(evidence.pathReceipt),calls=[];
 mutate(response);
 // Negative fixtures remain valid generic originals: rejection must bind the own dispatched packet.
 assert.equal(woundPathOriginalIssue(response.original,packet),null);
 const userId='12345678-1234-4234-8234-123456789013';
 const db={auth:{
  getSession:async()=>({data:{session:{user:{id:userId},access_token:'synthetic-test-token',expires_at:Math.floor(Date.now()/1000)+3600}},error:null}),
  getUser:async()=>({data:{user:{id:userId}},error:null}),
 },rpc:async(name,args)=>{
  if(name==='resolve_current_profile_id')return {data:packet.actorId,error:null};
  if(name==='current_tenant_id')return {data:packet.tenantId,error:null};
  assert.equal(name,method==='commit'?'web_commit_wound_path_packet':'web_confirm_wound_path_packet');
  assert.deepEqual(args.p_packet,packet);
  calls.push({name,args:structuredClone(args)});
  return {data:response,error:null};
 }};
 globalThis[key]={db};
 const source=fs.readFileSync(new URL('src/lib/pflege/woundPathRepository.supabase.web.ts',root),'utf8')
  .replace("import {getSupabaseClient} from '@/lib/supabase/client';",`const getSupabaseClient=()=>globalThis['${key}'].db;`)
  .replace("import {toGermanSupabaseError} from '@/lib/supabase/errors';","const toGermanSupabaseError=()=> 'synthetic service error';")
  .replace("import {withServiceQueryTimeout} from '@/lib/services/queryTimeout';","const withServiceQueryTimeout=async request=>await request;")
  .replace("from './careWorkspaceAuthority.web'",`from '${authorityUrl}'`)
  .replace("from '../clients/clientRecordNativeOriginal.web.ts'",`from '${nativeOriginalUrl}'`)
  .replace("from './woundPathPacket.web'",`from '${packetUrl}'`);
 try{
  const repository=await import(moduleUrl(source));
  const result=await repository[method==='commit'?'commitWoundPathPacket':'confirmWoundPathPacket'](packet,isCurrent);
  return {result,calls,response};
 }finally{delete globalThis[key];}
}

const changes=[
 ['different saved actor',r=>{r.original.recordedBy=otherId;r.original.history.at(-1).recordedBy=otherId;}],
 ['different saved request event',r=>{r.original.id=otherId;r.original.headId=otherId;r.original.history.at(-1).id=otherId;}],
 ['different saved reason',r=>{r.original.history.at(-1).reason+=' Other recorded reason.';}],
 ['different saved clinical entry',r=>{r.original.payload.title+=' Different entry.';r.original.history.at(-1).payload.title+=' Different entry.';}],
 ['changed earlier immutable history',r=>{r.original.history[0].recordedByName='Different historical person';}],
 ['another root and previous head',r=>{r.original.rootId=otherId;r.original.history[0].id=otherId;r.original.history.at(-1).previousId=otherId;}],
 ['later valid current head instead of own historical receipt',r=>{
  const old=r.original.history.at(-1),next={...structuredClone(old),id:otherId,previousId:old.id,revision:old.revision+1};
  r.original.history.push(next);Object.assign(r.original,{id:otherId,headId:otherId,revision:next.revision});
 }],
];

for(const method of ['commit','confirm']){
 test(`${method}: actual retained SQL revision satisfies production repository receipt binding`,async()=>{
  const {result,calls,response}=await run(method);
  assert.deepEqual(result,{ok:true,data:response.original});
  assert.equal(calls.length,1);
 });
 for(const [name,mutate] of changes)test(`${method}: generic valid original with ${name} cannot confirm own request`,async()=>{
  const {result,calls}=await run(method,mutate);
  assert.equal(result.ok,false);assert.equal('data' in result,false);assert.equal(calls.length,1);
  if(method==='commit')assert.equal(result.uncertain,true);
 });
}
