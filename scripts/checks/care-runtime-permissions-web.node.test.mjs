import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { carePermissionOwner, sameCarePermissionOwner, carePermissionOwnerIsCurrent } from '../../src/lib/permissions/carePermissionOwner.web.ts';
import { clientParentReadScope, captureClientParentRecord, captureClientParentDetail } from '../../src/lib/clients/clientRecordRead.web.ts';
import { getClientRecordTabsForClientContext } from '../../src/lib/clients/clientIntakeFieldRules.ts';

const id = n => `55555555-5555-4555-8555-${String(n).padStart(12, '0')}`;
const right = 'pflege.wounds.view', manage = 'pflege.wounds.manage';
const auth = () => ({ authReady:true,isAuthenticated:true,isLoading:false,profileBootstrapError:null,profile:{id:id(1),tenantId:id(2),roleKey:'nurse'},user:{id:id(1),roleKey:'nurse'},session:{user:{id:id(1),roleKey:'nurse'},accessToken:'test-token',expiresAt:null},portalSession:null });
const owner = () => carePermissionOwner(auth(),id(2),false);
const body = file => stripTypeScriptTypes(readFileSync(new URL(`../../${file}`,import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,''));
const loaderSource = body('src/lib/permissions/currentCarePermissions.web.ts');
const makeLoader = new Function('carePermissionOwnerIsCurrent','getPermissionsForRole','getSupabaseClient',`${loaderSource};return fetchCurrentCarePermissions;`);
const hookSource = body('src/hooks/pflege/useCareRuntimePermissions.web.ts');
const makeHook = new Function('useEffect','useRef','useState','ROLE_LABELS','checkPermissionWithList','hasEffectiveModuleGateAccess','isDemoMode','useAuth','resolveEffectiveRoleKey','useServiceTenantId','carePermissionOwner','sameCarePermissionOwner','carePermissionOwnerIsCurrent','fetchCurrentCarePermissions',`${hookSource};return useCareRuntimePermissions;`);
const deferred = () => { let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject}; };
const settle = async () => { for(let i=0;i<100;i++)await Promise.resolve(); };

test('Native bestätigte Geschäftsidentität wird unabhängig und unverändert festgehalten',()=>{const a=auth(),before=structuredClone(a),o=carePermissionOwner(a,id(2),false);assert.ok(o);assert.equal(o.profileId,id(1));assert.ok(Object.isFrozen(o));assert.deepEqual(a,before);a.profile.id=id(9);assert.equal(o.profileId,id(1));});
for(const [name,change] of [
 ['Anmeldung nicht fertig',a=>{a.authReady=false;}],['abgemeldet',a=>{a.isAuthenticated=false;}],['Authentifizierung lädt',a=>{a.isLoading=true;}],['Profilfehler',a=>{a.profileBootstrapError='failed';}],
 ['fremder Benutzer',a=>{a.user.id=id(9);}],['fremde Sitzung',a=>{a.session.user.id=id(9);}],['fremde Benutzerrolle',a=>{a.user.roleKey='business_admin';}],['fremde Sitzungsrolle',a=>{a.session.user.roleKey='business_admin';}],
 ['fehlendes Profil',a=>{a.profile=null;}],['fehlende Sitzung',a=>{a.session=null;}],['fehlender Token',a=>{a.session.accessToken='';}],['abgelaufene Sitzung',a=>{a.session.expiresAt=0;}],['ungültiger Ablauf',a=>{a.session.expiresAt=NaN;}],['Portalwechsel',a=>{a.portalSession={roleKey:'employee_portal'};}],['unbekannte Rolle',a=>{a.profile.roleKey='foo';}],['fremder Mandant',a=>{a.profile.tenantId=id(9);}],['ungültige Profilkennung',a=>{a.profile.id='Anzeigename';}]
])test(`Der native ${name}-Zustand erzeugt keinen Berechtigungseigentümer`,()=>{const a=auth();change(a);assert.equal(carePermissionOwner(a,id(2),false),null);});
test('Demorechte bleiben auf expliziten Demomodus mit eigenem nativem Profil beschränkt',()=>{const a=auth();a.user=null;a.session=null;assert.equal(carePermissionOwner(a,id(2),false),null);assert.equal(carePermissionOwner(a,id(2),true).demo,true);assert.equal(carePermissionOwner(a,id(9),true),null);});
test('Ablauf und erneuerter Token ändern die Identität auch bei derselben Rolle',()=>{const a=auth(),o=carePermissionOwner(a,id(2),false);a.session.accessToken='new-token';assert.equal(sameCarePermissionOwner(o,carePermissionOwner(a,id(2),false)),false);assert.equal(carePermissionOwnerIsCurrent({...o,expiresAt:10},10),false);});

