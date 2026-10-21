import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { isUuid } from '../../src/lib/validation/uuid.ts';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const time = '2026-10-15T05:10:00.123456+00:00';
const source = stripTypeScriptTypes(readFileSync(new URL(
  '../../src/lib/clients/repositories/careClientIntakeDraftRepository.supabase.web.ts', import.meta.url,
), 'utf8').replace(/^import[\s\S]*?;\n/gm, '').replace(/\bexport /g, ''));
const form = patch => ({
  firstName: ' Anna ', lastName: 'Meyer', dateOfBirth: '1940-02-29',
  careLevel: '', street: ' Straße ', houseNumber: ' 7 ', zip: '44623', city: 'Herne',
  phone: '', mobile: '', email: '', specialNotes: ' Original ', insuranceNumber: '',
  admissionDate: '', gender: '', billingTypes: [], ...patch,
});
const row = patch => ({
  id: id(20), tenant_id: id(1), status: 'lead', updated_at: time,
  first_name: 'Anna', last_name: 'Meyer', date_of_birth: '1940-02-29',
  insurance_number: null, ...patch,
});
const options = patch => ({ actorProfileId: id(2), ...patch });

function literalLike(pattern) { return pattern.replace(/\\([\\%_])/g, '$1').toLocaleLowerCase('de-DE'); }
function database(initial = [], controls = {}) {
  const rows = structuredClone(initial), calls = [], receipts = new Map(), proofs = new Map();
  const db = { rows, calls, receipts, async rpc(name, args) {
    assert.ok(['web_reserve_reviewed_client_intake_draft','web_confirm_reviewed_client_intake_draft'].includes(name));
    const call = { mode: 'rpc', name, args: structuredClone(args) };
    calls.push(call); await controls.before?.(call, db);
    const aborted=controls.abortReply?.(call);if(aborted)return aborted;
    if (controls.failBefore?.(call)) return { data: null, error: { message: 'RPC nicht erlaubt' } };
    const previous = receipts.get(args.p_request_id);
    const proof = proofs.get(args.p_request_id);
    if (name === 'web_confirm_reviewed_client_intake_draft' && (!previous || !proof
      || proof.reviewId !== args.p_review_id || proof.actor !== args.p_actor_profile_id || proof.tenant !== args.p_tenant_id
      || JSON.stringify(proof.payload) !== JSON.stringify(args.p_payload)
      || JSON.stringify(rows.find(row=>row.id===args.p_request_id)) !== JSON.stringify(proof.row))) return {data:null,error:{code:'P0I04'}};
    if (previous) {
      const repeated = { id: previous.id, request_id:args.p_request_id,identity_review_id:args.p_review_id,created: false, updated_at: previous.updated_at, row: structuredClone(previous) };
      return controls.after?.(call, { data: repeated, error: null }, db) ?? { data: repeated, error: null };
    }
    const input = args.p_payload;
    const exact = rows.find(item => item.tenant_id === args.p_tenant_id && (
      String(item.first_name).trim().toLowerCase() === String(input.first_name).trim().toLowerCase()
        && String(item.last_name).trim().toLowerCase() === String(input.last_name).trim().toLowerCase()
        && item.date_of_birth === input.date_of_birth
      || input.insurance_number && String(item.insurance_number ?? '').trim().toLowerCase() === String(input.insurance_number).trim().toLowerCase()
    ));
    if (exact) return { data: null, error: { code: 'P0I01', message: 'identity conflict' } };
    const created = { id: args.p_proposed_client_id, tenant_id: args.p_tenant_id, status: 'lead',
      created_by: args.p_actor_profile_id, updated_by: args.p_actor_profile_id, updated_at: time, ...structuredClone(input) };
    rows.push(created); receipts.set(args.p_request_id, created);proofs.set(args.p_request_id,{reviewId:args.p_review_id,actor:args.p_actor_profile_id,tenant:args.p_tenant_id,payload:structuredClone(input),row:structuredClone(created)});
    const result = { data: { id: created.id,request_id:args.p_request_id,identity_review_id:args.p_review_id,created: true, updated_at: created.updated_at, row: structuredClone(created) }, error: null };
    return controls.after?.(call, result, db) ?? result;
  }, from(table) {
    assert.equal(table, 'clients');
    let mode = 'select', payload, columns, limit = Infinity;
    const filters = [];
    const query = {
      select(value) { columns = value; return query; },
      update(value) { mode = 'update'; payload = structuredClone(value); return query; },
      insert(value) { mode = 'insert'; payload = structuredClone(value); return query; },
      eq(key, value) { filters.push(['eq', key, value]); return query; },
      neq(key, value) { filters.push(['neq', key, value]); return query; },
      ilike(key, value) { filters.push(['ilike', key, value]); return query; },
      limit(value) { limit = value; return query; },
      maybeSingle() { return execute(true); },
      single() { return execute(true); },
      then(resolve, reject) { return execute(false).then(resolve, reject); },
    };
    async function execute(single) {
      const call = { mode, payload, columns, filters: structuredClone(filters) };
      calls.push(call);
      await controls.before?.(call, db);
      if (controls.failBefore?.(call)) return { data: null, error: { message: 'Lesen nicht erlaubt' } };
      let matches = rows.filter(item => filters.every(([kind, key, value]) => {
        if (kind === 'eq') return item[key] === value;
        if (kind === 'neq') return item[key] !== value;
        return String(item[key] ?? '').toLocaleLowerCase('de-DE') === literalLike(value);
      })).slice(0, limit);
      if (mode === 'insert') {
        const created = { id: id(80 + rows.length), updated_at: time, ...structuredClone(payload) };
        rows.push(created); matches = [created];
      } else if (mode === 'update') {
        for (const item of matches) Object.assign(item, structuredClone(payload));
      }
      const selected = matches.map(item => columns === '*' ? structuredClone(item)
        : Object.fromEntries(columns.split(',').map(key => [key, item[key]])));
      const normal = { data: single ? selected[0] ?? null : selected, error: null };
      return controls.after?.(call, normal, db) ?? normal;
    }
    return query;
  } };
  return db;
}
function api(db, current = () => db, method = 'upsertClientIntakeDraft') {
  const run = new Function('getSupabaseClient', 'toGermanSupabaseError', 'SERVICE_ERRORS', 'isUuid',
    'normalizeIntakeCareLevelForDb', 'resolvePrimaryCostBearerName', 'resolveIntakeBillingProfileType',
    `${source}; return ${method};`)(current,
    error => error?.message ?? 'Datenbankfehler', { supabaseUnavailable: 'Kein SDK' }, isUuid,
    value => value || null, () => null, () => null);
  // Direct adapter regression cases receive an explicit synthetic server-review
  // port. The session/hook cases exercise preparation through the real reader.
  return (...args) => {
    if(method==='upsertClientIntakeDraft' && args[2]?.newClientId && !Object.hasOwn(args[2],'identityReview')) {
      const input=args[1],opts=args[2],now=Date.now();
      const review={id:id(500),requestId:opts.newClientId,tenantId:args[0],actorId:opts.actorProfileId,
        inputKey:JSON.stringify([input.firstName.trim(),input.lastName.trim(),input.dateOfBirth.trim(),input.insuranceNumber.trim()]),
        candidateCount:0,preparedAt:new Date(now).toISOString(),expiresAt:new Date(now+300000).toISOString()};
      args[2]={...opts,identityReview:()=>review};
    }
    return run(...args);
  };
}
const writes = db => db.calls.filter(call => call.mode !== 'select' && call.name !== 'web_confirm_reviewed_client_intake_draft');

