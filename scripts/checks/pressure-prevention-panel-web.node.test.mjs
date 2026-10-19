import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes as strip} from 'node:module';
import {fileURLToPath} from 'node:url';
import * as native from '../../src/lib/clients/clientRecordNativeOriginal.web.ts';
import * as owners from '../../src/lib/permissions/carePermissionOwner.web.ts';
import {woundUuid,woundInstant} from '../../src/lib/pflege/woundCareDomain.ts';
import {treatmentRecordedTimeDisplay} from '../../src/lib/pflege/treatmentTimeDisplay.web.ts';
import {withServiceQueryTimeout} from '../../src/lib/services/queryTimeout.ts';
const root=fileURLToPath(new URL('../../',import.meta.url));
const read=path=>readFileSync(root+path,'utf8');
const body=path=>strip(read(path).replace(/^import[\s\S]*?;\n/gm,'').replace(/\bexport /g,''));
const compose=(path,deps,names)=>new Function(...Object.keys(deps),body(path)+';return {'+names.join(',')+'};')(...Object.values(deps));
const fixture=read('scripts/checks/pressure-prevention-originals-web.node.test.mjs');
const fixtureBody=fixture.slice(0,fixture.indexOf("test('Actual native SELECT-only reader"))
 .replace(/^import[^\n]*\n/gm,'').replace(/const root=fileURLToPath[^\n]*\n/,'').replace(/const read=p=>[^\n]*\n/,'');
const {harness,id,assessment,event,marker,deferred}=new Function('native','owners','woundInstant','woundUuid','treatmentRecordedTimeDisplay','withServiceQueryTimeout','strip','read','assert',fixtureBody+';return {harness,id,assessment,event,marker,deferred};')(native,owners,woundInstant,woundUuid,treatmentRecordedTimeDisplay,withServiceQueryTimeout,strip,read,assert);
const names=['createPressurePreventionPanelWeb','mountPressurePreventionPanelWeb','disposePressurePreventionPanelWeb','subscribePressurePreventionPanelWeb','pressurePreventionPanelViewWeb','readPressurePreventionPanelWeb','selectPressurePreventionPanelWeb','expandPressurePreventionPanelWeb','morePressurePreventionPanelWeb'];
function panelHarness(getAccess){
 const h=harness();h.reader.dispose();
 const api=compose('src/lib/pflege/pressurePreventionPanelBinding.web.ts',{PressurePreventionOriginalReader:h.Reader,...h.history,...native,...owners,woundUuid},names);
 const token=api.createPressurePreventionPanelWeb(getAccess?()=>getAccess(h):h.getAccess),life=api.mountPressurePreventionPanelWeb(token);
 const view=()=>api.pressurePreventionPanelViewWeb(token,life),load=(expected=view())=>api.readPressurePreventionPanelWeb(token,life,expected),select=(kind,key,expected=view())=>api.selectPressurePreventionPanelWeb(token,life,expected,kind,key);
 return{...h,api,token,life,view,load,select};
}
async function loaded(){const h=panelHarness();assert.equal(await h.load(),true);assert.equal(h.view().stage,'ready');return h;}
async function drain(){await new Promise(resolve=>setImmediate(resolve));}

