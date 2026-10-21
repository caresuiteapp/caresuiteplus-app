import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {stripTypeScriptTypes as strip} from 'node:module';
import * as contacts from '../../src/lib/clients/clientContactEvidence.web.ts';
import {assertClientTimelineCapture} from '../../src/lib/clients/clientTimelineNoteAction.web.ts';
import {medicationTimeDisplay} from '../../src/lib/pflege/medicationTimeDisplay.web.ts';
import {CLIENT_CONTACT_TYPE_LABELS,CONTACT_RELATION_LABELS} from '../../src/types/modules/client/clientContact.ts';
const root=resolve(new URL('../../',import.meta.url).pathname),read=p=>readFileSync(resolve(root,p),'utf8');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,scope={tenantId:id(1),clientId:id(4)},time='2026-10-25 02:30:00.123456+02:00';
const row=(n,extra={})=>({id:id(n),tenant_id:scope.tenantId,client_id:scope.clientId,first_name:'Native',last_name:'Contact',contact_type:'relative',relationship:'kind',phone:'030 1',email:null,notes:'Nur abends erreichbar',is_emergency_contact:false,is_portal_user:true,portal_permissions:{canViewDocuments:true,canViewCarePlan:false},created_at:time,updated_at:time,...extra});
const capture=input=>contacts.captureClientContactEvidence(input,scope);
test('All delivered contacts including two identical-looking doctors/relatives remain separate by native UUID, with exact category/relation/availability and no access/representation confirmation',()=>{
 const input=[row(10,{contact_type:'doctor',relationship:'Facharzt'}),row(11,{contact_type:'doctor',relationship:'Hausarzt'}),row(12),row(13)],before=structuredClone(input),result=capture(input);
 assert.deepEqual(result.originals,before);assert.deepEqual(result.entries.map(e=>e.nativeId),input.map(r=>r.id));assert.equal(result.entries[0].category.value,'doctor');assert.equal(result.entries[0].relationship.value,'Facharzt');assert.equal(result.entries[0].notes.value,'Nur abends erreichbar');assert.ok(result.entries.every(e=>e.accessEvidence==='not_confirmed'&&e.representationEvidence==='not_confirmed'));assert.deepEqual(input,before);
});
test('Native legacy/name/full_name/first and last fields remain separately proven, with no parsed relation/category or time/name fallback',()=>{
 const value=row(10,{name:'Legacy original',full_name:'Generated original',first_name:null,last_name:'',relationship:'Arzt für Spezialgebiet'});delete value.contact_type;delete value.created_at;
 const e=capture([value]).entries[0];assert.equal(e.legacyName.value,'Legacy original');assert.equal(e.fullName.value,'Generated original');assert.equal(e.firstName.state,'null');assert.equal(e.lastName.state,'empty');assert.equal(e.category.state,'missing');assert.equal(e.relationship.value,'Arzt für Spezialgebiet');assert.equal(e.createdAt.state,'missing');assert.equal(e.updatedAt.value,time);
});
test('Whole unknown raw fields, original author/version/0/false/null/empty/undefined remain frozen private originals; projection cannot reveal credential/extras/raw sidecars',()=>{
 const value=row(10,{created_by:id(90),updated_by:id(91),unknown:{raw:'PRIVATE CREDENTIAL',zero:0,flag:false,empty:'',nil:null,missing:undefined}}),out=capture([value]);
 assert.deepEqual(out.originals[0],value);assert.ok(Object.isFrozen(out.originals[0].unknown));assert.ok(Object.hasOwn(out.originals[0].unknown,'missing'));assert.equal(JSON.stringify(out.entries).includes('PRIVATE'),false);assert.equal(Object.hasOwn(out.entries[0],'created_by'),false);value.unknown.raw='changed';assert.equal(out.originals[0].unknown.raw,'PRIVATE CREDENTIAL');assert.equal(contacts.isCapturedClientContactEntries(out.entries),true);assert.equal(contacts.isCapturedClientContactEntries(structuredClone(out.entries)),false);
});
for(const value of [null,undefined,{},'missing'])test(`Unavailable native contact pool ${String(value)} never becomes delivered empty`,()=>assert.throws(()=>capture(value)));
test('Explicitly delivered [] remains an own empty original projection, not a contact-count or access claim',()=>{const out=capture([]);assert.deepEqual(out.originals,[]);assert.deepEqual(out.entries,[]);assert.equal(contacts.isCapturedClientContactEntries(out.entries),true);});
for(const [key,value] of [['tenant_id',id(99)],['client_id',id(99)],['id','opaque']])test(`Unselected later native contact ${key} damage rejects whole pool before primitive output`,()=>assert.throws(()=>capture([row(10),row(11,{[key]:value})])));
test('Duplicate native UUID, casefold duplicate, backwards native order are rejected without dropping rows',()=>{assert.throws(()=>capture([row(10),row(10)]));const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';assert.throws(()=>capture([row(10,{id:a}),row(11,{id:a.toUpperCase()})]));assert.throws(()=>capture([row(11),row(10)]));});
for(const change of [()=>new Date(),()=>new Map(),()=>Infinity,()=>()=>true,()=>Symbol('unknown'),()=>Array(1),()=>Object.assign([0],{extra:'native'}),()=>{const x={};x.self=x;return x;}])test(`Whole unknown original cannot silently drop malformed data ${change.toString()}`,()=>assert.throws(()=>capture([row(10,{unknown:change()})])));
for(const key of ['id','portal_permissions','notes','unknown'])test(`Own ${key} getter is never executed before whole rejection`,()=>{let called=0;const value=row(10);Object.defineProperty(value,key,{enumerable:true,get(){called++;return {};}});assert.throws(()=>capture([value]));assert.equal(called,0);});
for(const kind of ['symbol','nonenumerable'])test(`Unknown ${kind} property cannot disappear before contact projection`,()=>{const unknown={};if(kind==='symbol')unknown[Symbol('native')]='original';else Object.defineProperty(unknown,'original',{value:'private',enumerable:false});assert.throws(()=>capture([row(10,{unknown})]));});
test('Inherited portal_permissions getter cannot execute or create module evidence from absent native field',()=>{
 let called=0;Object.defineProperty(Object.prototype,'portal_permissions',{configurable:true,get(){called++;return {canViewDocuments:true};}});
 try{const value={id:id(10),tenant_id:id(1),client_id:id(4)};const e=capture([value]).entries[0];assert.equal(called,0);assert.equal(e.moduleConfiguration,'missing');assert.ok(e.configuredModules.every(m=>m.configured.state==='missing'&&m.configured.value===null));}finally{delete Object.prototype.portal_permissions;}
});
for(const [value,state,expected] of [[true,'known',true],[false,'known',false],[null,'null',null],['false','invalid',null],[0,'invalid',null]])test(`Stored portal mark ${String(value)} remains exact/unknown without truthy access derivation`,()=>{const e=capture([row(10,{is_portal_user:value})]).entries[0];assert.deepEqual(e.portalMark,{state,value:expected});assert.equal(e.accessEvidence,'not_confirmed');});
for(const [value,state,expected] of [[true,'known',true],[false,'known',false],[null,'null',null],['false','invalid',null],[0,'invalid',null]])test(`JSON module value ${String(value)} is never Boolean-coerced into granted access`,()=>{const e=capture([row(10,{portal_permissions:{canViewDocuments:value}})]).entries[0];assert.deepEqual(e.configuredModules.find(m=>m.key==='canViewDocuments').configured,{state,value:expected});assert.equal(e.configuredModules.find(m=>m.key==='canViewCarePlan').configured.state,'missing');assert.equal(e.accessEvidence,'not_confirmed');});
for(const [value,state] of [[null,'null'],[[],'invalid'],['legacy','invalid']])test(`Unknown whole module configuration ${state} remains private and visibly unconfirmed`,()=>{const out=capture([row(10,{portal_permissions:value})]);assert.deepEqual(out.originals[0].portal_permissions,value);assert.equal(out.entries[0].moduleConfiguration,state);assert.ok(out.entries[0].configuredModules.every(m=>m.configured.value===null));});
for(const value of [time,'1969-12-31T23:59:59.999999Z','2026-02-30T00:00:00Z','2026-10-11T10:00:00.1234567Z',null,'',0])test(`Contact metadata ${JSON.stringify(value)} is preserved literally; no contacted-at or admission inference`,()=>{const out=capture([row(10,{created_at:value})]);assert.equal(out.originals[0].created_at,value);assert.equal(Object.hasOwn(out.entries[0],'contactedAt'),false);assert.equal(Object.hasOwn(out.entries[0],'admissionDate'),false);if(typeof value==='string')assert.equal(out.entries[0].createdAt.value,value);});

// Actual whole current Parent/native permission/session loader/SELECT/SharedQuery fixture,
// with only the newly imported pure helper provided as its actual module dependency.
let fixture=read('scripts/checks/client-native-parent-web.node.test.mjs');fixture=fixture.slice(0,fixture.indexOf("test('Actual Parent"));
fixture=fixture.replace(/^const root=.*$/m,`const root=${JSON.stringify(root)},read=p=>readFileSync(resolve(root,p),'utf8');`);
fixture=fixture.replace("const apiFields='","const apiFields='capturePanelContactRead,capturePanelInternalNotesRead,");
fixture=fixture.replace('const args={...identitySession','const contactEvidence=awaitNever;const args={...contactEvidence,...identitySession');
// Top-level load uses the same actual module/WeakSet instance as this suite. No forged projection or authorization leaf.
fixture=fixture.replace('const contactEvidence=awaitNever;','').replace("const office=compose(","const contactEvidence=await load('src/lib/clients/clientContactEvidence.web.ts');\nconst office=compose(");
fixture+='\nexport {harness,ready,id,deferred};';
const {harness,ready,deferred}=await import('data:text/javascript;base64,'+Buffer.from(fixture).toString('base64'));
function make(t,rights=['view','view_sensitive']){const h=harness({rights:new Set(rights.map(k=>'office.clients.'+k))});t.after(()=>h.unmount());h.tables.client_contacts=[row(10),row(11,{contact_type:'doctor',relationship:'Facharzt'})];return h;}
const ps=read('src/screens/business/office/ClientRecordContactEvidencePanel.web.tsx');
const helpers=strip(ps.slice(ps.indexOf('function captureContactRead('),ps.indexOf('function ClientContactEntry(')));
const start=ps.indexOf('export function ClientRecordContactEvidencePanel('),prefix=strip(ps.slice(start,ps.indexOf('  if (!mayRead()) return <SectionPanel',start)).replace('export ','')+'return {read,mayRead};}');
const deps={useAuroraAdaptiveText:()=>({primary:'#111',secondary:'#333'}),...contacts,assertClientTimelineCapture,medicationTimeDisplay,CLIENT_CONTACT_TYPE_LABELS,CONTACT_RELATION_LABELS};
function props(h){const matches=[...read('src/screens/pflege/ClientRecordWorkspace365.web.tsx').matchAll(/<ClientRecordContactEvidencePanel captureRead=\{([^}]+)\} \/>/g)];assert.equal(matches.length,2);return {captureRead:new Function('capturePanelContactRead','return '+matches[0][1]+';')(h.api.capturePanelContactRead)};}
function panel(h){let slots=[],slot=0,cleanups=[],api;const useRef=v=>slots[slot++]??(slots[slot-1]={current:v});const useEffect=f=>{slot++;if(!cleanups.length)cleanups.push(f());};const run=new Function(...Object.keys(deps),'useRef','useEffect',helpers+'\n'+prefix+';return ClientRecordContactEvidencePanel;')(...Object.values(deps),useRef,useEffect);const render=()=>{slot=0;api=run(props(h));return api;};render();return {render,get api(){return api;},dispose:()=>cleanups.forEach(f=>f?.())};}
test('Actual Parent contact/relative JSX passes only current BasicView factory, all delivered contacts; no raw/auth/portalcredential props/AI and no new SELECT/write/RPC',async t=>{
 const h=make(t,['view']);h.tables.client_contacts[0].unknown={secret:'PRIVATE RAW CONTACT',zero:0};await ready(h);const before=h.selectCalls.length,p=panel(h);t.after(p.dispose);const frame=p.api.read;
 assert.equal(p.api.mayRead(),true);assert.equal(frame.entries.length,2);assert.equal(frame.entries[0].notes.value,'Nur abends erreichbar');assert.equal(frame.entries[1].category.value,'doctor');assert.deepEqual(Object.keys(props(h)),['captureRead']);assert.deepEqual(Reflect.ownKeys(frame.owner),[]);assert.ok(Object.isFrozen(frame.owner));assert.equal(JSON.stringify(frame).includes('PRIVATE'),false);assert.equal(JSON.stringify(h.ai).includes('PRIVATE'),false);assert.equal(h.api.parentRead.liveOriginalReceipt().fullNative.parts.contacts[0].unknown.secret,'PRIVATE RAW CONTACT');assert.equal(h.selectCalls.length,before);assert.equal(h.nativeWrites.length,0);assert.equal(h.rpcCalls.length,0);assert.equal(h.legacyCalls.length,0);
});
for(const hook of [0,1])test(`Actual native permission hook${hook} refresh before Parent render denies retained contact Entry and captured original factory`,async t=>{
 const h=make(t);await ready(h);const p=panel(h);t.after(p.dispose);const old=p.api,frame=old.read,before=h.selectCalls.length;h.permissionAPIs[hook].refreshPermissions();assert.equal(old.mayRead(frame.entries[0]),false);assert.throws(frame.assertCurrentRead);assert.equal(props(h).captureRead(),null);assert.equal(h.selectCalls.length,before);
});
for(const hook of [0,1])test(`Actual hook${hook} same-native regrant cannot revive previous contact capture/Entry; fresh immutable metadata uses new own generation`,async t=>{
 const h=make(t);await ready(h);const p=panel(h);t.after(p.dispose);const old=p.api,frame=old.read;h.permissionAPIs[hook].refreshPermissions();h.render();await ready(h);p.render();assert.equal(old.mayRead(),false);assert.throws(frame.assertCurrentRead);assert.equal(p.api.mayRead(),true);assert.notEqual(p.api.read.owner,frame.owner);assert.equal(h.nativeWrites.length,0);assert.equal(h.rpcCalls.length,0);
});
for(const query of ['recordQuery','fullQuery'])test(`Actual Parent ${query} read starts before rerender and blocks previous contact Entry / receipt until new whole read`,async t=>{
 const h=make(t);await ready(h);const p=panel(h);t.after(p.dispose);const old=p.api,frame=old.read,wait=deferred();h.state.selectIntercept=c=>c.table==='clients'?wait.promise:undefined;const refreshing=h.api.parentRead[query].refresh();await h.tick();assert.equal(old.mayRead(frame.entries[0]),false);assert.equal(props(h).captureRead(),null);wait.resolve(undefined);await refreshing;h.state.selectIntercept=undefined;h.render();p.render();assert.equal(p.api.mayRead(),true);assert.equal(old.mayRead(),false);assert.notEqual(p.api.read.key,frame.key);
});
for(const change of ['token','client','tenant','actor','role','portal','expiry'])test(`Actual native ${change} change denies old contact frame and retained Child-only read with zero new metadata query`,async t=>{
 const h=make(t);await ready(h);const p=panel(h);t.after(p.dispose);const old=p.api;
 if(change==='token')h.state.token='token-B';if(change==='client')h.state.clientId=id(99);if(change==='tenant')h.state.tenantId=id(99);if(change==='actor'){h.state.user={id:id(99)};h.state.profile={...h.state.profile,id:id(99)};}if(change==='role')h.state.profile={...h.state.profile,roleKey:'nurse'};if(change==='portal')h.state.portalSession={id:id(99)};if(change==='expiry')h.state.expiresAt=Date.now()-1;
 // Updating the controlled Authprovider input alone is not a native-hook publication.
 h.render();const before=h.selectCalls.length;assert.equal(old.mayRead(),false);p.render();assert.equal(p.api.mayRead(),false);assert.equal(h.nativeWrites.length,0);assert.equal(h.rpcCalls.length,0);
});
test('Actual Parent A→B→A never revives initial opaque receipt or selected original Entry',async t=>{
 const h=make(t);await ready(h);const p=panel(h);t.after(p.dispose);const old=p.api,frame=old.read;h.state.clientId=id(99);h.render();p.render();assert.equal(p.api.read,null);h.state.clientId=id(4);h.render();await ready(h);p.render();assert.equal(p.api.mayRead(),true);assert.notEqual(p.api.read.owner,frame.owner);assert.equal(old.mayRead(frame.entries[0]),false);
});
test('Whole foreign contact on a later native page blocks receipt and all entries, never hidden by projection',async t=>{
 const h=make(t);h.tables.client_contacts=[row(10),row(11),row(12)];h.state.selectIntercept=c=>c.table==='client_contacts'&&c.cursor===id(11)?{data:[row(12,{client_id:id(99)})],error:null}:undefined;for(let i=0;i<4;i++)await h.settle();const p=panel(h);t.after(p.dispose);assert.equal(h.api.parentRead.ownRead,false);assert.equal(p.api.read,null);assert.equal(p.api.mayRead(),false);assert.equal(h.nativeWrites.length,0);
});
test('Actual unchanged Parent BasicView permits contact reading without Sensitive/Edit; absence of BasicView cannot substitute extra rights',async t=>{
 const h=make(t,['view_sensitive','edit']);for(let i=0;i<4;i++)await h.settle();const before=h.selectCalls.length,p=panel(h);t.after(p.dispose);assert.equal(p.api.read,null);assert.equal(p.api.mayRead(),false);assert.equal(h.selectCalls.length,before);
});
test('Parent or Child cleanup closes all retained contact frame/entry readers, without another query',async t=>{
 const h=make(t);await ready(h);const p=panel(h);const old=p.api,before=h.selectCalls.length;p.dispose();assert.equal(old.mayRead(),false);h.unmount();assert.throws(old.read.assertCurrentRead);assert.equal(h.selectCalls.length,before);
});
test('Native raw metadata text is displayed with complete microseconds and separate invalid/missing states; no millisecond fallback or clinical time inferred',()=>{
 const helpersApi=new Function(...Object.keys(deps),helpers+';return {contactMetadataTime,contactFlag};')(...Object.values(deps));
 assert.match(helpersApi.contactMetadataTime(capture([row(10)]).entries[0].createdAt),/123456/);assert.match(helpersApi.contactMetadataTime(capture([row(10,{created_at:'2026-02-30T00:00:00Z'})]).entries[0].createdAt),/Ungültige/);assert.equal(helpersApi.contactFlag(capture([row(10,{is_portal_user:'false'})]).entries[0].portalMark),'Ungeklärtes Originalformat');
});

for(const status of ['gesperrt','deaktiviert','nicht_eingerichtet','aktiv'])test(`Actual full native related portal status ${status} never upgrades the contact configuration into current relative/client access or representation`,async t=>{
 const h=make(t);h.tables.client_portal_access=[row(20,{contact_id:id(10),status,portal_enabled:status==='aktiv',portal_username:null,email:null,last_login_at:null,invited_at:null,code_created_at:time,code_rotated_at:null,modules_enabled:['documents'],two_factor_enabled:false,auth_user_id:null})];await ready(h);const p=panel(h);t.after(p.dispose);assert.equal(p.api.mayRead(),true);assert.equal(p.api.read.entries[0].portalMark.value,true);assert.equal(p.api.read.entries[0].accessEvidence,'not_confirmed');assert.equal(p.api.read.entries[0].representationEvidence,'not_confirmed');assert.equal(Object.hasOwn(p.api.read.entries[0],'portalAccess'),false);assert.equal(h.api.parentRead.liveOriginalReceipt().fullNative.parts.portalAccess[0].status,status);assert.equal(h.nativeWrites.length,0);
});
test('Actual harmless Parent rerender preserves immutable contact generation/entries and original current capture without additional query or can-function identity requirement',async t=>{
 const h=make(t);await ready(h);const p=panel(h);t.after(p.dispose);const old=p.api,frame=old.read,before=h.selectCalls.length;h.render();p.render();assert.equal(p.api.mayRead(),true);assert.equal(old.mayRead(),true);assert.equal(p.api.read.entries,frame.entries);assert.equal(p.api.read.owner,frame.owner);assert.equal(p.api.read.key,frame.key);assert.equal(h.selectCalls.length,before);
});
test('Actual freshly delivered empty contact pool has a basic own read receipt; unavailable Parent flow does not get fabricated []',async t=>{
 const h=make(t);h.tables.client_contacts=[];await ready(h);const p=panel(h);t.after(p.dispose);assert.equal(p.api.mayRead(),true);assert.deepEqual(p.api.read.entries,[]);h.permissionAPIs[0].refreshPermissions();p.render();assert.equal(p.api.read,null);assert.equal(p.api.mayRead(),false);
});