test('a new web draft writes a lead only after exact identity checks and verifies every written field', async () => {
  const db = database(), input = form(), original = structuredClone(input);
  const result = await api(db)(id(1), input, options({ newClientId: id(77) }));
  assert.deepEqual(result, { ok: true, data: { id: id(77) } });
  assert.deepEqual(input, original);
  assert.deepEqual(db.calls.map(call => call.mode), ['select', 'rpc']);
  assert.equal(db.rows[0].status, 'lead');
  assert.equal(db.rows[0].created_by, id(2));
  assert.equal(db.rows[0].first_name, 'Anna');
  assert.equal(writes(db)[0].args.p_request_id, id(77));
});

for (const [name, tenant, opts] of [
  ['missing tenant', '', options()], ['invalid tenant', 'demo-tenant', options()],
  ['missing actor', id(1), {}], ['invalid actor', id(1), options({ actorProfileId: 'Name' })],
  ['legacy draft id', id(1), options({ clientId: 'client-intake-123' })],
]) test(`${name} cannot reach a native read or write`, async () => {
  const db = database();
  assert.equal((await api(db)(tenant, form(), opts)).ok, false);
  assert.equal(db.calls.length, 0);
});

for (const birthDate of ['1940-02-30', '1900-02-29', '1940-13-01', '1940-2-9', '0000-01-01', '1940-02-29T00:00:00Z']) {
  test(`invalid calendar birth date ${birthDate} cannot write`, async () => {
    const db = database();
    assert.equal((await api(db)(id(1), form({ dateOfBirth: birthDate }), options())).ok, false);
    assert.equal(db.calls.length, 0);
  });
}
test('a valid leap day can be reserved while an incomplete first intake remains local', async () => {
  const db=database();assert.equal((await api(db)(id(1),form({dateOfBirth:'2000-02-29'}),options({newClientId:id(77)}))).ok,true);
  assert.equal(db.rows[0].date_of_birth,'2000-02-29');
  const incomplete=database();assert.equal((await api(incomplete)(id(1),form({dateOfBirth:''}),options({newClientId:id(77)}))).ok,false);
  assert.equal(incomplete.calls.length,0);
});