test('Empty opaque tokens/lifetimes expose no raw owner/source; only genuine current view can start native read',async()=>{
 const h=panelHarness();assert.deepEqual(Reflect.ownKeys(h.token),[]);assert.deepEqual(Reflect.ownKeys(h.life),[]);assert.ok(Object.isFrozen(h.token));assert.ok(Object.isFrozen(h.life));
 assert.equal(h.api.pressurePreventionPanelViewWeb({...h.token},h.life),null);assert.equal(h.api.pressurePreventionPanelViewWeb(h.token,{...h.life}),null);
 const view=h.view();assert.equal(await h.api.readPressurePreventionPanelWeb(h.token,h.life,{...view}),false);assert.equal(h.calls.length,0);assert.equal(await h.load(view),true);assert.equal(h.calls.length,5);
 assert.equal(Object.hasOwn(h.view(),'auth'),false);assert.equal(Object.hasOwn(h.view(),'originals'),false);assert.equal(JSON.stringify(h.view()).includes('raw_extra'),false);
});
test('Whole original fields, nullable values, authors, plan strings and precise independent time purposes survive safe selection',async()=>{
 const h=await loaded(),before=structuredClone(h.tables);assert.equal(h.select('assessment',id(10)),true);const view=h.view(),a=view.selectedAssessment;
 assert.deepEqual(a.measurements.length_cm,{state:'null',value:null});assert.deepEqual(a.measurements.width_cm,{state:'value',value:0});assert.deepEqual(a.tissue.granulation,{state:'missing'});
 assert.deepEqual(a.pressureReliefPlan.aids,{state:'empty',value:''});assert.equal(a.pressureReliefPlan.positioning.value,' Originalposition ');assert.equal(a.assessor.value,id(2));
 assert.equal(a.assessedAt.purpose,'assessment');assert.equal(a.recordedAt.purpose,'recorded');assert.equal(a.updatedAt.purpose,'updated');assert.equal(a.reviewAgreement.purpose,'review_agreement');
 assert.equal(a.updatedAt.raw,'2026-10-11 10:01:00.123458+02:00');assert.ok(Object.isFrozen(a.pressureReliefPlan));assert.deepEqual(h.tables,before);
 assert.equal(Object.hasOwn(a,'clinicalDone'),false);assert.equal(Object.hasOwn(a,'reviewTask'),false);assert.equal(h.calls.length,5);
});
test('A partial native history reference never turns into a reconstructed assessment plan or clinical action',async()=>{
 const h=await loaded();assert.equal(h.select('history',id(20)),true);const e=h.view().selectedEvent;assert.equal(e.author.value,id(2));assert.deepEqual(e.assessmentReference,{state:'supplied_reference',assessmentId:id(10)});
 assert.equal(Object.hasOwn(e,'pressureReliefPlan'),false);assert.equal(Object.hasOwn(e,'snapshot'),false);assert.equal(h.api.expandPressurePreventionPanelWeb(h.token,h.life,h.view()),true);assert.equal(h.view().expanded,true);
});
test('Short native pages deliver the complete private source before safe list slicing; more never queries or changes selection',async()=>{
 const h=panelHarness();h.state.cap=1;h.tables.pressure_injury_assessments=Array.from({length:9},(_,i)=>assessment(10+i));h.tables.body_map_finding_history=Array.from({length:8},(_,i)=>event(30+i));
 assert.equal(await h.load(),true);const initial=h.view(),calls=h.calls.length;assert.equal(initial.assessmentCount,9);assert.equal(initial.historyCount,8);assert.equal(initial.assessmentRows.length,6);assert.equal(initial.assessmentRemaining,3);
 assert.equal(h.api.morePressurePreventionPanelWeb(h.token,h.life,initial,'assessment'),true);assert.equal(h.view().assessmentRows.length,9);assert.equal(h.view().selectedAssessment,null);assert.equal(h.calls.length,calls);
 assert.equal(h.api.morePressurePreventionPanelWeb(h.token,h.life,h.view(),'history'),true);assert.equal(h.view().historyRows.length,8);assert.equal(h.calls.length,calls);
 assert.equal(h.api.morePressurePreventionPanelWeb(h.token,h.life,initial,'history'),false);
});
test('Genuine empty pools remain ready empty rather than an inferred absence of risk or complete revisions',async()=>{
 const h=panelHarness();h.tables.pressure_injury_assessments=[];h.tables.body_map_finding_history=[];assert.equal(await h.load(),true);const view=h.view();assert.equal(view.stage,'ready');assert.equal(view.assessmentCount,0);assert.equal(view.historyCount,0);assert.deepEqual(view.assessmentRows,[]);assert.equal(view.selectedAssessment,null);assert.equal(h.calls.length,3);
});
test('All unselected rows are checked before projection: an invisible foreign 25th original prevents the entire panel',async()=>{
 const h=panelHarness();h.tables.pressure_injury_assessments=Array.from({length:25},(_,i)=>assessment(10+i));h.state.onResult=(call,result)=>call.table==='pressure_injury_assessments'&&call.cursor===id(33)?{...result,data:[assessment(34,{tenant_id:id(99)})]}:result;
 assert.equal(await h.load(),false);const view=h.view();assert.equal(view.stage,'error');assert.equal(view.assessmentCount,0);assert.equal(view.markerId,null);assert.equal(h.select('assessment',id(10)),false);
});
test('Refresh invalidates old projection and all captured actions synchronously before the first await',async()=>{
 const h=await loaded();h.select('assessment',id(10));const held=h.view(),wait=deferred();let entered=false;h.state.defer=(call,result)=>{if(!entered){entered=true;return wait.promise;}return result;};
 const pending=h.load(held);assert.equal(entered,true);assert.equal(h.view().stage,'loading');assert.equal(h.view().selectedAssessment,null);
 assert.equal(h.select('assessment',id(10),held),false);assert.equal(h.api.expandPressurePreventionPanelWeb(h.token,h.life,held),false);assert.equal(h.api.morePressurePreventionPanelWeb(h.token,h.life,held,'assessment'),false);
 assert.equal(await h.load(held),false);assert.equal(h.calls.length,6);wait.resolve({data:[marker()],error:null,status:200});assert.equal(await pending,true);assert.equal(h.select('assessment',id(10),held),false);
});
test('A completed same-source refresh cannot revive old exact view callbacks; fresh deliberate view is required',async()=>{
 const h=await loaded(),old=h.view();assert.equal(await h.load(old),true);assert.equal(h.select('assessment',id(10),old),false);assert.equal(h.select('assessment',id(10)),true);assert.equal(h.view().selectedAssessment.id,id(10));
});
test('A native read failure never leaves previously selected metadata visible and a genuine current retry loads a new whole source',async()=>{
 const h=await loaded();h.select('assessment',id(10));h.state.onResult=()=>({error:{code:'08006'},data:null,status:500});assert.equal(await h.load(),false);assert.equal(h.view().stage,'error');assert.equal(h.view().selectedAssessment,null);
 h.state.onResult=null;assert.equal(await h.load(),true);assert.equal(h.view().selectedAssessment,null);assert.equal(h.view().assessmentCount,1);
});
test('Changing selection invalidates old expand/read handlers even when both rows are from the same source',async()=>{
 const h=panelHarness();h.tables.pressure_injury_assessments.push(assessment(11));assert.equal(await h.load(),true);h.select('assessment',id(10));const held=h.view();assert.equal(h.select('assessment',id(11),held),true);
 assert.equal(h.api.expandPressurePreventionPanelWeb(h.token,h.life,held),false);assert.equal(await h.load(held),false);assert.equal(h.view().selectedAssessment.id,id(11));assert.equal(h.api.expandPressurePreventionPanelWeb(h.token,h.life,h.view()),true);
});
for(const loss of ['permission','owner','token','expiry','tenant','client','marker','role','mode','sdk','origin'])test(`Observed ${loss} closes old data/actions permanently through matching restoration`,async()=>{
 const h=await loaded();h.select('assessment',id(10));const held=h.view(),old={auth:structuredClone(h.state.auth),tenantId:h.state.tenantId,clientId:h.state.clientId,markerId:h.state.markerId,mode:h.state.mode,sdk:h.state.sdk,permissions:h.state.permissions};
 if(loss==='permission')h.state.permission=false;if(loss==='owner')h.state.auth.profile.id=id(99);if(loss==='token')h.state.auth.session.accessToken='new-token';if(loss==='expiry')h.state.auth.session.expiresAt=Date.now()-1;
 if(loss==='tenant')h.state.tenantId=id(99);if(loss==='client')h.state.clientId=id(99);if(loss==='marker')h.state.markerId=id(99);if(loss==='role')h.state.auth.profile.roleKey='business_admin';if(loss==='mode')h.state.mode='demo';if(loss==='sdk')h.state.sdk={};if(loss==='origin')h.state.permissions=Object.freeze(['pflege.plans.view']);
 assert.equal(h.view().stage,'blocked');assert.equal(h.view().selectedAssessment,null);assert.equal(h.view().markerId,null);const count=h.calls.length;
 Object.assign(h.state,old,{permission:true});assert.equal(h.view().stage,'blocked');assert.equal(await h.load(held),false);assert.equal(h.select('assessment',id(10),held),false);assert.equal(h.calls.length,count);
});
test('A new genuine binding after denied old scope can perform a fresh explicit read; old binding is not silently restored',async()=>{
 const h=await loaded(),held=h.view();h.state.permission=false;assert.equal(h.view().stage,'blocked');h.state.permission=true;
 const token=h.api.createPressurePreventionPanelWeb(h.getAccess),life=h.api.mountPressurePreventionPanelWeb(token),fresh=h.api.pressurePreventionPanelViewWeb(token,life);
 assert.equal(await h.api.readPressurePreventionPanelWeb(token,life,fresh),true);assert.equal(h.api.pressurePreventionPanelViewWeb(token,life).stage,'ready');assert.equal(await h.load(held),false);
});
for(const where of ['build','firstThen','secondThen','lastSDK'])test(`Native ${where} denial prevents actual SELECT entry through whole binding/reader`,async()=>{
 const h=panelHarness();let armed=false;if(where==='build')h.state.onBuild=()=>h.state.permission=false;
 h.state.onThenGetter=n=>{if(where==='firstThen'&&n===1||where==='secondThen'&&n===2)h.state.permission=false;if(n===2)armed=true;};
 if(where==='lastSDK')h.state.onSDK=()=>{if(armed)h.state.permission=false;};assert.equal(await h.load(),false);assert.equal(h.calls.length,0);assert.equal(h.view().stage,'blocked');
});
test('A queued loss after legitimately synchronous SELECT dispatch prevents every following page and delivery',async()=>{
 const h=panelHarness();h.state.onBuild=()=>queueMicrotask(()=>h.state.permission=false);assert.equal(await h.load(),false);assert.equal(h.calls.length,1);assert.equal(h.view().stage,'blocked');assert.equal(h.view().assessmentRows.length,0);
});
test('Unmount during native await discards late results, all old handlers and every later page',async()=>{
 const h=panelHarness(),held=h.view(),wait=deferred();h.state.defer=()=>wait.promise;const pending=h.load(held);assert.equal(h.calls.length,1);h.api.disposePressurePreventionPanelWeb(h.token,h.life);
 assert.equal(h.view(),null);assert.equal(h.select('assessment',id(10),held),false);wait.resolve({data:[marker()],error:null,status:200});assert.equal(await pending,false);assert.equal(h.calls.length,1);
});
test('New mount uses an empty new lifetime and only a fresh read; old cleanup cannot dispose the replacement',async()=>{
 const h=await loaded(),old=h.life,held=h.view(),next=h.api.mountPressurePreventionPanelWeb(h.token);assert.notEqual(next,old);assert.deepEqual(Reflect.ownKeys(next),[]);
 h.api.disposePressurePreventionPanelWeb(h.token,old);assert.equal(h.api.pressurePreventionPanelViewWeb(h.token,next).stage,'idle');assert.equal(h.view(),null);assert.equal(await h.load(held),false);
 const view=h.api.pressurePreventionPanelViewWeb(h.token,next);assert.equal(await h.api.readPressurePreventionPanelWeb(h.token,next,view),true);
});
test('Mount replacement while read is pending keeps late old result from overwriting a newer actual whole read',async()=>{
 const h=panelHarness(),wait=deferred();let first=true;h.state.defer=(call,result)=>{if(first){first=false;return wait.promise;}return result;};const old=h.load();
 h.state.defer=null;const life=h.api.mountPressurePreventionPanelWeb(h.token),view=h.api.pressurePreventionPanelViewWeb(h.token,life);assert.equal(await h.api.readPressurePreventionPanelWeb(h.token,life,view),true);
 wait.resolve({data:[marker()],error:null,status:200});assert.equal(await old,false);assert.equal(h.api.pressurePreventionPanelViewWeb(h.token,life).stage,'ready');
});
test('Unknown whole source fields stay private without string coercion or default clinical values',async()=>{
 const h=panelHarness();Object.assign(h.tables.pressure_injury_assessments[0],{classification:{privateUnknown:'legacy'},pressure_relief_plan:{positioning:{privateUnknown:'secret'},interval:null},next_review_at:{privateUnknown:'raw-time'}});
 assert.equal(await h.load(),true);h.select('assessment',id(10));const view=h.view();assert.equal(view.selectedAssessment.classification.state,'unresolved');assert.equal(view.selectedAssessment.pressureReliefPlan.positioning.state,'unresolved');assert.equal(view.selectedAssessment.reviewAgreement.state,'unresolved');assert.equal(JSON.stringify(view).includes('privateUnknown'),false);
});
test('Wrong/fabricated selection cannot turn a foreign native identifier or copied view into metadata access',async()=>{
 const h=await loaded(),view=h.view();assert.equal(h.select('assessment',id(99)),false);assert.equal(h.select('assessment',id(10),{...view}),false);assert.equal(h.select('assessment','client-001'),false);
 const other=panelHarness();assert.equal(h.api.selectPressurePreventionPanelWeb(h.token,h.life,other.view(),'assessment',id(10)),false);assert.equal(h.view().selectedAssessment,null);
});
test('Getter-bearing native access is rejected before executing the getter or starting any SDK read',async()=>{
 const h=panelHarness();let getters=0;Object.defineProperty(h.state.auth.profile,'id',{enumerable:true,get(){getters++;return id(2);}});assert.equal(h.view().stage,'blocked');assert.equal(await h.load(),false);assert.equal(getters,0);assert.equal(h.calls.length,0);
});
test('Same-binding permission callback reentry cannot recursively mint a current view or new read',async()=>{
 const h=await loaded();let entered=false;h.state.onPermission=()=>{if(!entered){entered=true;assert.equal(h.view().stage,'blocked');}};assert.equal(h.view().stage,'blocked');assert.equal(entered,true);assert.equal(h.view().assessmentRows.length,0);
});
test('Only active lifetime subscribers receive changes; unsubscribe and old cleanup cannot signal a replacement',async()=>{
 const h=panelHarness();let notices=0;const stop=h.api.subscribePressurePreventionPanelWeb(h.token,h.life,()=>notices++);assert.equal(await h.load(),true);assert.equal(notices,2);stop();h.select('assessment',id(10));assert.equal(notices,2);
 const next=h.api.mountPressurePreventionPanelWeb(h.token);assert.equal(await h.api.readPressurePreventionPanelWeb(h.token,next,h.api.pressurePreventionPanelViewWeb(h.token,next)),true);assert.equal(notices,2);
});

