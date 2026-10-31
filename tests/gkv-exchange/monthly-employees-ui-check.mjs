// Actual React forms and writer; API/auth boundaries remain synthetic. DOM only.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Window} from 'happy-dom';
import {runInThisContext} from 'node:vm';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const tenant=randomUUID(),actor=randomUUID(),other=randomUUID(),employee=randomUUID();
const stubs={
 '@/lib/gkvExchange/monthlyEmployeeClient.web':['loadEmployeeRegistrations','commandEmployeeRegistration','employeeRequestStatus'].map(n=>`export const ${n}=(...a)=>globalThis.employeeApi.${n}(...a);`).join('\n'),
 '@/lib/auth/context':'export const useAuth=()=>globalThis.employeeAuth;',
 '@/hooks/useTenantId':'export const useServiceTenantId=()=>globalThis.employeeTenant;',
 '@/hooks/useGkvUnsavedChanges.web':`export const useGkvUnsavedChanges=(dirty,busy)=>{globalThis.employeeGuard={dirty,busy};return {confirmLeave:()=>!busy&&(!dirty||window.confirm('Verwerfen?'))};};`,
};
const bundle=await build({stdin:{contents:"import * as React from 'react';import {createRoot} from 'react-dom/client';import {GkvEmployeePanel,GkvEmployeeSelf} from './src/components/office/gkv/GkvEmployees.web';globalThis.employeeUi={React,createRoot,GkvEmployeePanel,GkvEmployeeSelf};",resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',tsconfigRaw:{},plugins:[{name:'boundaries',setup(b){
 b.onResolve({filter:/.*/},args=>{if(stubs[args.path])return {path:args.path,namespace:'fixture'};if(args.path.startsWith('@/')){const base=resolve('src',args.path.slice(2)),path=[base,base+'.ts',base+'.tsx'].find(existsSync);if(path)return {path};}});
 b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:stubs[args.path],loader:'js',resolveDir:process.cwd()}));
}}]});
const window=new Window();for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Event','MouseEvent','Node','FormData'])globalThis[key]=key==='window'?window:window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const OriginalChannel=globalThis.MessageChannel,channels=[];globalThis.MessageChannel=class extends OriginalChannel{constructor(){super();channels.push(this);}};
runInThisContext(bundle.outputFiles[0].text);
const {React,createRoot,GkvEmployeePanel,GkvEmployeeSelf}=globalThis.employeeUi;
const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
let ws,calls,work,passed=0,key=0;
const pending=(owner=actor)=>({id:randomUUID(),tenant_id:tenant,employee_id:employee,actor_id:owner,employee_number:'234567890',employee_name:'Fiktive Pflegekraft',evidence_reference:'Synthetischer Beleg',submitted_at:'2026-10-30T08:00:00Z',revision:1,state:'pending',reviewed_by:null,reviewed_at:null,review_reference:null,review_note:null,valid_from:null,valid_until:null,closed_by:null,closed_at:null,close_reason:null});
function reset(){calls=[];work=[];ws={tenantId:tenant,actorId:actor,employeeId:employee,employeeName:'Fiktive Pflegekraft',canReview:true,checkedAt:'2026-10-31T09:00:00Z',items:[],nextCursor:null};
 globalThis.employeeAuth={authReady:true,isAuthenticated:true,user:{id:actor},portalSession:null};globalThis.employeeTenant=tenant;
 globalThis.employeeApi={loadEmployeeRegistrations:async(...a)=>{calls.push(['list',...a]);return structuredClone(ws);},
  commandEmployeeRegistration:async(t,a,c,id)=>{calls.push(['write',structuredClone(c),id]);const r=c.action==='submit'?{...pending(a),id:c.input.id,employee_number:c.input.employeeNumber,evidence_reference:c.input.evidenceReference}:{...ws.items.find(r=>r.id===c.input.id),revision:2,state:{approve:'approved',reject:'rejected',withdraw:'withdrawn',revoke:'revoked'}[c.action]};return r;},
  employeeRequestStatus:async(t,a,id)=>{calls.push(['status',id]);return {state:'not-found',tenantId:t,requestId:id};}};
 window.confirm=()=>true;
}
const button=name=>[...container.querySelectorAll('button')].find(b=>b.textContent===name);
const field=name=>[...container.querySelectorAll('label')].find(l=>l.textContent===name)?.querySelector('input,textarea');
const disabled=b=>b.disabled||!!b.closest('fieldset:disabled');
async function click(name){const b=button(name);assert.ok(b,name);assert.equal(disabled(b),false,name+' enabled');await React.act(async()=>b.click());}
async function input(name,value){const e=field(name);assert.ok(e,name);await React.act(async()=>{const prototype=e.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(e,value);e.dispatchEvent(new window.Event('input',{bubbles:true}));});}
async function mount({self=false,owner=actor,t=tenant,strict=false}={}){const node=self?React.createElement(GkvEmployeeSelf,{key:++key}):React.createElement(GkvEmployeePanel,{key:++key,tenantId:t,actorId:owner,onWorkState:s=>work.push(s)});await React.act(async()=>root.render(strict?React.createElement(React.StrictMode,null,node):node));}
async function check(name,run){await React.act(async()=>root.render(null));reset();await run();process.stdout.write(`ok ${++passed} - ${name}\n`);}
async function submit(){await input('GKV-Beschäftigtennummer','234567890');await input('Referenz auf den Nummernnachweis','Eigenen Beleg geprüft');await click('Zur Prüfung melden');}
try{
 await check('own submission sends no actor, employee or success flag and clears its form',async()=>{await mount();await submit();const c=calls.find(c=>c[0]==='write')[1];assert.deepEqual(Object.keys(c.input).sort(),['employeeNumber','evidenceReference','id']);assert.equal(c.action,'submit');assert.equal(field('GKV-Beschäftigtennummer').value,'');assert.equal(work.at(-1).dirty,false);assert.match(container.textContent,/Prüfung ausstehend/);});
 await check('self cannot approve or revoke their own registration',async()=>{ws.items=[pending()];await mount();await click('Meldung bearbeiten');assert.equal(button('Zuordnung freigeben'),undefined);assert.equal(button('Zuordnung widerrufen'),undefined);assert.equal(disabled(button('Meldung zurückziehen')),true);await input('Prüfvermerk oder Begründung','Falschen Beleg ausgewählt');await click('Meldung zurückziehen');assert.equal(calls.find(c=>c[0]==='write')[1].action,'withdraw');});
 await check('review requires explicit independent check, reference, note and German validity date',async()=>{ws.items=[pending(other)];await mount();await click('Meldung bearbeiten');assert.equal(disabled(button('Zuordnung freigeben')),true);await input('Referenz auf den geprüften Nachweis','Beleg unabhängig geprüft');await input('Prüfvermerk oder Begründung','Person und Nummer abgeglichen');await input('Gültig bis einschließlich','2027-06-30');assert.equal(disabled(button('Zuordnung freigeben')),true);await React.act(async()=>container.querySelector('input[type="checkbox"]').click());await click('Zuordnung freigeben');const c=calls.find(c=>c[0]==='write')[1];assert.equal(c.input.reviewed,true);assert.equal(c.input.validUntil,'2027-06-30T21:59:59.999Z');assert.equal(c.input.revision,1);});
 await check('response loss locks fields and never repeats approval during read-only recovery',async()=>{let stored;const api=globalThis.employeeApi.commandEmployeeRegistration;globalThis.employeeApi.commandEmployeeRegistration=async(...a)=>{stored=await api(...a);throw Error('Antwort verloren');};globalThis.employeeApi.employeeRequestStatus=async(t,a,id)=>{calls.push(['status',id]);return {state:'applied',tenantId:t,requestId:id,registration:stored};};await mount();await submit();assert.ok(button('Auftragsstatus prüfen'));assert.equal(disabled(button('Stand aktualisieren')),true);assert.equal(work.at(-1).busy,true);assert.equal(button('Unverändert erneut senden'),undefined);await click('Auftragsstatus prüfen');assert.equal(calls.filter(c=>c[0]==='write').length,1);assert.equal(work.at(-1).busy,false);});
 await check('explicit retry after absent status uses exactly the original request and input',async()=>{globalThis.employeeApi.commandEmployeeRegistration=async(t,a,c,id)=>{calls.push(['write',structuredClone(c),id]);throw Error('Antwort fehlt');};await mount();await submit();await click('Auftragsstatus prüfen');await click('Unverändert erneut senden');const writes=calls.filter(c=>c[0]==='write');assert.equal(writes.length,2);assert.deepEqual(writes[0],writes[1]);});
 await check('late response is ignored after changing the tenant/account',async()=>{let resolvePage;globalThis.employeeApi.loadEmployeeRegistrations=()=>new Promise(r=>{resolvePage=r;});await mount();const old=resolvePage;globalThis.employeeApi.loadEmployeeRegistrations=async()=>({...ws,employeeName:'Anderer Zugang',items:[]});await mount({owner:other,t:randomUUID()});await React.act(async()=>old({...ws,employeeName:'ALTES KONTO',items:[pending()]}));assert.equal(container.textContent.includes('ALTES KONTO'),false);assert.equal(container.textContent.includes('234567890'),false);});
 await check('employee profile lazily opens its own panel and keeps unsaved/unknown work protected',async()=>{globalThis.employeeAuth.portalSession={loginType:'employee_portal'};await mount({self:true,strict:true});assert.equal(calls.length,0);await click('Eigene Zuordnung öffnen');await input('GKV-Beschäftigtennummer','234567890');assert.equal(globalThis.employeeGuard.dirty,true);window.confirm=()=>false;await click('Bereich schließen');assert.ok(field('GKV-Beschäftigtennummer'));window.confirm=()=>true;await click('Bereich schließen');assert.equal(field('GKV-Beschäftigtennummer'),undefined);});
 await check('client and relative portals have no employee-number form',async()=>{for(const loginType of ['client_portal','relative_portal']){globalThis.employeeAuth.portalSession={loginType};await mount({self:true});assert.equal(container.querySelector('button'),null);}assert.equal(calls.length,0);});
 await check('unconfigured backend shows a recoverable failure without dummy registrations',async()=>{globalThis.employeeApi.loadEmployeeRegistrations=async()=>{throw Error('Noch nicht freigeschaltet');};await mount();assert.match(container.textContent,/Noch nicht freigeschaltet/);assert.equal(field('GKV-Beschäftigtennummer'),undefined);assert.equal(disabled(button('Stand aktualisieren')),false);});
 process.stdout.write(`Employee UI: ${passed} checks passed (DOM only; no visual approval).\n`);
}finally{await React.act(async()=>root.unmount());await window.happyDOM.abort();for(const c of channels){c.port1.close();c.port2.close();}}