for (const existing of [
  row({ first_name: 'anna', last_name: 'MEYER' }),
  row({ first_name: 'Else', insurance_number: 'a123456789' }),
]) test(`an exact ${existing.first_name === 'Else' ? 'insurance' : 'name/birth'} conflict stops before every mutation`, async () => {
  const db = database([existing]);
  const result = await api(db)(id(1), form({ insuranceNumber: ' A123456789 ' }), options());
  assert.equal(result.ok, false); assert.match(result.error, /bereits vorhanden/);
  assert.equal(writes(db).length, 0); assert.equal(db.rows.length, 1);
});
test('insurance conflicts also block a draft whose name or birth date is still incomplete', async () => {
  const db = database([row({ insurance_number: 'A123456789' })]);
  assert.equal((await api(db)(id(1), form({ firstName: '', dateOfBirth: '', insuranceNumber: 'A123456789' }), options())).ok, false);
  assert.equal(writes(db).length, 0);
});
test('similar names never choose or modify an existing person', async () => {
  const existing = row({ first_name: 'Anne' }), db = database([existing]);
  assert.equal((await api(db)(id(1), form(), options({ newClientId: id(77) }))).ok, true);
  assert.deepEqual(db.rows[0], existing); assert.equal(db.rows.length, 2);
  assert.equal(writes(db)[0].mode, 'rpc');
});
test('another tenant is excluded and literal percent, underscore and backslash are escaped', async () => {
  const db = database([row({ tenant_id: id(9) })]);
  assert.equal((await api(db)(id(1), form({ firstName: 'A%_\\na' }), options({ newClientId: id(77) }))).ok, true);
  assert.ok(db.calls[0].filters.some(([kind, key, value]) => kind === 'ilike' && key === 'first_name' && value === 'A\\%\\_\\\\na'));
  assert.ok(db.calls[0].filters.some(([, key, value]) => key === 'tenant_id' && value === id(1)));
});

