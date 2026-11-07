import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

const root=new URL('../..',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const asModule=s=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(s,{mode:'strip'})).toString('base64');
const scopeUrl=new URL('src/lib/portal/employeePortalClientScope.ts',root).href;
const bridgeUrl=asModule(read('src/lib/assist/assignmentStatusBridge.ts'));
const id=n=>`00000000-7777-4777-8777-${String(n).padStart(12,'0')}`;
const tenant=id(1),employee=id(2),clientId=id(3),otherClient=id(4);
const visit=(patch={})=>({id:id(10),tenant_id:tenant,client_id:clientId,employee_id:employee,employee_portal_visible:true,planning_status:'published',planned_start_at:'2026-10-14T08:00:00.123456Z',canonical_status:'started',client_visible_notes:'Nur eigener sichtbarer Einsatzhinweis',title:'Eigener sichtbarer Einsatz',...patch});
const client=(patch={})=>({id:clientId,tenant_id:tenant,status:'active',deleted_at:null,first_name:'Synthetic',last_name:'Own client',street:'Own street',postal_code:'12345',city:'Own city',care_level:'2',phone:'own-phone',mobile:null,date_of_birth:null,key_management_notes:null,doorbell_name:null,...patch});
const contact=(patch={})=>({id:id(40),tenant_id:tenant,client_id:clientId,full_name:'Synthetic primary contact',phone:'own-primary-phone',mobile:null,relationship:'Synthetic relationship',is_primary_contact:true,is_emergency_contact:false,...patch});
let sequence=0;
async function harness(options={}){
 const key=`__employeeClientWeb${sequence++}`,calls=[],documentCalls=[];
 const state={tables:{assist_visits:[visit()],clients:[client()],client_contacts:[],client_addresses:[],...options.tables},errors:{...options.errors},caps:{...options.caps},bypass:new Set(options.bypass??[]),raw:{...options.raw},documents:options.documents??{ok:true,data:[]},onQuery:options.onQuery,onDocuments:options.onDocuments};
 const db={};
 function from(_db,table){
  const filters=[],queryCalls=[],orderings=[];let start=0,end=Infinity;
  const q={
   select(fields){queryCalls.push(['select',fields]);return q;},
   eq(k,v){queryCalls.push(['eq',k,v]);filters.push(r=>r[k]===v);return q;},
   neq(k,v){queryCalls.push(['neq',k,v]);filters.push(r=>r[k]!==v&&r[k]!==null&&r[k]!==undefined);return q;},
   is(k,v){queryCalls.push(['is',k,v]);filters.push(r=>r[k]===v);return q;},
   not(k,op,v){queryCalls.push(['not',k,op,v]);assert.equal(op,'is');filters.push(r=>r[k]!==v);return q;},
   or(expression){queryCalls.push(['or',expression]);assert.equal(expression,'is_primary_contact.eq.true,is_emergency_contact.eq.true');filters.push(r=>r.is_primary_contact===true||r.is_emergency_contact===true);return q;},
   order(k,o){queryCalls.push(['order',k,o]);orderings.push([k,o.ascending]);return q;},
   range(a,b){queryCalls.push(['range',a,b]);start=a;end=b;return q;},
   limit(n){queryCalls.push(['limit',n]);end=n-1;return q;},
   async then(resolve,reject){
    const call={table,operations:structuredClone(queryCalls)};calls.push(call);await state.onQuery?.(call,state,calls);
    let data;
    if(Object.hasOwn(state.raw,table))data=structuredClone(state.raw[table]);
    else{
     data=(state.tables[table]??[]).filter(row=>state.bypass.has(table)||filters.every(f=>f(row)));
     data=[...data].sort((a,b)=>{for(const [field,asc] of orderings){if(a[field]===b[field])continue;const n=a[field]<b[field]?-1:1;return asc?n:-n;}return 0;});
     data=data.slice(start,Math.min(end+1,start+(state.caps[table]??Infinity)));
    }
    return Promise.resolve({data,error:state.errors[table]??null}).then(resolve,reject);
   },
  };return q;
 }
 globalThis[key]={db,from,documents:async(t,c)=>{documentCalls.push([t,c]);await state.onDocuments?.(state);return structuredClone(state.documents);}};
 let source=read('src/lib/portal/employeePortalClientRecordsService.ts');
 const dependency={
  "@/lib/assist/assignmentStatusBridge":`export {remoteStatusToAssignment} from '${bridgeUrl}';`,
  "@/lib/formatters/unitFormatters":"export const formatCareLevel=value=>'Pflegegrad '+value;",
  "@/lib/formatters/dateTimeFormatters":"export const formatDate=value=>value;",
  "@/lib/supabase/client":`export const getSupabaseClient=()=>globalThis['${key}'].db;`,
  "@/lib/supabase/untypedTable":`export const fromUnknownTable=(...args)=>globalThis['${key}'].from(...args);`,
  "@/lib/supabase/errors":"export const toGermanSupabaseError=error=>String(error.message??'Native query failed');",
  "@/lib/services/serviceRunner":"export async function runService(action){try{return await action();}catch{return {ok:false,error:'Unexpected service failure'};}}",
  "@/lib/services/errors":"export const SERVICE_ERRORS={supabaseUnavailable:'SDK unavailable'};",
  "@/lib/portal/portalVisibilityService":"export const sanitizeEmployeePortalPayload=value=>value;",
  "@/lib/portal/portalDocumentsLiveService":`export const fetchEmployeePortalClientDocuments=(...args)=>globalThis['${key}'].documents(...args);`,
  "@/types/portal/documents":"export const PORTAL_DOCUMENT_CATEGORY_LABELS={};",
 };
 for(const [path,module] of Object.entries(dependency))source=source.replaceAll(`from '${path}'`,`from '${asModule(module)}'`);
 source=source.replace("from './employeePortalClientScope'",`from '${scopeUrl}'`);
 const api=await import(asModule(source));
 return {calls,documentCalls,state,list:(t=tenant,e=employee)=>api.fetchEmployeePortalClientRecords(t,e),detail:(t=tenant,e=employee,c=clientId)=>api.fetchEmployeePortalClientRecordDetail(t,e,c),close:()=>delete globalThis[key]};
}
async function run(options,action){const h=await harness(options);try{await action(h);}finally{h.close();}}
const tableCalls=(h,table)=>h.calls.filter(c=>c.table===table);