function backend(){
 const env={role:{id:id(3),key:'nurse'},roleError:null,global:[{permission_key:right}],tenant:[],globalError:null,tenantError:null,token:'test-token',userId:id(1),sessionError:null,sessionCalls:0,afterSession:null,pageOverride:null,cap:200,expiresAt:undefined,sessionOverride:null};
 const calls=[];
 const nativeRows=(table)=>env[table==='role_permissions'?'global':'tenant'].map((row,i)=>({id:id(100+i),...(table==='role_permissions'?{role_id:id(3)}:{tenant_id:id(2),role_key:'nurse'}),...row}));
 const client={auth:{getSession:async()=>{env.sessionCalls++;calls.push({session:true});if(env.afterSession)env.afterSession(env.sessionCalls,env);return env.sessionOverride?env.sessionOverride():{error:env.sessionError,data:{session:{access_token:env.token,user:{id:env.userId},...(env.expiresAt===undefined?{}:{expires_at:env.expiresAt})}}};}},from:table=>{
  const filters={},query={select:columns=>{calls.push({table,columns,filters});return query;},eq:(key,value)=>{filters[key]=value;return query;},order:(field)=>{filters.order=field;return query;},limit:value=>{filters.limit=value;return query;},gt:(key,value)=>{filters.cursor=value;return query;},maybeSingle:async()=>{calls.push({table,roleRead:true,token:env.token});return {data:env.role,error:env.roleError};},then:(resolve,reject)=>{
   const call={table,filters:{...filters},cursor:filters.cursor??null,token:env.token};calls.push(call);
   let response;if(env.pageOverride)response=env.pageOverride(table,call.cursor,env,call);else response={data:nativeRows(table).filter(row=>!call.cursor||row.id.toLowerCase()>call.cursor).slice(0,Math.min(env.cap,filters.limit)),error:env[table==='role_permissions'?'globalError':'tenantError']};
   return Promise.resolve(response).then(resolve,reject);
  }};return query;
 }};
 let fallback=0,clientEnabled=true;
 const fetch=makeLoader(carePermissionOwnerIsCurrent,()=>{fallback++;return [right,manage];},()=>clientEnabled?client:null);
 return {env,calls,fetch,nativeRows,set clientEnabled(value){clientEnabled=value;},get fallback(){return fallback;}};
}
test('Tatsächlicher Webloader liest native Rolle und Mandantenoverride mit eigener Sitzung',async()=>{const b=backend();b.env.tenant=[{permission_key:manage}];const p=await b.fetch(owner());assert.deepEqual(p,[manage]);assert.ok(Object.isFrozen(p));assert.ok(b.calls.some(c=>c.table==='role_permission_sets'&&c.filters.tenant_id===id(2)&&c.filters.role_key==='nurse'));assert.ok(b.env.sessionCalls>=2);assert.equal(b.fallback,0);});
test('Fehlender Mandantenoverride übernimmt vollständige globale Rechte; leere globale Rechte vergeben nichts',async()=>{const b=backend();assert.deepEqual(await b.fetch(owner()),[right]);b.env.global=[];assert.deepEqual(await b.fetch(owner()),[]);assert.equal(b.fallback,0);});
for(const [name,change] of [
 ['fehlender Client',b=>{b.clientEnabled=false;}],['Rollenfehler',b=>{b.env.roleError={message:'failed'};}],['fehlende Rolle',b=>{b.env.role=null;}],['fremde Rollenkennung',b=>{b.env.role={id:id(3),key:'business_admin'};}],['ungültige Rollen-ID',b=>{b.env.role.id='Anzeige';}],
 ['globale Abfrage fehlgeschlagen',b=>{b.env.globalError={message:'failed'};}],['Override fehlgeschlagen',b=>{b.env.tenantError={message:'failed'};}],['SDK-Sitzung nicht aktuell',b=>{b.env.token='other-token';}],['SDK-Benutzer nicht aktuell',b=>{b.env.userId=id(9);}],['SDK-Sitzungsfehler',b=>{b.env.sessionError={message:'failed'};}],['Sitzungswechsel während Read',b=>{b.env.afterSession=(n,e)=>{if(n===2)e.token='other-token';};}],['ungültiger Grant',b=>{b.env.global=[{permission_key:null}];}]
])test(`Ein ${name} führt im echten Webloader zu keinen statischen Ersatzrechten`,async()=>{const b=backend();change(b);await assert.rejects(b.fetch(owner()),/nicht bestätigt/);assert.equal(b.fallback,0);});
test('Neue Reads derselben Rolle verwenden keinen abgeschlossenen Rechtecache',async()=>{const b=backend();assert.deepEqual(await b.fetch(owner()),[right]);b.env.global=[{permission_key:manage}];assert.deepEqual(await b.fetch(owner()),[manage]);assert.ok(b.env.sessionCalls>=4);});
test('Mehrere native Berechtigungsseiten werden vor der Freigabe vollständig gelesen',async()=>{const b=backend();b.env.global=Array.from({length:201},(_,i)=>({permission_key:`pflege.test.${i}`}));assert.equal((await b.fetch(owner())).length,201);assert.ok(b.calls.some(c=>c.table==='role_permissions'&&c.cursor===id(299)&&c.filters.limit===200));});
test('Fehler auf späterer Seite stellt keine frühere Teilseite bereit',async()=>{const b=backend();b.env.pageOverride=(table,cursor)=>table==='role_permissions'?cursor===null?{data:Array.from({length:200},(_,i)=>({id:id(100+i),role_id:id(3),permission_key:`pflege.test.${i}`})),error:null}:{data:null,error:{message:'later failure'}}:{data:[],error:null};await assert.rejects(b.fetch(owner()));assert.equal(b.fallback,0);});
test('Explizite Demorechte lösen keine SDK- oder Tabellenabfrage aus',async()=>{const b=backend();assert.deepEqual(await b.fetch({...owner(),demo:true}),[right,manage]);assert.deepEqual(b.calls,[]);assert.equal(b.env.sessionCalls,0);});

