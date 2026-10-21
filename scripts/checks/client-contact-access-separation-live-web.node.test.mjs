import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';

const read=(path)=>readFileSync(new URL(`../../${path}`,import.meta.url),'utf8');
const id=(n)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const permissions=(value=false)=>({canViewAppointments:value,canViewDocuments:value,canViewCarePlan:value,canSendMessages:value,canViewBilling:value});
const input=(patch={})=>({firstName:'Maria',lastName:'Meyer',relationship:'betreuer',relationshipLabel:'Betreuerin',contactType:'relative',phone:null,email:null,isEmergency:false,isPortalUser:false,portalPermissions:permissions(false),notes:null,...patch});
const compose=(path,deps,names)=>new Function(...Object.keys(deps),strip(read(path).replace(/^import[\s\S]*?;\n/gm,'').replace(/\bexport /g,''))+`;return {${names.join(',')}};`)(...Object.values(deps));

function database(){
 const calls=[];
 const db={calls,from(table){let mode='read',payload=null,filters=[];const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},single(){return q;},insert(value){mode='insert';payload=structuredClone(value);return q;},update(value){mode='update';payload=structuredClone(value);return q;},then(resolve,reject){calls.push({table,mode,payload:structuredClone(payload),filters:structuredClone(filters)});if(table==='clients')return Promise.resolve({data:{id:id(3),tenant_id:id(1)},error:null}).then(resolve,reject);return Promise.resolve({data:{id:id(4),tenant_id:id(1),client_id:id(3),first_name:'Maria',last_name:'Meyer',relationship:'Betreuerin',contact_type:'relative',is_portal_user:false,portal_permissions:permissions(false),...payload},error:null}).then(resolve,reject);}};return q;}};
 return db;
}

function repository(db){
 return compose('src/lib/clients/repositories/clientExtendedRepository.supabase.ts',{
  getSupabaseClient:()=>db,SERVICE_ERRORS:{supabaseUnavailable:'Kein SDK',clientNotFound:'Nicht gefunden'},
  fromUnknownTable:(sdk,table)=>sdk.from(table),toGermanSupabaseError:(error)=>error?.message??'Datenbankfehler',
  mapClientContactExtended:(row)=>row,
 },['requestsContactPortalGrant','supabaseClientExtendedRepository']);
}

function service({permission=true,repo={}}={}){
 return compose('src/lib/clients/clientContactsService.ts',{
  runService:(operation)=>operation(),isDemoClientBackend:()=>false,getClientExtendedRepository:()=>repo,
  enforcePermission:(_role,key)=>permission?null:{ok:false,error:`Keine Berechtigung: ${key}`},
  assertDemoTenant:()=>null,getDemoClientFullDetail:()=>null,upsertDemoClientFullDetail:()=>{},
  SERVICE_ERRORS:{clientNotFound:'Nicht gefunden'},
 },['contactInputRequestsPortalGrant','fetchClientContacts','createClientContact','updateClientContact','deleteClientContact']);
}

test('contact relationship, emergency flag and false portal fields never request an access grant',()=>{
 const api=service();
 assert.equal(api.contactInputRequestsPortalGrant(input()),false);
 assert.equal(api.contactInputRequestsPortalGrant({relationship:'kind',isEmergency:true}),false);
});

test('portal marker or any module permission is rejected as a grant request',()=>{
 const api=service();
 assert.equal(api.contactInputRequestsPortalGrant({isPortalUser:true}),true);
 assert.equal(api.contactInputRequestsPortalGrant({portalPermissions:{...permissions(false),canViewDocuments:true}}),true);
});

test('active contact service blocks a portal grant before repository access',async()=>{
 let calls=0;const api=service({repo:{createContact(){calls++;throw Error('must not run');}}});
 const result=await api.createClientContact(id(1),id(3),input({isPortalUser:true}),'business_admin');
 assert.equal(result.ok,false);assert.match(result.error,/keinen Portal- oder Aktenzugriff/);assert.equal(calls,0);
});

test('active contact reads and mutations require their separate current permissions',async()=>{
 let calls=0;const repo={fetchContacts(){calls++;},createContact(){calls++;},updateContact(){calls++;},deleteContact(){calls++;}};
 const api=service({permission:false,repo});
 assert.match((await api.fetchClientContacts(id(1),id(3),'employee')).error,/office.clients.view/);
 assert.match((await api.createClientContact(id(1),id(3),input(),'employee')).error,/office.clients.manage_contacts/);
 assert.match((await api.updateClientContact(id(1),id(3),id(4),{notes:'x'},'employee')).error,/office.clients.manage_contacts/);
 assert.match((await api.deleteClientContact(id(1),id(3),id(4),'employee')).error,/office.clients.manage_contacts/);
 assert.equal(calls,0);
});

test('repository defense rejects contact-based portal enablement without a query or write',async()=>{
 const db=database(),api=repository(db);
 const result=await api.supabaseClientExtendedRepository.createContact(id(1),id(3),input({portalPermissions:permissions(true)}));
 assert.equal(result.ok,false);assert.match(result.error,/getrennten Freigabeablauf/);assert.equal(db.calls.length,0);
});

test('safe contact creation persists an explicit no-access state',async()=>{
 const db=database(),api=repository(db);
 const result=await api.supabaseClientExtendedRepository.createContact(id(1),id(3),input());
 assert.equal(result.ok,true);const write=db.calls.find((call)=>call.table==='client_contacts');assert.ok(write);
 assert.equal(write.payload.is_portal_user,false);assert.deepEqual(write.payload.portal_permissions,permissions(false));
 assert.equal(write.payload.relationship,'Betreuerin');
});

test('safe contact update cannot mutate portal identity or module permissions',async()=>{
 const db=database(),api=repository(db);
 const result=await api.supabaseClientExtendedRepository.updateContact(id(1),id(3),id(4),{notes:'Nur Kontakt',isPortalUser:false,portalPermissions:permissions(false)});
 assert.equal(result.ok,true);const write=db.calls.find((call)=>call.table==='client_contacts');assert.deepEqual(write.payload,{notes:'Nur Kontakt'});
});

test('repository update rejects a later portal grant before native mutation',async()=>{
 const db=database(),api=repository(db);
 const result=await api.supabaseClientExtendedRepository.updateContact(id(1),id(3),id(4),{isPortalUser:true});
 assert.equal(result.ok,false);assert.equal(db.calls.length,0);
});
