import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { carePermissionOwner, sameCarePermissionOwner, carePermissionOwnerIsCurrent } from '../../src/lib/permissions/carePermissionOwner.web.ts';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tick = () => new Promise(resolve => setImmediate(resolve));
import { WORKFLOW_STATUS_LABELS } from '../../src/types/workflow/status.ts';
import { filterBySearch, filterByField, sortItems, paginateItems } from '../../src/lib/list/listQuery.ts';
function harness(variant) {
  const state = { account: id(1), profile: id(2), tenant: id(3), token: 'synthetic', expiry: Date.now() + 3600000,
    timedOut: false, budget: 0, plan: id(4), grants: Object.freeze(['pflege.plans.view']), allowed: true, mode: 'supabase', sdk: {}, role: 'nurse' };
  const slots = [], effects = [], calls = [];
  let cursor = 0;
  const deps = {
    Platform: { OS: variant === 'web' ? 'web' : 'android' }, SERVICE_QUERY_TIMEOUT_MS: 120000, NATIVE_SERVICE_QUERY_TIMEOUT_MS: 15000,
    withServiceQueryTimeout: (promise, _label, budget) => { state.budget = budget; return state.timedOut ? Promise.reject(new Error('timeout')) : promise; },
    WORKFLOW_STATUS_LABELS, filterBySearch, filterByField, sortItems, paginateItems,
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
    fetchCarePlanList: (...args) => new Promise((resolve,reject) => calls.push({ args, resolve, reject })),
  };
  const raw = readFileSync(new URL(`../../src/hooks/useCarePlanList.${variant}.ts`,import.meta.url),'utf8');
  const source = stripTypeScriptTypes(raw.replace(/^import .*;\n/gm,''),{ mode: 'strip' }).replace(/^export /gm,'');
  const hook = new Function(...Object.keys(deps),source+'\nreturn useCarePlanList;')(...Object.values(deps));
  const render = () => { cursor=0; return hook(); };
  const flush = () => effects.splice(0).forEach(fn=>fn());
  const stop = () => slots.forEach(s=>s?.cleanup?.());
  const result = () => ({ ok:true,data:Array.from({length:12},(_,i)=>({id:id(20+i),tenantId:state.tenant,title:'Plan '+i,clientName:'Client '+String(i).padStart(2,'0'),status:i<2?'aktiv':'entwurf',validFrom:'2026-10-31'})) });
  const ready = async () => { render();flush();calls.at(-1).resolve(result());await tick();return render(); };
  return { state,calls,render,flush,stop,result,ready };
}
for(const variant of ['web','native']) {
  test(`${variant}: actual list publishes counted rows and authentic local pagination`,async()=>{
    const h=harness(variant);try{const api=await h.ready();assert.equal(api.totalCount,12);assert.equal(api.items.length,8);assert.equal(api.showSuccess,false);assert.equal(api.isCurrentItem(id(20)),true);assert.equal(api.isCurrentItem(id(31)),false);api.loadMore();assert.equal(h.render().items.length,12);assert.equal(api.isCurrent(),false);assert.equal(h.render().isCurrentItem(id(31)),true);}finally{h.stop();}
  });
  for(const [label,change]of[['account',s=>s.account=id(9)],['profile',s=>s.profile=id(9)],['tenant',s=>s.tenant=id(9)],['token',s=>s.token='changed'],['expiry',s=>s.expiry++],['grants',s=>s.grants=Object.freeze(['pflege.plans.view'])],['SDK',s=>s.sdk={}],['role',s=>s.role='caregiver']])test(`${variant}: ${label} change removes rows, filters and old row actions synchronously`,async()=>{
    const h=harness(variant);try{const old=await h.ready();old.setSearch('Client');const shown=h.render();assert.equal(shown.search,'Client');change(h.state);const empty=h.render();assert.equal(empty.allItems.length,0);assert.equal(empty.search,'');assert.equal(empty.statusFilter,'all');assert.equal(shown.isCurrentItem(id(20)),false);await shown.refresh();assert.equal(h.calls.length,1);h.flush();h.calls.at(-1).resolve(h.result());await tick();assert.equal(h.render().totalCount,12);}finally{h.stop();}
  });
  test(`${variant}: filters and sorting use actual utilities and invalidate held row selection`,async()=>{
    const h=harness(variant);try{const first=await h.ready();first.setStatusFilter('aktiv');let api=h.render();assert.equal(api.filteredCount,2);assert.equal(first.isCurrentItem(id(20)),false);api.setSortKey('client_desc');api=h.render();assert.equal(api.items[0].id,id(21));api.setSearch('Client 00');assert.equal(h.render().filteredCount,1);h.render().resetFilters();assert.equal(h.render().filteredCount,12);}finally{h.stop();}
  });
  test(`${variant}: only successful explicit refresh reports success; failure clears old data`,async()=>{
    const h=harness(variant);try{const api=await h.ready();const p=api.refresh();await api.refresh();assert.equal(h.calls.length,2);assert.equal(h.render().showSuccess,false);h.calls[1].resolve({ok:false,error:'read denied'});await p;assert.equal(h.render().showSuccess,false);assert.equal(h.render().totalCount,0);assert.equal(h.render().error,'read denied');const retry=h.render().refresh();h.calls[2].resolve(h.result());await retry;assert.equal(h.render().showSuccess,true);assert.equal(api.isCurrentItem(id(20)),false);}finally{h.stop();}
  });
  for(const change of [r=>r.data[0].tenantId=id(99),r=>r.data[1]=r.data[0],r=>r.data[0].id=5,r=>r.data[0].id=' '+r.data[0].id])test(`${variant}: independently rejects foreign or duplicate or malformed DTO rows`,async()=>{
    const h=harness(variant);try{h.render();h.flush();const r=h.result();change(r);h.calls[0].resolve(r);await tick();assert.equal(h.render().allItems.length,0);assert(h.render().error);assert.equal(h.render().showSuccess,false);}finally{h.stop();}
  });
  test(`${variant}: late earlier owner cannot overwrite the current complete list`,async()=>{
    const h=harness(variant);try{h.render();h.flush();const old=h.result();h.state.account=id(9);h.render();h.flush();const next=h.result();next.data[0].title='Current';h.calls[1].resolve(next);await tick();h.calls[0].resolve(old);await tick();assert.equal(h.render().allItems[0].title,'Current');}finally{h.stop();}
  });
  test(`${variant}: rights loss prevents pending response and held actions`,async()=>{
    const h=harness(variant);try{const old=h.render();h.flush();h.state.allowed=false;assert.equal(h.render().allItems.length,0);h.calls[0].resolve(h.result());await tick();await old.refresh();assert.equal(h.calls.length,1);assert.equal(h.render().showSuccess,false);}finally{h.stop();}
  });
  test(`${variant}: initial denial dispatches no query`,()=>{
    const h=harness(variant);try{h.state.allowed=false;const api=h.render();h.flush();assert.equal(h.calls.length,0);assert(api.error);assert.equal(api.isEmpty,false);}finally{h.stop();}
  });
  test(`${variant}: unmount invalidates pending data and retained selection`,async()=>{
    const h=harness(variant);const old=h.render();h.flush();h.stop();h.calls[0].resolve(h.result());await tick();assert.equal(old.isCurrentItem(id(20)),false);await old.refresh();assert.equal(h.calls.length,1);
  });
}

for (const variant of ['web','native']) test(`${variant}: bounded read deadline settles failure and late original cannot replace successful retry`,async()=>{
 const h=harness(variant);try{h.state.timedOut=true;h.render();h.flush();await tick();const failed=h.render();assert.equal(failed.loading,false);assert(failed.error);assert.equal(failed.showSuccess,false);assert.equal(h.state.budget,variant==='web'?120000:15000);h.state.timedOut=false;const pending=failed.refresh();const result=h.result();result.data[0].title='Retry';h.calls[1].resolve(result);await pending;h.calls[0].resolve(h.result());await tick();assert.equal(h.render().allItems[0].title,'Retry');assert.equal(h.render().showSuccess,true);}finally{h.stop();}
});