for (const [label, initial] of [
  ['missing', []], ['active', [row({ status: 'active' })]],
  ['foreign tenant', [row({ tenant_id: id(9) })]], ['archived', [row({ status: 'archived' })]],
]) test(`a ${label} stored draft cannot fall back to inserting another person`, async () => {
  const db = database(initial), before = structuredClone(initial);
  const result = await api(db)(id(1), form(), options({ clientId: id(20) }));
  assert.equal(result.ok, false); assert.match(result.error, /keine weitere Person angelegt/);
  assert.equal(writes(db).length, 0); assert.deepEqual(db.rows, before);
});
test('an own draft uses its exact original microsecond version, excludes itself and never inserts', async () => {
  const db = database([row()]);
  assert.deepEqual(await api(db)(id(1), form({ street: 'Neue Straße' }), options({ clientId: id(20) })), { ok: true, data: { id: id(20) } });
  const write = writes(db)[0]; assert.equal(write.mode, 'update');
  assert.ok(write.filters.some(([, key, value]) => key === 'updated_at' && value === time));
  assert.ok(write.filters.some(([, key, value]) => key === 'status' && value === 'lead'));
  assert.ok(db.calls[1].filters.some(([kind, key, value]) => kind === 'neq' && key === 'id' && value === id(20)));
  assert.equal(db.rows.length, 1); assert.equal(db.rows[0].street, 'Neue Straße');
});
test('a second exact person remains blocking when the current draft is excluded', async () => {
  const db = database([row(), row({ id: id(21) })]);
  assert.equal((await api(db)(id(1), form(), options({ clientId: id(20) }))).ok, false);
  assert.equal(writes(db).length, 0);
});
test('a one-microsecond concurrent edit stops the update and never creates a replacement', async () => {
  const db = database([row()], { before: (call, state) => {
    if (call.mode === 'update') state.rows[0].updated_at = '2026-10-15T05:10:00.123457+00:00';
  } });
  assert.equal((await api(db)(id(1), form({ street: 'Must not overwrite' }), options({ clientId: id(20) }))).ok, false);
  assert.equal(writes(db).length, 1); assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0].street, undefined);
});
test('a concurrent activation cannot be changed back to a lead', async () => {
  const db = database([row()], { before: (call, state) => { if (call.mode === 'update') state.rows[0].status = 'active'; } });
  assert.equal((await api(db)(id(1), form(), options({ clientId: id(20) }))).ok, false);
  assert.equal(db.rows[0].status, 'active'); assert.equal(db.rows.length, 1);
});
for (const updatedAt of [null, '', 'not-a-time']) test(`an unconfirmed draft revision ${updatedAt} never mutates`, async () => {
  const db = database([row({ updated_at: updatedAt })]);
  assert.equal((await api(db)(id(1), form(), options({ clientId: id(20) }))).ok, false);
  assert.equal(writes(db).length, 0);
});

