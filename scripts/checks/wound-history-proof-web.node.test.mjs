import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {blankWoundPathEntry,woundPathOriginalIssue} from '../../src/lib/pflege/woundPathPacket.web.ts';

const root=new URL('../..',import.meta.url);
const moduleUrl=source=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source,{mode:'strip'})).toString('base64');
const packetUrl=new URL('src/lib/pflege/woundPathPacket.web.ts',root).href;
const nativeOriginalUrl=new URL('src/lib/clients/clientRecordNativeOriginal.web.ts',root).href;
const reviewUrl=moduleUrl(fs.readFileSync(new URL('src/lib/pflege/woundPathReview.web.ts',root),'utf8').replace("from './woundPathPacket.web'",`from '${packetUrl}'`));
const {woundPathReviewOriginalIssue}=await import(reviewUrl);
const authorityUrl=new URL('src/lib/pflege/careWorkspaceAuthority.web.ts',root).href;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sha=letter=>`sha256:${letter.repeat(64)}`;
const tenant=id(1),client=id(2),wound=id(3),actor=id(4),authUser=id(99);
const at='2026-10-17T09:00:00.123456Z',older='2026-10-17T09:00:00.123455Z';
const scope={tenantId:tenant,clientId:client,woundId:wound,actorId:actor,isCurrent:()=>true};
let fixtureSequence=0;
function pathOriginal(n,time){
 const payload={...blankWoundPathEntry('infection_suspicion',tenant,client,wound,time),title:'Synthetisch dokumentierte Beobachtung',observation:{state:'suspected',signs:['Synthetische Rötung'],narrative:'Testbeobachtung ohne abgeleitete Diagnose',assessmentId:null,photoId:null,photoConsentId:null},contact:{state:'pending',channel:'',contactedAt:null,contactName:'',responseAt:null,response:'',nextStep:'Tatsächlichen nächsten Schritt gesondert dokumentieren',responsibleBy:null},person:{decision:'Synthetisch dokumentierte Entscheidung',informedAt:null,photoDecision:'not_applicable'}};
 const h={id:id(n),revision:1,previousId:null,recordedAt:time,recordedBy:actor,recordedByName:'Synthetische Person',reason:'',payload,contentFingerprint:sha('a')};
 return {id:id(n),tenantId:tenant,clientId:client,woundId:wound,rootId:id(n),headId:id(n),revision:1,kind:payload.kind,recordedAt:time,recordedBy:actor,recordedByName:h.recordedByName,payload,contentFingerprint:h.contentFingerprint,history:[h]};
}
function reviewOriginal(n,time){
 const h={id:id(n),revision:1,previousId:null,requestId:id(n+100),action:'request',recordedAt:time,actorId:actor,actorName:'Synthetische Person',reason:'Getrennte Prüfung der exakt dokumentierten synthetischen Fassung',requiredChange:'',rationale:'',woundHeadId:id(n+200),woundFingerprint:sha('a'),qualification:null,fingerprint:sha('b')};
 return {id:id(n),tenantId:tenant,clientId:client,woundId:wound,rootId:id(n),headId:id(n),revision:1,woundRootId:id(n+200),woundHeadId:id(n+200),woundFingerprint:sha('a'),woundKind:'escalation_resolution',status:'requested',history:[h]};
}
function advanceOlderRoot(spec,old){
 const next=structuredClone(old),eventId=id(21),recordedAt='2026-10-17T09:00:00.123455Z';
 if(spec.kind==='path'){
  const payload={...next.payload,observedAt:recordedAt,title:'Synthetischer begründeter Nachtrag zur älteren Fassung'};
  next.history.push({...next.history[0],id:eventId,revision:2,previousId:next.headId,recordedAt,reason:'Tatsächlicher Grund für den synthetischen Nachtrag',payload,contentFingerprint:sha('d')});
  Object.assign(next,{id:eventId,headId:eventId,revision:2,recordedAt,payload,contentFingerprint:sha('d')});
 }else{
  const reviewer=id(80),qualification={id:id(81),employeeId:id(82),profileId:reviewer,qualificationType:'synthetic_test',title:'Synthetischer Qualifikationsvertrag, keine reale Befähigung',status:'valid',issuedAt:'2020-01-01',validUntil:'2027-12-31',verifiedAt:old.history[0].recordedAt,updatedAt:old.history[0].recordedAt,documentId:id(83),documentFingerprint:sha('e'),sourceFingerprint:sha('e'),employmentStart:'2020-01-01',employmentEnd:null,employeeFingerprint:sha('e'),scopeId:id(84),scopeKind:'wound_care_review',scopeFingerprint:sha('e')};
  next.history.push({id:eventId,revision:2,previousId:next.headId,requestId:id(121),action:'return',recordedAt,actorId:reviewer,actorName:'Getrennte synthetische Person',reason:'Synthetisch dokumentierter konkreter Rückgabegrund',requiredChange:'Synthetischen tatsächlichen Originalbezug ergänzen',rationale:'',woundHeadId:next.woundHeadId,woundFingerprint:next.woundFingerprint,qualification,fingerprint:sha('d')});
  Object.assign(next,{id:eventId,headId:eventId,revision:2,status:'returned'});
 }
 return next;
}
const specs=[
 {kind:'path',file:'src/lib/pflege/woundPathRepository.supabase.web.ts',rpc:'web_read_wound_path_page',method:'readWoundPathPage',make:pathOriginal,validate:woundPathOriginalIssue},
 {kind:'review',file:'src/lib/pflege/woundPathReviewRepository.supabase.web.ts',rpc:'web_read_wound_path_review_page',method:'readWoundPathReviewPage',make:reviewOriginal,validate:woundPathReviewOriginalIssue},
];
function page(rows,proof=sha('c')){const last=rows.at(-1);return {rows,stateFingerprint:proof,nextCursorRecordedAt:last?.history[0].recordedAt??null,nextCursorId:last?.rootId??null};}
async function harness(spec,pages){
 const key=`__woundHistoryProof${fixtureSequence++}`,calls=[];
 let pageIndex=0;
 const session={user:{id:authUser},access_token:'synthetic-not-a-real-token',expires_at:Math.floor(Date.now()/1000)+3600};
 const db={auth:{getSession:async()=>({data:{session:structuredClone(session)},error:null}),getUser:async()=>({data:{user:{id:authUser}},error:null})},rpc:async(name,args)=>{
  if(name==='resolve_current_profile_id')return {data:actor,error:null};
  if(name==='current_tenant_id')return {data:tenant,error:null};
  assert.equal(name,spec.rpc);calls.push(structuredClone(args));
  assert.ok(pageIndex<pages.length,`unexpected page ${pageIndex}`);
  const next=pages[pageIndex++];return {data:structuredClone(typeof next==='function'?next(calls):next),error:null};
 }};
 globalThis[key]={db};
 let source=fs.readFileSync(new URL(spec.file,root),'utf8')
  .replace("import {getSupabaseClient} from '@/lib/supabase/client';",`const getSupabaseClient=()=>globalThis['${key}'].db;`)
  .replace("import {toGermanSupabaseError} from '@/lib/supabase/errors';","const toGermanSupabaseError=()=> 'synthetic service error';")
  .replace("import {withServiceQueryTimeout} from '@/lib/services/queryTimeout';","const withServiceQueryTimeout=async request=>await request;")
  .replace("from './careWorkspaceAuthority.web'",`from '${authorityUrl}'`)
  .replace("from '../clients/clientRecordNativeOriginal.web.ts'",`from '${nativeOriginalUrl}'`)
  .replace("from './woundPathPacket.web'",`from '${packetUrl}'`)
  .replace("from './woundPathReview.web'",`from '${reviewUrl}'`);
 const repository=await import(moduleUrl(source));
 return {calls,read:async(context=scope)=>{try{return await repository[spec.method](context);}finally{delete globalThis[key];}}};
}
for(const spec of specs){
 const top=spec.make(30,at),old=spec.make(20,older);
 test(`${spec.kind}: fixtures pass actual original validators`,()=>{assert.equal(spec.validate(top,scope),null);assert.equal(spec.validate(old,scope),null);});
 if(spec.kind==='path'){
  const corruptions=[
   ['detached root',o=>{o.rootId=id(91);}],
   ...['tenantId','clientId','woundId'].map(field=>[`foreign historical ${field}`,o=>{o.history[0].payload[field]=id(91);}]),
   ['detached historical observation time',o=>{o.history[0].payload.observedAt='2026-10-17T09:00:00.123454Z';}],
   ['duplicate historical event identity',o=>{o.history[0].id=o.headId;o.rootId=o.headId;o.history[1].previousId=o.headId;}],
  ];
  for(const [name,mutate] of corruptions)test(`path: ${name} is rejected by the actual reader before exposing history`,async()=>{
   const changed=advanceOlderRoot(spec,old);mutate(changed);
   assert.ok(spec.validate(changed,scope));
   const h=await harness(spec,[page([changed])]),result=await h.read();
   assert.equal(result.ok,false);assert.equal('data' in result,false);assert.equal(h.calls.length,1);
  });
 }
 test(`${spec.kind}: consumes exact proof across all pages and rechecks first page`,async()=>{
  const first=page([top]),h=await harness(spec,[first,page([old]),page([]),first]),result=await h.read();
  assert.deepEqual(result,{ok:true,data:[top,old]});assert.equal(h.calls.length,4);
  assert.equal(h.calls[1].p_cursor_recorded_at,at);assert.equal(h.calls[2].p_cursor_recorded_at,older);assert.equal(h.calls[3].p_cursor_recorded_at,null);assert.equal(h.calls[3].p_cursor_id,null);
 });
 test(`${spec.kind}: changed older page with stable first head returns no mixed history`,async()=>{
  const initial=spec.make(20,'2026-10-17T09:00:00.123454Z'),changed=advanceOlderRoot(spec,initial);
  assert.equal(spec.validate(changed,scope),null,'a valid appended older path revision / review decision');
  const h=await harness(spec,[page([top]),page([changed],sha('d'))]),result=await h.read();
  assert.equal(result.ok,false);assert.equal('data' in result,false);assert.equal(h.calls.length,2);
 });
 test(`${spec.kind}: mutation observed only by empty terminator rejects partial history`,async()=>{const h=await harness(spec,[page([top]),page([],sha('d'))]);const result=await h.read();assert.equal(result.ok,false);assert.equal('data' in result,false);});
 test(`${spec.kind}: mutation after empty terminator is detected by final reread`,async()=>{const h=await harness(spec,[page([top]),page([]),page([top],sha('d'))]);assert.equal((await h.read()).ok,false);assert.equal(h.calls.length,3);});
 test(`${spec.kind}: same proof with inconsistent first-page payload rejects`,async()=>{const changed=structuredClone(top);changed.history[0][spec.kind==='path'?'recordedByName':'reason']='Synthetisch geänderter Kopf';if(spec.kind==='path')changed.recordedByName=changed.history[0].recordedByName;const h=await harness(spec,[page([top]),page([]),page([changed])]);assert.equal((await h.read()).ok,false);});
 test(`${spec.kind}: stable empty ledger still requires final proof`,async()=>{const h=await harness(spec,[page([]),page([])]);assert.deepEqual(await h.read(),{ok:true,data:[]});assert.equal(h.calls.length,2);});
 for(const [name,proof] of [['missing',undefined],['null',null],['unprefixed','c'.repeat(64)],['short','sha256:abc'],['uppercase',`sha256:${'A'.repeat(64)}`],['object',{value:sha('c')}],['newline',sha('c')+'\n']]){
  test(`${spec.kind}: ${name} proof fails before exposing first-page records`,async()=>{const first=page([top]);if(proof===undefined)delete first.stateFingerprint;else first.stateFingerprint=proof;const h=await harness(spec,[first]);const result=await h.read();assert.equal(result.ok,false);assert.equal('data' in result,false);assert.equal(h.calls.length,1);});
 }
 test(`${spec.kind}: missing empty-terminator proof fails closed`,async()=>{const terminal=page([]);delete terminal.stateFingerprint;const h=await harness(spec,[page([top]),terminal]);assert.equal((await h.read()).ok,false);});
 test(`${spec.kind}: missing final-reread proof fails closed`,async()=>{const final=page([top]);delete final.stateFingerprint;const h=await harness(spec,[page([top]),page([]),final]);assert.equal((await h.read()).ok,false);});
 test(`${spec.kind}: malformed empty cursor cannot truncate history`,async()=>{const terminal=page([]);terminal.nextCursorId=id(60);const h=await harness(spec,[page([top]),terminal]);assert.equal((await h.read()).ok,false);});
 test(`${spec.kind}: duplicate root on a later page cannot appear twice`,async()=>{const h=await harness(spec,[page([top]),page([top])]);assert.equal((await h.read()).ok,false);});
 test(`${spec.kind}: changed active scope during page read discards accumulated records`,async()=>{let current=true;const h=await harness(spec,[()=>{current=false;return page([top]);}]);assert.equal((await h.read({...scope,isCurrent:()=>current})).ok,false);});
}
