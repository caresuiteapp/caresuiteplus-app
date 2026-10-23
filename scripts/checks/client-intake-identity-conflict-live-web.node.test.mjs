import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';
import { currentIntakeValidation } from './helpers/current-intake-validation.mjs';
import { isUuid } from '../../src/lib/validation/uuid.ts';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const form = (patch = {}) => ({
  firstName: ' Anna ',
  lastName: 'Meyer',
  dateOfBirth: '1940-02-29',
  insuranceNumber: ' A123456789 ',
  assignedModules: [],
  ...patch,
});

function repository(db) {
  const source = strip(read('src/lib/clients/repositories/clientIntakeRepository.supabase.ts')
    .replace(/^import[\s\S]*?;\n/gm, '')
    .replace(/\bexport /g, ''));
  const deps = {
    getSupabaseClient: () => db,
    toGermanSupabaseError: (error) => error?.message ?? 'Datenbankfehler',
    SERVICE_ERRORS: { supabaseUnavailable: 'Kein SDK' },
    isUuid: (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value),
    normalizeIntakeCareLevelForDb: (value) => value || null,
    resolvePrimaryCostBearerName: () => null,
    resolveIntakeBillingProfileType: () => null,
    workflowStatusToRemote: (value) => value,
    fromUnknownTable: () => { throw new Error('Nicht Teil dieser Prüfung'); },
    isCostBearerTypeKey: () => false,
  };
  return new Function(
    ...Object.keys(deps),
    `${source}; return { findExactClientIdentityConflictFromIntake, createClientFromIntake };`,
  )(...Object.values(deps));
}

