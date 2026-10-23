import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createNativeCarePlanSourceRepository } from '../../src/lib/pflege/nativeCarePlanSourceRepository.web.ts';
import { createNativeCarePlanSourceController } from '../../src/lib/pflege/nativeCarePlanSourceController.web.ts';
import { freezeClientNativeOriginal } from '../../src/lib/clients/clientRecordNativeOriginal.web.ts';
import { id } from './assessment-path-transport-fixtures.mjs';
import { carePermissionOwner, carePermissionOwnerIsCurrent, sameCarePermissionOwner } from '../../src/lib/permissions/carePermissionOwner.web.ts';

function harness(patch = () => {}) {
  const state = { current: true, token: 'synthetic-source-session', expiry: 4102444800, account: id(10), profile: id(11), tenant: id(12) };
  const selection = { planId: id(13), clientId: id(14), sourceAssessmentId: id(15) };
  const authority = { tenantId: state.tenant, actorId: state.profile, accessToken: state.token, expiresAt: state.expiry * 1000, isCurrent: () => state.current };
  const plan = { id: selection.planId, tenant_id: state.tenant, client_id: selection.clientId, source_assessment_id: selection.sourceAssessmentId, version: 3, status: 'draft', updated_at: '2026-10-23T12:00:00.123456Z', unknown_native_metadata: { original: null, empty: '' } };
  const assessment = { id: selection.sourceAssessmentId, tenant_id: state.tenant, subject_type: 'client', subject_id: selection.clientId, status: 'draft', updated_at: '2026-10-23T12:00:00.123456Z', unknown_native_metadata: ['retained'] };
  const calls = [];
  let count = 0;
  const sdk = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: state.account }, access_token: state.token, expires_at: state.expiry } }, error: null }),
      getUser: async () => ({ data: { user: { id: state.account } }, error: null }),
    },
    rpc: async name => {
      calls.push({ name });
      return { data: name === 'resolve_current_profile_id' ? state.profile : name === 'current_tenant_id' ? state.tenant : null, error: null };
    },
  };
  let currentSdk = sdk;
  const readNative = async (db, table, filters) => {
    calls.push({ db, table, filters });
    const response = { data: structuredClone(table === 'care_plans' ? plan : assessment), error: null, status: 200 };
    await patch({ state, authority, selection, plan, assessment, response, table, index: ++count, changeSdk: () => { currentSdk = { ...sdk }; } });
    return response;
  };
  const repository = createNativeCarePlanSourceRepository({ getSdk: () => currentSdk, query: request => Promise.resolve(request), readNative });
  return { state, authority, selection, plan, assessment, calls, repository, sdk, read: () => repository.read(authority, selection) };
}

