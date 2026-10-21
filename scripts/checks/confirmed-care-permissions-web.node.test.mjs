import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { carePermissionOwner, sameCarePermissionOwner, carePermissionOwnerIsCurrent } from '../../src/lib/permissions/carePermissionOwner.web.ts';

const id=n=>`88888888-8888-4888-8888-${String(n).padStart(12,'0')}`;
const own=()=>({tenantId:id(2),profileId:id(1),roleKey:'nurse',accessToken:'test-token',expiresAt:null,demo:false});
const source=p=>stripTypeScriptTypes(readFileSync(new URL(`../../${p}`,import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,''));
const compile=(p,names,deps)=>new Function(...Object.keys(deps),`${source(p)};return {${names}};`)(...Object.values(deps));
const timeout=compile('src/lib/services/queryTimeout.ts','withServiceQueryTimeout,NATIVE_SERVICE_QUERY_TIMEOUT_MS',{});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};
function backend(){
 const env={token:'test-token',sessionId:id(1),serverUser:{id:id(1),is_anonymous:false,user_metadata:{role_key:'business_admin',tenant_id:id(9)}},authError:null,
  profile:{id:id(1),tenant_id:id(2),role_id:id(3),is_active:true,status:'active',auth_user_id:null,roles:{id:id(3),key:'nurse'}},profileError:null,role:{id:id(3),key:'nurse'},
  global:[{id:id(100),role_id:id(3),permission_key:'pflege.wounds.view'}],tenant:[],profileCalls:0,authCalls:0,permissionCalls:0,sessionCalls:0,authOverride:null,profileOverride:null,pageOverride:null,onSession:null,client:true};
 const calls=[];
 const sdk={auth:{getSession:async()=>{env.sessionCalls++;env.onSession?.(env);return {error:null,data:{session:{access_token:env.token,user:{id:env.sessionId}}}};},getUser:async token=>{
  env.authCalls++;calls.push({auth:token});return env.authOverride?env.authOverride(env.authCalls):{error:env.authError,data:{user:env.serverUser}};
 }},from:table=>{
  const filters={},query={select:columns=>{calls.push({table,columns});return query;},eq:(k,v)=>{filters[k]=v;return query;},order:()=>query,limit:n=>{filters.limit=n;return query;},gt:(_k,v)=>{filters.cursor=v;return query;},maybeSingle:()=>query,then:(resolve,reject)=>{
   calls.push({table,filters:{...filters},dispatch:true});let result;
   if(table==='profiles'){env.profileCalls++;result=env.profileOverride?env.profileOverride(env.profileCalls):{error:env.profileError,data:env.profile};}
   else if(table==='roles')result={error:null,data:env.role};
   else {env.permissionCalls++;result=env.pageOverride?env.pageOverride(table,filters):{error:null,data:env[table==='role_permissions'?'global':'tenant'].filter(r=>!filters.cursor||r.id>filters.cursor).slice(0,filters.limit)};}
   return Promise.resolve(result).then(resolve,reject);
  }};return query;
 }};
 let fallback=0;
 const inner=compile('src/lib/permissions/currentCarePermissions.web.ts','fetchCurrentCarePermissions',{carePermissionOwnerIsCurrent,getPermissionsForRole:()=>{fallback++;return ['pflege.wounds.view'];},getSupabaseClient:()=>env.client?sdk:null}).fetchCurrentCarePermissions;
 const fetch=compile('src/lib/permissions/confirmedCarePermissions.web.ts','fetchConfirmedCarePermissions',{carePermissionOwnerIsCurrent,fetchCurrentCarePermissions:inner,getSupabaseClient:()=>env.client?sdk:null,...timeout}).fetchConfirmedCarePermissions;
 return {env,calls,fetch,inner,get fallback(){return fallback;}};
}
test('Actual wrapper and complete keyset loader confirm the token user and active own native joined role before and after granting',async()=>{
 const b=backend(),p=await b.fetch(own());assert.deepEqual(p,['pflege.wounds.view']);assert.ok(Object.isFrozen(p));assert.equal(b.env.authCalls,2);assert.equal(b.env.profileCalls,2);assert.ok(b.calls.filter(c=>c.table==='profiles'&&c.dispatch).every(c=>c.filters.id===id(1)));assert.equal(b.fallback,0);
});
for(const [name,change] of [
 ['Auth server rejects user',b=>{b.env.authError={message:'blocked'};}],['foreign authentic user',b=>{b.env.serverUser.id=id(9);}],['missing authentic user',b=>{b.env.serverUser=null;}],['anonymous user',b=>{b.env.serverUser.is_anonymous=true;}],
 ['inactive profile',b=>{b.env.profile.is_active=false;}],['disabled profile',b=>{b.env.profile.status='disabled';}],['unconfirmed active flag',b=>{b.env.profile.is_active=1;}],['foreign profile',b=>{b.env.profile.id=id(9);}],['foreign tenant',b=>{b.env.profile.tenant_id=id(9);}],
 ['foreign auth relation',b=>{b.env.profile.auth_user_id=id(9);}],['missing profile',b=>{b.env.profile=null;}],['profile read failure',b=>{b.env.profileError={message:'failed'};}],['missing role relation',b=>{b.env.profile.role_id=null;b.env.profile.roles=null;}],
 ['different native role',b=>{b.env.profile.roles.key='business_admin';}],['different role ID',b=>{b.env.profile.roles.id=id(9);}],['expired or unconfirmed SDK owner',b=>{b.env.token='other-token';}],
 ])test(`Current server/profile condition rejects ${name} before any permission dispatch`,async()=>{const b=backend();change(b);await assert.rejects(b.fetch(own()));assert.equal(b.env.permissionCalls,0);assert.equal(b.fallback,0);});