for (const data of [null, {}, [null], [{ id: 'legacy-id', tenant_id: id(1) }], [{ id: id(30), tenant_id: id(9) }]]) {
  test('malformed or foreign identity results fail before the draft write', async () => {
    const db = database([], { after: call => call.mode === 'select' ? { data, error: null } : undefined });
    assert.equal((await api(db)(id(1), form(), options())).ok, false);
    assert.equal(writes(db).length, 0);
  });
}
test('an identity lookup error stops before every write', async () => {
  const db = database([], { failBefore: call => call.mode === 'select' });
  assert.equal((await api(db)(id(1), form(), options())).ok, false);
  assert.equal(writes(db).length, 0);
});
for (const corrupt of [
  data => ({ ...data, id: 'legacy-id' }),
  data => ({ ...data, row: { ...data.row, tenant_id: id(9) } }),
  data => ({ ...data, row: { ...data.row, status: 'active' } }),
  data => ({ ...data, row: { ...data.row, first_name: 'Another person' } }),
  data => { const copy = structuredClone(data); delete copy.row.updated_by; return copy; },
]) test('a wrong or incomplete mutation result is never reported as saved', async () => {
  const db = database([], { after: (call, result) => call.mode !== 'select' ? { data: corrupt(result.data), error: null } : undefined });
  const result = await api(db)(id(1), form(), options({ newClientId: id(77) }));
  assert.equal(result.ok, false); assert.match(result.error, /nicht vollständig bestätigt/);
  assert.equal(writes(db).length, 1);
});
test('a wrong returned update identity is rejected even when all saved values match', async () => {
  const db = database([row()], { after: (call, result) => call.mode === 'update' ? { data: { ...result.data, id: id(99) }, error: null } : undefined });
  assert.equal((await api(db)(id(1), form(), options({ clientId: id(20) }))).ok, false);
  assert.equal(writes(db).length, 1);
});
test('a lost insert response stays unconfirmed and causes no automatic second write', async () => {
  const db = database([], { after: call => call.mode === 'rpc' ? { data: null, error: { message: 'Response lost', code: '08006' } } : undefined });
  const result = await api(db)(id(1), form(), options({ newClientId: id(77) }));
  assert.equal(result.ok, false); assert.match(result.error, /nicht vollständig bestätigt/);
  assert.equal(db.rows.length, 1); assert.equal(writes(db).length, 1);
});
test('form and actor changes during the identity lookup cannot rewrite its captured payload', async () => {
  const input = form(), actor = options();
  const db = database([], { before: call => { if (call.mode === 'select') { input.firstName = 'Different'; input.street = 'Different'; actor.actorProfileId = id(99); } } });
  actor.newClientId = id(77);
  assert.equal((await api(db)(id(1), input, actor)).ok, true);
  assert.equal(db.rows[0].first_name, 'Anna'); assert.equal(db.rows[0].street, 'Straße');
  assert.equal(db.rows[0].updated_by, id(2)); assert.equal(db.rows[0].created_by, id(2));
});
test('a replaced SDK instance cannot receive the write after an old lookup', async () => {
  let current;
  const db = database([], { before: () => { current = database(); } }); current = db;
  assert.equal((await api(db, () => current)(id(1), form(), options({ newClientId: id(77) }))).ok, false);
  assert.equal(writes(db).length, 0); assert.equal(writes(current).length, 0);
});
test('a thrown lookup failure is handled without an unhandled autosave rejection', async () => {
  const db = database([], { before: () => { throw Error('Private transport details'); } });
  const result = await api(db)(id(1), form(), options({ newClientId: id(77) }));
  assert.equal(result.ok, false); assert.doesNotMatch(result.error, /Private transport/);
  assert.equal(writes(db).length, 0);
});
test('a thrown response after an actual insert remains unconfirmed and is never retried automatically', async () => {
  const db = database([], { after: call => { if (call.mode === 'rpc') throw Error('Lost response'); } });
  const result = await api(db)(id(1), form(), options({ newClientId: id(77) }));
  assert.equal(result.ok, false); assert.match(result.error, /nicht vollständig bestätigt/);
  assert.equal(db.rows.length, 1); assert.equal(writes(db).length, 1);
});


