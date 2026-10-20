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
const read=p=>readFileSync(root+p,'utf8');
const body=p=>strip(read(p).replace(/^import[\s\S]*?;\n/gm,'').replace(/\bexport /g,''));
const compose=(path,deps,names)=>new Function(...Object.keys(deps),body(path)+';return {'+names.join(',')+'};')(...Object.values(deps));
const fixture=read('scripts/checks/mental-health-originals-web.node.test.mjs');
const fixtureBody=fixture.slice(0,fixture.indexOf("test('Own full Parent"))
 .replace(/^import[^\n]*\n/gm,'').replace(/const root=fileURLToPath[^\n]*\n/,'').replace(/const read=p=>[^\n]*\n/,'');
const {harness,id,topic,measure,assessment,deferred}=new Function('native','owners','woundInstant','woundUuid','treatmentRecordedTimeDisplay','withServiceQueryTimeout','strip','read','assert',fixtureBody+';return {harness,id,topic,measure,assessment,deferred};')(native,owners,woundInstant,woundUuid,treatmentRecordedTimeDisplay,withServiceQueryTimeout,strip,read,assert);
const names=['createMentalHealthNarrativePanelWeb','mountMentalHealthNarrativePanelWeb','disposeMentalHealthNarrativePanelWeb','subscribeMentalHealthNarrativePanelWeb','mentalHealthNarrativePanelViewWeb','readMentalHealthNarrativePanelWeb','selectMentalHealthNarrativePanelWeb','expandMentalHealthNarrativePanelWeb','moreMentalHealthNarrativePanelWeb'];
function panelHarness(getAccess){
 const h=harness();h.reader.dispose();h.state.sensitive=true;h.state.permissions=Object.freeze(['pflege.plans.view','office.clients.view_sensitive']);
 const can=key=>{assert.ok(['pflege.plans.view','office.clients.view_sensitive'].includes(key));h.state.onPermission?.(key);return key==='pflege.plans.view'?h.state.permission:h.state.sensitive;};
 const ownAccess=()=>({...h.getAccess(),can});
 const api=compose('src/lib/careAssessment/mentalHealthNarrativePanelBinding.web.ts',{MentalHealthOriginalReader:h.Reader,currentMentalHealthOriginalsWeb:h.mentalOriginals,isCurrentMentalHealthOriginalContextWeb:h.mentalContext,...h.history,...native,...owners,woundUuid,getSupabaseClient:()=>h.state.sdk},names);
 const access=()=>getAccess?getAccess({...h,getAccess:ownAccess}):ownAccess();
 const token=api.createMentalHealthNarrativePanelWeb(access),life=api.mountMentalHealthNarrativePanelWeb(token);
 const view=()=>api.mentalHealthNarrativePanelViewWeb(token,life),load=(expected=view())=>api.readMentalHealthNarrativePanelWeb(token,life,expected),select=(kind,key,expected=view())=>api.selectMentalHealthNarrativePanelWeb(token,life,expected,kind,key);
 return{...h,getAccess:access,api,token,life,view,load,select};
}
async function loaded(){const h=panelHarness();assert.equal(await h.load(),true);assert.equal(h.view().stage,'ready');return h;}
async function drain(){await new Promise(resolve=>setImmediate(resolve));}