test('Actual pre-fix inner loader demonstrates that a matching local session alone can grant after a server denial; wrapper closes that gap',async()=>{
 const b=backend();b.env.authError={message:'deleted or refused'};assert.deepEqual(await b.inner(own()),['pflege.wounds.view']);b.env.permissionCalls=0;await assert.rejects(b.fetch(own()));assert.equal(b.env.permissionCalls,0);
});
test('Editable user metadata never supplies the role or tenant and cannot substitute a native role relation',async()=>{
 const b=backend();assert.deepEqual(await b.fetch(own()),['pflege.wounds.view']);b.env.profile.roles.key='business_admin';await assert.rejects(b.fetch(own()));
});
for(const [name,change] of [
 ['profile disabled',e=>{e.profile={...e.profile,is_active:false};}],['profile tenant changed',e=>{e.profile={...e.profile,tenant_id:id(9)};}],['role replaced under same key',e=>{e.profile={...e.profile,role_id:id(9),roles:{id:id(9),key:'nurse'}};}],['auth server rejected',e=>{e.authError={message:'later rejection'};}]
])test(`Final confirmation discards already read grants when ${name}`,async()=>{
 const b=backend();let originalsRead=0;b.env.pageOverride=(table,filters)=>{change(b.env);const data=table==='role_permissions'&&!filters.cursor?b.env.global:[];originalsRead+=data.length;return {error:null,data};};await assert.rejects(b.fetch(own()));assert.equal(originalsRead,1);assert.equal(b.fallback,0);
});
test('A native owner/session switch during authentic user read cannot start the old profile query',async()=>{
 const b=backend(),d=deferred(),o=own();b.env.authOverride=()=>d.promise;const read=b.fetch(o);await settle();o.accessToken='changed';d.resolve({error:null,data:{user:{id:id(1)}}});await assert.rejects(read);assert.equal(b.env.profileCalls,0);assert.equal(b.env.permissionCalls,0);
});
test('A profile field getter is rejected without execution and cannot manufacture a role receipt',async()=>{
 const b=backend();let invoked=0;Object.defineProperty(b.env.profile,'role_id',{enumerable:true,get(){invoked++;return id(3);}});await assert.rejects(b.fetch(own()));assert.equal(invoked,0);assert.equal(b.env.permissionCalls,0);
});
test('Auth user descriptor cannot execute an ID getter or inherit a matching identity',async()=>{
 for(const inherited of [false,true]){const b=backend();let invoked=0;b.env.serverUser=inherited?Object.create({id:id(1)}):{};if(!inherited)Object.defineProperty(b.env.serverUser,'id',{enumerable:true,get(){invoked++;return id(1);}});await assert.rejects(b.fetch(own()));assert.equal(invoked,0);assert.equal(b.env.profileCalls,0);}
});
test('Explicit demo stays local while missing production client never borrows demo rights',async()=>{
 const b=backend();b.env.client=false;await assert.rejects(b.fetch(own()));assert.deepEqual(await b.fetch({...own(),demo:true,accessToken:null}),['pflege.wounds.view']);assert.equal(b.env.authCalls,0);assert.equal(b.env.profileCalls,0);assert.equal(b.fallback,1);
});
test('Existing real 15-second timeout fails closed and a late Auth answer starts no profile or permissions query',async()=>{
 const b=backend(),d=deferred();b.env.authOverride=()=>d.promise;const read=b.fetch(own());await assert.rejects(read,/zu lange/);d.resolve({error:null,data:{user:{id:id(1)}}});await settle();assert.equal(b.env.profileCalls,0);assert.equal(b.env.permissionCalls,0);
});
test('Actual inner reader cancellation predicate stops both grant streams after a pending page is no longer current',async()=>{
 const b=backend(),d=deferred();let current=true;b.env.pageOverride=()=>d.promise;const read=b.inner(own(),()=>current);await settle();const calls=b.calls.length;current=false;d.resolve({error:null,data:[]});await assert.rejects(read);await settle();assert.equal(b.calls.length,calls);
});