// Actual hook source with controlled state/effect scheduling. No React, browser, SDK or DB execution.
function workspace(nativeLoader=null){
 const slots=[],effects=[],pending=[];let index=0;
 const env={auth:auth(),tenant:id(2),demo:false};
 const useRef=initial=>{const i=index++;return slots[i]??={current:initial};};
 const useState=initial=>{const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];};
 const useEffect=(run,deps)=>{const i=index++,prev=effects[i];if(!prev||deps.some((d,j)=>d!==prev.deps[j])){prev?.cleanup?.();effects[i]={run,deps,cleanup:run()};}};
 const hook=makeHook(useEffect,useRef,useState,{nurse:'Pflegefachkraft',business_admin:'Admin'},(_role,permissions,p)=>({allowed:permissions.includes(p)}),()=>true,()=>env.demo,()=>env.auth,(p,u,s)=>s?.roleKey??p?.roleKey??u?.roleKey??null,()=>env.tenant,carePermissionOwner,sameCarePermissionOwner,carePermissionOwnerIsCurrent,nativeLoader??(readOwner=>{const d=deferred();pending.push({owner:readOwner,...d});return d.promise;}));
 const render=()=>{index=0;return hook();};
 const dispose=()=>effects.forEach(e=>e?.cleanup?.());
 return {env,pending,render,dispose,strictReplay:()=>effects.forEach(e=>{if(e){e.cleanup?.();e.cleanup=e.run();}})};
}
async function ready(){const w=workspace();assert.equal(w.render().can(right),false);w.pending[0].resolve([right,manage]);await settle();assert.equal(w.render().can(right),true);return w;}
test('Neue Berechtigungen werden erst nach bestätigter eigener Antwort sichtbar',async()=>{const w=workspace(),r=w.render();assert.equal(r.can(right),false);assert.equal(r.canAll([]),false);w.pending[0].resolve([right]);await settle();assert.equal(w.render().can(right),true);w.dispose();});
for(const [name,change] of [
 ['Benutzer',e=>{const a=auth();a.profile.id=id(9);a.user.id=id(9);a.session.user.id=id(9);e.auth=a;}],['Mandant',e=>{e.tenant=id(9);e.auth.profile.tenantId=id(9);}],['Rolle',e=>{e.auth.profile.roleKey='business_admin';e.auth.user.roleKey='business_admin';e.auth.session.user.roleKey='business_admin';}],['Token',e=>{e.auth.session.accessToken='other-token';}],['temporärer Profilverlust',e=>{e.auth.profile=null;}],['Abmeldung',e=>{e.auth.isAuthenticated=false;}]
])test(`Ein ${name}-Wechsel sperrt zurückbehaltene can/check/Modulaktionen vor neuer Antwort`,async()=>{const w=await ready(),old=w.render();change(w.env);const next=w.render();assert.equal(old.can(right),false);assert.equal(old.canAny([right]),false);assert.equal(old.canAll([right]),false);assert.equal(old.check(right).allowed,false);assert.equal(old.hasModuleGate('pflege'),false);assert.equal(next.can(right),false);w.dispose();});
test('Verspätete ältere Antwort derselben Rolle wird nach Benutzerwechsel verworfen',async()=>{const w=workspace();w.render();const a=auth();a.profile.id=id(9);a.user.id=id(9);a.session.user.id=id(9);w.env.auth=a;w.render();w.pending[0].resolve([right,manage]);await settle();assert.equal(w.render().can(right),false);w.pending[1].resolve([right]);await settle();assert.equal(w.render().can(right),true);assert.equal(w.render().can(manage),false);w.dispose();});
test('Wechsel A–B–A belebt einen alten A-Read nicht wieder',async()=>{const w=workspace(),a=structuredClone(w.env.auth);w.render();w.env.auth.session.accessToken='other-token';w.render();w.env.auth=a;w.render();w.pending[0].resolve([right,manage]);w.pending[1].resolve([right,manage]);await settle();assert.equal(w.render().can(right),false);w.pending[2].resolve([right]);await settle();assert.equal(w.render().can(right),true);w.dispose();});
test('Erneute Prüfung entwertet alte Rechte sofort und verarbeitet nur ihr eigenes Ticket',async()=>{const w=await ready(),old=w.render();old.refreshPermissions();assert.equal(old.can(right),false);w.render();assert.equal(old.can(right),false);w.pending[1].resolve([right]);await settle();assert.equal(w.render().can(right),true);assert.equal(w.render().can(manage),false);w.dispose();});
test('Fehler ist geschlossen und kann ohne Rechte aus dem Fehlerzustand erneut geprüft werden',async()=>{const w=workspace();w.render();w.pending[0].reject(new Error('sensitive internal data'));await settle();const error=w.render();assert.match(error.error,/nicht bestätigt/);assert.doesNotMatch(error.error,/sensitive/);assert.equal(error.can(right),false);error.refreshPermissions();w.render();w.pending[1].resolve([right]);await settle();assert.equal(w.render().can(right),true);w.dispose();});
test('Strict-Mode Effektwiederholung übernimmt keine Antwort des ersten Setups',async()=>{const w=workspace();w.render();w.strictReplay();w.pending[0].resolve([right,manage]);await settle();assert.equal(w.render().can(right),false);w.pending[1].resolve([right]);await settle();assert.equal(w.render().can(right),true);assert.equal(w.render().can(manage),false);w.dispose();});
test('Unmount sperrt alle zurückbehaltenen Funktionen und verarbeitet keine neue Antwort',async()=>{const w=await ready(),old=w.render();w.dispose();assert.equal(old.can(right),false);assert.equal(old.hasModuleGate('pflege'),false);old.refreshPermissions();assert.equal(w.pending.length,1);});
test('Ein anderer Hook-Eigentümer übernimmt keine Bestätigung oder Rechte aus einer alten Instanz',async()=>{const first=await ready();first.dispose();const second=workspace();assert.equal(second.render().can(right),false);assert.equal(second.pending.length,1);second.dispose();});
test('Tatsächlicher Hook und vollständiger Loader übernehmen gemeinsam nur den nativen Override',async()=>{const b=backend();b.env.tenant=[{permission_key:manage}];const w=workspace(b.fetch);w.render();await settle();const r=w.render();assert.equal(r.can(manage),true);assert.equal(r.can(right),false);assert.ok(b.env.sessionCalls>=2);w.dispose();});
test('Tatsächlicher Hook stellt bei fehlgeschlagener späterer Serverseite keine Rolle aus dem statischen Katalog bereit',async()=>{const b=backend();b.env.globalError={message:'server failed'};const w=workspace(b.fetch);w.render();await settle();const r=w.render();assert.equal(r.can(right),false);assert.match(r.error,/nicht bestätigt/);assert.equal(b.fallback,0);w.dispose();});
test('Native Rechteentziehung wird nach erneuter Abfrage wirksam, ohne alte can-Closures wiederzubeleben',async()=>{const b=backend(),w=workspace(b.fetch);w.render();await settle();const old=w.render();assert.equal(old.can(right),true);b.env.global=[];old.refreshPermissions();assert.equal(old.can(right),false);w.render();await settle();assert.equal(w.render().can(right),false);assert.equal(w.render().error,null);assert.ok(b.env.sessionCalls>=4);w.dispose();});
test('Eine unpassende SDK-Sitzung erreicht im ganzen Hook-/Loaderpfad keine Berechtigungsseite',async()=>{const b=backend();b.env.token='fremd';const w=workspace(b.fetch);w.render();await settle();assert.equal(w.render().can(right),false);assert.deepEqual(b.calls.filter(call=>call.table),[]);w.dispose();});
test('Ablauf sperrt zurückbehaltene Aktionsaufrufe auch vor dem nächsten UI-Render',async()=>{const w=workspace(),now=Date.now;w.env.auth.session.expiresAt=now()+10000;w.render();w.pending[0].resolve([right]);await settle();const old=w.render();assert.equal(old.can(right),true);try{Date.now=()=>now()+20000;assert.equal(old.can(right),false);assert.equal(old.hasModuleGate('pflege'),false);}finally{Date.now=now;w.dispose();}});