test('Opaque token/lifetime and exact view guard reject copied capabilities before any SDK call',async()=>{
 const h=panelHarness();assert.deepEqual(Reflect.ownKeys(h.token),[]);assert.deepEqual(Reflect.ownKeys(h.life),[]);assert.ok(Object.isFrozen(h.token));assert.ok(Object.isFrozen(h.life));
 assert.equal(h.api.mentalHealthNarrativePanelViewWeb({...h.token},h.life),null);assert.equal(h.api.mentalHealthNarrativePanelViewWeb(h.token,{...h.life}),null);
 assert.equal(await h.load({...h.view()}),false);assert.equal(h.calls.length,0);assert.equal(await h.load(),true);assert.equal(h.calls.length,16);
});
test('Only deliberate native Topic selection delivers allowlisted statements, exact source array and communication support',async()=>{
 const h=await loaded(),before=structuredClone(h.tables);assert.equal(h.view().selectedTopic,null);assert.equal(h.view().communicationSupport,null);assert.equal(h.select('topic',id(10)),true);
 const view=h.view(),row=view.selectedTopic;assert.deepEqual(Object.keys(row.fields),['person_perspective','resources','wishes','habits_biography']);assert.equal(row.fields.resources.value,'Individuelle Ressource');
 assert.deepEqual(row.informationSources,{state:'value',values:['Person','Historische Quelle']});assert.equal(view.communicationSupport.value,'Vertraute Ansprache');assert.equal(row.recordedAt.purpose,'recorded');assert.equal(row.updatedAt.raw,'2026-10-11 10:00:00.123458+02:00');
 assert.ok(Object.isFrozen(row.fields));assert.deepEqual(h.tables,before);assert.equal(h.calls.length,16);
});
test('Only selected measure allowlist survives; planning TEXT references never become native relation or completion',async()=>{
 const h=await loaded();assert.equal(h.select('measure',id(30)),true);const row=h.view().selectedMeasure;
 assert.deepEqual(Object.keys(row.fields),['title','related_topic_key','related_risk_key','personal_goal','intervention','timing','frequency','person_contribution','relatives_contribution']);assert.equal(row.fields.related_risk_key.value,'psychological_crisis');
 assert.equal(row.reviewAgreement.purpose,'review_agreement');assert.equal(row.reviewAgreement.raw,'2026-10-14 10:00:00.000001+02:00');assert.equal(Object.hasOwn(row.fields,'warning_signs'),false);assert.equal(Object.hasOwn(row.fields,'escalation_path'),false);assert.equal(Object.hasOwn(row.fields,'status'),false);
 assert.equal(Object.hasOwn(row,'clinicalDone'),false);assert.equal(h.view().communicationSupport,null);
});
test('Every private hidden risk/event/link/version original is retained but no raw or excluded detail crosses the view',async()=>{
 const h=panelHarness();h.tables.care_assessment_risks[0].evidence='EXCLUDED_RISK';h.tables.care_assessment_events[0].summary='EXCLUDED_EVENT';h.tables.care_assessment_links[0].label='EXCLUDED_LINK';h.tables.care_assessment_versions[0].snapshot.assessment.person_statement='EXCLUDED_VERSION';h.tables.care_assessment_measures[0].warning_signs='EXCLUDED_WARNING';h.tables.care_assessment_measures[0].escalation_path='EXCLUDED_ESCALATION';
 const before=structuredClone(h.tables);assert.equal(await h.load(),true);h.select('topic',id(10));let json=JSON.stringify(h.view());for(const text of ['EXCLUDED_RISK','EXCLUDED_EVENT','EXCLUDED_LINK','EXCLUDED_VERSION','EXCLUDED_WARNING','EXCLUDED_ESCALATION','opaque-native-token','legacy_payload'])assert.equal(json.includes(text),false);
 h.select('measure',id(30));json=JSON.stringify(h.view());for(const text of ['EXCLUDED_RISK','EXCLUDED_EVENT','EXCLUDED_LINK','EXCLUDED_VERSION','EXCLUDED_WARNING','EXCLUDED_ESCALATION'])assert.equal(json.includes(text),false);
 assert.deepEqual(h.tables,before);for(const key of ['originals','permissions','auth','riskCount','risks','events','versions','links'])assert.equal(Object.hasOwn(h.view(),key),false);
});
for(const [label,value,state] of [['missing',undefined,'missing'],['null',null,'null'],['empty','','empty'],['zero',0,'unresolved'],['object',{rawSecret:'no serialization'},'unresolved']])test(`Native selected text ${label} is honest and never normalizes an unknown structure`,async()=>{
 const h=panelHarness();if(value===undefined)delete h.tables.care_assessment_topics[0].resources;else h.tables.care_assessment_topics[0].resources=value;
 assert.equal(await h.load(),true);h.select('topic',id(10));assert.equal(h.view().selectedTopic.fields.resources.state,state);assert.equal(JSON.stringify(h.view()).includes('rawSecret'),false);
});
for(const [label,value,state,values] of [['missing',undefined,'missing',null],['null',null,'null',null],['empty',[],'empty',[]],['emptyString','','empty',null],['invalid',[0],'unresolved',null]])test(`Information sources ${label} remain distinct; no missing array invented`,async()=>{
 const h=panelHarness();if(value===undefined)delete h.tables.care_assessment_topics[0].information_sources;else h.tables.care_assessment_topics[0].information_sources=value;
 assert.equal(await h.load(),true);h.select('topic',id(10));assert.deepEqual(h.view().selectedTopic.informationSources,{state,values});
});
test('Long literal texts retain original whitespace and meaning without keyword diagnosis or truncation',async()=>{
 const h=panelHarness(),text='  Psychische Krise ist hier ein historisches Zitat. '+ 'Original '.repeat(3000)+'\nSelbstbestimmter Wunsch  ';h.tables.care_assessment_topics[0].habits_biography=text;
 assert.equal(await h.load(),true);h.select('topic',id(10));assert.equal(h.view().selectedTopic.fields.habits_biography.value,text);assert.equal(Object.hasOwn(h.view().selectedTopic,'diagnosis'),false);
});
test('Complete UUID pages precede slicing and More changes only current bound view with zero additional SDK calls',async()=>{
 const h=panelHarness();h.state.cap=1;h.tables.care_assessment_topics=Array.from({length:9},(_,i)=>topic(10+i));h.tables.care_assessment_measures=Array.from({length:8},(_,i)=>measure(30+i));
 assert.equal(await h.load(),true);const first=h.view(),count=h.calls.length;assert.equal(first.topicCount,9);assert.equal(first.measureCount,8);assert.equal(first.topicRows.length,6);
 assert.equal(h.api.moreMentalHealthNarrativePanelWeb(h.token,h.life,first,'topic'),true);assert.equal(h.view().topicRows.length,9);assert.equal(h.view().selectedTopic,null);assert.equal(h.calls.length,count);assert.equal(h.api.moreMentalHealthNarrativePanelWeb(h.token,h.life,first,'measure'),false);
 assert.equal(h.api.moreMentalHealthNarrativePanelWeb(h.token,h.life,h.view(),'measure'),true);assert.equal(h.view().measureRows.length,8);
});
for(const table of ['care_assessment_topics','care_assessment_risks','care_assessment_measures','care_assessment_evaluations','care_assessment_events','care_assessment_links','care_assessment_versions'])test(`Unselected late foreign ${table} prevents any partial panel`,async()=>{
 const h=panelHarness();h.state.cap=1;const row=h.tables[table][0];h.tables[table]=[row,{...row,id:id(95)}];h.state.onResult=(call,result)=>call.table===table&&call.cursor!==null&&result.data.length?{...result,data:[{...result.data[0],tenant_id:id(99)}]}:result;
 assert.equal(await h.load(),false);assert.equal(h.view().stage,'error');assert.equal(h.view().assessmentId,null);assert.equal(h.view().topicCount,0);assert.equal(h.select('topic',id(10)),false);
});
test('Genuine empty Topic/Measure sources remain known empty without synthetic help, diagnosis or historical claim',async()=>{
 const h=panelHarness();h.tables.care_assessment_topics=[];h.tables.care_assessment_measures=[];assert.equal(await h.load(),true);assert.equal(h.view().topicCount,0);assert.equal(h.view().measureCount,0);assert.deepEqual(h.view().topicRows,[]);assert.equal(h.view().selectedTopic,null);
});
test('Refresh synchronously removes old detail and invalidates all old actions before native await',async()=>{
 const h=await loaded();h.select('topic',id(10));const held=h.view(),wait=deferred();let first=true;h.state.defer=(call,result)=>{if(first){first=false;return wait.promise}return result};const pending=h.load(held);
 assert.equal(h.view().stage,'loading');assert.equal(h.view().selectedTopic,null);assert.equal(h.select('measure',id(30),held),false);assert.equal(h.api.expandMentalHealthNarrativePanelWeb(h.token,h.life,held),false);assert.equal(h.api.moreMentalHealthNarrativePanelWeb(h.token,h.life,held,'topic'),false);assert.equal(await h.load(held),false);
 wait.resolve({data:assessment(),error:null,status:200});assert.equal(await pending,true);assert.equal(h.select('topic',id(10),held),false);
});
test('Failure hides old metadata; current own deliberate retry may read anew but never reuse held callbacks',async()=>{
 const h=await loaded();h.select('topic',id(10));const held=h.view();h.state.onResult=()=>({error:{code:'08006'},data:null,status:500});assert.equal(await h.load(),false);assert.equal(h.view().stage,'error');assert.equal(h.view().selectedTopic,null);
 h.state.onResult=null;assert.equal(await h.load(),true);assert.equal(h.select('topic',id(10),held),false);assert.equal(h.view().selectedTopic,null);
});
test('Changed native selection invalidates retained Expand and Read on unchanged full source',async()=>{
 const h=panelHarness();h.tables.care_assessment_topics.push(topic(11));assert.equal(await h.load(),true);h.select('topic',id(10));const held=h.view();assert.equal(h.select('topic',id(11),held),true);assert.equal(h.api.expandMentalHealthNarrativePanelWeb(h.token,h.life,held),false);assert.equal(await h.load(held),false);assert.equal(h.view().selectedTopic.id,id(11));
});
for(const loss of ['plan','sensitive','owner','token','expiry','tenant','client','assessment','role','mode','sdk','origin'])test(`Observed ${loss} closes exact bound metadata permanently through matching restoration`,async()=>{
 const h=await loaded();h.select('topic',id(10));const held=h.view(),old={auth:structuredClone(h.state.auth),tenantId:h.state.tenantId,clientId:h.state.clientId,assessmentId:h.state.assessmentId,mode:h.state.mode,sdk:h.state.sdk,permissions:h.state.permissions};
 if(loss==='plan')h.state.permission=false;if(loss==='sensitive')h.state.sensitive=false;if(loss==='owner')h.state.auth.profile.id=id(99);if(loss==='token')h.state.auth.session.accessToken='new-token';if(loss==='expiry')h.state.auth.session.expiresAt=Date.now()-1;
 if(loss==='tenant')h.state.tenantId=id(99);if(loss==='client')h.state.clientId=id(99);if(loss==='assessment')h.state.assessmentId=id(99);if(loss==='role')h.state.auth.profile.roleKey='business_admin';if(loss==='mode')h.state.mode='demo';if(loss==='sdk')h.state.sdk={};if(loss==='origin')h.state.permissions=Object.freeze(['pflege.plans.view','office.clients.view_sensitive']);
 assert.equal(h.view().stage,'blocked');assert.equal(h.view().topicCount,0);assert.equal(h.view().communicationSupport,null);assert.equal(h.view().selectedTopic,null);const count=h.calls.length;
 Object.assign(h.state,old,{permission:true,sensitive:true});assert.equal(await h.load(held),false);assert.equal(h.view().stage,'blocked');assert.equal(h.calls.length,count);
});
for(const key of ['pflege.plans.view','office.clients.view_sensitive'])for(const location of ['build','firstThen','secondThen','lastSDK','lastMode','afterResult'])test(`Both keys: ${key} loss at ${location} stops full original delivery and any next native boundary`,async()=>{
 const h=panelHarness();let armed=false,fired=false;const revoke=()=>{if(fired)return;fired=true;if(key==='pflege.plans.view')h.state.permission=false;else h.state.sensitive=false;};
 if(location==='build')h.state.onBuild=revoke;h.state.onThenGetter=n=>{if(location==='firstThen'&&n===1||location==='secondThen'&&n===2)revoke();if(n===2)armed=true;};
 if(location==='lastSDK')h.state.onSDK=()=>{if(armed)revoke()};if(location==='lastMode')h.state.onMode=()=>{if(armed)revoke()};if(location==='afterResult')h.state.onResult=(c,r)=>{revoke();return r};
 assert.equal(await h.load(),false);assert.equal(fired,true);assert.equal(h.calls.length,location==='afterResult'?1:0);assert.equal(h.view().stage,'blocked');assert.equal(h.view().topicRows.length,0);
});
test('Missing native Sensitive origin cannot be manufactured by a true can callback',async()=>{
 const h=panelHarness();h.state.permissions=Object.freeze(['pflege.plans.view']);assert.equal(await h.load(),false);assert.equal(h.view().stage,'blocked');assert.equal(h.calls.length,0);
});
for(const grant of [null,1,'true',Promise.resolve(true)])test(`Truthy/nonboolean Sensitive callback ${typeof grant} is not native display permission`,async()=>{
 const h=panelHarness(base=>({...base.getAccess(),can:key=>key==='pflege.plans.view'?true:grant}));assert.equal(await h.load(),false);assert.equal(h.calls.length,0);assert.equal(h.view().stage,'blocked');
});
test('Getter-bearing access fields are rejected before traversing or calling their getter',async()=>{
 const h=panelHarness();let getters=0;Object.defineProperty(h.state.auth.profile,'id',{enumerable:true,get(){getters++;return id(2)}});assert.equal(await h.load(),false);assert.equal(getters,0);assert.equal(h.calls.length,0);
});
test('Own permission callback reentry closes metadata instead of recursively minting fresh view',async()=>{
 const h=await loaded();let entered=false;h.state.onPermission=()=>{if(!entered){entered=true;assert.equal(h.view().stage,'blocked')}};assert.equal(h.view().stage,'blocked');assert.equal(entered,true);assert.equal(h.view().topicCount,0);
});
test('Foreign id, copied view and independent same-scope binding cannot select or expand own data',async()=>{
 const h=await loaded(),v=h.view(),other=await loaded();assert.equal(h.select('topic',id(99)),false);assert.equal(h.select('topic','legacy'),false);assert.equal(h.select('topic',id(10),{...v}),false);assert.equal(h.select('topic',id(10),other.view()),false);assert.equal(h.api.expandMentalHealthNarrativePanelWeb(h.token,h.life,v),false);
});
test('Unmount while awaiting native result prevents late delivery and every old callback',async()=>{
 const h=panelHarness(),held=h.view(),wait=deferred();h.state.defer=()=>wait.promise;const pending=h.load(held);assert.equal(h.calls.length,1);h.api.disposeMentalHealthNarrativePanelWeb(h.token,h.life);assert.equal(h.view(),null);
 wait.resolve({data:assessment(),error:null,status:200});assert.equal(await pending,false);assert.equal(h.calls.length,1);assert.equal(h.select('topic',id(10),held),false);
});
test('New mount uses fresh empty lifetime and old cleanup cannot dispose a newly completed read',async()=>{
 const h=await loaded(),held=h.view(),life=h.api.mountMentalHealthNarrativePanelWeb(h.token);assert.notEqual(life,h.life);h.api.disposeMentalHealthNarrativePanelWeb(h.token,h.life);assert.equal(h.view(),null);
 const v=h.api.mentalHealthNarrativePanelViewWeb(h.token,life);assert.equal(v.stage,'idle');assert.equal(await h.api.readMentalHealthNarrativePanelWeb(h.token,life,v),true);assert.equal(await h.load(held),false);assert.equal(h.api.mentalHealthNarrativePanelViewWeb(h.token,life).stage,'ready');
});
test('Observer callbacks cannot give stale lifetime authority or leak past unsubscribe',async()=>{
 const h=panelHarness();let calls=0;const stop=h.api.subscribeMentalHealthNarrativePanelWeb(h.token,h.life,()=>calls++);assert.equal(await h.load(),true);assert.equal(calls,2);stop();h.select('topic',id(10));assert.equal(calls,2);
});