// Actual permission hook + new confirmation + original complete loader with local SDK adapters.
function workspace(b,lifecycle={}){
 const slots=[],effects=[];let index=0;
 const auth={authReady:true,isAuthenticated:true,isLoading:false,profileBootstrapError:null,profile:{id:id(1),tenantId:id(2),roleKey:'nurse'},user:{id:id(1),roleKey:'nurse'},session:{user:{id:id(1),roleKey:'nurse'},accessToken:'test-token',expiresAt:null},portalSession:null};
 const useRef=initial=>{const i=index++;return slots[i]??={current:initial};};
 const useState=initial=>{const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];};
 const useEffect=(run,deps)=>{const i=index++,prev=effects[i];if(!prev||deps.some((d,j)=>d!==prev.deps[j])){prev?.cleanup?.();effects[i]={deps,cleanup:run()};}};
 const hook=compile('src/hooks/pflege/useCareRuntimePermissions.web.ts','useCareRuntimePermissions',{useEffect,useRef,useState,ROLE_LABELS:{nurse:'Pflegefachkraft'},checkPermissionWithList:(_r,ps,p)=>({allowed:ps.includes(p)}),hasEffectiveModuleGateAccess:()=>true,isDemoMode:()=>false,useAuth:()=>auth,resolveEffectiveRoleKey:()=>auth.profile?.roleKey??null,useServiceTenantId:()=>auth.profile?.tenantId??null,carePermissionOwner,sameCarePermissionOwner,carePermissionOwnerIsCurrent,fetchCurrentCarePermissions:b.fetch,...lifecycle}).useCareRuntimePermissions;
 return {auth,render:()=>{index=0;return hook();},dispose:()=>effects.forEach(e=>e?.cleanup?.())};
}
test('Actual production hook binding waits for authentic server/profile/permission confirmation and retries a failed server check without borrowed grants',async()=>{
 const b=backend(),w=workspace(b);b.env.authError={message:'internal confidential detail'};const pending=w.render();assert.equal(pending.loading,true);assert.equal(pending.can('pflege.wounds.view'),false);await settle();const failed=w.render();assert.match(failed.error,/nicht bestätigt/);assert.doesNotMatch(failed.error,/confidential/);assert.equal(b.env.permissionCalls,0);
 b.env.authError=null;failed.refreshPermissions();w.render();await settle();assert.equal(w.render().can('pflege.wounds.view'),true);assert.equal(b.env.profileCalls,2);w.dispose();
});
test('Actual retained hook handlers lose grants immediately on refresh; disabled native profile prevents regrant despite unchanged local role/session',async()=>{
 const b=backend(),w=workspace(b);w.render();await settle();const old=w.render();assert.equal(old.can('pflege.wounds.view'),true);b.env.profile={...b.env.profile,is_active:false};old.refreshPermissions();assert.equal(old.can('pflege.wounds.view'),false);w.render();await settle();assert.equal(w.render().can('pflege.wounds.view'),false);assert.equal(old.check('pflege.wounds.view').allowed,false);w.dispose();
});
test('Actual hook cannot accept a late Auth reply after logout and a changed SDK session; no old profile query starts',async()=>{
 const b=backend(),w=workspace(b),d=deferred();b.env.authOverride=()=>d.promise;w.render();await settle();w.auth.isAuthenticated=false;b.env.token='other-session';w.render();d.resolve({error:null,data:{user:{id:id(1)}}});await settle();assert.equal(w.render().can('pflege.wounds.view'),false);assert.equal(b.env.profileCalls,0);w.dispose();
});