test('active tenant records are listed regardless of own, team, hidden or missing visits', () => run({
  tables: {
    clients: [
      client(), client({ id: otherClient }), client({ id: id(5) }), client({ id: id(6) }),
      client({ id: id(7), status: 'lead' }),
      client({ id: id(8), tenant_id: id(99) }),
      client({ id: id(9), deleted_at: '2026-01-01' }),
    ],
    assist_visits: [
      visit(),
      visit({ id: id(11), client_id: otherClient, employee_id: id(50) }),
      visit({ id: id(12), client_id: id(5), employee_portal_visible: false }),
      visit({ id: id(13), client_id: id(5), planning_status: 'draft' }),
      visit({ id: id(14), client_id: null }),
    ],
  },
}, async h => {
  const result = await h.list();
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.map(row => row.clientId), [clientId, otherClient, id(5), id(6)]);
  assert.equal(result.data[0].hints, 'Nur eigener sichtbarer Einsatzhinweis');
  for (const row of result.data.slice(1)) {
    assert.equal(row.hints, null);
    assert.equal(row.activeAssignmentCount, 0);
  }
  for (const query of tableCalls(h, 'clients')) {
    assert.ok(query.operations.some(op => op[0] === 'eq' && op[1] === 'tenant_id' && op[2] === tenant));
    assert.ok(query.operations.some(op => op[0] === 'eq' && op[1] === 'status' && op[2] === 'active'));
    assert.ok(query.operations.some(op => op[0] === 'is' && op[1] === 'deleted_at' && op[2] === null));
  }
  for (const query of tableCalls(h, 'assist_visits')) {
    assert.ok(query.operations.some(op => op[0] === 'eq' && op[1] === 'employee_id' && op[2] === employee));
    assert.ok(query.operations.some(op => op[0] === 'eq' && op[1] === 'employee_portal_visible' && op[2] === true));
    assert.ok(query.operations.some(op => op[0] === 'neq' && op[1] === 'planning_status' && op[2] === 'draft'));
  }
}));