// Actual private Office parent hook composed with the actual permission hook/loader.
// State/effect/query scheduling stays controlled and is not React or an SDK/DB run.
const officeFile = readFileSync(new URL('../../src/screens/pflege/ClientRecordWorkspace365.web.tsx',import.meta.url),'utf8');
const parentSource = stripTypeScriptTypes(officeFile.slice(officeFile.indexOf('type ParentReadEnvelope'),officeFile.indexOf('function resolvePrimaryAddress')));
const makeParent = new Function('deps',`const {useCallback,useEffect,useRef,useState,useAuth,useServiceTenantId,usePermissions,clientParentReadScope,captureClientParentRecord,captureClientParentDetail,fetchClientRecord,fetchClientFullDetail,fetchClientOriginalReadWeb,resolveCareContextsForClient,getClientRecordTabsForClientContext,useAsyncQuery,subscribeToClientRecordChanges}=deps;${parentSource};return useOwnClientParentRead;`);
function officeWorkspace(b) {
 const permission=workspace(b.fetch),slots=[],effects=[],queries={},reads={};let index=0,fetches=0;
 const original={id:id(4),tenantId:id(2),core:{id:id(4),tenantId:id(2),diagnoses:[]},addresses:[],createdAt:'2026-10-08 10:00:00.123456+00:00'};
 const pending=[];
 const useRef=initial=>{const i=index++;return slots[i]??={current:initial};};
 const useState=initial=>{const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];};
 const useEffect=(run,deps)=>{const i=index++,prev=effects[i];if(!prev||deps.some((d,j)=>d!==prev.deps[j])){prev?.cleanup?.();effects[i]={deps,cleanup:run()};}};
 const fetch=kind=>{fetches++;if(pending.length)return pending.shift().promise;return Promise.resolve({ok:true,data:kind==='record'?{detail:original,careContexts:[],tabs:['uebersicht']}:original});};
 const parent=makeParent({useCallback:fn=>fn,useEffect,useRef,useState,useAuth:()=>permission.env.auth,useServiceTenantId:()=>permission.env.tenant,usePermissions:()=>permission.render(),clientParentReadScope,captureClientParentRecord,captureClientParentDetail,fetchClientRecord:()=>fetch('record'),fetchClientFullDetail:()=>fetch('full'),fetchClientOriginalReadWeb:async(_tenant,_client,options)=>{options.assertCurrentRead();const r=await fetch(options.includeCareContexts?'record':'full');options.assertCurrentRead();return r.ok?{...r,data:{detail:r.data.detail??r.data,originals:Object.freeze({compatibilityLeafOnly:true}),...(options.includeCareContexts?{careContexts:r.data.careContexts??[]}:{})}}:r;},resolveCareContextsForClient:async()=>[],getClientRecordTabsForClientContext,subscribeToClientRecordChanges:()=>()=>{},useAsyncQuery:(read,_deps,options)=>{
  const kind=options.queryKey.startsWith('office-client-record')?'record':'full';reads[kind]=read;
  const q=queries[kind]??={data:null,loading:false,refreshing:false,error:null,refreshError:null,previewData:null,tableMissing:false,cacheMeta:{fromCache:false,partialDetail:false}};
  return {...q,refresh:async()=>{const r=await read();q.data=r.ok?r.data:null;q.error=r.ok?null:r.error;return r;}};
 }});
 const render=()=>{index=0;return parent(id(4));};
 const dispose=()=>{effects.forEach(e=>e?.cleanup?.());permission.dispose();};
 const readAll=async()=>{for(const kind of ['record','full']){const r=await reads[kind]();queries[kind].data=r.ok?r.data:null;queries[kind].error=r.ok?null:r.error;}};
 return {permission,render,dispose,readAll,reads,pending,get fetches(){return fetches;}};
}
const officeRights=[{permission_key:'office.clients.view'},{permission_key:'office.clients.view_sensitive'},{permission_key:'office.clients.edit'}];
test('Tatsächliche Büroakte wartet auf eigene Berechtigungen und kann eine fehlgeschlagene Rechteabfrage erneut starten',async()=>{
 const b=backend();b.env.global=officeRights;b.env.globalError={message:'internal failure'};const o=officeWorkspace(b);
 const loading=o.render();assert.equal(loading.loading,true);assert.equal(loading.error,null);assert.equal((await o.reads.record()).ok,false);assert.equal(o.fetches,0);
 await settle();const failed=o.render();assert.match(failed.error,/nicht bestätigt/);assert.equal(failed.ownRead,false);
 b.env.globalError=null;await failed.refresh();assert.equal(o.render().loading,true);await settle();o.render();await o.readAll();const ready=o.render();assert.equal(ready.ownRead,true);assert.equal(ready.detail.createdAt,'2026-10-08 10:00:00.123456+00:00');o.dispose();
});
test('Zurückbehaltener tatsächlicher Büroaktenbeleg und alter Readaufruf sperren schon vor erneutem Elternrender bei Rechteprüfung',async()=>{
 const b=backend();b.env.global=officeRights;const o=officeWorkspace(b);o.render();await settle();o.render();await o.readAll();const ready=o.render(),receipt=ready.liveOriginalReceipt;assert.ok(receipt());const count=o.fetches;
 o.permission.render().refreshPermissions();assert.equal(receipt(),null);assert.equal((await o.reads.record()).ok,false);assert.equal(o.fetches,count);assert.equal(ready.detail.createdAt,'2026-10-08 10:00:00.123456+00:00');o.dispose();
});
test('Verspätete Originalantwort der tatsächlichen Büroakte kann nach nativem Sitzungswechsel keinen alten Aktenbeleg liefern',async()=>{
 const b=backend();b.env.global=officeRights;const o=officeWorkspace(b);o.render();await settle();o.render();const d=deferred();o.pending.push(d);const late=o.reads.record();
 o.permission.env.auth.session.accessToken='new-session';o.render();d.resolve({ok:true,data:{detail:{id:id(4),tenantId:id(2),core:{id:id(4),tenantId:id(2),diagnoses:[]},addresses:[]},careContexts:[],tabs:[]}});
 assert.equal((await late).ok,false);assert.equal(o.render().liveOriginalReceipt(),null);o.dispose();await settle();
});

