import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stripTypeScriptTypes as strip } from 'node:module';
import * as native from '../../src/lib/clients/clientRecordNativeOriginal.web.ts';
import * as signature from '../../src/lib/clients/clientSignatureOriginals.web.ts';
import { assertClientTimelineCapture } from '../../src/lib/clients/clientTimelineNoteAction.web.ts';
import { withServiceQueryTimeout } from '../../src/lib/services/queryTimeout.ts';
const root=resolve(new URL('../../',import.meta.url).pathname), read=p=>readFileSync(resolve(root,p),'utf8');
// Actual existing whole Parent/current native permission/SELECT/native write fixture, unchanged risk bodies.
let fixture=read('scripts/checks/client-native-parent-web.node.test.mjs');
fixture=fixture.slice(0,fixture.indexOf("test('Actual Parent"));
fixture=fixture.replace(/^const root=.*$/m,`const root=${JSON.stringify(root)},read=p=>readFileSync(resolve(root,p),'utf8');`);
// The imported fixture is evaluated from a data URL; retain the real helper URL.
fixture=fixture.replace("new URL('./helpers/current-intake-validation.mjs',import.meta.url).href",JSON.stringify(new URL('./helpers/current-intake-validation.mjs',import.meta.url).href));
fixture=fixture.replace("const apiFields='","const apiFields='capturePanelTimelineRead,timelineAccess,");
fixture=fixture.replace('render();return {get api()','render();return {get nativeSdk(){return nativeDb;},get api()');
fixture+='\nexport {harness,ready,id,deferred};';
const {harness,ready,id,deferred}=await import('data:text/javascript;base64,'+Buffer.from(fixture).toString('base64'));
const time='2026-10-25 02:30:00.123456+02:00';
const row=(n,extra={})=>({id:id(n),tenant_id:id(1),client_id:id(4),...extra});
const doc=(n=710,extra={})=>row(n,{status:'not_started',preview_html:'PRIVATE DOCUMENT HTML',finalized_html:'PRIVATE FINAL HTML',...extra});
const sig=(n=720,extra={})=>row(n,{document_id:id(710),signer_name:'Native signer',signer_role:'client',signed_at:time,created_at:'2026-10-25T02:30:00.123457+02:00',signature_data:'PRIVATE SIGNATURE',unknown:{zero:0,time,original:'PRIVATE EXTRA'},...extra});
const moduleBody=p=>strip(read(p).replace(/^import[\s\S]*?;\n/gm,'').replace(/\bexport /g,''));
function make(t,rights=['view','view_sensitive']) {
 const h=harness({rights:new Set(rights.map(k=>'office.clients.'+k))});t.after(()=>h.unmount());
 h.tables.client_intake_documents=[doc()];h.tables.client_document_signatures=[sig()];return h;
}
// Consume the real JSX factory expression, with no replacement capture or raw sidecar props.
function signatureProps(h){const source=read('src/screens/pflege/ClientRecordWorkspace365.web.tsx');const match=source.match(/<ClientRecordSignaturePanel captureRead=\{([^}]+)\} \/>/);assert.ok(match);return {captureRead:new Function('capturePanelTimelineRead','return '+match[1]+';')(h.api.capturePanelTimelineRead)};}
function panel(h) {
 const source=read('src/screens/business/office/ClientRecordSignaturePanel.web.tsx');
 const helpers=strip(source.slice(source.indexOf('function captureSignatureRead('),source.indexOf('function SignatureEntry(')));
 const start=source.indexOf('export function ClientRecordSignaturePanel(');
 const prefix=strip(source.slice(start,source.indexOf('  return <SectionPanel',start)).replace('export ','')+'return {query,generation,ownPool,projectionData,mayRead,retry,read,visible};}');
 const deps={...native,...signature,getSupabaseClient:()=>h.nativeSdk,fromUnknownTable:(db,t)=>db.from(t),toGermanSupabaseError:e=>e.message,withServiceQueryTimeout};
 const reader=new Function(...Object.keys(deps),moduleBody('src/lib/clients/clientSignatureOriginalRead.web.ts')+';return fetchClientSignatureOriginalReadWeb;')(...Object.values(deps));
 let cursor=0,api,effects=[],slots=[],fetcher;
 const same=(a,b)=>a?.length===b?.length&&a.every((v,i)=>Object.is(v,b[i]));
 const useState=v=>{const i=cursor++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];};
 const useRef=v=>{const i=cursor++;return slots[i]??(slots[i]={current:v});};
 const useMemo=(f,d)=>{const i=cursor++;if(!(i in slots)||!same(slots[i].deps,d))slots[i]={deps:d,value:f()};return slots[i].value;};
 const useCallback=(f,d)=>useMemo(()=>f,d);
 const useEffect=(f,d)=>{const i=cursor++;if(!(i in slots)||!same(slots[i].deps,d)){const old=slots[i];slots[i]={deps:d,cleanup:old?.cleanup};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=f();});}};
 // Whole unchanged SharedQuery source; primitive state/effects and controlled native SDK only.
 const qsource=read('src/hooks/core/useAsyncQuery.ts');
 const qbody=strip(qsource.slice(qsource.indexOf('function isTransientQueryError(')).replace('export function useAsyncQuery','function useAsyncQuery'));
 const actualQuery=new Function('useState','useRef','useMemo','useCallback','useEffect','Platform','AppState','withServiceQueryTimeout','NATIVE_SERVICE_QUERY_TIMEOUT_MS','useLiveRefresh','DEFAULT_LIVE_POLL_MS',qbody+';return useAsyncQuery;')(useState,useRef,useMemo,useCallback,useEffect,{OS:'web'},{},withServiceQueryTimeout,120000,()=>({isLiveConnected:false}),60000);
 const useAsyncQuery=(f,...args)=>{fetcher=f;return actualQuery(f,...args);};
 const run=new Function('useState','useRef','useEffect','useAsyncQuery','useAuroraAdaptiveText','fetchClientSignatureOriginalReadWeb','assertClientTimelineCapture','freezeClientNativeOriginal',helpers+'\n'+prefix+';return ClientRecordSignaturePanel;')(useState,useRef,useEffect,useAsyncQuery,()=>({}),reader,assertClientTimelineCapture,native.freezeClientNativeOriginal);
 const render=()=>{cursor=0;api=run(signatureProps(h));return api;};
 const flush=()=>{const pending=effects;effects=[];pending.forEach(f=>f());};
 const settle=async()=>{flush();await h.tick();render();flush();await h.tick();render();};
 render();
 return {render,settle,get api(){return api;},get fetcher(){return fetcher;},ready:async()=>{for(let i=0;i<3;i++)await settle();assert.equal(api.ownPool,true,api.query.error??api.query.refreshError);return api;},dispose:()=>{for(const slot of slots)slot?.cleanup?.();}};
}
const calls=h=>h.selectCalls.filter(c=>['client_intake_documents','client_document_signatures'].includes(c.table));
test('Actual document-tab JSX passes only the existing current readonly factory and empty opaque token',async t=>{
 const h=make(t);await ready(h);const props=signatureProps(h),capture=props.captureRead(),original=h.api.parentRead.liveOriginalReceipt();
 assert.deepEqual(Object.keys(props),['captureRead']);assert.equal(props.captureRead,h.api.capturePanelTimelineRead);assert.notEqual(capture.owner,original.owner);assert.ok(Object.isFrozen(capture.owner));assert.deepEqual(Reflect.ownKeys(capture.owner),[]);assert.equal(capture.owner,h.api.timelineAccess.captureRead().owner);assert.equal(JSON.stringify(capture).includes('recordNative'),false);
});
test('Actual Parent→SharedQuery→whole native two-pool reader→Panel preserves raw originals privately and displays metadata only',async t=>{
 const h=make(t);await ready(h);const p=panel(h);t.after(p.dispose);await p.ready();const e=p.api.projectionData.entries[0];assert.equal(e.nativeId,id(720));assert.equal(e.signedAt.value,time);assert.equal(e.createdAt.value,'2026-10-25T02:30:00.123457+02:00');assert.equal(e.documentStatus.value,'not_started');assert.equal(p.api.mayRead(e),true);assert.equal(JSON.stringify(p.api.query.data).includes('PRIVATE'),false);assert.equal(JSON.stringify(p.api.generation.trusted.originals).includes('PRIVATE SIGNATURE'),true);assert.equal(p.api.generation.trusted.originals.pools.signatures[0].unknown.zero,0);assert.equal(JSON.stringify(h.ai).includes('PRIVATE'),false);assert.equal(JSON.stringify(h.api.fullQuery.data).includes('PRIVATE SIGNATURE'),false);assert.equal(h.nativeWrites.length,0);assert.equal(h.rpcCalls.length,0);assert.equal(h.legacyCalls.length,0);
});
test('Complete native keyset pages preserve all signatures, duplicate-looking authors and raw microseconds without text dedupe',async t=>{
 const h=make(t);h.tables.client_document_signatures=[sig(720),sig(721),sig(722,{document_id:id(999)})];await ready(h);const before=calls(h).length,p=panel(h);t.after(p.dispose);await p.ready();assert.equal(p.api.projectionData.entries.length,3);assert.equal(p.api.projectionData.entries[2].documentLink,'unresolved');assert.equal(p.api.generation.trusted.originals.pools.signatures.length,3);const selected=calls(h).slice(before);assert.equal(selected.length,5);assert.ok(selected.every(c=>c.columns==='*'&&c.filters.some(([k,v])=>k==='tenant_id'&&v===id(1))&&c.filters.some(([k,v])=>k==='client_id'&&v===id(4))));assert.deepEqual(selected.filter(c=>c.table==='client_document_signatures').map(c=>c.cursor),[null,id(721),id(722)]);
});
for(const hook of [0,1])test(`Actual permission hook ${hook} refresh before Parent render denies retained metadata, Retry and SDK fetcher`,async t=>{
 const h=make(t);await ready(h);const p=panel(h);t.after(p.dispose);await p.ready();const old=p.api,fetch=p.fetcher,before=calls(h).length;h.permissionAPIs[hook].refreshPermissions();assert.equal(old.mayRead(),false);await old.retry();assert.equal(calls(h).length,before);assert.equal((await fetch()).ok,false);assert.equal(calls(h).length,before);assert.equal(h.nativeWrites.length,0);
});
for(const hook of [0,1])test(`Actual hook ${hook} same-native regrant rotates opaque owner and cannot revive cached metadata`,async t=>{
 const h=make(t);await ready(h);const p=panel(h);t.after(p.dispose);await p.ready();const old=p.api,capture=h.api.capturePanelTimelineRead(),before=calls(h).length;h.permissionAPIs[hook].refreshPermissions();h.render();await ready(h);const afterParent=calls(h).length;const fresh=h.api.capturePanelTimelineRead();assert.notEqual(fresh.owner,capture.owner);assert.throws(capture.assertCurrentRead);p.render();assert.equal(p.api.ownPool,false);assert.equal(old.mayRead(),false);assert.equal(calls(h).length,afterParent);if(hook===0)assert.equal(afterParent,before);await p.ready();assert.equal(p.api.ownPool,true);assert.ok(calls(h).length>afterParent);assert.equal(old.mayRead(),false);
});
for(const query of ['recordQuery','fullQuery'])test(`Starting actual Parent ${query} refresh before render closes cached signature metadata and late callbacks`,async t=>{
 const h=make(t);await ready(h);const p=panel(h);t.after(p.dispose);await p.ready();const old=p.api,before=calls(h).length;const wait=deferred();h.state.selectIntercept=c=>c.table==='clients'?wait.promise:undefined;const refreshing=h.api.parentRead[query].refresh();await h.tick();assert.equal(old.mayRead(),false);await old.retry();assert.equal(calls(h).length,before);wait.resolve(undefined);await refreshing;h.state.selectIntercept=undefined;h.render();p.render();assert.equal(p.api.ownPool,false);await p.ready();assert.equal(old.mayRead(),false);
});
for(const hook of [0,1])test(`Native hook ${hook} loss while signature SDK response is held rejects whole late projection and stops next pages`,async t=>{
 const h=make(t);await ready(h);const wait=deferred(),entered=deferred();h.state.selectIntercept=c=>{if(c.table==='client_document_signatures'){entered.resolve();return wait.promise;}};const p=panel(h);t.after(p.dispose);const read=p.fetcher();await entered.promise;const before=calls(h).length;h.permissionAPIs[hook].refreshPermissions();wait.resolve(undefined);assert.equal((await read).ok,false);assert.equal(calls(h).length,before);assert.equal(p.api.generation.trusted,null);assert.equal(h.nativeWrites.length,0);
});
for(const change of ['token','client','tenant','actor','role','portal','expiry'])test(`Actual native ${change} replacement denies old signature originals and retained refresh before new display`,async t=>{
 const h=make(t);await ready(h);const p=panel(h);t.after(p.dispose);await p.ready();const old=p.api,before=calls(h).length;
 if(change==='token')h.state.token='token-B';if(change==='client')h.state.clientId=id(99);if(change==='tenant')h.state.tenantId=id(99);if(change==='actor'){h.state.user={id:id(99)};h.state.profile={...h.state.profile,id:id(99)};}if(change==='role')h.state.profile={...h.state.profile,roleKey:'nurse'};if(change==='portal')h.state.portalSession={id:id(99)};if(change==='expiry')h.state.expiresAt=Date.now()-1;
 h.render();assert.equal(old.mayRead(),false);await old.retry();assert.equal(calls(h).length,before);assert.equal((await p.fetcher()).ok,false);assert.equal(calls(h).length,before);
});
for(const rights of [[],['view'],['view','edit']])test(`Actual delivered native rights ${JSON.stringify(rights)} do not substitute basic/Edit for Sensitive signature reading`,async t=>{
 const h=make(t,rights);if(rights.includes('view'))await ready(h);else{for(let i=0;i<4;i++)await h.settle();}const before=calls(h).length,p=panel(h);t.after(p.dispose);await p.settle();assert.equal(p.api.read,null);assert.equal(p.api.ownPool,false);assert.equal(calls(h).length,before);assert.equal((await p.fetcher()).ok,false);assert.equal(h.nativeWrites.length,0);
});
test('Whole foreign signature beyond the first native cap invalidates all metadata instead of clipping hidden damage',async t=>{
 const h=make(t);await ready(h);h.tables.client_document_signatures=[sig(720),sig(721),sig(722)];h.state.selectIntercept=c=>c.table==='client_document_signatures'&&c.cursor===id(721)?{data:[sig(722,{client_id:id(99)})],error:null}:undefined;const p=panel(h);t.after(p.dispose);assert.equal((await p.fetcher()).ok,false);assert.equal(p.api.generation.trusted,null);assert.equal(p.api.mayRead(),false);assert.equal(h.nativeWrites.length,0);
});
test('Genuine empty native pools are an own empty receipt; missing signer or document remains unknown rather than inferred',async t=>{
 const h=make(t);await ready(h);h.tables.client_intake_documents=[];h.tables.client_document_signatures=[];const p=panel(h);t.after(p.dispose);await p.ready();assert.deepEqual(p.api.projectionData.entries,[]);assert.equal(p.api.ownPool,true);
 h.tables.client_document_signatures=[sig(720,{document_id:id(999),signer_name:null,signer_role:'',signed_at:null})];await p.api.query.refresh();p.render();const e=p.api.projectionData.entries[0];assert.equal(e.documentLink,'unresolved');assert.equal(e.signerName.state,'null');assert.equal(e.signerRole.state,'empty');assert.equal(e.signedAt.state,'null');assert.equal(Object.hasOwn(e,'approved'),false);
});
test('Actual Parent or Panel unmount denies cached metadata and retained Retry/fetch with zero new SDK work',async t=>{
 const h=make(t);await ready(h);const p=panel(h);t.after(p.dispose);await p.ready();const old=p.api,before=calls(h).length;h.unmount();assert.equal(old.mayRead(),false);await old.retry();assert.equal((await p.fetcher()).ok,false);assert.equal(calls(h).length,before);p.dispose();assert.equal(old.mayRead(),false);assert.equal(h.nativeWrites.length,0);
});