for (const [label, patch] of [
  ['foreign employee', { employee_id: id(50) }],
  ['foreign tenant', { tenant_id: id(50) }],
  ['different client', { client_id: otherClient }],
  ['hidden visit', { employee_portal_visible: false }],
  ['draft', { planning_status: 'draft' }],
  ['blank planning status', { planning_status: '' }],
  ['invalid time', { planned_start_at: 'later' }],
]) {
  test(`invalid history payload (${label}) is discarded without blocking the record`, () => run({
    bypass: ['assist_visits'],
    tables: { assist_visits: [visit(patch)] },
  }, async h => {
    const result = await h.detail();
    assert.equal(result.ok, true);
    assert.deepEqual(result.data.assignmentHistory, []);
    assert.match(result.data.assignmentHistoryError, /Einsatzdaten/);
    assert.deepEqual(h.documentCalls, []);
  }));
}

for (const payload of [null, { rows: [] }, [null], [visit(), visit()]]) {
  test('invalid or duplicated visit payload leaves the active directory usable', () => run({
    ...(Array.isArray(payload) && payload.length === 2
      ? { tables: { assist_visits: payload } }
      : { raw: { assist_visits: payload } }),
  }, async h => {
    const result = await h.list();
    assert.equal(result.ok, true);
    assert.equal(result.data[0].clientId, clientId);
    assert.equal(result.data[0].hints, null);
  }));
}

for (const [label, patch] of [
  ['wrong tenant', { tenant_id: id(9) }],
  ['inactive client', { status: 'paused' }],
  ['deleted client', { deleted_at: '2026-01-01T00:00:00Z' }],
  ['missing deleted marker', { deleted_at: undefined }],
]) {
  test(`directory rejects unexpected ${label} metadata`, () => run({
    bypass: ['clients'], tables: { clients: [client(patch)] },
  }, async h => assert.equal((await h.list()).ok, false)));
}

test('duplicate client metadata is rejected', () => run({
  tables: { clients: [client(), client()] },
}, async h => assert.equal((await h.list()).ok, false)));

test('a paused client is not reintroduced by an old visit', () => run({
  tables: { clients: [client({ status: 'paused' })] },
}, async h => assert.deepEqual(await h.list(), { ok: true, data: [] })));

test('pagination continues after short server-capped pages', () => run({
  caps: { assist_visits: 2, clients: 1 },
  tables: {
    assist_visits: [visit(), visit({ id: id(11), client_id: otherClient }), visit({ id: id(12), client_id: id(5) })],
    clients: [client(), client({ id: otherClient }), client({ id: id(5) })],
  },
}, async h => {
  const result = await h.list();
  assert.equal(result.ok, true);
  assert.equal(result.data.length, 3);
  assert.ok(tableCalls(h, 'assist_visits').some(q => q.operations.some(op => op[0] === 'range' && op[1] === 2)));
  assert.ok(tableCalls(h, 'clients').some(q => q.operations.some(op => op[0] === 'range' && op[1] === 3)));
}));

test('Office still loads visit metadata for the selected employee', () => run({
  tables: { assist_visits: [visit({ employee_id: id(8) })] },
}, async h => {
  const result = await h.list(tenant, id(8));
  assert.equal(result.ok, true);
  assert.equal(result.data[0].activeAssignmentCount, 1);
  assert.ok(tableCalls(h, 'assist_visits').every(q => q.operations.some(op => op[0] === 'eq' && op[1] === 'employee_id' && op[2] === id(8))));
}));

test('direct detail lookup opens a client without a visit and loads primary contacts', () => run({
  tables: {
    assist_visits: [],
    clients: [client(), client({ id: otherClient })],
    client_contacts: [contact({ client_id: otherClient })],
  },
}, async h => {
  const result = await h.detail(tenant, employee, otherClient);
  assert.equal(result.ok, true);
  assert.equal(result.data.clientId, otherClient);
  assert.deepEqual(result.data.assignmentHistory, []);
  assert.equal(result.data.contacts[0].phone, 'own-primary-phone');
  assert.deepEqual(h.documentCalls, []);
  assert.ok(tableCalls(h, 'clients').every(q => q.operations.some(op => op[0] === 'eq' && op[1] === 'id' && op[2] === otherClient)));
}));