test('actual reader confirms distinct account/profile and preserves all delivered singleton originals', async () => {
  const h = harness(), result = await h.read();
  assert.equal(result.ok, true); assert.notEqual(h.state.account, h.state.profile);
  assert.deepEqual(result.data, { plan: h.plan, assessment: h.assessment });
  assert(Object.isFrozen(result.data.plan.unknown_native_metadata));
  assert(Object.isFrozen(result.data.assessment.unknown_native_metadata));
  const reads = h.calls.filter(call => call.table);
  assert.deepEqual(reads.map(call => call.table), ['care_plans', 'care_assessments', 'care_plans', 'care_assessments']);
  for (const read of reads) assert.deepEqual(read.filters, read.table === 'care_plans'
    ? { id: h.selection.planId, tenant_id: h.state.tenant, client_id: h.selection.clientId }
    : { id: h.selection.sourceAssessmentId, tenant_id: h.state.tenant, subject_type: 'client', subject_id: h.selection.clientId });
  assert(h.calls.filter(call => call.name).every(call => ['current_tenant_id', 'resolve_current_profile_id'].includes(call.name)));
});
test('explicit stored null remains unlinked and never queries an invented Assessment', async () => {
  const h = harness(); h.plan.source_assessment_id = h.selection.sourceAssessmentId = null;
  const result = await h.read(); assert.equal(result.ok, true); assert.equal(result.data.assessment, null);
  assert.deepEqual(h.calls.filter(call => call.table).map(call => call.table), ['care_plans', 'care_plans']);
});
for (const [label, mutate] of [
  ['foreign plan', h => { h.plan.id = id(90); }],
  ['foreign plan tenant', h => { h.plan.tenant_id = id(90); }],
  ['foreign client', h => { h.plan.client_id = id(90); }],
  ['different saved source', h => { h.plan.source_assessment_id = id(90); }],
  ['missing saved source', h => { delete h.plan.source_assessment_id; }],
  ['undefined saved source', h => { h.plan.source_assessment_id = undefined; }],
  ['empty saved source', h => { h.plan.source_assessment_id = ''; }],
  ['unknown version', h => { delete h.plan.version; }],
  ['string version', h => { h.plan.version = '3'; }],
  ['zero version', h => { h.plan.version = 0; }],
  ['foreign Assessment', h => { h.assessment.id = id(90); }],
  ['foreign Assessment tenant', h => { h.assessment.tenant_id = id(90); }],
  ['foreign Assessment client', h => { h.assessment.subject_id = id(90); }],
  ['resident Assessment', h => { h.assessment.subject_type = 'resident'; }],
]) test('rejects ' + label + ' instead of asserting a source link', async () => {
  const h = harness(); mutate(h); assert.equal((await h.read()).ok, false);
});
for (const [label, mutate] of [
  ['plan microsecond', h => { h.plan.updated_at = '2026-10-23T12:00:00.123457Z'; }],
  ['Assessment metadata', h => { h.assessment.unknown_native_metadata.push('changed'); }],
  ['version', h => { h.plan.version++; }],
  ['source', h => { h.plan.source_assessment_id = id(99); }],
]) test('double read detects ' + label + ' drift', async () => {
  const h = harness(frame => { if (frame.index === 2) mutate(frame); });
  assert.equal((await h.read()).ok, false);
});
for (const [label, mutate] of [
  ['token', h => { h.state.token = 'changed'; }],
  ['raw account', h => { h.state.account = id(90); }],
  ['profile', h => { h.state.profile = id(90); }],
  ['tenant', h => { h.state.tenant = id(90); }],
  ['expiry', h => { h.state.expiry++; }],
  ['current rights', h => { h.state.current = false; }],
  ['SDK', h => { h.changeSdk(); }],
  ['selection', h => { h.selection.clientId = id(90); }],
  ['authority', h => { h.authority.actorId = id(90); }],
]) test('identity/selection barrier rejects changed ' + label + ' during read', async () => {
  const h = harness(frame => { if (frame.index === 1) mutate(frame); });
  assert.equal((await h.read()).ok, false); assert.equal(h.calls.filter(call => call.table).length, 1);
});
for (const where of ['selection', 'authority', 'response', 'native row']) test(where + ' accessor is rejected without execution', async () => {
  let invoked = 0;
  const descriptor = { enumerable: true, get() { invoked++; return id(99); } };
  const h = harness(frame => {
    if (where === 'response') Object.defineProperty(frame.response, 'data', descriptor);
    if (where === 'native row') Object.defineProperty(frame.response.data, 'hidden', descriptor);
  });
  if (where === 'selection') Object.defineProperty(h.selection, 'clientId', descriptor);
  if (where === 'authority') Object.defineProperty(h.authority, 'actorId', descriptor);
  assert.equal((await h.read()).ok, false); assert.equal(invoked, 0);
});
for (const change of [h => { h.response.error = { code: '42501' }; }, h => { h.response.data = null; }, h => { h.response.data = []; }, h => { h.response.status = 403; }, h => { delete h.response.error; }]) {
  test('missing/denied/malformed native read never becomes a source confirmation', async () => {
    const h = harness(frame => change(frame)); assert.equal((await h.read()).ok, false);
  });
}
for (const change of [h => { h.selection.planId += '\n'; }, h => { h.selection.sourceAssessmentId = ''; }, h => { h.authority.expiresAt = null; }, h => { h.selection.extra = true; }]) {
  test('invalid selection or unknown expiry fails before any native query', async () => {
    const h = harness(); change(h); assert.equal((await h.read()).ok, false); assert.equal(h.calls.filter(call => call.table).length, 0);
  });
}