// Native SELECT-only paging/session boundaries; all SDK objects here are local adapters.
const globalRow = (n,key=right) => ({id:id(n),role_id:id(3),permission_key:key});
const tenantRow = (n,key=right) => ({id:id(n),tenant_id:id(2),role_key:'nurse',permission_key:key});
const permissionCalls = b => b.calls.filter(call=>call.table==='role_permissions'&&'cursor' in call);
const scopedCalls = b => b.calls.filter(call=>['role_permissions','role_permission_sets'].includes(call.table)&&'cursor' in call);
test('Servercap zwei darf globale native Rechte weder abschneiden noch vor echter leerer Seite freigeben',async()=>{
 const b=backend();b.env.cap=2;b.env.global=Array.from({length:5},(_,i)=>({permission_key:`pflege.cap.${i}`}));
 assert.deepEqual(await b.fetch(owner()),b.env.global.map(row=>row.permission_key));
 assert.deepEqual(permissionCalls(b).map(call=>call.cursor),[null,id(101),id(103),id(104)]);
 assert.ok(b.calls.every(call=>!call.columns||call.table==='roles'||call.columns.includes('id')));
});
test('Servercap zwei liest den ganzen Mandantenoverride und übernimmt niemals dessen Teilbestand',async()=>{
 const b=backend();b.env.cap=2;b.env.tenant=Array.from({length:5},(_,i)=>({permission_key:`pflege.override.${i}`}));
 assert.deepEqual(await b.fetch(owner()),b.env.tenant.map(row=>row.permission_key));assert.equal(b.fallback,0);
});
test('Native echte leere Overridepools behalten globale Vererbung; unbekannte Keys werden weder umbenannt noch zu bekannten Grants ergänzt',async()=>{
 const b=backend();b.env.global=[{permission_key:'native.Unbekannt_Ärztlich'},{permission_key:right}];
 assert.deepEqual(await b.fetch(owner()),['native.Unbekannt_Ärztlich',right]);assert.equal(b.fallback,0);
});
test('Über hundert kurze native Seiten werden bis echter Erschöpfung gelesen',async()=>{
 const b=backend();b.env.cap=1;b.env.global=Array.from({length:205},(_,i)=>({permission_key:`pflege.long.${i}`}));
 assert.equal((await b.fetch(owner())).length,205);assert.equal(permissionCalls(b).length,206);
});
for(const [name,rows] of [
 ['fremde globale Rollenbindung',[{...globalRow(100),role_id:id(9)}]],
 ['fremde Mandantenbindung',[{...tenantRow(100),tenant_id:id(9)}]],
 ['fremde native Tenantrolle',[{...tenantRow(100),role_key:'business_admin'}]],
 ['ungültige native Zeilenkennung',[{...globalRow(100),id:'Anzeige'}]],
 ['doppelte Kennung trotz verschiedener Grants',[globalRow(100,right),globalRow(100,manage)]],
 ['umgekehrte UUIDfolge',[globalRow(101,right),globalRow(100,manage)]],
 ['doppelter Permissionkey trotz verschiedener nativer UUIDs',[globalRow(100,right),globalRow(101,right)]],
 ['zusätzliche unangeforderte Scopefelder',[{...globalRow(100),tenant_id:id(2)}]],
 ['fehlender native Rollenbeleg',[{id:id(100),permission_key:right}]],
 ['unnormalisiertes Grant-Leerzeichen',[globalRow(100,` ${right}`)]],
 ['leerer Grant',[globalRow(100,'')]],
 ['nichttextueller Grant',[globalRow(100,false)]],
 ['mehr native Rows als angefordert',Array.from({length:201},(_,i)=>globalRow(100+i,`pflege.large.${i}`))],
])test(`Der gesamte tatsächliche Grantpool sperrt ${name}`,async()=>{
 const b=backend(),tenant=name.includes('Mandanten')||name.includes('Tenantrolle');b.env.pageOverride=(table)=>({data:table===(tenant?'role_permission_sets':'role_permissions')?rows:[],error:null});
 await assert.rejects(b.fetch(owner()),/nicht bestätigt/);assert.equal(b.fallback,0);
});
test('Gleicher UUIDcursor darf auf keiner späteren Seite als neue Vollständigkeit gelten',async()=>{
 const b=backend();b.env.pageOverride=table=>({data:table==='role_permissions'?[globalRow(100)]:[],error:null});
 await assert.rejects(b.fetch(owner()));assert.equal(permissionCalls(b).length,2);
});
test('Permissionkeys bleiben über native Seiten eindeutig, auch wenn der zweite gleiche Key einen anderen UUIDcursor besitzt',async()=>{
 const b=backend();b.env.pageOverride=(table,cursor)=>({data:table==='role_permissions'?[globalRow(cursor?101:100)]:[],error:null});await assert.rejects(b.fetch(owner()));
});
for(const name of ['sparse','extraArrayField','rowPrototype','rowGetter','arrayGetter'])test(`Native ${name}-Seite wird vor Feldzugriff und vor Teilrechtefreigabe abgewiesen`,async()=>{
 const b=backend();let accesses=0;let rows=[globalRow(100)];
 if(name==='sparse'){rows.length=2;}if(name==='extraArrayField'){rows.extra='hidden';}
 if(name==='rowPrototype'){rows=[Object.assign(new Date(),globalRow(100))];}
 if(name==='rowGetter'){Object.defineProperty(rows[0],'permission_key',{enumerable:true,get(){accesses++;return right;}});}
 if(name==='arrayGetter'){Object.defineProperty(rows,'0',{enumerable:true,get(){accesses++;return globalRow(100);}});}
 b.env.pageOverride=table=>({data:table==='role_permissions'?rows:[],error:null});await assert.rejects(b.fetch(owner()));assert.equal(accesses,0);
});
for(const [name,role] of [
 ['Array',[]],['Date',new Date()],['fremde Rolle',{id:id(3),key:'business_admin'}],['zusätzliche Felder',{id:id(3),key:'nurse',permission_key:right}],['fehlende Kennung',{key:'nurse'}],
])test(`Eine native ${name}-Rollenantwort erreicht keine Grantabfrage`,async()=>{const b=backend();b.env.role=role;await assert.rejects(b.fetch(owner()));assert.equal(scopedCalls(b).length,0);});
test('Native Rolegetter wird niemals ausgeführt',async()=>{const b=backend();let accesses=0;b.env.role={key:'nurse'};Object.defineProperty(b.env.role,'id',{enumerable:true,get(){accesses++;return id(3);}});await assert.rejects(b.fetch(owner()));assert.equal(accesses,0);assert.equal(scopedCalls(b).length,0);});
test('Unbekannte native Actorrolle erreicht weder SDK noch statische Ersatzrechte',async()=>{const b=backend();await assert.rejects(b.fetch({...owner(),roleKey:'foo'}));assert.equal(b.env.sessionCalls,0);assert.equal(b.fallback,0);});
for(const expiry of [0,1,-1,NaN,Infinity,'1999999999',{},Date.now()/1000+60,Number.MAX_SAFE_INTEGER])test(`Explizit ungültige oder abgelaufene SDK-Sekunden ${String(expiry)} erteilen keine Grants`,async()=>{const b=backend();b.env.expiresAt=expiry;await assert.rejects(b.fetch(owner()));assert.equal(scopedCalls(b).length,0);});
test('Bekannte native SDK-Sekunden müssen exakt dem unveränderten Owner-Millisekundenwert entsprechen',async()=>{
 const seconds=Math.floor(Date.now()/1000)+60,b=backend();b.env.expiresAt=seconds;
 assert.deepEqual(await b.fetch({...owner(),expiresAt:seconds*1000}),[right]);
 await assert.rejects(b.fetch({...owner(),expiresAt:seconds*1000+1}));await assert.rejects(b.fetch(owner()));
});
for(const expiry of [undefined,null])test(`SDK-Ablauf ${String(expiry)} bleibt nur mit ebenfalls unbekanntem Ownerablauf zulässig`,async()=>{
 const b=backend();b.env.expiresAt=expiry;assert.deepEqual(await b.fetch(owner()),[right]);await assert.rejects(b.fetch({...owner(),expiresAt:Math.floor(Date.now()/1000)*1000+60000}));
});
for(const field of ['access_token','expires_at','user'])test(`SDK-Sitzungsgetter ${field} wird vor SELECT nicht konsumiert`,async()=>{
 const b=backend();let accesses=0;const session={access_token:'test-token',user:{id:id(1)}};Object.defineProperty(session,field,{enumerable:true,get(){accesses++;return field==='user'?{id:id(1)}:field==='expires_at'?null:'test-token';}});
 b.env.sessionOverride=()=>({error:null,data:{session}});await assert.rejects(b.fetch(owner()));assert.equal(accesses,0);assert.equal(scopedCalls(b).length,0);
});
test('Sitzungswechsel während Roleawait verhindert bereits die erste Permissionseite',async()=>{
 const b=backend();b.env.afterSession=(n,env)=>{if(n===2)env.token='other-token';};await assert.rejects(b.fetch(owner()));assert.equal(scopedCalls(b).length,0);
});
test('Sitzungswechsel nach erster Capseite verhindert weitere Queries auch bei späterer A-Rückkehr',async()=>{
 const b=backend();b.env.cap=1;b.env.global=[{permission_key:right},{permission_key:manage}];b.env.pageOverride=(table,cursor,env)=>{if(table==='role_permissions'){env.token='other-token';return {data:[globalRow(100)],error:null};}return {data:[],error:null};};
 await assert.rejects(b.fetch(owner()));b.env.token='test-token';assert.equal(permissionCalls(b).length,1);assert.equal(permissionCalls(b).some(call=>call.cursor!==null),false);
});
test('Known Owneränderung während laufender SDK-Abfrage kann die eingefrorene Readscope nicht ersetzen',async()=>{
 const b=backend(),mutable={...owner()};b.env.afterSession=(n)=>{if(n===2)mutable.tenantId=id(9);};await assert.rejects(b.fetch(mutable));assert.equal(scopedCalls(b).length,0);
});
test('Native Ownerablauf während Seite stoppt einen weiteren Zugriff',async()=>{
 const b=backend(),originalNow=Date.now,seconds=Math.floor(originalNow()/1000)+60;let now=originalNow();Date.now=()=>now;b.env.expiresAt=seconds;
 b.env.pageOverride=(table)=>{if(table==='role_permissions')now=seconds*1000;return {data:table==='role_permissions'?[globalRow(100)]:[],error:null};};
 try{await assert.rejects(b.fetch({...owner(),expiresAt:seconds*1000}));assert.equal(permissionCalls(b).length,1);}finally{Date.now=originalNow;}
});
test('Bekannter WholeReadfehler schließt noch wartende Schwesterseiten ohne weitere Permissionquery',async()=>{
 const b=backend(),late=deferred();let tenantStarted=false;b.env.pageOverride=(table,cursor)=>{if(table==='role_permissions')return {data:null,error:{message:'failed'}};tenantStarted=true;return late.promise;};
 await assert.rejects(b.fetch(owner()));assert.equal(tenantStarted,true);const count=scopedCalls(b).length;late.resolve({data:[tenantRow(100)],error:null});await settle();assert.equal(scopedCalls(b).length,count);
});
test('Tatsächlicher Hook veröffentlicht bei Servercap den vollständigen Pool und bei ganzem späteren Seitenfehler überhaupt keine Grants',async()=>{
 const b=backend();b.env.cap=2;b.env.global=[{permission_key:right},{permission_key:manage},{permission_key:'pflege.cap.last'}];const w=workspace(b.fetch);w.render();await settle();assert.equal(w.render().can('pflege.cap.last'),true);
 b.env.pageOverride=(table,cursor)=>({data:table==='role_permissions'?(cursor?null:[globalRow(100)]):[],error:table==='role_permissions'&&cursor?{message:'later'}:null});w.render().refreshPermissions();w.render();await settle();assert.equal(w.render().can(right),false);assert.match(w.render().error,/nicht bestätigt/);w.dispose();
});