test('absent detail returns null before any child queries', () => run({}, async h => {
  assert.deepEqual(await h.detail(tenant, employee, otherClient), { ok: true, data: null });
  assert.ok(h.calls.every(call => call.table === 'clients'));
  assert.deepEqual(h.documentCalls, []);
}));

test('detail rejects an unexpected client ID before child queries', () => run({
  bypass: ['clients'],
}, async h => {
  assert.equal((await h.detail(tenant, employee, otherClient)).ok, false);
  assert.ok(h.calls.every(call => call.table === 'clients'));
}));

test('client metadata failure returns no records inferred from visits', () => run({
  errors: { clients: { message: 'Client records denied' } },
}, async h => {
  assert.deepEqual(await h.list(), { ok: false, error: 'Client records denied' });
}));

test('primary/emergency contacts are filtered both on server and on returned data',()=>run({bypass:['client_contacts'],tables:{client_contacts:[contact(),contact({id:id(41),is_primary_contact:false,is_emergency_contact:true,phone:'own-emergency-phone'}),contact({id:id(42),is_primary_contact:false,phone:'must-not-return'}),contact({id:id(43),is_primary_contact:'true',is_emergency_contact:1,phone:'boolean-coercion-must-not-return'})]}},async h=>{const r=await h.detail();assert.equal(r.ok,true);assert.deepEqual(r.data.contacts.map(c=>c.phone).sort(),['own-emergency-phone','own-primary-phone']);for(const q of tableCalls(h,'client_contacts')){assert.ok(q.operations.some(o=>o[0]==='eq'&&o[1]==='client_id'&&o[2]===clientId));assert.ok(q.operations.some(o=>o[0]==='or'));}}));
for(const [name,patch] of [['foreign tenant',{tenant_id:id(9)}],['foreign client',{client_id:otherClient}],['invalid native ID',{id:'contact label'}]])test(`detail contains no contacts from ${name} payload and reports the failed contact scope`,()=>run({bypass:['client_contacts'],tables:{client_contacts:[contact(patch)]}},async h=>{const r=await h.detail();assert.equal(r.ok,true);assert.deepEqual(r.data.contacts,[]);assert.match(r.data.contactsError,/Mandanten/);}));
test('foreign address response is rejected and the detail stays readable',()=>run({bypass:['client_addresses'],tables:{client_addresses:[{id:id(50),tenant_id:tenant,client_id:otherClient,access_notes:'foreign secret'}]}},async h=>{const r=await h.detail();assert.equal(r.ok,true);assert.equal(r.data.accessHint,null);assert.match(r.data.accessError,/Mandanten/);}));
test('failed address query ignores accompanying payload and retains explicit partial read error',()=>run({errors:{client_addresses:{message:'Address read denied'}},tables:{client_addresses:[{id:id(50),tenant_id:tenant,client_id:clientId,access_notes:'must not show failed-query data'}]}},async h=>{const r=await h.detail();assert.equal(r.ok,true);assert.equal(r.data.accessHint,null);assert.equal(r.data.accessError,'Address read denied');}));
test('document and contact failures remain explicit rather than resembling empty successful reads',()=>run({errors:{client_contacts:{message:'Contacts denied'}},documents:{ok:false,error:'Documents denied'}},async h=>{const r=await h.detail();assert.equal(r.ok,true);assert.equal(r.data.contactsError,'Contacts denied');assert.equal(r.data.documentsError,'Documents denied');assert.deepEqual(r.data.portalDocuments,[]);}));
for(const [t,e,c] of [['',employee,clientId],[tenant,'',clientId],[tenant,employee,'display-label']])test(`invalid detail identity fails before reads: ${t}/${e}/${c}`,()=>run({},async h=>{assert.equal((await h.detail(t,e,c)).ok,false);assert.equal(h.calls.length,0);}));