// Whole actual native hook/session UUID loader; controlled native SDK leaves, no static permission fallback.
const permissionSource=body('src/lib/permissions/currentCarePermissions.web.ts'),hookSource=body('src/hooks/pflege/useCareRuntimePermissions.web.ts'),resolverSource=body('src/lib/auth/sessionTarget.ts');
const resolveEffectiveRoleKey=new Function('BUSINESS_HOME_ROUTE',resolverSource+';return resolveEffectiveRoleKey;')('/');
const keys=['pflege.plans.view'];
function permissionHarness(){
 let slots=[],cursor=0,effects=[],api;
 const state={user:{id:id(2)},profile:{id:id(2),tenantId:id(1),roleKey:'business_admin'},token:'native-token-A',expiresAt:Math.floor(Date.now()/1000)*1000+60000,rights:[...keys],calls:[],fallback:0};
 const sameDeps=(a,b)=>a?.length===b?.length&&a.every((v,i)=>Object.is(v,b[i]));
 const useState=v=>{const i=cursor++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];};
 const useRef=v=>{const i=cursor++;if(!(i in slots))slots[i]={current:v};return slots[i];};
 const useEffect=(fn,deps)=>{const i=cursor++;if(!(i in slots)||!sameDeps(slots[i].deps,deps)){const old=slots[i],effect={deps,cleanup:old?.cleanup};slots[i]=effect;effects.push(()=>{old?.cleanup?.();effect.cleanup=fn();});}};
 const auth=()=>({authReady:true,isAuthenticated:true,isLoading:false,profileBootstrapError:null,profile:state.profile,user:state.user,portalSession:null,session:{user:state.user,accessToken:state.token,expiresAt:state.expiresAt}});
 const sdk={auth:{getSession:async()=>{state.calls.push('session');return{error:null,data:{session:{user:state.user,access_token:state.token,expires_at:state.expiresAt/1000}}};}},from(table){if(state.nativeDb&&!['roles','role_permissions','role_permission_sets'].includes(table))return state.nativeDb.from(table);let cursor=null;const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,gt:(_key,value)=>{cursor=value;return q;},maybeSingle:()=>{q.single=true;return q;},then(resolve,reject){state.calls.push({table,cursor});const rows=table==='role_permissions'?state.rights.map((permission_key,i)=>({id:id(100+i),role_id:id(50),permission_key})):[];return Promise.resolve({error:null,data:q.single?{id:id(50),key:state.profile.roleKey}:rows.filter(row=>!cursor||row.id>cursor).slice(0,1)}).then(resolve,reject);}};return q;}};
 const fetchCurrentCarePermissions=new Function('carePermissionOwnerIsCurrent','getPermissionsForRole','getSupabaseClient',permissionSource+';return fetchCurrentCarePermissions;')(owners.carePermissionOwnerIsCurrent,()=>{state.fallback++;throw Error('No fallback');},()=>sdk);
 const hook=new Function('useEffect','useRef','useState','ROLE_LABELS','checkPermissionWithList','hasEffectiveModuleGateAccess','isDemoMode','useAuth','resolveEffectiveRoleKey','useServiceTenantId','carePermissionOwner','sameCarePermissionOwner','carePermissionOwnerIsCurrent','fetchCurrentCarePermissions',hookSource+';return useCareRuntimePermissions;')(useEffect,useRef,useState,{business_admin:'Admin'},(_role,list,key)=>({allowed:list.includes(key)}),()=>{throw Error('Product gate is not an authorization fixture');},()=>false,auth,resolveEffectiveRoleKey,()=>id(1),owners.carePermissionOwner,owners.sameCarePermissionOwner,owners.carePermissionOwnerIsCurrent,fetchCurrentCarePermissions);
 const render=()=>{cursor=0;api=hook();return api;};
 const flush=()=>{const fs=effects;effects=[];fs.forEach(f=>f());};
 const ready=async()=>{for(let i=0;i<4;i++){render();flush();await new Promise(r=>setImmediate(r));}render();};
 const stop=()=>{for(const s of slots)s?.cleanup?.();};
 return{state,auth,sdk,ready,render,stop,get api(){return api;}};
}
async function nativePanel(){const p=permissionHarness();await p.ready();let h=panelHarness(base=>({...base.getAccess(),auth:p.auth(),permissions:p.api.permissions,can:p.api.can}));p.state.nativeDb=h.state.sdk;h.state.sdk=p.sdk;return{h,p,stop(){h.api.disposePressurePreventionPanelWeb(h.token,h.life);p.stop();}};}