// Whole actual native hook/session UUID loader; controlled native SDK leaves, no static permission fallback.
const permissionSource=body('src/lib/permissions/currentCarePermissions.web.ts'),hookSource=body('src/hooks/pflege/useCareRuntimePermissions.web.ts'),resolverSource=body('src/lib/auth/sessionTarget.ts');
const resolveEffectiveRoleKey=new Function('BUSINESS_HOME_ROUTE',resolverSource+';return resolveEffectiveRoleKey;')('/');
const keys=['pflege.plans.view','office.clients.view_sensitive'];
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
async function nativePanel(){const p=permissionHarness();await p.ready();let h=panelHarness(base=>({...base.getAccess(),auth:p.auth(),permissions:p.api.permissions,can:p.api.can}));p.state.nativeDb=h.state.sdk;h.state.sdk=p.sdk;return{h,p,stop(){h.api.disposeMentalHealthNarrativePanelWeb(h.token,h.life);p.stop();}};}


test('Whole actual native Hook/UUID/session/keyset loader supplies BOTH display keys on the same native SDK without Manage',async()=>{
 const n=await nativePanel();try{const {h,p}=n;assert.equal(await h.load(),true);assert.equal(p.state.fallback,0);assert.equal(h.calls.length,16);assert.ok(Object.isFrozen(p.api.permissions));assert.equal(p.api.can('pflege.assessments.manage'),false);assert.equal(p.api.can('office.clients.edit'),false);assert.equal(h.select('topic',id(10)),true);assert.equal(h.view().selectedTopic.fields.resources.value,'Individuelle Ressource');}finally{n.stop();}
});
for(const key of ['pflege.plans.view','office.clients.view_sensitive'])test(`Actual native current ${key} refresh revokes held callback before render`,async()=>{
 const n=await nativePanel();try{const {h,p}=n;assert.equal(await h.load(),true);h.select('topic',id(10));const held=h.view(),count=h.calls.length;p.state.rights=p.state.rights.filter(k=>k!==key);p.api.refreshPermissions();assert.equal(p.api.can(key),false);assert.equal(h.select('topic',id(10),held),false);assert.equal(h.view().stage,'blocked');assert.equal(await h.load(held),false);assert.equal(h.calls.length,count);await p.ready();assert.equal(h.view().topicCount,0);}finally{n.stop();}
});
test('Unobserved completed native refresh cannot revive old projection even after matching BOTH-key regrant',async()=>{
 const n=await nativePanel();try{const {h,p}=n;assert.equal(await h.load(),true);const held=h.view(),origin=p.api.permissions;p.api.refreshPermissions();await p.ready();assert.notEqual(p.api.permissions,origin);assert.equal(p.api.can('pflege.plans.view'),true);assert.equal(p.api.can('office.clients.view_sensitive'),true);assert.equal(h.view().stage,'blocked');assert.equal(await h.load(held),false);}finally{n.stop();}
});
test('Harmless same native permission read may create fresh can function without dropping legitimate readonly display',async()=>{
 const n=await nativePanel();try{const {h,p}=n;assert.equal(await h.load(),true);const origin=p.api.permissions,can=p.api.can;p.render();assert.equal(p.api.permissions,origin);assert.notEqual(p.api.can,can);assert.equal(h.select('topic',id(10)),true);assert.equal(h.view().stage,'ready');}finally{n.stop();}
});
for(const accessor of ['SDK','mode'])test(`Actual native refresh from last ${accessor} boundary prevents initial M source then`,async()=>{
 const n=await nativePanel();try{const {h,p}=n;let armed=false,fired=false;h.state.onThenGetter=count=>{if(count===2)armed=true};const deny=()=>{if(armed&&!fired){fired=true;p.api.refreshPermissions()}};if(accessor==='SDK')h.state.onSDK=deny;else h.state.onMode=deny;
 assert.equal(await h.load(),false);assert.equal(fired,true);assert.equal(h.calls.length,0);assert.equal(h.view().stage,'blocked');}finally{n.stop();}
});
test('Matching native owner return cannot revive old data but separate own token can deliberately obtain new source',async()=>{
 const n=await nativePanel();try{const {h,p}=n;assert.equal(await h.load(),true);const held=h.view(),user=p.state.user,profile=p.state.profile;p.state.user={id:id(22)};p.state.profile={...profile,id:id(22)};p.render();assert.equal(h.view().stage,'blocked');p.state.user=user;p.state.profile=profile;await p.ready();assert.equal(await h.load(held),false);
 const token=h.api.createMentalHealthNarrativePanelWeb(()=>({...h.getAccess(),auth:p.auth(),permissions:p.api.permissions,can:p.api.can})),life=h.api.mountMentalHealthNarrativePanelWeb(token);assert.equal(await h.api.readMentalHealthNarrativePanelWeb(token,life,h.api.mentalHealthNarrativePanelViewWeb(token,life)),true);h.api.disposeMentalHealthNarrativePanelWeb(token,life);}finally{n.stop();}
});

