/** Actual React monthly component and Office screen. Existing esbuild/happy-dom
 * only; API/auth/router boundaries are synthetic. DOM checks are NOT layout or
 * Supabase evidence. No installation, real patient data, storage or live sends. */
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Window} from 'happy-dom';
import {runInThisContext} from 'node:vm';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {tenant,client,user,month,fixture,finalProof,signedProof,workspace,sources,deferred} from './monthly-fixtures.mjs';

const apiNames=['checkMonthlyRequest','commandMonthlyProof','listMonthlyClients','listMonthlySources','listMonthlyEvents','loadMonthlyProof',
 'loadMonthlyWorkspace','readMonthlyProofHistory','command','downloadBytes','readBatch','readDirectory','readEvents','readInvoiceCase',
 'readInvoiceSources','readRevision','readRevisions','readWorkspace','requestTestExport','requestMonthlyOriginal','commandMonthlyAuthority'];
const stubs={
 '@/components/inputs/CareSignatureCanvas.web':"import {createElement} from 'react'; export const CareSignatureCanvas=({onConfirm,disabled})=>createElement('button',{disabled,onClick:()=>onConfirm('data:image/png;base64,'+globalThis.monthlySignaturePng)},'Unterschrift im Test zeichnen');",
 '@/components/layout/ScreenShell.web':"import {createElement} from 'react'; export const ScreenShell=({children})=>createElement('main',null,children);",
 '@/components/office/gkv/GkvKimHost.web':'export const KimHostPanel=()=>null;',
 '@/components/office/gkv/GkvRevisionHistory.web':'export const RevisionHistory=()=>null;',
 '@/components/office/gkv/GkvEditors.web':'export const CaseEditor=()=>null,Choice=()=>null,Field=()=>null,ProfileEditor=()=>null,money=String;',
 '@/lib/auth/context':'export const useAuth=()=>globalThis.monthlyAuth;',
 '@/hooks/usePermissions':"export const usePermissions=()=>({roleKey:'verwaltung',permissions:globalThis.monthlyPermissions,can:p=>globalThis.monthlyPermissions.includes(p)});",
 '@/hooks/useTenantId':'export const useServiceTenantId=()=>globalThis.monthlyTenant;',
 'expo-router':"export const useRouter=()=>({push:path=>globalThis.monthlyNavigation.push(path)}),useNavigation=()=>({dispatch:()=>{}}),useIsFocused=()=>true,usePathname=()=>'/business/office/gkv';",
 'expo-router/react-navigation':'export const usePreventRemove=(prevent,callback)=>{globalThis.monthlyPrevent={prevent,callback};};',
 '@/lib/gkvExchange/repository.web':apiNames.map(name=>`export const ${name}=(...args)=>globalThis.monthlyApi.${name}(...args);`).join('\n'),
};
const entry=`import * as React from 'react';import {createRoot} from 'react-dom/client';
import {GkvMonthlyProofs} from './src/components/office/gkv/GkvMonthlyProofs.web';
import {GkvKassenabrechnungScreen} from './src/screens/office/GkvKassenabrechnungScreen.web';
import {MonthlyProofWriteError} from './src/lib/gkvExchange/monthlyProof';
globalThis.monthlyPanel={React,createRoot,GkvMonthlyProofs,GkvKassenabrechnungScreen,MonthlyProofWriteError};`;
const bundle=await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',tsconfigRaw:{},
 define:{'process.env.NODE_ENV':'"test"'},plugins:[{name:'existing-api-boundaries',setup(b){
  b.onResolve({filter:/.*/},args=>{if(stubs[args.path])return {path:args.path,namespace:'fixture'};
   if(args.path.startsWith('@/')){const base=resolve('src',args.path.slice(2));const path=[base,base+'.ts',base+'.tsx'].find(existsSync);if(path)return {path};}});
  b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:stubs[args.path],loader:'js',resolveDir:process.cwd()}));
 }}]});