test('Actual native UUID/session/keyset permission loader and whole hook authorize plans-only own read on the same SDK',async()=>{
 const n=await nativePanel();try{const {h,p}=n;assert.equal(await h.load(),true);assert.equal(p.state.fallback,0);assert.equal(h.calls.length,5);assert.equal(h.select('assessment',id(10)),true);assert.equal(h.view().selectedAssessment.assessor.value,id(2));
 assert.ok(p.state.calls.some(call=>call.table==='role_permissions'&&call.cursor===id(100)));assert.ok(Object.isFrozen(p.api.permissions));assert.equal(p.api.can('pflege.plans.manage'),false);assert.equal(p.api.can('office.clients.edit'),false);
 }finally{n.stop();}
});
test('Actual native permission refresh before render closes retained panel actions and hides every old field',async()=>{
 const n=await nativePanel();try{const {h,p}=n;assert.equal(await h.load(),true);h.select('assessment',id(10));const held=h.view(),count=h.calls.length;p.api.refreshPermissions();
 assert.equal(p.api.can('pflege.plans.view'),false);assert.equal(h.select('assessment',id(10),held),false);assert.equal(h.view().stage,'blocked');assert.equal(h.view().selectedAssessment,null);assert.equal(await h.load(held),false);assert.equal(h.calls.length,count);
 await p.ready();assert.equal(p.api.can('pflege.plans.view'),true);assert.equal(h.view().stage,'blocked');assert.equal(h.select('assessment',id(10),held),false);
 }finally{n.stop();}
});
test('Unobserved completed native permission generation is not a reused pointer grant to previous metadata',async()=>{
 const n=await nativePanel();try{const {h,p}=n;assert.equal(await h.load(),true);const held=h.view(),origin=p.api.permissions;p.api.refreshPermissions();await p.ready();assert.notEqual(p.api.permissions,origin);assert.equal(p.api.can('pflege.plans.view'),true);
 assert.equal(h.view().stage,'blocked');assert.equal(await h.load(held),false);assert.equal(h.view().assessmentCount,0);
 }finally{n.stop();}
});
test('Harmless native same-read renders keep exact grant origin and allow current owned selection',async()=>{
 const n=await nativePanel();try{const {h,p}=n;assert.equal(await h.load(),true);const origin=p.api.permissions,can=p.api.can;p.render();assert.equal(p.api.permissions,origin);assert.notEqual(p.api.can,can);assert.equal(h.view().stage,'ready');assert.equal(h.select('assessment',id(10)),true);
 }finally{n.stop();}
});
test('Actual native session expiry without render blocks held metadata and any following read',async()=>{
 const n=await nativePanel(),clock=Date.now;try{const {h,p}=n;assert.equal(await h.load(),true);const held=h.view(),count=h.calls.length;Date.now=()=>p.state.expiresAt+1;assert.equal(h.view().stage,'blocked');assert.equal(h.select('assessment',id(10),held),false);assert.equal(await h.load(held),false);assert.equal(h.calls.length,count);
 }finally{Date.now=clock;n.stop();}
});
for(const accessor of ['SDK','mode'])test(`Actual native refresh inside final ${accessor} accessor cannot dispatch pressure reads or expose a current panel`,async()=>{
 const n=await nativePanel();try{const {h,p}=n;let armed=false,fired=false;h.state.onThenGetter=count=>{if(count===2)armed=true;};const invalidate=()=>{if(armed&&!fired){fired=true;p.api.refreshPermissions();}};if(accessor==='SDK')h.state.onSDK=invalidate;else h.state.onMode=invalidate;
 assert.equal(await h.load(),false);assert.equal(fired,true);assert.equal(h.calls.length,0);assert.equal(h.view().stage,'blocked');await p.ready();assert.equal(h.view().stage,'blocked');
 }finally{n.stop();}
});
test('Native owner A→B→A cannot revive old token; separate freshly created actual own binding can read',async()=>{
 const n=await nativePanel();try{const {h,p}=n;assert.equal(await h.load(),true);const held=h.view(),user=p.state.user,profile=p.state.profile;p.state.user={id:id(22)};p.state.profile={...profile,id:id(22)};p.render();assert.equal(h.view().stage,'blocked');p.state.user=user;p.state.profile=profile;await p.ready();assert.equal(h.view().stage,'blocked');assert.equal(await h.load(held),false);
 const token=h.api.createPressurePreventionPanelWeb(()=>({...h.getAccess(),auth:p.auth(),permissions:p.api.permissions,can:p.api.can})),life=h.api.mountPressurePreventionPanelWeb(token);assert.equal(await h.api.readPressurePreventionPanelWeb(token,life,h.api.pressurePreventionPanelViewWeb(token,life)),true);h.api.disposePressurePreventionPanelWeb(token,life);
 }finally{n.stop();}
});