test('Fehlende eigene SDK-Ablaufmetadaten konsumieren keinen geerbten Getter als native Sitzungszeit',async()=>{
 const b=backend();let accesses=0;Object.defineProperty(Object.prototype,'expires_at',{configurable:true,get(){accesses++;return 1;}});
 try{assert.deepEqual(await b.fetch(owner()),[right]);assert.equal(accesses,0);}finally{delete Object.prototype.expires_at;}
});

for(const phase of ['session','role','page'])for(const error of [undefined,false,0,''])test(`Ungeklärter nativer SDK-Ergebnisstatus ${phase}/${String(error)} wird niemals zur Grantfreigabe`,async()=>{
 const b=backend();if(phase==='session')b.env.sessionError=error;else if(phase==='role')b.env.roleError=error;else b.env.globalError=error;
 await assert.rejects(b.fetch(owner()));assert.equal(b.fallback,0);if(phase==='session')assert.equal(b.calls.filter(call=>call.table).length,0);if(phase==='role')assert.equal(scopedCalls(b).length,0);
});
test('Ein komplett fehlender eigener SDK-Fehlerstatus ist keine native Bestätigung eines erfolgreichen Reads',async()=>{
 const b=backend();b.env.sessionOverride=()=>({data:{session:{access_token:'test-token',user:{id:id(1)}}}});await assert.rejects(b.fetch(owner()));assert.equal(b.calls.filter(call=>call.table).length,0);
});
test('Globaler Fehler nach Schwester-Sitzungsprüfung verhindert auch deren nächste echte SDK-Dispatch-Microtask',async()=>{
 const late=deferred(),queries=[];let phase=0,closed=false,scheduled=false;
 const native={auth:{getSession:async()=>{
  if(queries.some(q=>q.table==='role_permissions')&&queries.filter(q=>q.table==='role_permission_sets').length===1&&++phase===2){scheduled=true;queueMicrotask(()=>late.resolve({data:null,error:{message:'Native denial'}}));}
  return{error:null,data:{session:{access_token:'test-token',user:{id:id(1)}}}};
 }},from:table=>{let cursor=null;const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,gt:(_key,value)=>{cursor=value;return q;},maybeSingle:async()=>({data:{id:id(3),key:'nurse'},error:null}),then:(resolve,reject)=>{
  queries.push({table,cursor,closed});if(table==='role_permissions')return late.promise.then(resolve,reject);
  return Promise.resolve({data:[tenantRow(100,right),tenantRow(101,manage),tenantRow(102,'pflege.third')].filter(row=>!cursor||row.id>cursor).slice(0,2),error:null}).then(resolve,reject);
 }};return q;}};
 // Neutral observation only; the actual close assignment and all guard/SDK bodies stay unchanged.
 const fetch=new Function('carePermissionOwnerIsCurrent','getPermissionsForRole','getSupabaseClient','observeClose',loaderSource.replace('closed = true;', 'closed = true; observeClose();')+';return fetchCurrentCarePermissions;')(carePermissionOwnerIsCurrent,()=>{throw Error('Forbidden fallback');},()=>native,()=>{closed=true;});
 await assert.rejects(fetch(owner()));await settle();assert.equal(scheduled,true);assert.equal(queries.filter(query=>query.closed).length,0);
});