test('a reserved UUID is inserted exactly once and must be returned unchanged', async () => {
  const db = database();
  assert.deepEqual(await api(db)(id(1), form(), options({ newClientId: id(77) })), { ok: true, data: { id: id(77) } });
  assert.equal(writes(db)[0].args.p_proposed_client_id, id(77));
});
test('a first live write without a durable request id fails closed', async () => {
  const db = database();
  assert.equal((await api(db)(id(1), form(), options())).ok, false);
  assert.equal(writes(db).length, 0); assert.equal(db.rows.length, 0);
});
test('two independent exact first writes are resolved by the atomic server boundary', async () => {
  const db = database();
  const results = await Promise.all([
    api(db)(id(1), form(), options({ newClientId: id(77) })),
    api(db)(id(1), form(), options({ newClientId: id(78) })),
  ]);
  assert.equal(results.filter(result => result.ok).length, 1);
  assert.equal(results.filter(result => !result.ok).length, 1);
  assert.equal(db.rows.length, 1);
  assert.equal(db.calls.filter(call => call.mode === 'rpc').length, 2);
});
test('the server receipt returns the same client for the same request without another insert', async () => {
  const db = database();
  const args = { p_tenant_id: id(1), p_request_id: id(77), p_proposed_client_id: id(77),
    p_actor_profile_id: id(2), p_review_id:id(500),p_payload: { first_name: 'Anna', last_name: 'Meyer', date_of_birth: '1940-02-29' } };
  const first = await db.rpc('web_reserve_reviewed_client_intake_draft', args);
  const second = await db.rpc('web_reserve_reviewed_client_intake_draft', args);
  assert.equal(first.data.created, true); assert.equal(second.data.created, false);
  assert.equal(second.data.id, id(77)); assert.equal(db.rows.length, 1);
});
for (const opts of [{newClientId:'legacy'}, {newClientId:id(77),clientId:id(20)}]) test('an invalid or conflicting reserved id cannot reach a query', async () => {
  const db = database(); assert.equal((await api(db)(id(1),form(),options(opts))).ok,false); assert.equal(db.calls.length,0);
});
for (const behavior of ['denied','throws']) test(`a dispatch journal that ${behavior} prevents the native mutation`, async () => {
  const db=database(); const beforeWrite=async()=>{if(behavior==='throws')throw Error('storage');return false;};
  assert.equal((await api(db)(id(1),form(),options({newClientId:id(77),beforeWrite}))).ok,false); assert.equal(writes(db).length,0);
});
test('replacing the SDK while dispatch journaling awaits prevents the write',async()=>{
  const db=database(), other=database();let current=db;
  assert.equal((await api(db,()=>current)(id(1),form(),options({newClientId:id(77),beforeWrite:async()=>{current=other;return true;}}))).ok,false);
  assert.equal(writes(db).length+writes(other).length,0);
});
test('a lost response keeps the preallocated id available for a read-only exact recovery',async()=>{
  const db=database([], {after:(call,result)=>call.mode==='rpc'?{data:null,error:{message:'lost'}}:result});
  assert.equal((await api(db)(id(1),form(),options({newClientId:id(77),beforeWrite:async()=>true}))).ok,false);
  const before=writes(db).length;
  assert.deepEqual(await api(db,()=>db,'confirmClientIntakeDraft')(id(1),id(77),form(),id(2)),{ok:true,data:{id:id(77)}});
  assert.equal(writes(db).length,before); assert.equal(db.rows.length,1);
});
for(const change of [r=>{r.status='active';},r=>{r.tenant_id=id(9);},r=>{r.first_name='Else';},r=>{r.updated_by=id(3);},r=>{r.insurance_number='changed';}])test('a different native recovery original never confirms the dispatched draft',async()=>{
  const db=database();await api(db)(id(1),form(),options({newClientId:id(77)}));change(db.rows[0]);
  assert.equal((await api(db,()=>db,'confirmClientIntakeDraft')(id(1),id(77),form(),id(2))).ok,false);
  assert.equal(writes(db).length,1);
});
test('a missing draft does not turn read-only recovery into a fresh insert',async()=>{
  const db=database();assert.equal((await api(db,()=>db,'confirmClientIntakeDraft')(id(1),id(77),form(),id(2))).ok,false);assert.equal(writes(db).length,0);
});