const window=new Window({settings:{disableIframePageLoading:true}});
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','Event','MouseEvent','Node','FormData'])globalThis[key]=key==='window'?window:window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const OriginalChannel=globalThis.MessageChannel,channels=[];
globalThis.MessageChannel=class extends OriginalChannel{constructor(){super();channels.push(this);}};
runInThisContext(bundle.outputFiles[0].text);
const {React,createRoot,GkvMonthlyProofs,GkvKassenabrechnungScreen,MonthlyProofWriteError}=globalThis.monthlyPanel;
const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
const calls=[],work=[];let p,ws,list,history,pageAfter=null,key=0,passed=0,captureState,authorities;
function reset(){p=fixture();ws=workspace(null);list=sources(p);history=[];pageAfter=null;calls.length=0;work.length=0;
 authorities=[];captureState={original:null,receipt:null};globalThis.monthlySignaturePng=Buffer.from('synthetic canvas boundary').toString('base64');
 globalThis.monthlyTenant=tenant;globalThis.monthlyAuth={authReady:true,isAuthenticated:true,user:{id:user},portalSession:null};
 globalThis.monthlyPermissions=['office.invoices.view','office.invoices.create'];globalThis.monthlyNavigation=[];
 globalThis.monthlyApi={
  readWorkspace:async()=>({settings:null,batches:[],directories:[]}),
  listMonthlyClients:async(...args)=>{calls.push(['clients',...args]);return {items:[{id:client,name:'Test Patient'}],nextCursor:null};},
  loadMonthlyWorkspace:async(...args)=>{calls.push(['workspace',...args]);return structuredClone(ws);},
  listMonthlySources:async(...args)=>{calls.push(['sources',...args]);return {items:structuredClone(list),nextCursor:pageAfter};},
  loadMonthlyProof:async()=>structuredClone(p),
  readMonthlyProofHistory:async()=>({rows:structuredClone(history),hasMore:false}),listMonthlyEvents:async()=>[],
  commandMonthlyProof:async(_tenant,_role,command,id)=>{calls.push(['write',structuredClone(command),id]);p.id=command.input.new_id||p.id;ws=workspace(p);history=[p];return structuredClone(p);},
  checkMonthlyRequest:async(_tenant,_role,id)=>{calls.push(['status',id]);return {state:'applied',proof:structuredClone(p)};},
  commandMonthlyAuthority:async(proof,_role,command)=>{
    calls.push(['authority',structuredClone(command)]);
    if(command.action==='register')authorities.push({id:command.id,tenant_id:tenant,client_id:client,service_type:proof.payload.serviceType,signer_name:command.signerName,basis:command.basis,
      evidence_reference:command.evidenceReference,review_note:command.reviewNote,valid_from:command.validFrom,valid_until:command.validUntil,reviewed_by:user,reviewed_at:new Date().toISOString(),revoked_by:null,revoked_at:null,revocation_reason:null});
    if(command.action==='revoke'){const a=authorities.find(a=>a.id===command.id);Object.assign(a,{revoked_by:user,revoked_at:new Date().toISOString(),revocation_reason:command.reason});}
    return {tenantId:tenant,clientId:client,proofId:p.id,serviceType:proof.payload.serviceType,canManage:true,checkedAt:new Date().toISOString(),authorities:structuredClone(authorities)};
  },
  requestMonthlyOriginal:async(_tenant,_role,command)=>{
    calls.push(['capture',structuredClone(command)]);const {action,pngBase64,originalSha256,...scope}=command;
    const common={version:1,...scope,actorId:user};
    if(action==='prepare' || action==='read' || action==='archive'){
      captureState.original??={captureId:command.captureId,proofId:p.id,revision:p.revision,contentSha256:p.content_sha256,originalSha256:'b'.repeat(64),originalVersion:randomUUID(),acknowledged:false,...(command.authorityId?{representative:structuredClone(authorities.find(a=>a.id===command.authorityId))}:{})};
      return {...common,kind:'original',original:structuredClone(captureState.original),pdfBase64:Buffer.from('%PDF- synthetic viewer boundary').toString('base64'),
        archive:action==='archive'?{status:p.status,version:p.version,finalizedAt:p.finalized_at,invalidatedAt:p.invalidated_at}:null};
    }
    if(action==='acknowledge'){captureState.original.acknowledged=true;return {...common,kind:'acknowledged',originalSha256};}
    if(action==='verify'){
      captureState.receipt={receiptId:randomUUID(),captureId:command.captureId,proofId:p.id,revision:p.revision,tenantId:tenant,actorId:user,
        contentSha256:p.content_sha256,originalSha256:captureState.original.originalSha256,signatureSha256:createHash('sha256').update(Buffer.from(pngBase64,'base64')).digest('hex')};
      return {...common,kind:'receipt',receipt:structuredClone(captureState.receipt)};
    }
    return {...common,kind:'state',state:captureState.receipt?'verified':captureState.original?.acknowledged?'acknowledged':captureState.original?'prepared':'absent',
      original:structuredClone(captureState.original),receipt:structuredClone(captureState.receipt)};
  },
 };
 window.confirm=()=>true;
}
const button=name=>[...container.querySelectorAll('button')].find(b=>b.textContent===name);
function applySignedCapture(){
 const value=signedProof(p,captureState.receipt.receiptId);value.confirmation.captureId=captureState.receipt.captureId;
 const prefix=`tenant/${tenant}/gkv/monthly/${p.id}/captures/${captureState.receipt.captureId}`;
 value.confirmation.originalPath=prefix+'/original.pdf';value.confirmation.signaturePath=prefix+'/signature.png';
 value.confirmation.originalVersion=captureState.original.originalVersion;
 value.confirmation.originalSha256=captureState.receipt.originalSha256;value.confirmation.signatureSha256=captureState.receipt.signatureSha256;
 if(captureState.original.representative){value.confirmation.signerRole='representative';value.confirmation.signerName=captureState.original.representative.signer_name;value.confirmation.authorityReference=captureState.original.representative.id;}
 p=value;ws=workspace(p);history=[p];return structuredClone(p);
}
const field=name=>[...container.querySelectorAll('label')].find(l=>l.querySelector('span')?.textContent===name)?.querySelector('input,select,textarea');
const click=async name=>{const b=button(name);assert.ok(b,`button ${name} exists`);assert.equal(b.disabled,false,`${name} enabled`);await React.act(async()=>b.click());};
async function input(element,value){assert.ok(element,'input exists');await React.act(async()=>{
 const prototype=element instanceof window.HTMLTextAreaElement?window.HTMLTextAreaElement.prototype:element instanceof window.HTMLSelectElement?window.HTMLSelectElement.prototype:window.HTMLInputElement.prototype;
 Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,value);element.dispatchEvent(new window.Event(element.tagName==='SELECT'?'change':'input',{bubbles:true}));
});}
async function mount({id=tenant,canCreate=true,strict=false,screen=false}={}){
 const node=screen?React.createElement(GkvKassenabrechnungScreen,{key:++key}):React.createElement(GkvMonthlyProofs,{key:++key,tenantId:id,roleKey:'verwaltung',canCreate,onWorkState:s=>work.push(s)});
 await React.act(async()=>root.render(strict?React.createElement(React.StrictMode,null,node):node));
}
async function selectClient(){
 // Fixed synthetic month, independent of wall clock. Month changes are explicit.
 await input(field('Leistungsmonat'),month);await click('Auswahl laden');
 const select=container.querySelector('.gx-monthly-client select');await input(select,client);
}
async function check(name,fn){await React.act(async()=>root.render(null));reset();await fn();passed++;process.stdout.write(`ok ${passed} - ${name}\n`);}
try{
 await check('StrictMode initialization, source selection, duplicate click and server-owned create',async()=>{
  await mount({strict:true});assert.ok(container.querySelector('.gx-monthly-client select option[value="'+client+'"]'));
  await selectClient();const source=container.querySelector('.gx-monthly-source input');await React.act(async()=>source.click());assert.equal(work.at(-1).dirty,true);
  const wait=deferred();globalThis.monthlyApi.commandMonthlyProof=async(_t,_r,c,id)=>{calls.push(['write',structuredClone(c),id]);p.id=c.input.new_id;return wait.promise;};
  await React.act(async()=>{button('Monatsnachweis anlegen').click();button('Monatsnachweis anlegen').click();});
  assert.equal(calls.filter(c=>c[0]==='write').length,1);assert.equal(work.at(-1).busy,true);assert.equal(field('Leistungsmonat').disabled,true);
  ws=workspace(p);history=[p];await React.act(async()=>wait.resolve(structuredClone(p)));
  assert.match(container.textContent,/Gespeicherte Fassung 1/);assert.match(container.textContent,/Körperpflege/);assert.equal(work.at(-1).dirty,false);
 });
 await check('unknown write blocks editing/navigation and checks status without another write',async()=>{
  await mount();await selectClient();await React.act(async()=>container.querySelector('.gx-monthly-source input').click());
  globalThis.monthlyApi.commandMonthlyProof=async(_t,_r,c,id)=>{calls.push(['write',c,id]);p.id=c.input.new_id;ws=workspace(p);history=[p];throw Error('Verbindung unterbrochen');};
  await click('Monatsnachweis anlegen');assert.match(container.textContent,/Ergebnis der Speicherung noch offen/);assert.equal(work.at(-1).busy,true);
  assert.equal(field('Leistungsmonat').disabled,true);assert.equal(button('Unverändert erneut senden'),undefined);
  await click('Speicherung klären');assert.equal(calls.filter(c=>c[0]==='write').length,1);assert.equal(calls.filter(c=>c[0]==='status').length,1);
  assert.equal(work.at(-1).busy,false);assert.equal(work.at(-1).dirty,false);
 });
 await check('not-found retry preserves request and body and recovers an invalidated original',async()=>{
  await mount();await selectClient();await React.act(async()=>container.querySelector('.gx-monthly-source input').click());
  globalThis.monthlyApi.commandMonthlyProof=async(_t,_r,c,id)=>{calls.push(['write',structuredClone(c),id]);p.id=c.input.new_id;
   if(calls.filter(c=>c[0]==='write').length===1)throw Error('Antwort fehlt');p={...finalProof(p),status:'invalidated',invalidated_at:p.updated_at};history=[p];return p;};
  globalThis.monthlyApi.checkMonthlyRequest=async()=>({state:'not_found',proof:null});
  await click('Monatsnachweis anlegen');await click('Speicherung klären');await click('Unverändert erneut senden');
  const writes=calls.filter(c=>c[0]==='write');assert.deepEqual(writes[0],writes[1]);assert.match(container.textContent,/Ungültiger Vorgänger/);
  assert.equal(button('Korrektur beginnen'),undefined);assert.equal(button('Quellen abgleichen und speichern'),undefined);
 });
 await check('final correction is explicit, bound to revision, and shows an unsigned successor plus immutable predecessor',async()=>{
  p=finalProof(p);ws=workspace(p);history=[p];await mount();await selectClient();assert.equal(container.querySelector('.gx-monthly-source'),null);
  await click('Korrektur beginnen');assert.equal(button('Korrekturfassung anlegen').disabled,true);await input(field('Begründung'),'Leistung fachlich korrigieren');
  assert.equal(button('Korrekturfassung anlegen').disabled,true);await React.act(async()=>container.querySelector('.gx-check input').click());
  const old=structuredClone(p);globalThis.monthlyApi.commandMonthlyProof=async(_t,_r,c,id)=>{calls.push(['write',c,id]);assert.equal(c.action,'correct');assert.equal(c.input.revision,old.revision);
   p={...old,id:c.input.new_id,predecessor_id:old.id,version:2,revision:1,status:'open',confirmation:null,finalized_at:null,invalidated_at:null};
   p.payload=structuredClone(old.payload);p.payload.records[0].description='Korrigierte Leistung';ws=workspace(p);history=[p,{...old,status:'invalidated',invalidated_at:old.updated_at}];return p;};
  await click('Korrekturfassung anlegen');assert.match(container.textContent,/Vergleich: Fassung 1 → 2/);assert.match(container.textContent,/Korrigierte Leistung/);
  assert.equal(p.confirmation,null);assert.match(container.textContent,/Ungültiger Vorgänger/);assert.equal(work.at(-1).dirty,false);
 });
 await check('missing signature needs reason and affirmative review; unsaved sources cannot be finalized',async()=>{
  ws=workspace(p);history=[p];await mount();await selectClient();await React.act(async()=>container.querySelector('.gx-monthly-source input').click());
  assert.equal(button('Ausnahme ohne Unterschrift dokumentieren').disabled,true);await React.act(async()=>container.querySelector('.gx-monthly-source input').click());
  await click('Ausnahme ohne Unterschrift dokumentieren');assert.match(container.textContent,/noch im Klientenportal/);
  assert.equal(container.querySelector('.gx-monthly-source input').disabled,true);await input(field('Begründung'),'Nachvollziehbarer Ausnahmefall');
  assert.equal(button('Endgültig ohne Unterschrift abschließen').disabled,true);await React.act(async()=>container.querySelector('.gx-check input').click());
  globalThis.monthlyApi.commandMonthlyProof=async(_t,_r,c,id)=>{calls.push(['write',c,id]);assert.equal(c.action,'finalize_missing');assert.equal(c.input.content_sha256,p.content_sha256);
   p=finalProof(p);ws=workspace(p);history=[p];return p;};await click('Endgültig ohne Unterschrift abschließen');assert.match(container.textContent,/Endgültig ohne Unterschrift/);
 });
 await check('read-only and revoked delegation expose originals but no write actions',async()=>{
  ws=workspace(p);ws.canWrite=false;history=[p];await mount();await selectClient();assert.match(container.textContent,/Nur Ansicht/);
  assert.equal(button('Quellen abgleichen und speichern'),undefined);assert.equal(button('Ausnahme ohne Unterschrift dokumentieren'),undefined);
  ws.canWrite=true;await mount({canCreate:false});await selectClient();assert.equal(button('Quellen abgleichen und speichern'),undefined);
  await mount();await selectClient();await input(field('Begründung für den Quellenabgleich'),'Quellstand erneut prüfen');
  globalThis.monthlyApi.commandMonthlyProof=async()=>{throw new MonthlyProofWriteError('Beauftragung entzogen',false);};
  await click('Quellen abgleichen und speichern');assert.match(container.textContent,/Beauftragung entzogen/);assert.equal(button('Speicherung klären'),undefined);
 });
 await check('stored sources outside the loaded page remain visible, selected and removable; other-series sources stay locked',async()=>{
  ws=workspace(p);history=[p];list=[{...sources(fixture())[0],assignedSeriesId:randomUUID()}];await mount();await selectClient();
  const boxes=[...container.querySelectorAll('.gx-monthly-source input')];assert.equal(boxes.length,2);assert.equal(boxes[0].disabled,true);assert.equal(boxes[1].checked,true);
  await React.act(async()=>boxes[1].click());assert.match(container.textContent,/0 Leistungen ausgewählt/);assert.equal(button('Quellen abgleichen und speichern').disabled,true);
 });
 await check('late response from old tenant cannot populate the new panel',async()=>{
  await mount();const wait=deferred();globalThis.monthlyApi.loadMonthlyWorkspace=()=>wait.promise;
  const select=container.querySelector('.gx-monthly-client select');await input(select,client);assert.match(container.textContent,/Monatsnachweise laden/);
  const nextTenant=randomUUID();globalThis.monthlyApi.listMonthlyClients=async()=>({items:[],nextCursor:null});await mount({id:nextTenant});
  await React.act(async()=>wait.resolve(ws));assert.ok(!container.textContent.includes('Test Patient ·'));assert.equal(container.querySelector('.gx-monthly-source'),null);
 });
 await check('missing database extension is actionable and never silently simulated',async()=>{
  globalThis.monthlyApi.listMonthlyClients=async()=>{throw Error('Monatsnachweise sind für dieses Unternehmen noch nicht freigeschaltet.');};await mount();
  assert.match(container.querySelector('[role="alert"]').textContent,/noch nicht freigeschaltet/);assert.ok(button('Auswahl laden'));assert.equal(button('Monatsnachweis anlegen'),undefined);
 });
 await check('Office navigation respects dirty monthly input, uncertain writes and auth remount',async()=>{
  await mount({screen:true});await click('Monatsnachweise');await selectClient();await React.act(async()=>container.querySelector('.gx-monthly-source input').click());
  let confirms=0;window.confirm=()=>{confirms++;return false;};await click('Abrechnungsprofil');assert.equal(button('Monatsnachweise').getAttribute('aria-pressed'),'true');assert.equal(confirms,1);
  const leave=new window.Event('caresuite:before-page-leave',{cancelable:true});window.dispatchEvent(leave);assert.equal(leave.defaultPrevented,true);
  globalThis.monthlyApi.commandMonthlyProof=async()=>{throw Error('Antwort fehlt');};await click('Monatsnachweis anlegen');
  assert.equal(button('Rechnungen').disabled,true);assert.equal(button('Abrechnungsprofil').disabled,true);assert.equal(globalThis.monthlyPrevent.prevent,true);
  globalThis.monthlyAuth={...globalThis.monthlyAuth,user:{id:randomUUID()}};
  await React.act(async()=>root.render(React.createElement(GkvKassenabrechnungScreen,{key})));assert.equal(button('Speicherung klären'),undefined);
  assert.equal(button('Abrechnungspakete').getAttribute('aria-pressed'),'true');assert.equal(button('Rechnungen').disabled,false);
 });
 await check('personal confirmation requires opened PDF and review before the new canvas capture; final command is separate',async()=>{
  ws=workspace(p);history=[p];await mount();await selectClient();await click('Original zur Bestätigung öffnen');
  assert.equal(field('Leistungsmonat').disabled,true);assert.equal(work.at(-1).dirty,true);
  assert.equal(button('Geprüft, Unterschrift erfassen').disabled,true);assert.equal(button('Unterschrift im Test zeichnen'),undefined);
  await React.act(async()=>container.querySelector('iframe[title="Originalfassung des Monatsnachweises"]').dispatchEvent(new window.Event('load')));
  await React.act(async()=>container.querySelector('.gx-signature-choice input').click());await click('Geprüft, Unterschrift erfassen');
  await click('Unterschrift im Test zeichnen');assert.equal(calls.filter(c=>c[0]==='write').length,0);
  let command;globalThis.monthlyApi.commandMonthlyProof=async(_t,_r,c,id)=>{command=c;calls.push(['write',c,id]);
    return applySignedCapture();};
  await click('Monatsbestätigung speichern');assert.equal(command.action,'confirm');assert.equal(command.input.receipt_id,captureState.receipt.receiptId);
  assert.equal(button('Unterschrift im Test zeichnen'),undefined);assert.ok(button('Archivoriginal öffnen'));assert.equal(work.at(-1).dirty,false);
 });
 await check('representative review, original selection, new signature and final receipt stay bound in the actual UI',async()=>{
  ws=workspace(p);history=[p];await mount();await selectClient();await input(field('Wer bestätigt den Monatsnachweis?'),'representative');
  assert.equal(button('Original zur Bestätigung öffnen').disabled,true);await click('Vertretungsprüfung dokumentieren');
  assert.equal(work.at(-1).dirty,true);assert.equal(field('Leistungsmonat').disabled,true);
  for(const [name,value] of [['name','Fiktive Vertreterin'],['reference','Prüfakte TEST 42'],['note','Identität und Vollmacht für diese Leistungsart geprüft.'],['from','2026-01-01T00:00'],['until','2027-12-31T23:59']])await input(container.querySelector(`.gx-representative input[name="${name}"]`),value);
  await React.act(async()=>container.querySelector('input[name="reviewed"]').click());await click('Geprüfte Berechtigung speichern');
  assert.equal(authorities.length,1);assert.equal(field('Geprüfte Vertretung').value,authorities[0].id);assert.equal(work.at(-1).dirty,false);
  await click('Original zur Bestätigung öffnen');assert.equal(field('Wer bestätigt den Monatsnachweis?').disabled,true);
  assert.equal(calls.find(c=>c[0]==='capture')[1].authorityId,authorities[0].id);
  await React.act(async()=>container.querySelector('iframe').dispatchEvent(new window.Event('load')));
  assert.match(container.querySelector('.gx-signature-choice').textContent,/Fiktive Vertreterin/);
  await React.act(async()=>container.querySelector('.gx-signature-choice input').click());await click('Geprüft, Unterschrift erfassen');await click('Unterschrift im Test zeichnen');
  globalThis.monthlyApi.commandMonthlyProof=async()=>applySignedCapture();await click('Monatsbestätigung speichern');
  assert.equal(p.confirmation.signerRole,'representative');assert.equal(p.confirmation.authorityReference,authorities[0].id);assert.equal(work.at(-1).dirty,false);
 });
 await check('unavailable representative permissions cannot create or silently fall back to patient',async()=>{
  ws=workspace(p);history=[p];const api=globalThis.monthlyApi.commandMonthlyAuthority;
  globalThis.monthlyApi.commandMonthlyAuthority=async(...args)=>({...await api(...args),canManage:false});
  await mount();await selectClient();await input(field('Wer bestätigt den Monatsnachweis?'),'representative');
  assert.match(container.textContent,/noch keine gültige Vertretungsprüfung/);assert.equal(button('Vertretungsprüfung dokumentieren'),undefined);
  assert.equal(button('Original zur Bestätigung öffnen').disabled,true);assert.equal(calls.filter(c=>c[0]==='capture').length,0);
 });
 await check('lost representative review reply is recovered by reading, without duplicate review or signature',async()=>{
  ws=workspace(p);history=[p];const api=globalThis.monthlyApi.commandMonthlyAuthority;
  globalThis.monthlyApi.commandMonthlyAuthority=async(...args)=>{const result=await api(...args);if(args[2].action==='register')throw Error('Antwort fehlt');return result;};
  await mount();await selectClient();await input(field('Wer bestätigt den Monatsnachweis?'),'representative');await click('Vertretungsprüfung dokumentieren');
  for(const [name,value] of [['name','Fiktive Vertreterin'],['reference','Prüfakte TEST 43'],['note','Persönliche Prüfung der Befugnis dokumentiert.'],['from','2026-01-01T00:00'],['until','2027-12-31T23:59']])await input(container.querySelector(`input[name="${name}"]`),value);
  await React.act(async()=>container.querySelector('input[name="reviewed"]').click());await click('Geprüfte Berechtigung speichern');
  assert.equal(work.at(-1).dirty,true);assert.equal(button('Original zur Bestätigung öffnen').disabled,true);assert.equal(container.querySelector('input[name="name"]').closest('fieldset').disabled,true);
  await click('Gespeicherten Stand prüfen');assert.equal(authorities.length,1);assert.equal(work.at(-1).dirty,false);
  assert.equal(calls.filter(c=>c[0]==='authority' && c[1].action==='register').length,1);assert.equal(calls.filter(c=>c[0]==='capture').length,0);
 });
 await check('late representative response is discarded when the tenant or permission context is replaced',async()=>{
  ws=workspace(p);history=[p];const wait=deferred(),api=globalThis.monthlyApi.commandMonthlyAuthority;let response;
  globalThis.monthlyApi.commandMonthlyAuthority=async(...args)=>{response=await api(...args);return wait.promise;};
  await mount();await selectClient();await input(field('Wer bestätigt den Monatsnachweis?'),'representative');
  await mount({canCreate:false});await React.act(async()=>wait.resolve(response));
  assert.equal(field('Geprüfte Vertretung'),undefined);assert.equal(button('Original zur Bestätigung öffnen'),undefined);
 });
 await check('lost final confirmation stays locked and reads the applied receipt without confirming or signing twice',async()=>{
  ws=workspace(p);history=[p];await mount();await selectClient();await click('Original zur Bestätigung öffnen');
  await React.act(async()=>container.querySelector('iframe').dispatchEvent(new window.Event('load')));
  await React.act(async()=>container.querySelector('.gx-signature-choice input').click());await click('Geprüft, Unterschrift erfassen');await click('Unterschrift im Test zeichnen');
  globalThis.monthlyApi.commandMonthlyProof=async(_t,_r,c,id)=>{calls.push(['write',c,id]);applySignedCapture();throw new MonthlyProofWriteError('Antwort fehlt',true);};
  await click('Monatsbestätigung speichern');assert.equal(field('Leistungsmonat').disabled,true);assert.ok(button('Speicherung klären'));
  assert.equal(button('Monatsbestätigung speichern').disabled,true);await click('Speicherung klären');
  assert.ok(button('Archivoriginal öffnen'));assert.equal(work.at(-1).dirty,false);assert.equal(calls.filter(c=>c[0]==='write').length,1);
  assert.equal(calls.filter(c=>c[0]==='capture'&&c[1].action==='verify').length,1);
 });
 await check('lost verification response blocks navigation and recovers the receipt without signing or issuing twice',async()=>{
  ws=workspace(p);history=[p];const api=globalThis.monthlyApi.requestMonthlyOriginal;
  globalThis.monthlyApi.requestMonthlyOriginal=async(...args)=>{const result=await api(...args);if(args[2].action==='verify')throw Error('Antwort fehlt');return result;};
  await mount();await selectClient();await click('Original zur Bestätigung öffnen');
  await React.act(async()=>container.querySelector('iframe').dispatchEvent(new window.Event('load')));
  await React.act(async()=>container.querySelector('.gx-signature-choice input').click());await click('Geprüft, Unterschrift erfassen');await click('Unterschrift im Test zeichnen');
  assert.equal(work.at(-1).busy,true);assert.equal(field('Leistungsmonat').disabled,true);assert.equal(button('Unterschrift im Test zeichnen'),undefined);
  await click('Erfassung prüfen');assert.ok(button('Monatsbestätigung speichern'));assert.equal(calls.filter(c=>c[0]==='capture'&&c[1].action==='verify').length,1);
  assert.equal(calls.filter(c=>c[0]==='write').length,0);
 });
 await check('unconfigured host is visible, never simulated, and an explicit close releases the selection',async()=>{
  ws=workspace(p);history=[p];globalThis.monthlyApi.requestMonthlyOriginal=async()=>{throw Error('Die Verbindung für Monatsunterschriften ist noch nicht eingerichtet.');};
  await mount();await selectClient();await click('Original zur Bestätigung öffnen');assert.match(container.textContent,/noch nicht eingerichtet/);
  assert.equal(button('Unterschrift im Test zeichnen'),undefined);assert.equal(button('Monatsbestätigung speichern'),undefined);
  await click('Erfassung schließen');assert.equal(field('Leistungsmonat').disabled,false);assert.equal(work.at(-1).dirty,false);
 });
 await check('a late original response cannot return after tenant switch or revoked write delegation',async()=>{
  ws=workspace(p);history=[p];const wait=deferred(),api=globalThis.monthlyApi.requestMonthlyOriginal;let response;
  globalThis.monthlyApi.requestMonthlyOriginal=async(...args)=>{response=await api(...args);return wait.promise;};
  await mount();await selectClient();await React.act(async()=>button('Original zur Bestätigung öffnen').click());
  await mount({canCreate:false});await React.act(async()=>wait.resolve(response));assert.equal(container.querySelector('iframe'),null);assert.equal(button('Monatsbestätigung speichern'),undefined);
 });
 process.stdout.write(`Monthly UI: ${passed} checks passed (synthetic API/canvas boundaries, DOM only; no visual approval).\n`);
}finally{await React.act(async()=>root.unmount());await window.happyDOM.abort();for(const channel of channels){channel.port1.close();channel.port2.close();}}