function componentHarness(h){
 const token=h.api.createMentalHealthNarrativePanelWeb(h.getAccess);let slots=[],cursor=0,effects=[],latest,intervals=new Map(),serial=0;
 const sameDeps=(a,b)=>a?.length===b?.length&&a.every((v,i)=>Object.is(v,b[i]));
 const useState=v=>{const i=cursor++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];};
 const useEffect=(fn,deps)=>{const i=cursor++;if(!(i in slots)||!sameDeps(slots[i].deps,deps)){const old=slots[i],effect={deps,cleanup:old?.cleanup};slots[i]=effect;effects.push(()=>{old?.cleanup?.();effect.cleanup=fn()})}};
 const source=read('src/components/careAssessment/MentalHealthNarrativeSourcePanel.web.tsx'),start=source.indexOf('export function MentalHealthNarrativeSourcePanel('),end=source.indexOf('\n return <View',start);
 assert.ok(start>=0&&end>start);const prefix=source.slice(start,end).replace('export function','function')+'\nreturn {view,lifetime,read,select,expand,more};\n}';
 const deps={...h.api,useState,useEffect,useCareLightPalette:()=>({c:{text:'#102B49',muted:'#526B82',border:'#CCDBEA'}}),StyleSheet:{create:v=>v},spacing:{xs:4,sm:8,md:16},typography:{body:{},caption:{}},setInterval:fn=>{const key=++serial;intervals.set(key,fn);return key},clearInterval:key=>intervals.delete(key)};
 const Component=new Function(...Object.keys(deps),strip(prefix)+';return MentalHealthNarrativeSourcePanel;')(...Object.values(deps));
 const render=()=>{cursor=0;latest=Component({token});return latest},flush=()=>{const runs=effects;effects=[];runs.forEach(fn=>fn())},stop=()=>{for(const slot of slots)slot?.cleanup?.()};render();flush();render();return{render,flush,stop,token,intervals,get api(){return latest}};
}
test('Actual Panel effect and source-extracted handlers make no automatic query; deliberate read/select/expand use current source',async()=>{
 const h=panelHarness(),c=componentHarness(h);try{assert.equal(c.api.view.stage,'idle');assert.equal(h.calls.length,0);c.api.read();await drain();c.render();assert.equal(c.api.view.stage,'ready');assert.equal(h.calls.length,16);c.api.select('topic',id(10));c.render();c.api.expand();c.render();assert.equal(c.api.view.expanded,true);assert.equal(c.api.view.selectedTopic.fields.resources.value,'Individuelle Ressource');}finally{c.stop();}
});
for(const key of ['plan','sensitive'])test(`Actual retained Panel ${key}-denied callbacks produce no read or stale selected metadata without render`,async()=>{
 const h=panelHarness(),c=componentHarness(h);try{c.api.read();await drain();c.render();c.api.select('topic',id(10));c.render();const held=c.api,count=h.calls.length;if(key==='plan')h.state.permission=false;else h.state.sensitive=false;held.select('measure',id(30));held.expand();held.more('topic');held.read();await drain();c.render();assert.equal(c.api.view.stage,'blocked');assert.equal(c.api.view.selectedTopic,null);assert.equal(h.calls.length,count);}finally{c.stop();}
});
test('Actual effect cleanup removes timer and all retained actions even after same-own lifetime replacement',async()=>{
 const h=panelHarness(),c=componentHarness(h);c.api.read();await drain();c.render();const held=c.api,count=h.calls.length;assert.equal(c.intervals.size,1);c.stop();assert.equal(c.intervals.size,0);held.read();held.select('topic',id(10));held.expand();await drain();assert.equal(h.calls.length,count);assert.equal(h.api.mentalHealthNarrativePanelViewWeb(c.token,held.lifetime),null);
});


