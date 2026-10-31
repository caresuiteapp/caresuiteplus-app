import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { carePermissionOwner, sameCarePermissionOwner, carePermissionOwnerIsCurrent } from '../../src/lib/permissions/carePermissionOwner.web.ts';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness(variant) {
  const state = { account: id(1), profile: id(2), tenant: id(3), token: 'synthetic', expiry: Date.now() + 3600000,
    plan: id(4), grants: Object.freeze(['pflege.plans.view']), allowed: true, mode: 'supabase', sdk: {}, role: 'nurse' };
  const slots = [], effects = [], calls = [];
  let cursor = 0;
  const deps = {
    useRef: initial => { const i = cursor++; return slots[i] ??= { current: initial }; },
    useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useEffect: (effect, values) => { const i = cursor++, old = slots[i]; if (!old || values.some((v,j) => !Object.is(v,old.values[j]))) { slots[i] = { values, cleanup: old?.cleanup }; effects.push(() => { old?.cleanup?.(); slots[i].cleanup = effect(); }); } },
    useAuth: () => ({ authReady: true, isAuthenticated: true, isLoading: false, profileBootstrapError: null, portalSession: null,
      user: { id: state.account }, session: { user: { id: state.account }, accessToken: state.token, expiresAt: state.expiry },
      profile: { id: state.profile, tenantId: state.tenant, roleKey: state.role } }),
    useServiceTenantId: () => state.tenant,
    useCareRuntimePermissions: () => ({ permissions: state.grants, tenantId: state.tenant, loading: false, can: () => state.allowed }),
    carePermissionOwner, sameCarePermissionOwner, carePermissionOwnerIsCurrent,
    getSupabaseClient: () => state.sdk, getServiceMode: () => state.mode, isDemoMode: () => false,
    fetchCarePlanDetail: (...args) => new Promise((resolve,reject) => calls.push({ args, resolve, reject })),
  };
  const raw = readFileSync(new URL(`../../src/hooks/useCarePlanDetail.${variant}.ts`,import.meta.url),'utf8');
  const source = stripTypeScriptTypes(raw.replace(/^import .*;\n/gm,''),{ mode: 'strip' }).replace(/^export /gm,'');
  const hook = new Function(...Object.keys(deps),source+'\nreturn useCarePlanDetail;')(...Object.values(deps));
  const render = () => { cursor=0; return hook(state.plan); };
  const flush = () => effects.splice(0).forEach(fn=>fn());
  const stop = () => slots.forEach(s=>s?.cleanup?.());
  const result = () => ({ ok:true,data:{ id:state.plan, tenantId:state.tenant, clientId:id(5), title:'Originalplan' } });
  const ready = async () => { render();flush();calls.at(-1).resolve(result());await tick();return render(); };
  return { state,calls,render,flush,stop,result,ready };
}
for (const variant of ['web','native']) {
  test(`${variant}: publishes only its own detail and explicitly leaves vitals unloaded`,async()=>{
    const h=harness(variant);try { const api=await h.ready();assert.equal(api.data.title,'Originalplan');assert.equal(api.loading,false);assert.equal(api.error,null);assert.equal(api.vitalsLoaded,false);assert.equal(api.isCurrent(),true);assert.deepEqual(h.calls[0].args,[id(4),id(3),'nurse']); } finally {h.stop();}
  });
  for(const [label,change] of [
    ['account',s=>s.account=id(9)],['profile',s=>s.profile=id(9)],['tenant',s=>s.tenant=id(9)],
    ['token',s=>s.token='replacement'],['expiry',s=>s.expiry+=1],['route',s=>s.plan=id(9)],
    ['grants',s=>s.grants=Object.freeze(['pflege.plans.view'])],['SDK',s=>s.sdk={}],['role',s=>s.role='caregiver'],
  ])test(`${variant}: ${label} switch hides data synchronously and retires retained reload`,async()=>{
    const h=harness(variant);try { const old=await h.ready();change(h.state);assert.equal(h.render().data,undefined);assert.equal(old.isCurrent(),false);await old.refresh();assert.equal(h.calls.length,1);h.flush();h.calls.at(-1).resolve(h.result());await tick();assert.equal(h.render().data.id,h.state.plan); }finally{h.stop();}
  });
  for(const [label,change] of [['rights',s=>s.allowed=false],['expired session',s=>s.expiry=1],['service mode',s=>s.mode='demo']])test(`${variant}: ${label} loss blocks pending publication and old reload`,async()=>{
    const h=harness(variant);try{const old=h.render();h.flush();change(h.state);assert.equal(h.render().data,undefined);h.calls[0].resolve(h.result());await tick();await old.refresh();assert.equal(h.calls.length,1);assert.equal(h.render().data,undefined);}finally{h.stop();}
  });
  test(`${variant}: late prior route response cannot replace current plan`,async()=>{
    const h=harness(variant);try{h.render();h.flush();const prior=h.result();h.state.plan=id(9);h.render();h.flush();h.calls[1].resolve(h.result());await tick();h.calls[0].resolve(prior);await tick();assert.equal(h.render().data.id,id(9));}finally{h.stop();}
  });
  test(`${variant}: duplicate reload is blocked and reload failure removes old data`,async()=>{
    const h=harness(variant);try{const api=await h.ready();const pending=api.refresh();await api.refresh();assert.equal(h.calls.length,2);assert.equal(h.render().data,undefined);assert.equal(api.isCurrent(),false);h.calls[1].resolve({ok:false,error:'Abfrage abgewiesen'});await pending;assert.equal(h.render().error,'Abfrage abgewiesen');assert.equal(h.render().data,undefined);}finally{h.stop();}
  });
  for(const key of ['id','tenantId'])test(`${variant}: independently rejects foreign ${key} despite query filters`,async()=>{
    const h=harness(variant);try{h.render();h.flush();const r=h.result();r.data[key]=id(99);h.calls[0].resolve(r);await tick();assert.equal(h.render().data,undefined);assert.match(h.render().error,/aktuellen Auswahl/);}finally{h.stop();}
  });
  test(`${variant}: unmount invalidates response and held reload`,async()=>{
    const h=harness(variant);const old=h.render();h.flush();h.stop();h.calls[0].resolve(h.result());await tick();await old.refresh();assert.equal(h.calls.length,1);assert.equal(h.render().data,undefined);
  });
  test(`${variant}: rejection settles loading and permits explicit retry`,async()=>{
    const h=harness(variant);try{h.render();h.flush();h.calls[0].reject(new Error('network'));await tick();const api=h.render();assert.equal(api.loading,false);assert.match(api.error,/erneut/);const pending=api.refresh();h.calls[1].resolve(h.result());await pending;assert.equal(h.render().data.title,'Originalplan');}finally{h.stop();}
  });
}

for (const variant of ['web','native']) test(`${variant}: retained action cannot reuse an earlier successful snapshot after reload`,async()=>{
  const h=harness(variant);try{const old=await h.ready();const pending=old.refresh();h.calls[1].resolve(h.result());await pending;assert.equal(old.isCurrent(),false);assert.equal(h.render().isCurrent(),true);}finally{h.stop();}
});