function database(rows = [], options = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      assert.equal(table, 'clients');
      const filters = [];
      let limit = Infinity;
      const query = {
        select(columns) { assert.equal(columns, 'id'); return query; },
        eq(field, value) { filters.push(['eq', field, value]); return query; },
        neq(field, value) { filters.push(['neq', field, value]); return query; },
        ilike(field, value) { filters.push(['ilike', field, value]); return query; },
        limit(value) { limit = value; return query; },
        then(resolve, reject) {
          calls.push(structuredClone(filters));
          if (options.failAt === calls.length) {
            return Promise.resolve({ data: null, error: { message: 'RLS-Prüfung fehlgeschlagen' } }).then(resolve, reject);
          }
          const data = rows.filter((row) => filters.every(([kind, field, value]) => {
            if (kind === 'eq') return row[field] === value;
            if (kind === 'neq') return row[field] !== value;
            const literal = value.replace(/\\([\\%_])/g, '$1').toLocaleLowerCase('de-DE');
            return String(row[field] ?? '').toLocaleLowerCase('de-DE') === literal;
          })).slice(0, limit).map((row) => ({ id: row.id }));
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

test('exact tenant-scoped name and birth date blocks a second native identity', async () => {
  const db = database([{ id: id(20), tenant_id: id(1), first_name: 'anna', last_name: 'MEYER', date_of_birth: '1940-02-29', insurance_number: null }]);
  const result = await repository(db).findExactClientIdentityConflictFromIntake(id(1), form());
  assert.deepEqual(result, { ok: true, data: { clientId: id(20), match: 'name_birth_date' } });
  assert.equal(db.calls.length, 1);
  assert.ok(db.calls[0].some(([, field, value]) => field === 'tenant_id' && value === id(1)));
});

test('exact insurance number blocks after the name and birth date check', async () => {
  const db = database([{ id: id(21), tenant_id: id(1), first_name: 'Else', last_name: 'Schulz', date_of_birth: '1939-01-01', insurance_number: 'a123456789' }]);
  const result = await repository(db).findExactClientIdentityConflictFromIntake(id(1), form());
  assert.deepEqual(result, { ok: true, data: { clientId: id(21), match: 'insurance_number' } });
  assert.equal(db.calls.length, 2);
});

test('same identity in another tenant is never selected', async () => {
  const db = database([{ id: id(22), tenant_id: id(9), first_name: 'Anna', last_name: 'Meyer', date_of_birth: '1940-02-29', insurance_number: 'A123456789' }]);
  const result = await repository(db).findExactClientIdentityConflictFromIntake(id(1), form());
  assert.deepEqual(result, { ok: true, data: null });
});

test('the current recoverable draft is excluded but another duplicate remains blocking', async () => {
  const draft = id(30);
  const rows = [
    { id: draft, tenant_id: id(1), first_name: 'Anna', last_name: 'Meyer', date_of_birth: '1940-02-29', insurance_number: 'A123456789' },
    { id: id(31), tenant_id: id(1), first_name: 'Anna', last_name: 'Meyer', date_of_birth: '1940-02-29', insurance_number: null },
  ];
  const db = database(rows);
  const result = await repository(db).findExactClientIdentityConflictFromIntake(id(1), form(), draft);
  assert.deepEqual(result, { ok: true, data: { clientId: id(31), match: 'name_birth_date' } });
  assert.ok(db.calls[0].some(([kind, field, value]) => kind === 'neq' && field === 'id' && value === draft));
});

test('missing identity input and lookup failure both fail closed', async () => {
  const db = database([], { failAt: 1 });
  const api = repository(db);
  assert.deepEqual(await api.findExactClientIdentityConflictFromIntake(id(1), form({ firstName: ' ' })), {
    ok: false,
    error: 'Die Identitätsprüfung benötigt Mandant, Name und Geburtsdatum.',
  });
  assert.deepEqual(await api.findExactClientIdentityConflictFromIntake(id(1), form()), {
    ok: false,
    error: 'RLS-Prüfung fehlgeschlagen',
  });
  const malformed = repository(database([{ id: 'legacy-row', tenant_id: id(1), first_name: 'Anna', last_name: 'Meyer', date_of_birth: '1940-02-29', insurance_number: null }]));
  assert.deepEqual(await malformed.findExactClientIdentityConflictFromIntake(id(1), form()), {
    ok: false,
    error: 'Die Identitätsprüfung lieferte keine gültige native Personenkennung.',
  });
});

function submitClientIntake(deps) {
  const source = read('src/lib/clients/clientIntakeService.ts');
  const body = strip(source.slice(
    source.indexOf('export async function submitClientIntake('),
    source.indexOf('export async function submitClientIntakeUpdate('),
  ).replace(/\bexport /g, ''));
  return new Function(...Object.keys(deps), `${body}; return submitClientIntake;`)(...Object.values(deps));
}

const moduleBody=path=>strip(read(path).replace(/^import[\s\S]*?;\n/gm,'').replace(/\bexport /g,''));
const empty=new Function(`${moduleBody('src/types/forms/clientIntakeForm.ts')};return EMPTY_CLIENT_INTAKE_FORM;`)();
const rules=new Function(`${moduleBody('src/lib/clients/clientIntakeFieldRules.ts')};return {getVisibleSectionsForClientContext};`)();
const getIntakeSectionsForForm=new Function(...Object.keys(rules),`${moduleBody('src/lib/clients/clientIntakePlan.ts')};return getIntakeSectionsForForm;`)(...Object.values(rules));
const completeForm=patch=>({...structuredClone(empty),firstName:'Anna',lastName:'Meyer',dateOfBirth:'1940-02-29',
 careContexts:['daily_assistance'],intakeWorkflowVersion:2,serviceStart:'2026-10-22',street:'Testweg',houseNumber:'1',zip:'12345',city:'Testort',phone:'0123456',
 fundingSources:['selbstzahler'],billingTypes:['privat'],supportWishes:['Haushalt'],intakeContractType:'assist',intakeAssignmentEnabled:false,
 intakeDocuments:[['privacy_consent_default','privacy_consent'],['client_contract_assist','client_contract']].map(([templateKey,documentType])=>({templateKey,documentType,title:templateKey,status:'finalized',missingPlaceholders:[],signatures:{client:{dataUrl:'data:image/png;base64,YWJj'},employee:{dataUrl:'data:image/png;base64,YWJj'},legal_representative:{dataUrl:'data:image/png;base64,YWJj'}}})),...patch});
const completionReceipt=(patch={})=>({ok:true,data:{contract:'client-intake-completion-v1',clientId:id(40),revision:7,status:'active',confirmed:true,replayed:false,...patch}});
function serviceHarness(options={}) {
 const calls=[];
 const db={from(){throw Error('Server completion must not fall back to client-side creation or activation');},functions:{async invoke(name,args){calls.push({name,args:structuredClone(args)});return options.response??{data:completionReceipt(),error:null};}}};
 const submit=submitClientIntake({enforcePermission:()=>options.denied??null,runService:operation=>operation(),isDemoClientBackend:()=>false,
  getIntakeSectionsForForm,validateIntakeStep:currentIntakeValidation.validateIntakeStep,isUuid,getSupabaseClient:()=>options.noSdk?null:db});
 return{calls,submit:(form=completeForm(),patch={})=>submit(id(1),form,{actorProfileId:id(2),actorRoleKey:'business_admin',draftClientId:id(40),expectedRevision:7,...patch})};
}

test('actual active intake uses the single server completion endpoint for the exact already-persisted draft revision',async()=>{
 const h=serviceHarness();assert.deepEqual(await h.submit(),{ok:true,data:{id:id(40)}});
 assert.deepEqual(h.calls,[{name:'complete-client-intake',args:{body:{tenantId:id(1),clientId:id(40),expectedRevision:7}}}]);
});
test('current actual validation rejects incomplete intake before the completion transport',async()=>{
 const h=serviceHarness(),result=await h.submit(completeForm({firstName:'',intakeDocuments:[]}));
 assert.equal(result.ok,false);assert.equal(result.recoverableClientId,id(40));assert.match(result.error,/Vorname/);assert.match(result.error,/Datenschutz/);assert.equal(h.calls.length,0);
});
for(const patch of [{draftClientId:undefined},{draftClientId:'invalid'},{expectedRevision:undefined},{expectedRevision:0},{expectedRevision:-1},{expectedRevision:1.5},{expectedRevision:'7'}])
 test(`missing persisted draft/revision ${JSON.stringify(patch)} never falls back to local creation`,async()=>{const h=serviceHarness(),result=await h.submit(completeForm(),patch);assert.equal(result.ok,false);assert.equal(h.calls.length,0);assert.match(result.error,/zuerst auf dem Server/);});
for(const replayed of [false,true])test(`exact server completion receipt replayed=${replayed} confirms the same persisted identity`,async()=>{
 const h=serviceHarness({response:{data:completionReceipt({replayed}),error:null}});assert.deepEqual(await h.submit(),{ok:true,data:{id:id(40)}});assert.equal(h.calls.length,1);
});
for(const patch of [{contract:'other'},{clientId:id(41)},{revision:8},{revision:'7'},{status:'draft'},{confirmed:false},{replayed:'true'},{replayed:undefined}])
 test(`foreign/malformed completion receipt ${JSON.stringify(patch)} retains the same recoverable draft`,async()=>{const h=serviceHarness({response:{data:completionReceipt(patch),error:null}}),result=await h.submit();assert.equal(result.ok,false);assert.equal(result.recoverableClientId,id(40));assert.equal(h.calls.length,1);});
test('server identity conflict is propagated from atomic completion without another client mutation',async()=>{
 const h=serviceHarness({response:{data:null,error:{context:{status:409,clone:()=>({json:async()=>({error:'Die Identitätsprüfung hat eine vorhandene Person erkannt.'})})}}}});
 assert.deepEqual(await h.submit(),{ok:false,error:'Die Identitätsprüfung hat eine vorhandene Person erkannt.',recoverableClientId:id(40),conflict:true});assert.equal(h.calls.length,1);
});
test('server denial without readable response retains the draft and never reports successful activation',async()=>{
 const h=serviceHarness({response:{data:null,error:{context:{status:403,clone:()=>({json:async()=>{throw Error('unreadable');}})}}}}),result=await h.submit();
 assert.equal(result.ok,false);assert.equal(result.recoverableClientId,id(40));assert.equal(result.conflict,false);assert.match(result.error,/nicht bestätigt/);assert.equal(h.calls.length,1);
});
test('missing SDK and denied create permission cannot invoke atomic completion',async()=>{
 const absent=serviceHarness({noSdk:true});assert.equal((await absent.submit()).ok,false);assert.equal(absent.calls.length,0);
 const denied=serviceHarness({denied:{ok:false,error:'Create denied'}});assert.deepEqual(await denied.submit(),{ok:false,error:'Create denied'});assert.equal(denied.calls.length,0);
});