function controllerHarness() {
  const h = harness(); let current = true, response = null, calls = 0;
  const controller = createNativeCarePlanSourceController({ isCurrent: () => current, read: async () => { calls++; return response ?? h.read(); } });
  controller.mount();
  return { h, controller, setCurrent: value => { current = value; }, setResponse: value => { response = value; }, count: () => calls };
}
test('navigation performs a fresh original check and returns only its own stored Assessment', async () => {
  const h = controllerHarness(); await h.controller.refresh();
  assert.equal(await h.controller.sourceForNavigation(), h.h.selection.sourceAssessmentId); assert.equal(h.count(), 2);
});
test('changed original after rendering blocks navigation until an explicit reload', async () => {
  const h = controllerHarness(); await h.controller.refresh(); h.h.plan.version++;
  assert.equal(await h.controller.sourceForNavigation(), null); assert.equal(h.controller.state().snapshot, null);
  assert.match(h.controller.state().error, /geändert/);
  await h.controller.refresh(); assert.equal(h.controller.state().snapshot.plan.version, 4);
});
test('permission loss permanently retires a controller and cannot restore an old navigation callback', async () => {
  const h = controllerHarness(); await h.controller.refresh(); h.setCurrent(false);
  assert.equal(h.controller.state().snapshot, null); h.setCurrent(true);
  assert.equal(await h.controller.sourceForNavigation(), null); assert.equal(h.count(), 1);
});
test('unlinked plan has no navigation capability', async () => {
  const h = controllerHarness(); h.h.plan.source_assessment_id = h.h.selection.sourceAssessmentId = null;
  await h.controller.refresh(); assert.equal(await h.controller.sourceForNavigation(), null); assert.equal(h.count(), 1);
});
test('late response after disposal does not restore an old screen', async () => {
  let resolve;
  const controller = createNativeCarePlanSourceController({ isCurrent: () => true, read: () => new Promise(done => { resolve = done; }) });
  controller.mount(); const pending = controller.refresh(); controller.dispose();
  resolve({ ok: true, data: freezeClientNativeOriginal({ plan: { id: id(1) }, assessment: null }) }); await pending;
  assert.equal(controller.state().snapshot, null);
});
test('effect cleanup/remount allows a new read while the earlier result stays stale', async () => {
  const waiting = [], controller = createNativeCarePlanSourceController({ isCurrent: () => true, read: () => new Promise(done => waiting.push(done)) });
  controller.mount(); const old = controller.refresh(); controller.dispose(); controller.mount(); const next = controller.refresh();
  waiting[0]({ ok: true, data: { plan: { version: 1 }, assessment: null } }); await old;
  assert.equal(controller.state().snapshot, null); assert.equal(controller.state().loading, true);
  waiting[1]({ ok: true, data: { plan: { version: 2 }, assessment: null } }); await next;
  assert.equal(controller.state().snapshot.plan.version, 2);
});
test('busy guard blocks duplicate opens and refreshes without issuing another read', async () => {
  const h = controllerHarness(); await h.controller.refresh(); let resolve;
  h.setResponse(new Promise(done => { resolve = done; })); const pending = h.controller.sourceForNavigation();
  await h.controller.refresh(); assert.equal(await h.controller.sourceForNavigation(), null); assert.equal(h.count(), 2);
  resolve({ ok: false, error: 'not confirmed' }); await pending; assert.equal(h.controller.state().snapshot, null);
});
test('actual Supabase adapter selects complete scoped singletons and issues no write', async () => {
  const calls = [], db = {}, row = { id: id(1) };
  const query = { select(value) { calls.push(['select', value]); return this; }, eq(...args) { calls.push(['eq', ...args]); return this; }, maybeSingle() { calls.push(['maybeSingle']); return Promise.resolve({ data: row, error: null }); } };
  const raw = readFileSync(new URL('../../src/lib/pflege/nativeCarePlanSourceRepository.supabase.web.ts', import.meta.url), 'utf8');
  const source = stripTypeScriptTypes(raw.replace(/^import .*;\n/gm, ''), { mode: 'strip' }).replace(/^export /gm, '');
  const adapter = new Function('getSupabaseClient', 'fromUnknownTable', 'withServiceQueryTimeout', 'createNativeCarePlanSourceRepository', source + '\nreturn nativeCarePlanSourceRepository;')(
    () => db, (sdk, table) => { assert.equal(sdk, db); calls.push(['table', table]); return query; }, promise => promise, options => options,
  );
  await adapter.readNative(db, 'care_assessments', { id: id(2), tenant_id: id(3), subject_type: 'client', subject_id: id(4) });
  assert.deepEqual(calls, [['table', 'care_assessments'], ['select', '*'], ['eq', 'id', id(2)], ['eq', 'tenant_id', id(3)], ['eq', 'subject_type', 'client'], ['eq', 'subject_id', id(4)], ['maybeSingle']]);
});

