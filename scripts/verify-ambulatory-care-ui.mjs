/* global setTimeout, document */
/** Isolated layout and interaction QA of the real tour screen. No live data/network. */
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const output = await mkdtemp(join(tmpdir(), 'caresuite-ambulatory-ui-'));
const screen = resolve('src/screens/pflege/CareTourPlanningScreen.tsx');
const fixtures = `
import React from 'react';
import { berlinCalendarDate } from '${resolve('src/lib/pflege/careTourWorkflow.ts')}';
const date=berlinCalendarDate();
const tour={id:'tour',tourDate:date,name:'Frühtour Dortmund – ambulante Versorgung',employeeId:'employee',employeeName:'Alexandra Pflegefachkraft',vehicleLabel:'DO-CS 101',status:'in_progress',notes:'Schlüsselübergabe vor dem ersten Einsatz.',events:[{id:'event',action:'published→in_progress',note:'',occurredAt:'2026-10-02T05:00:00Z'}],stops:[{id:'stop',sequenceNo:1,clientId:'client',clientName:'Maximilian Alexander Musterklient mit langem Doppelnamen',address:'Torgauer Straße 7, 44263 Dortmund',plannedStart:'07:00',plannedEnd:'07:45',serviceSummary:'Unterstützung bei der Körperpflege und Mobilisation',status:'in_progress',notes:'',actualStartedAt:'2026-10-02T05:05:00Z',actualEndedAt:'',serviceProofId:''},{id:'stop2',sequenceNo:2,clientId:'client2',clientName:'Erika Musterfrau',address:'Beispielstraße 10, 44137 Dortmund',plannedStart:'08:00',plannedEnd:'08:30',serviceSummary:'Grundpflege',status:'planned',notes:'',actualStartedAt:'',actualEndedAt:'',serviceProofId:''}]};
export const fetchCareTours=async()=>({ok:true,data:[tour]});
export const fetchCareTourResources=async()=>({ok:true,data:{employees:[{id:'employee',name:'Alexandra Pflegefachkraft',qualification:'Pflegefachkraft'}],clients:[{id:'client',name:'Maximilian Musterklient',address:'Torgauer Straße 7, Dortmund'},{id:'client2',name:'Erika Musterfrau',address:'Beispielstraße 10, Dortmund'}]}});
window.calls=[];
export const createCareTour=async(...args)=>{window.calls.push(['create',args]);return {ok:true,data:{id:'new'}}};
export const updateCareTourStatus=async(...args)=>{window.calls.push(['tour',args]);return {ok:true,data:{id:'tour'}}};
export const updateCareTourStopStatus=async(...args)=>{window.calls.push(['stop',args]);return {ok:true,data:{id:args[1]}}};
`;
const mocks = {
 '@/components/layout': `import React from 'react'; export const ScreenShell=({title,subtitle,children})=><main style={{maxWidth:1180,margin:'auto',padding:16}}><h1>{title}</h1><p>{subtitle}</p>{children}</main>;`,
 '@/components/ui': `import React from 'react';export const ErrorState=({message})=><div role="alert">{message}</div>;export const LoadingState=({message})=><div>{message}</div>;`,
 '@/hooks/core': `import {useEffect,useState} from 'react';export function useAsyncQuery(fetcher,deps,options){const [data,setData]=useState(null);const [loading,setLoading]=useState(true);const refresh=async()=>{const r=await fetcher();setData(r.data);setLoading(false)};useEffect(()=>{if(options.enabled)void refresh();else setLoading(false)},[...deps,options.enabled]);return {data,loading,error:null,refreshError:null,refresh}}`,
 '@/hooks/useTenantId': `export const useServiceTenantId=()=> 'tenant';`,
 '@/lib/auth/context': `export const useAuth=()=>({profile:{id:'actor',roleKey:'nurse'}});`,
 '@/lib/permissions': `export const hasPermission=()=>true;`,
 '@/lib/pflege/careTourPlanningService': fixtures,
 'expo-router': `export const useRouter=()=>({push:(url)=>window.calls.push(['route',url])});`,
 '@/design/tokens/carelightadaptive': `import {careSuiteColors} from '${resolve('src/design/tokens/colors.ts')}';const p=careSuiteColors.light;const c={surface:p.background.elevated,surfaceAlt:p.background.soft,text:p.text.primary,muted:p.text.muted,border:'rgba(255,255,255,0.1)'};export const useCareLightPalette=()=>({c});`,
};
await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {CareTourPlanningScreen} from '${screen}';createRoot(document.getElementById('root')).render(<CareTourPlanningScreen/>);`, resolveDir: process.cwd(), loader: 'tsx' }, outfile: join(output,'app.js'), bundle: true, jsx: 'automatic', platform: 'browser', define: { 'process.env.NODE_ENV': '"test"', __DEV__: 'false' }, plugins: [{ name: 'isolated-qa', setup(b) {
 b.onResolve({filter:/.*/},args=>{
  if(mocks[args.path])return {path:args.path,namespace:'mock'};
  if(args.path==='react-native')return {path:resolve('node_modules/react-native-web/dist/index.js')};
  if(args.path.startsWith('@/'))return {path:resolve('src',args.path.slice(2)+'.ts')};
 });
 b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'tsx',resolveDir:process.cwd()}));
} }] });
const html='<!doctype html><html lang="de"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#071124;color:#f1f5ff;font-family:Arial,sans-serif}*{box-sizing:border-box}h1{font-size:28px}p{color:#bac8df}</style><div id="root"></div><script src="/app.js"></script></html>';
if(process.argv.includes('--dom')) {
 const {Window}=await import('happy-dom');
 const window=new Window({console,url:'http://localhost/',settings:{enableJavaScriptEvaluation:true}});
 window.document.write(html.replace('<script src="/app.js"></script>',''));
 window.eval(readFileSync(join(output,'app.js'),'utf8'));
 const settle=async()=>{await new Promise(r=>setTimeout(r,80));};
 await settle();
 const button=(label)=>[...window.document.querySelectorAll('[role="button"]')].find(b=>b.textContent===label);
 await writeFile(join(output,'dom.html'),window.document.documentElement.outerHTML);
 if(button('Tour abschließen')?.getAttribute('aria-disabled')!=='true')throw Error('Tourabschluss nicht gesperrt');
 if(button('Dokumentiert abschließen')?.getAttribute('aria-disabled')!=='true')throw Error('Abschluss ohne Doku möglich');
 const note=window.document.querySelector('[aria-label="Durchführungsnachweis / Besonderheiten"]');
 Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(note,'Grundpflege durchgeführt.');
 note.dispatchEvent(new window.Event('input',{bubbles:true}));await settle();
 if(button('Dokumentiert abschließen')?.getAttribute('aria-disabled')==='true')throw Error('Dokuaktion bleibt gesperrt');
 button('Dokumentiert abschließen').click();await settle();
 if(window.calls.filter(c=>c[0]==='stop').length!==1)throw Error('Dokumentation nicht gespeichert');
 button('+ Tour planen').click();await settle();
 if(!window.document.querySelector('[aria-label="Pflegekraft suchen"]'))throw Error('Pflegekraftauswahl fehlt');
 button('+ Einsatz hinzufügen').click();await settle();
 if(window.document.querySelectorAll('[aria-label="Beginn (HH:MM)"]').length!==2)throw Error('Einsatzeditor fehlt');
 button('Entfernen').click();await settle();
 if(window.document.querySelectorAll('[aria-label="Beginn (HH:MM)"]').length!==1)throw Error('Entfernen nicht wirksam');
 button('Editor schließen').click();await settle();
 button('Änderungsverlauf anzeigen').click();await settle();
 if(!window.document.body.textContent.includes('Freigegeben → Unterwegs'))throw Error('Verlauf fehlt');
 await writeFile(join(output,'result.json'),JSON.stringify({passed:true,scope:'Actual tour component interaction in happy-dom. No layout engine/live E2E.'},null,2));
 console.log(JSON.stringify({passed:true,output,scope:'DOM interaction only; browser layout unverified'}));
 await window.happyDOM.abort();window.close();process.exit(0);
}
const server=createServer((req,res)=>{res.setHeader('content-type',req.url==='/app.js'?'text/javascript':'text/html');res.end(req.url==='/app.js'?readFileSync(join(output,'app.js')):html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true, executablePath:process.env.LIQUID_COMMAND_BROWSER_EXECUTABLE});
const errors=[];
try {
 for(const [name,width,height] of [['desktop',1440,1000],['phone',390,844],['narrow',320,740]]){
  const page=await browser.newPage({viewport:{width,height}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByRole('button',{name:'Tour abschließen',exact:true}).waitFor();
  if(!(await page.getByRole('button',{name:'Tour abschließen',exact:true}).isDisabled()))throw Error('Tourabschluss nicht gesperrt');
  if(!(await page.getByRole('button',{name:'Dokumentiert abschließen',exact:true}).isDisabled()))throw Error('Abschluss ohne Doku möglich');
  await page.getByRole('textbox',{name:'Durchführungsnachweis / Besonderheiten',exact:true}).fill('Körperpflege durchgeführt. Keine Besonderheiten.');
  await page.getByRole('button',{name:'Dokumentiert abschließen',exact:true}).click();
  if((await page.evaluate(()=>window.calls.filter(x=>x[0]==='stop').length))!==1)throw Error('Speicheraktion fehlt');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);if(overflow)throw Error(`${name}: horizontaler Überlauf`);
  await page.screenshot({path:join(output,`${name}-tour.png`),fullPage:true});
  await page.getByRole('button',{name:'+ Tour planen',exact:true}).click();await page.getByRole('textbox',{name:'Pflegekraft suchen',exact:true}).waitFor();
  await page.getByRole('button',{name:'Pflegekraft: Alexandra Pflegefachkraft',exact:true}).click();
  await page.getByRole('button',{name:'Klient:in: Maximilian Musterklient',exact:true}).click();
  await page.getByRole('button',{name:'+ Einsatz hinzufügen',exact:true}).click();
  if(await page.getByRole('textbox',{name:'Beginn (HH:MM)',exact:true}).count()!==2)throw Error('Strukturierter Einsatzeditor fehlt');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1))throw Error(`${name}: Editorüberlauf`);
  await page.screenshot({path:join(output,`${name}-editor.png`),fullPage:true});await page.close();
 }
 if(errors.length)throw Error(errors.join('\n'));
 await writeFile(join(output,'result.json'),JSON.stringify({passed:true,widths:[1440,390,320],scope:'Actual tour component; mocked shell/auth/data. No live E2E.'},null,2));
 console.log(JSON.stringify({passed:true,output}));
} finally {await browser.close();server.close();}
