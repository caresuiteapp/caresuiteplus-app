/* global setTimeout */
// DOM interaction of actual portal panels. No browser layout engine or live data.
import { build } from 'esbuild';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Window } from 'happy-dom';
const output=await mkdtemp(join(tmpdir(),'care-portal-dom-'));
const mocks={
 '@/hooks/usePortalActor':`export const usePortalActor=()=>({roleKey:window.role,tenantId:'tenant',actorId:'actor',clientId:'client',employeeId:'employee',displayName:'Test Klient',isLinkedReady:true});`,
 '@/hooks/core':`import {useState,useEffect} from 'react';export function useAsyncQuery(fetcher,deps,options){const[data,setData]=useState(null);const[loading,setLoading]=useState(true);const refresh=async()=>{const r=await fetcher();setData(r.data);setLoading(false)};useEffect(()=>{if(options?.enabled!==false)void refresh()},deps);return{data,loading,error:null,refreshError:null,refresh}}`,
 '@/components/ui':`import React from 'react';export const SectionPanel=({title,children})=><section><h2>{title}</h2>{children}</section>;export const PremiumButton=({title,onPress,disabled})=><button disabled={disabled} onClick={onPress}>{title}</button>;export const PremiumInput=({label,value,onChangeText,multiline,editable})=>multiline?<textarea aria-label={label} value={value} onChange={e=>onChangeText(e.target.value)} disabled={editable===false}/>:<input aria-label={label} value={value} onChange={e=>onChangeText(e.target.value)} disabled={editable===false}/>;export const LoadingState=({message})=><p>{message}</p>;export const ErrorState=({message})=><p role="alert">{message}</p>;`,
 '@/components/inputs/CareSignatureModal':`import React from 'react';export const CareSignatureModal=({visible,onConfirm,disabled})=>visible?<button disabled={disabled} onClick={()=>onConfirm('data:image/png;base64,iVBORw0KGgoAAAA')}>Testunterschrift bestätigen</button>:null;`,
 '@/design/tokens/carelightadaptive':`export const useCareLightPalette=()=>({c:{text:'#fff',muted:'#bbb'}});`,
 '@/lib/formatters/dateTimeFormatters':`export const formatDate=v=>String(v);export const formatTime=v=>String(v);`,
 '@/lib/pflege/carePortalService':`import {berlinCalendarDate} from '${resolve('src/lib/pflege/careTourWorkflow.ts')}';window.calls=[];export const fetchMyCareProofs=async()=>({ok:true,data:[{id:'proof',date:'2026-10-02',service:'Grundpflege',employee:'Pflegekraft',note:'Durchgeführt',amountCents:3275,status:'submitted'}]});export const downloadMyCareProof=async()=>({ok:true,data:{id:'proof'}});export const fetchMyCareSignature=async()=>({ok:true,data:{pngDataUrl:'png'}});export const fetchMyCareTours=async()=>({ok:true,data:[{id:'tour',date:berlinCalendarDate(),name:'Tour',status:'in_progress',stops:[{id:'stop',client:'Klient',address:'Dortmund',start:'07:00',end:'07:30',service:'Grundpflege',status:'in_progress'}]}]});export const signMyCareProof=async(...args)=>{window.calls.push(['sign',...args]);await new Promise(r=>setTimeout(r,50));return{ok:true,data:{id:'proof'}}};export const advanceMyCareTour=async(...args)=>{window.calls.push(['tour',...args]);return{ok:true,data:{id:'tour'}}};export const advanceMyCareStop=async(...args)=>{window.calls.push(['stop',...args]);await new Promise(r=>setTimeout(r,50));return{ok:true,data:{id:'stop'}}};`,
};
await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{ClientCareProofPanel,EmployeeCareToursPanel}from'${resolve('src/components/pflege/PortalCarePanels.tsx')}';window.root=createRoot(document.getElementById('root'));window.renderPanel=()=>window.root.render(window.role==='client_portal'?<ClientCareProofPanel/>:<EmployeeCareToursPanel/>);window.renderPanel();`,resolveDir:process.cwd(),loader:'tsx'},outfile:join(output,'app.js'),bundle:true,jsx:'automatic',platform:'browser',define:{'process.env.NODE_ENV':'"test"',__DEV__:'false'},plugins:[{name:'controlled-portal-fixtures',setup(b){b.onResolve({filter:/.*/},a=>mocks[a.path]?{path:a.path,namespace:'mock'}:a.path==='react-native'?{path:resolve('node_modules/react-native-web/dist/index.js')}:a.path.startsWith('@/')?{path:resolve('src',a.path.slice(2)+'.ts')}:undefined);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:process.cwd()}));}}]});
const settle=()=>new Promise(r=>setTimeout(r,90));
for(const role of ['client_portal','employee_portal']){
 const w=new Window({console,settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true}});w.eval('window.role='+JSON.stringify(role));w.document.write('<div id="root"></div>');w.eval(await readFile(join(output,'app.js'),'utf8'));await settle();
 await writeFile(join(output,role+'.html'),w.document.documentElement.outerHTML);
 const button=title=>[...w.document.querySelectorAll('button')].find(b=>b.textContent===title);
 if(role==='client_portal'){
  if(!button('Leistung prüfen und unterschreiben'))throw Error(w.document.body.innerHTML);button('Leistung prüfen und unterschreiben').click();await settle();button('Unterschrift erfassen').click();await settle();
  const confirm=button('Testunterschrift bestätigen');confirm.click();confirm.click();await settle();
  if(w.calls.filter(c=>c[0]==='sign').length!==1)throw Error('Doppelte Signaturanfrage');
  if(w.calls[0][1]!=='proof'||w.calls[0][2]!=='Test Klient')throw Error('Falscher Signaturbezug');
 }else{
  if(!button('Dokumentieren und abschließen').disabled||!button('Tour abschließen').disabled)throw Error('Abschluss ohne Durchführung möglich');
  const input=w.document.querySelector('textarea');Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype,'value').set.call(input,'Pflege durchgeführt.');input.dispatchEvent(new w.Event('input',{bubbles:true}));await settle();
  const finish=button('Dokumentieren und abschließen');if(finish.disabled)throw Error('Abschluss bleibt trotz Dokumentation gesperrt');finish.click();finish.click();await settle();
  if(w.calls.filter(c=>c[0]==='stop').length!==1||w.calls[0][4]!=='Pflege durchgeführt.')throw Error('Durchführung nicht eindeutig gespeichert');
 }
 await writeFile(join(output,role+'.html'),w.document.documentElement.outerHTML);await w.happyDOM.abort();w.close();
}
console.log(JSON.stringify({passed:true,scope:'Actual portal panels with controlled fixtures; DOM only, no layout or live delivery',output}));
