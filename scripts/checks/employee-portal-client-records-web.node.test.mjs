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
const appointment=(patch={})=>({id:id(10),employeeId:employee,clientId,title:'Eigener Einsatz',startsAt:'2026-10-14T08:00:00.123456Z',status:'aktiv',assignmentStatus:'gestartet',...patch});
const contact=(patch={})=>({id:id(40),tenant_id:tenant,client_id:clientId,full_name:'Synthetic primary contact',phone:'own-primary-phone',mobile:null,relationship:'Synthetic relationship',is_primary_contact:true,is_emergency_contact:false,...patch});
let sequence=0;
async function harness(options={}){
 const key=`__employeeClientWeb${sequence++}`,calls=[],appointmentCalls=[],documentCalls=[];
 const state={tables:{assist_visits:[visit()],clients:[client()],client_contacts:[],client_addresses:[],...options.tables},errors:{...options.errors},caps:{...options.caps},bypass:new Set(options.bypass??[]),raw:{...options.raw},appointments:options.appointments??{ok:true,data:[appointment()]},documents:options.documents??{ok:true,data:[]},onQuery:options.onQuery,onAppointments:options.onAppointments,onDocuments:options.onDocuments};
 const db={};
 function from(_db,table){
  const filters=[],queryCalls=[],orderings=[];let start=0,end=Infinity;
  const q={
   select(fields){queryCalls.push(['select',fields]);return q;},
   eq(k,v){queryCalls.push(['eq',k,v]);filters.push(r=>r[k]===v);return q;},
   neq(k,v){queryCalls.push(['neq',k,v]);filters.push(r=>r[k]!==v&&r[k]!==null&&r[k]!==undefined);return q;},
   is(k,v){queryCalls.push(['is',k,v]);filters.push(r=>r[k]===v);return q;},
   in(k,values){queryCalls.push(['in',k,[...values]]);filters.push(r=>values.includes(r[k]));return q;},
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
 globalThis[key]={db,from,appointments:async(t,e)=>{appointmentCalls.push([t,e]);await state.onAppointments?.(state);return structuredClone(state.appointments);},documents:async(t,c)=>{documentCalls.push([t,c]);await state.onDocuments?.(state);return structuredClone(state.documents);}};
 let source=read('src/lib/portal/employeePortalClientRecordsService.web.ts');
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
  "@/lib/portal/portalAppointmentsLiveService":`export const fetchLivePortalAppointmentsForEmployee=(...args)=>globalThis['${key}'].appointments(...args);`,
  "@/lib/portal/portalDocumentsLiveService":`export const fetchEmployeePortalClientDocuments=(...args)=>globalThis['${key}'].documents(...args);`,
  "@/types/portal/documents":"export const PORTAL_DOCUMENT_CATEGORY_LABELS={};",
 };
 for(const [path,module] of Object.entries(dependency))source=source.replaceAll(`from '${path}'`,`from '${asModule(module)}'`);
 source=source.replace("from './employeePortalClientScope'",`from '${scopeUrl}'`);
 const api=await import(asModule(source));
 return {calls,appointmentCalls,documentCalls,state,list:(t=tenant,e=employee)=>api.fetchEmployeePortalClientRecords(t,e),detail:(t=tenant,e=employee,c=clientId)=>api.fetchEmployeePortalClientRecordDetail(t,e,c),close:()=>delete globalThis[key]};
}
async function run(options,action){const h=await harness(options);try{await action(h);}finally{h.close();}}
const tableCalls=(h,table)=>h.calls.filter(c=>c.table===table);

test('Web list derives only own visible non-draft client IDs and sends those filters to server',()=>run({tables:{assist_visits:[visit(),visit({id:id(11),client_id:otherClient,employee_portal_visible:false}),visit({id:id(12),client_id:id(5),employee_id:id(6)}),visit({id:id(13),client_id:id(7),planning_status:'draft'})],clients:[client(),client({id:otherClient,phone:'hidden-phone'}),client({id:id(5)}),client({id:id(7)})]}},async h=>{
 const result=await h.list();assert.equal(result.ok,true);assert.deepEqual(result.data.map(r=>r.clientId),[clientId]);assert.equal(result.data[0].hints,'Nur eigener sichtbarer Einsatzhinweis');assert.equal(result.data[0].activeAssignmentCount,1);
 for(const q of tableCalls(h,'assist_visits')){assert.ok(q.operations.some(x=>x[0]==='eq'&&x[1]==='employee_id'&&x[2]===employee));assert.ok(q.operations.some(x=>x[0]==='eq'&&x[1]==='employee_portal_visible'&&x[2]===true));assert.ok(q.operations.some(x=>x[0]==='neq'&&x[1]==='planning_status'&&x[2]==='draft'));}
 for(const q of tableCalls(h,'clients'))assert.deepEqual(q.operations.find(x=>x[0]==='in'&&x[1]==='id')[2],[clientId]);assert.deepEqual(h.appointmentCalls,[]);
}));
test('without own visible assignments no tenant client query or appointment fallback runs',()=>run({tables:{assist_visits:[],clients:[client(),client({id:otherClient})]}},async h=>{assert.deepEqual(await h.list(),{ok:true,data:[]});assert.equal(tableCalls(h,'clients').length,0);assert.deepEqual(h.appointmentCalls,[]);}));
for(const [name,patch] of [['foreign tenant',{tenant_id:id(9)}],['other employee',{employee_id:id(9)}],['hidden',{employee_portal_visible:false}],['draft',{planning_status:'draft'}],['bad client ID',{client_id:'display-label'}],['invalid time',{planned_start_at:'later'}]])test(`native ${name} row invalidates whole snapshot before client query`,()=>run({bypass:['assist_visits'],tables:{assist_visits:[visit(),visit({id:id(11),...patch})]}},async h=>{const r=await h.list();assert.equal(r.ok,false);assert.equal('data' in r,false);assert.equal(tableCalls(h,'clients').length,0);assert.deepEqual(h.appointmentCalls,[]);}));
test('duplicate native assignment IDs fail closed',()=>run({tables:{assist_visits:[visit(),visit()]}},async h=>{assert.equal((await h.list()).ok,false);assert.equal(tableCalls(h,'clients').length,0);}));
for(const raw of [null,{rows:[]},[null]])test(`malformed visit payload ${JSON.stringify(raw)} does not become an empty authorization snapshot`,()=>run({raw:{assist_visits:raw}},async h=>{assert.equal((await h.list()).ok,false);assert.equal(tableCalls(h,'clients').length,0);}));
test('native visit failure cannot fall back to appointments that omit explicit visibility evidence',()=>run({errors:{assist_visits:{message:'permission denied'}},appointments:{ok:true,data:[appointment({clientId:otherClient})]}},async h=>{assert.equal((await h.list()).ok,false);assert.deepEqual(h.appointmentCalls,[]);assert.equal(tableCalls(h,'clients').length,0);}));
for(const [name,patch] of [['foreign client',{id:otherClient}],['wrong tenant',{tenant_id:id(9)}],['inactive client',{status:'paused'}],['deleted client',{deleted_at:'2026-01-01T00:00:00Z'}],['missing deleted marker',{deleted_at:undefined}]])test(`unexpected ${name} metadata is rejected despite matching server query`,()=>run({bypass:['clients'],tables:{clients:[client(patch)]}},async h=>{assert.equal((await h.list()).ok,false);}));
test('duplicate client metadata is rejected',()=>run({tables:{clients:[client(),client()]}},async h=>{assert.equal((await h.list()).ok,false);}));
test('absent or inactive client metadata does not manufacture a directory row from an old visit',()=>run({tables:{clients:[client({status:'paused'})]}},async h=>{assert.deepEqual(await h.list(),{ok:true,data:[]});}));
test('pagination continues after short server-capped pages and reaches explicit empty terminators',()=>run({caps:{assist_visits:2,clients:1},tables:{assist_visits:[visit(),visit({id:id(11),client_id:otherClient}),visit({id:id(12),client_id:id(5)})],clients:[client(),client({id:otherClient}),client({id:id(5)})]}},async h=>{const r=await h.list();assert.equal(r.ok,true);assert.equal(r.data.length,3);assert.ok(tableCalls(h,'assist_visits').some(c=>c.operations.some(o=>o[0]==='range'&&o[1]===2)));assert.ok(tableCalls(h,'clients').some(c=>c.operations.some(o=>o[0]==='range'&&o[1]===3)));}));
test('native assignment revocation during metadata load discards all accumulated records',()=>run({onQuery(call,state){if(call.table==='clients')state.tables.assist_visits=[];}},async h=>{const r=await h.list();assert.equal(r.ok,false);assert.equal('data' in r,false);}));
test('Office caller-selected employee remains supported with that employee own visible visits',()=>run({tables:{assist_visits:[visit({employee_id:id(8)})]}},async h=>{assert.equal((await h.list(tenant,id(8))).ok,true);assert.ok(tableCalls(h,'assist_visits').every(q=>q.operations.some(o=>o[0]==='eq'&&o[1]==='employee_id'&&o[2]===id(8))));}));
test('cancelled future own visit is not shown as next visit',()=>run({tables:{assist_visits:[visit({planned_start_at:'2099-01-01T12:00:00Z',canonical_status:'cancelled'})]}},async h=>{const r=await h.list();assert.equal(r.ok,true);assert.equal(r.data[0].nextAssignmentAt,null);assert.equal(r.data[0].activeAssignmentCount,0);}));
test('detail outside own visible list returns null before any contact, address, document or appointment reads',()=>run({},async h=>{assert.deepEqual(await h.detail(tenant,employee,otherClient),{ok:true,data:null});assert.deepEqual(h.appointmentCalls,[]);assert.deepEqual(h.documentCalls,[]);assert.equal(tableCalls(h,'client_contacts').length,0);assert.equal(tableCalls(h,'client_addresses').length,0);}));
test('detail history excludes hidden visits even if legacy appointment producer returns them',()=>run({appointments:{ok:true,data:[appointment(),appointment({id:id(99),title:'Hidden own visit'})]}},async h=>{const r=await h.detail();assert.equal(r.ok,true);assert.deepEqual(r.data.assignmentHistory.map(i=>i.assignmentId),[id(10)]);assert.deepEqual(h.appointmentCalls,[[tenant,employee]]);}));
for(const [name,patch] of [['another employee',{employeeId:id(9)}],['missing employee',{employeeId:undefined}],['invalid client',{clientId:'label'}],['invalid time',{startsAt:'later'}]])test(`detail rejects appointment snapshot with ${name} before detail metadata queries`,()=>run({appointments:{ok:true,data:[appointment(),appointment({id:id(99),...patch})]}},async h=>{assert.equal((await h.detail()).ok,false);assert.equal(tableCalls(h,'client_contacts').length,0);assert.equal(tableCalls(h,'client_addresses').length,0);}));
test('appointment cannot attach another own client native visit UUID to the requested client',()=>run({tables:{assist_visits:[visit(),visit({id:id(11),client_id:otherClient})],clients:[client(),client({id:otherClient})]},appointments:{ok:true,data:[appointment(),appointment({id:id(11),clientId})]}},async h=>{const r=await h.detail();assert.equal(r.ok,false);assert.equal(tableCalls(h,'client_contacts').length,0);assert.equal(tableCalls(h,'client_addresses').length,0);}));
test('duplicate appointment IDs cannot duplicate native history',()=>run({appointments:{ok:true,data:[appointment(),appointment()]}},async h=>{assert.equal((await h.detail()).ok,false);}));
test('client ID batches remain bounded to native scope for more than one hundred clients',()=>run({tables:{assist_visits:Array.from({length:101},(_,n)=>visit({id:id(2000+n),client_id:id(1000+n)})),clients:Array.from({length:101},(_,n)=>client({id:id(1000+n)}))}},async h=>{const r=await h.list();assert.equal(r.ok,true);assert.equal(r.data.length,101);const batches=tableCalls(h,'clients').map(q=>q.operations.find(o=>o[0]==='in'&&o[1]==='id')[2]);assert.ok(batches.every(b=>b.length<=100));assert.deepEqual([...new Set(batches.flat())].sort(),Array.from({length:101},(_,n)=>id(1000+n)).sort());}));
test('client metadata failure returns no tenant or appointment fallback',()=>run({errors:{clients:{message:'Client records denied'}}},async h=>{const r=await h.list();assert.equal(r.ok,false);assert.equal(r.error,'Client records denied');assert.deepEqual(h.appointmentCalls,[]);}));
test('blank native planning status is an invalid authorization snapshot',()=>run({tables:{assist_visits:[visit({planning_status:''})]}},async h=>{assert.equal((await h.list()).ok,false);assert.equal(tableCalls(h,'clients').length,0);}));
test('primary/emergency contacts are filtered both on server and on returned data',()=>run({bypass:['client_contacts'],tables:{client_contacts:[contact(),contact({id:id(41),is_primary_contact:false,is_emergency_contact:true,phone:'own-emergency-phone'}),contact({id:id(42),is_primary_contact:false,phone:'must-not-return'}),contact({id:id(43),is_primary_contact:'true',is_emergency_contact:1,phone:'boolean-coercion-must-not-return'})]}},async h=>{const r=await h.detail();assert.equal(r.ok,true);assert.deepEqual(r.data.contacts.map(c=>c.phone).sort(),['own-emergency-phone','own-primary-phone']);for(const q of tableCalls(h,'client_contacts')){assert.ok(q.operations.some(o=>o[0]==='eq'&&o[1]==='client_id'&&o[2]===clientId));assert.ok(q.operations.some(o=>o[0]==='or'));}}));
for(const [name,patch] of [['foreign tenant',{tenant_id:id(9)}],['foreign client',{client_id:otherClient}],['invalid native ID',{id:'contact label'}]])test(`detail contains no contacts from ${name} payload and reports the failed contact scope`,()=>run({bypass:['client_contacts'],tables:{client_contacts:[contact(patch)]}},async h=>{const r=await h.detail();assert.equal(r.ok,true);assert.deepEqual(r.data.contacts,[]);assert.match(r.data.contactsError,/Zuweisungen/);}));
test('foreign address response invalidates detail instead of exposing access hints',()=>run({bypass:['client_addresses'],tables:{client_addresses:[{id:id(50),tenant_id:tenant,client_id:otherClient,access_notes:'foreign secret'}]}},async h=>{const r=await h.detail();assert.equal(r.ok,false);assert.equal('data' in r,false);}));
test('failed address query ignores accompanying payload and retains explicit partial read error',()=>run({errors:{client_addresses:{message:'Address read denied'}},tables:{client_addresses:[{id:id(50),tenant_id:tenant,client_id:clientId,access_notes:'must not show failed-query data'}]}},async h=>{const r=await h.detail();assert.equal(r.ok,true);assert.equal(r.data.accessHint,null);assert.equal(r.data.accessError,'Address read denied');}));
test('document and contact failures remain explicit rather than resembling empty successful reads',()=>run({errors:{client_contacts:{message:'Contacts denied'}},documents:{ok:false,error:'Documents denied'}},async h=>{const r=await h.detail();assert.equal(r.ok,true);assert.equal(r.data.contactsError,'Contacts denied');assert.equal(r.data.documentsError,'Documents denied');assert.deepEqual(r.data.portalDocuments,[]);}));
test('assignment revocation during detail children discards whole completed detail',()=>run({onDocuments(state){state.tables.assist_visits=[];}},async h=>{const r=await h.detail();assert.equal(r.ok,false);assert.equal('data' in r,false);}));
for(const [t,e,c] of [['',employee,clientId],[tenant,'',clientId],[tenant,employee,'display-label']])test(`invalid detail identity fails before reads: ${t}/${e}/${c}`,()=>run({},async h=>{assert.equal((await h.detail(t,e,c)).ok,false);assert.equal(h.calls.length,0);assert.deepEqual(h.appointmentCalls,[]);}));
test('platform split leaves shared native service and existing extensionless callers in place',()=>{const shared=read('src/lib/portal/employeePortalClientRecordsService.ts'),web=read('src/lib/portal/employeePortalClientRecordsService.web.ts');assert.match(shared,/loadAllTenantClients/);assert.match(shared,/fetchLivePortalAppointmentsForEmployeeTeam/);assert.doesNotMatch(web,/loadAllTenantClients|fetchLivePortalAppointmentsForEmployeeTeam/);for(const caller of ['src/hooks/useEmployeePortalClientRecords.ts','src/screens/portal/EmployeeLogbookScreen.tsx','src/components/office/EmployeeLogbookOfficePanel.tsx'])assert.match(read(caller),/from '@\/lib\/portal\/employeePortalClientRecordsService'/);});