// Existing Node hook model: effects and lifetimes only, no DOM/layout or browser claim.
function hookHarness(patch = () => {}) {
  const h = harness(patch), slots = [], queued = [];
  let cursor = 0, api, selection = { ...h.selection }, allowed = true;
  const grants = Object.freeze(['pflege.plans.view']);
  const sameDeps = (a, b) => a?.length === b?.length && a.every((item, index) => Object.is(item, b[index]));
  const useRef = initial => { const index = cursor++; return slots[index] ??= { current: initial }; };
  const useState = initial => {
    const index = cursor++; if (!(index in slots)) slots[index] = initial;
    return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
  };
  const useEffect = (effect, deps) => {
    const index = cursor++, previous = slots[index];
    if (!previous || !sameDeps(previous.deps, deps)) {
      slots[index] = { deps, cleanup: previous?.cleanup };
      queued.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect(); });
    }
  };
  const raw = readFileSync(new URL('../../src/hooks/pflege/useNativeCarePlanSource.web.ts', import.meta.url), 'utf8');
  const source = stripTypeScriptTypes(raw.replace(/^import .*;\n/gm, ''), { mode: 'strip' }).replace(/^export /gm, '');
  const deps = {
    useRef, useState, useEffect,
    useAuth: () => ({ authReady: true, isAuthenticated: true, isLoading: false, profileBootstrapError: null, portalSession: null,
      profile: { id: h.state.profile, tenantId: h.state.tenant, roleKey: 'business_admin' }, user: { id: h.state.account },
      session: { user: { id: h.state.account }, accessToken: h.state.token, expiresAt: h.state.expiry * 1000 } }),
    useServiceTenantId: () => h.state.tenant,
    getSupabaseClient: () => h.sdk, getServiceMode: () => 'supabase', isDemoMode: () => false,
    carePermissionOwner, sameCarePermissionOwner, carePermissionOwnerIsCurrent,
    useCareRuntimePermissions: () => ({ permissions: grants, tenantId: h.state.tenant, can: () => allowed }),
    createNativeCarePlanSourceController, nativeCarePlanSourceRepository: h.repository,
  };
  const hook = new Function(...Object.keys(deps), source + '\nreturn useNativeCarePlanSource;')(...Object.values(deps));
  const render = () => { cursor = 0; api = hook(selection); return api; };
  const flush = () => { const effects = queued.splice(0); effects.forEach(effect => effect()); };
  const ready = async () => { render(); flush(); await new Promise(resolve => setImmediate(resolve)); return render(); };
  const stop = () => { for (const slot of slots) slot?.cleanup?.(); };
  return { h, render, flush, ready, stop, select: next => { selection = next; }, allow: next => { allowed = next; }, get api() { return api; } };
}
test('actual Web hook publishes its own bound reader result and rechecks before navigation', async () => {
  const h = hookHarness(); try {
    const api = await h.ready(), navigated = [];
    assert.equal(api.snapshot.assessment.id, h.h.selection.sourceAssessmentId);
    await api.open(id => navigated.push(id));
    assert.deepEqual(navigated, [h.h.selection.sourceAssessmentId]);
    assert.equal(h.h.calls.filter(call => call.table).length, 8);
  } finally { h.stop(); }
});
test('actual Web hook never opens a retained callback after current rights were withdrawn', async () => {
  const h = hookHarness(); try {
    const old = await h.ready(), count = h.h.calls.length; h.allow(false);
    await old.open(() => assert.fail('old navigation')); h.allow(true);
    await old.open(() => assert.fail('restored old navigation'));
    assert.equal(h.h.calls.length, count); assert.equal(h.render().snapshot, null);
  } finally { h.stop(); }
});
test('actual Web hook hides prior source synchronously on route/account changes and retires old callbacks', async () => {
  for (const change of ['route', 'account']) {
    const h = hookHarness(); try {
      const old = await h.ready(), count = h.h.calls.length;
      if (change === 'route') h.select({ ...h.h.selection, planId: id(80) }); else h.h.state.account = id(80);
      assert.equal(h.render().snapshot, null);
      await old.open(() => assert.fail('stale callback navigated')); assert.equal(h.h.calls.length, count);
    } finally { h.stop(); }
  }
});
test('actual Web hook unmount during navigation cannot open or publish the late source result', async () => {
  let release, pause = false;
  const h = hookHarness(async frame => { if (pause && frame.table === 'care_plans') await new Promise(resolve => { release = resolve; }); });
  const api = await h.ready(); pause = true;
  const pending = api.open(() => assert.fail('unmounted navigation'));
  while (!release) await new Promise(resolve => setImmediate(resolve));
  h.stop(); release(); await pending;
});