// EventTarget adapters exercise the actual hook's lifecycle handlers. They do
// not provide browser layout, real React effects, or live SDK transport proof.
function lifecycle(initial='visible'){
 class Target extends EventTarget{
  listeners=new Map();
  addEventListener(type,fn,...args){super.addEventListener(type,fn,...args);const fns=this.listeners.get(type)??new Set();fns.add(fn);this.listeners.set(type,fns);}
  removeEventListener(type,fn,...args){super.removeEventListener(type,fn,...args);this.listeners.get(type)?.delete(fn);}
  get count(){return [...this.listeners.values()].reduce((n,fns)=>n+fns.size,0);}
 }
 const document=new Target(),window=new Target();document.visibilityState=initial;
 return {document,window,visibility:value=>{document.visibilityState=value;document.dispatchEvent(new Event('visibilitychange'));},fire:type=>window.dispatchEvent(new Event(type))};
}
test('Hiding the actual permission hook invalidates retained can/check/module handlers synchronously before any rerender',async()=>{
 const b=backend(),l=lifecycle(),w=workspace(b,l);w.render();await settle();const old=w.render();assert.equal(old.can('pflege.wounds.view'),true);assert.equal(old.hasModuleGate('pflege'),true);
 const calls=b.env.authCalls;l.visibility('hidden');assert.equal(old.can('pflege.wounds.view'),false);assert.equal(old.canAny(['pflege.wounds.view']),false);assert.equal(old.canAll(['pflege.wounds.view']),false);assert.equal(old.check('pflege.wounds.view').allowed,false);assert.equal(old.hasModuleGate('pflege'),false);w.render();await settle();assert.equal(b.env.authCalls,calls);w.dispose();
});
test('An initially hidden document starts no Auth, profile or permission request; becoming visible requires a complete fresh confirmation',async()=>{
 const b=backend(),l=lifecycle('hidden'),w=workspace(b,l);assert.equal(w.render().can('pflege.wounds.view'),false);await settle();assert.equal(b.env.authCalls,0);assert.equal(b.env.permissionCalls,0);
 l.fire('focus');l.fire('online');w.render();await settle();assert.equal(b.env.authCalls,0);
 l.visibility('visible');assert.equal(w.render().can('pflege.wounds.view'),false);await settle();assert.equal(w.render().can('pflege.wounds.view'),true);assert.equal(b.env.authCalls,2);w.dispose();
});
test('A profile disabled while the tab was hidden cannot regain a previously confirmed right on return',async()=>{
 const b=backend(),l=lifecycle(),w=workspace(b,l);w.render();await settle();const old=w.render();assert.equal(old.can('pflege.wounds.view'),true);l.visibility('hidden');b.env.profile={...b.env.profile,is_active:false};
 l.visibility('visible');w.render();await settle();const latest=w.render();assert.equal(latest.can('pflege.wounds.view'),false);assert.match(latest.error,/nicht bestätigt/);assert.equal(old.can('pflege.wounds.view'),false);w.dispose();
});
for(const event of ['focus','pageshow','online'])test(`Visible ${event} invalidates existing grants before rerender and never reuses the old read result`,async()=>{
 const b=backend(),l=lifecycle(),w=workspace(b,l);w.render();await settle();const old=w.render();const count=b.env.authCalls;assert.equal(old.can('pflege.wounds.view'),true);
 l.fire(event);assert.equal(old.can('pflege.wounds.view'),false);w.render();await settle();assert.equal(w.render().can('pflege.wounds.view'),true);assert.equal(old.can('pflege.wounds.view'),false);assert.equal(b.env.authCalls,count+2);w.dispose();
});
test('Focus, pageshow and visibility bursts before rerender coalesce into one revalidation',async()=>{
 const b=backend(),l=lifecycle(),w=workspace(b,l);w.render();await settle();const count=b.env.authCalls;
 l.visibility('hidden');l.visibility('visible');l.fire('focus');l.fire('pageshow');l.fire('online');w.render();await settle();assert.equal(b.env.authCalls,count+2);assert.equal(w.render().can('pflege.wounds.view'),true);w.dispose();
});
test('A hidden pending Auth reply cannot dispatch its old native profile query or publish old permissions',async()=>{
 const b=backend(),l=lifecycle(),w=workspace(b,l),d=deferred();b.env.authOverride=()=>d.promise;w.render();await settle();l.visibility('hidden');d.resolve({error:null,data:{user:{id:id(1)}}});await settle();assert.equal(b.env.profileCalls,0);assert.equal(b.env.permissionCalls,0);assert.equal(w.render().can('pflege.wounds.view'),false);
 b.env.authOverride=null;l.visibility('visible');w.render();await settle();assert.equal(w.render().can('pflege.wounds.view'),true);w.dispose();
});
test('Suspending while a native permission page is pending prevents further grant-stream dispatch and final profile confirmation',async()=>{
 const b=backend(),l=lifecycle(),w=workspace(b,l),d=deferred();b.env.pageOverride=()=>d.promise;w.render();await settle();assert.equal(b.env.profileCalls,1);const calls=b.calls.length;l.visibility('hidden');d.resolve({error:null,data:[]});await settle();assert.equal(b.calls.length,calls);assert.equal(b.env.profileCalls,1);assert.equal(w.render().can('pflege.wounds.view'),false);w.dispose();
});
test('Pagehide clears grants even before visibilityState changes; pageshow uses a fresh read',async()=>{
 const b=backend(),l=lifecycle(),w=workspace(b,l);w.render();await settle();const old=w.render();l.fire('pagehide');assert.equal(l.document.visibilityState,'visible');assert.equal(old.can('pflege.wounds.view'),false);
 l.fire('pageshow');w.render();await settle();assert.equal(w.render().can('pflege.wounds.view'),true);assert.equal(old.can('pflege.wounds.view'),false);w.dispose();
});
test('Context replacement and unmount remove every lifecycle listener and old handlers cannot revive another tenant read',async()=>{
 const b=backend(),l=lifecycle(),w=workspace(b,l);w.render();await settle();const old=w.render();assert.equal(l.document.count+l.window.count,5);
 w.auth.isAuthenticated=false;w.render();assert.equal(l.document.count+l.window.count,0);l.visibility('visible');l.fire('focus');await settle();assert.equal(old.can('pflege.wounds.view'),false);const calls=b.env.authCalls;w.dispose();l.fire('pageshow');assert.equal(b.env.authCalls,calls);assert.equal(l.document.count+l.window.count,0);
});
test('An externally cancelled wrapper starts no SDK call and cancels a pending initial server confirmation',async()=>{
 const b=backend();await assert.rejects(b.fetch(own(),()=>false));assert.equal(b.env.sessionCalls,0);
 const d=deferred();let current=true;b.env.authOverride=()=>d.promise;const pending=b.fetch(own(),()=>current);await settle();current=false;d.resolve({error:null,data:{user:{id:id(1)}}});await assert.rejects(pending);assert.equal(b.env.profileCalls,0);assert.equal(b.env.permissionCalls,0);
});