function componentHarness(h){
 const token=h.api.createPressurePreventionPanelWeb(h.getAccess);let slots=[],cursor=0,effects=[],latest,intervals=new Map(),intervalSerial=0;
 const sameDeps=(a,b)=>a?.length===b?.length&&a.every((value,index)=>Object.is(value,b[index]));
 const useState=initial=>{const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return[slots[index],value=>{slots[index]=typeof value==='function'?value(slots[index]):value;}];};
 const useEffect=(run,deps)=>{const index=cursor++;if(!(index in slots)||!sameDeps(slots[index].deps,deps)){const previous=slots[index];slots[index]={deps,cleanup:previous?.cleanup};effects.push(()=>{previous?.cleanup?.();slots[index].cleanup=run();});}};
 const source=read('src/components/pflege/PressurePreventionHistoryPanel.web.tsx'),start=source.indexOf('export function PressurePreventionHistoryPanel('),end=source.indexOf('\n return (',start);
 assert.ok(start>=0&&end>start);const prefix=source.slice(start,end).replace('export function','function')+'\nreturn {view,lifetime,read,select,expand,more};\n}';
 const deps={...h.api,useState,useEffect,useCareLightPalette:()=>({c:{text:'#102B49',muted:'#526B82',border:'#CCDBEA'}}),StyleSheet:{create:value=>value},spacing:{xs:4,sm:8,md:16},typography:{body:{},caption:{}},
  setInterval:callback=>{const id=++intervalSerial;intervals.set(id,callback);return id;},clearInterval:id=>intervals.delete(id)};
 const Component=new Function(...Object.keys(deps),strip(prefix)+';return PressurePreventionHistoryPanel;')(...Object.values(deps));
 const render=()=>{cursor=0;latest=Component({token});return latest;};const flush=()=>{const pending=effects;effects=[];pending.forEach(run=>run());};
 const stop=()=>{for(const slot of slots)slot?.cleanup?.();};render();flush();render();return{render,flush,stop,token,intervals,get api(){return latest;}};
}
test('Actual Panel effect/handlers use empty token and load whole native source only after explicit action',async()=>{
 const h=panelHarness(),c=componentHarness(h);try{assert.equal(c.api.view.stage,'idle');assert.equal(h.calls.length,0);assert.deepEqual(Reflect.ownKeys(c.token),[]);c.api.read();await drain();c.render();assert.equal(c.api.view.stage,'ready');assert.equal(h.calls.length,5);
 c.api.select('assessment',id(10));c.render();assert.equal(c.api.view.selectedAssessment.id,id(10));c.api.expand();c.render();assert.equal(c.api.view.expanded,true);assert.equal(h.calls.length,5);
 }finally{c.stop();}
});
test('Actual held Panel selection/expand/retry callbacks stop after native denial without requiring a render',async()=>{
 const h=panelHarness(),c=componentHarness(h);try{c.api.read();await drain();c.render();c.api.select('assessment',id(10));c.render();const held=c.api,count=h.calls.length;h.state.permission=false;held.select('assessment',id(10));held.expand();held.read();await drain();c.render();assert.equal(c.api.view.stage,'blocked');assert.equal(c.api.view.selectedAssessment,null);assert.equal(h.calls.length,count);
 h.state.permission=true;held.read();await drain();c.render();assert.equal(c.api.view.stage,'blocked');assert.equal(h.calls.length,count);
 }finally{c.stop();}
});
test('Actual Panel read/selection callbacks and timer cleanup remain bound to the disposed effect lifetime',async()=>{
 const h=panelHarness(),c=componentHarness(h);c.api.read();await drain();c.render();const held=c.api,count=h.calls.length;assert.equal(c.intervals.size,1);c.stop();assert.equal(c.intervals.size,0);
 held.select('assessment',id(10));held.expand();held.more('assessment');held.read();await drain();assert.equal(h.calls.length,count);assert.equal(h.api.pressurePreventionPanelViewWeb(c.token,held.lifetime),null);
});
test('Actual Panel refresh handlers synchronously hide previous details and ignore old clicked callbacks across await',async()=>{
 const h=panelHarness(),c=componentHarness(h),wait=deferred();try{c.api.read();await drain();c.render();c.api.select('assessment',id(10));c.render();const held=c.api;let first=true;h.state.defer=(call,result)=>{if(first){first=false;return wait.promise;}return result;};held.read();c.render();assert.equal(c.api.view.stage,'loading');assert.equal(c.api.view.selectedAssessment,null);held.select('history',id(20));held.expand();assert.equal(h.calls.length,6);
 wait.resolve({data:[marker()],error:null,status:200});await drain();c.render();assert.equal(c.api.view.stage,'ready');assert.equal(c.api.view.selectedEvent,null);assert.equal(c.api.view.expanded,false);
 }finally{wait.resolve({data:[marker()],error:null,status:200});c.stop();}
});