for(const key of ['pflege.plans.view','office.clients.view_sensitive'])test(`Actual held panel action ignores shadowed source after native ${key} loss`,async()=>{const n=await nativePanel(),{h,p}=n;let own=null;const read=h.Reader.prototype.read;h.Reader.prototype.read=async function(...args){const result=await Reflect.apply(read,this,args);if(result.ok)own={reader:this,receipt:result.data,raw:h.mentalOriginals(this,result.data)};return result;};try{assert.equal(await h.load(),true);h.Reader.prototype.read=read;const held=h.view();assert.ok(own.raw);own.reader.currentOriginals=()=>own.raw;own.reader.current=()=>true;p.state.rights=p.state.rights.filter(value=>value!==key);p.api.refreshPermissions();assert.equal(p.api.can(key),false);assert.equal(h.select('topic',id(10),held),false);assert.equal(h.api.expandMentalHealthNarrativePanelWeb(h.token,h.life,held),false);assert.equal(h.api.moreMentalHealthNarrativePanelWeb(h.token,h.life,held,'topic'),false);assert.equal(h.view().stage,'blocked');await p.ready();assert.equal(h.view().stage,'blocked');}finally{h.Reader.prototype.read=read;n.stop();}});
test('Actual panel keeps its own patient when an instance method offers a genuinely delivered other patient original',async()=>{const n=await nativePanel(),{h,p}=n,foreignRoot=native.cloneClientNativeOriginal(h.tables.care_assessments[0]);foreignRoot.id=id(5);foreignRoot.subject_id=id(99);h.tables.care_assessments.push(foreignRoot);let pool=0;for(const table of Object.values(h.pools)){const rows=h.tables[table].map((source,i)=>{const row=native.cloneClientNativeOriginal(source);row.id=id(500+pool*20+i);row.assessment_id=id(5);if(table==='care_assessment_topics')row.resources='Genuine different patient resource';if(table==='care_assessment_versions'){row.snapshot.assessment=native.cloneClientNativeOriginal(foreignRoot);for(const key of ['topics','risks','measures'])for(const child of row.snapshot[key])child.assessment_id=id(5);}return row;});h.tables[table].push(...rows);pool++;}const b=new h.Reader(()=>({...h.getAccess(),clientId:id(99),assessmentId:id(5),auth:p.auth(),permissions:p.api.permissions,can:p.api.can}));b.mount();const read=h.Reader.prototype.read;let source=null,methodCalls=0;try{const br=await b.read();assert.equal(br.ok,true);const other=h.mentalOriginals(b,br.data);assert.equal(other.assessment.subject_id,id(99));h.Reader.prototype.read=async function(...args){const result=await Reflect.apply(read,this,args);if(result.ok){source={reader:this,receipt:result.data};this.currentOriginals=()=>{methodCalls++;return other;};this.current=()=>{methodCalls++;return true;};}return result;};assert.equal(await h.load(),true);h.Reader.prototype.read=read;assert.equal(p.api.can('office.clients.view_sensitive'),true);assert.equal(h.view().assessmentId,id(4));assert.equal(h.select('topic',String(other.pools.topics[0].id)),false);assert.equal(h.select('topic',id(10)),true);assert.equal(h.view().selectedTopic.fields.resources.value,'Individuelle Ressource');assert.equal(h.mentalOriginals(source.reader,source.receipt).assessment.subject_id,id(3));assert.equal(methodCalls,0);}finally{h.Reader.prototype.read=read;b.dispose();n.stop();}});
test('Actual legitimate panel selection reads fixed source while throwing shadow methods remain unconsumed',async()=>{const n=await nativePanel(),{h}=n;let source;const read=h.Reader.prototype.read;h.Reader.prototype.read=async function(...args){const result=await Reflect.apply(read,this,args);if(result.ok)source=this;return result;};let calls=0;try{assert.equal(await h.load(),true);h.Reader.prototype.read=read;source.currentOriginals=source.current=()=>{calls++;throw Error('Untrusted receiver method');};assert.equal(h.select('topic',id(10)),true);assert.equal(h.view().selectedTopic.fields.resources.value,'Individuelle Ressource');assert.equal(calls,0);}finally{h.Reader.prototype.read=read;n.stop();}});