for(const identityReview of [()=>null,()=>({id:id(500),requestId:id(99),tenantId:id(1),actorId:id(2),inputKey:'wrong',candidateCount:0,expiresAt:'2099-01-01T00:00:00Z'})])
test('a missing or unrelated server review never reaches the first reservation RPC',async()=>{
 const db=database();assert.equal((await api(db)(id(1),form(),options({newClientId:id(77),identityReview}))).ok,false);
 assert.equal(writes(db).length,0);assert.equal(db.rows.length,0);
});
test('the review port is read after the awaited dispatch guard has prepared its actual receipt',async()=>{
 const db=database(),input=form(),now=Date.now();let prepared=null;
 const result=await api(db)(id(1),input,options({newClientId:id(77),identityReview:()=>prepared,beforeWrite:async()=>{
  await Promise.resolve();prepared={id:id(501),requestId:id(77),tenantId:id(1),actorId:id(2),inputKey:JSON.stringify(['Anna','Meyer','1940-02-29','']),
   candidateCount:0,preparedAt:new Date(now).toISOString(),expiresAt:new Date(now+300000).toISOString()};return true;
 }}));assert.equal(result.ok,true);assert.equal(writes(db)[0].args.p_review_id,id(501));
});
for(const patch of [{identity_review_id:id(999)},{request_id:id(99)},{updated_at:'2026-10-15T05:10:00.123457+00:00'}])
test('a reservation acknowledgement must identify the same review, request and full native revision',async()=>{
 const db=database([],{after:(call,result)=>call.mode==='rpc'?{data:{...result.data,...patch},error:null}:result});
 const result=await api(db)(id(1),form(),options({newClientId:id(77)}));assert.equal(result.ok,false);assert.equal(result.identityReviewRejected,undefined);
});
for(const code of ['P0I01','P0I02','22023','42501'])test(`confirmed SQL rejection ${code} permits fresh review of the same reservation`,async()=>{
 const db=database([],{abortReply:()=>({data:null,error:{code}})});
 const result=await api(db)(id(1),form(),options({newClientId:id(77)}));assert.equal(result.ok,false);assert.equal(result.identityReviewRejected,true);
 assert.equal(db.rows.length,0);assert.equal(writes(db).length,1);
});
for(const response of [{data:null,error:{code:'08006'}},{data:null,error:{code:'PGRST000'}},{data:{id:id(77)},error:{code:'P0I02'}}])
test('transport errors and malformed mixed replies never establish a rolled-back transaction',async()=>{
 const db=database([],{abortReply:()=>response});const result=await api(db)(id(1),form(),options({newClientId:id(77)}));
 assert.equal(result.ok,false);assert.equal(result.identityReviewRejected,undefined);assert.equal(writes(db).length,1);
});
test('first-write recovery confirms both native row and consumed server decision without another insertion',async()=>{
 const db=database([],{after:(call,result)=>call.name==='web_reserve_reviewed_client_intake_draft'?{data:null,error:{code:'08006'}}:result});
 assert.equal((await api(db)(id(1),form(),options({newClientId:id(77)}))).ok,false);
 assert.equal((await api(db,()=>db,'confirmClientIntakeDraft')(id(1),id(77),form(),id(2),{requireDecisionReceipt:true,identityReviewId:id(500)})).ok,true);
 assert.equal(writes(db).length,1);assert.equal(db.rows.length,1);assert.equal(db.calls.at(-1).name,'web_confirm_reviewed_client_intake_draft');
});
for(const change of ['missing-receipt','wrong-review','changed-row','changed-payload'])test(`a ${change} never confirms an unknown first intake`,async()=>{
 const db=database();await api(db)(id(1),form(),options({newClientId:id(77)}));
 if(change==='missing-receipt')db.receipts.clear();if(change==='changed-row')db.rows[0].updated_at='2026-10-15T05:10:00.123457+00:00';
 const input=form(change==='changed-payload'?{specialNotes:'Changed'}:{});
 const result=await api(db,()=>db,'confirmClientIntakeDraft')(id(1),id(77),input,id(2),{requireDecisionReceipt:true,identityReviewId:change==='wrong-review'?id(999):id(500)});
 assert.equal(result.ok,false);assert.equal(writes(db).length,1);assert.equal(db.rows.length,1);
});
test('a legacy first-write journal without a decision receipt cannot turn a matching row into confirmation',async()=>{
 const db=database();await api(db)(id(1),form(),options({newClientId:id(77)}));const before=db.calls.length;
 assert.equal((await api(db,()=>db,'confirmClientIntakeDraft')(id(1),id(77),form(),id(2),{requireDecisionReceipt:true,identityReviewId:null})).ok,false);
 assert.equal(db.calls.length,before);
});

const revocation=patch=>({id:id(77),request_id:id(77),identity_review_id:id(500),tenant_id:id(1),actor_profile_id:id(2),
 created:false,disposition:'review_revoked',revoked_at:time,...patch});
test('only a complete native revocation acknowledgement permits another explicit review of the same reserved id',async()=>{
 const db=database([],{abortReply:()=>({data:revocation(),error:null})});
 const result=await api(db,()=>db,'confirmClientIntakeDraft')(id(1),id(77),form(),id(2),{requireDecisionReceipt:true,identityReviewId:id(500)});
 assert.deepEqual(result,{ok:true,data:{id:id(77),reviewRevoked:true}});assert.equal(db.rows.length,0);assert.equal(writes(db).length,0);
});
for(const patch of [{tenant_id:id(9)},{actor_profile_id:id(9)},{identity_review_id:id(999)},{revoked_at:'invalid'},{row:null},{created:true}])
test('incomplete, foreign or mixed revocation data cannot authorize any retry',async()=>{
 const db=database([],{abortReply:()=>({data:revocation(patch),error:null})});
 const result=await api(db,()=>db,'confirmClientIntakeDraft')(id(1),id(77),form(),id(2),{requireDecisionReceipt:true,identityReviewId:id(500)});
 assert.equal(result.ok,false);assert.equal(writes(db).length,0);
});
