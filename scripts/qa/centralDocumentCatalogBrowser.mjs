import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import http from 'node:http';

const dir=path.resolve('tmp/central-catalog/browser'); await fs.mkdir(dir,{recursive:true});
const contents=`
import React,{useState} from 'react'; import {createRoot} from 'react-dom/client';
import {CentralCatalogWorkspace} from './src/components/documents/CentralCatalogWorkspace.web';
import {sha256FileHex} from './src/lib/crypto/sha256Hex';
const T='11111111-1111-4111-8111-111111111111', A='22222222-2222-4222-8222-222222222222', B='33333333-3333-4333-8333-333333333333';
const records=new Map(),files=new Map();
function App(){const [list,setList]=useState([]);return <CentralCatalogWorkspace tenantId={T} author="Anna Fachkraft" demo={true} clients={[{id:A,label:'Mara Muster'},{id:B,label:'Ben Beispiel'}]} employees={[{id:A,label:'Anna Fachkraft'}]} loadingEntities={false} records={list} loadingRecords={false} permissions={{create:true,preview:true,export:true,save:true}}
loadContext={async(target,id)=>{await new Promise(r=>setTimeout(r,id===A?100:10));if(![A,B,T].includes(id))return {ok:false,error:'Akte nicht gefunden'};return {ok:true,data:{tenantId:T,target,entityId:id,company:{name:'Pflege am Park GmbH',address:'Parkstraße 12\\n10115 Berlin',phone:'030 555 123',email:'kontakt@example.test'},subject:{name:target==='company'?'Pflege am Park GmbH':id===B?'Ben Beispiel':target==='employee'?'Anna Fachkraft':'Mara Muster',address:'Blumenstraße 8\\n10117 Berlin'},representative:{},payor:{},employee:{},sourceFetchedAt:new Date().toISOString()}};}}
save={async(s,bytes)=>{const record={id:s.documentId,tenantId:T,title:s.definition.title,templateKey:s.definition.key,revision:s.revision,snapshot:JSON.parse(JSON.stringify(s)),state:'draft',pdfPath:null,pdfHash:sha256FileHex(bytes),createdAt:new Date().toISOString()};records.set(record.id,record);files.set(record.id,bytes);return {ok:true,data:record};}}
download={async(r)=>({ok:true,data:files.get(r.id)})} onSaved={()=>setList([...records.values()])} onRefresh={()=>setList([...records.values()])}/>}createRoot(document.getElementById('root')).render(<App/>);
`;
await build({stdin:{contents,loader:'tsx',resolveDir:process.cwd()},bundle:true,outdir:dir,entryNames:'app',format:'esm',splitting:true,platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},alias:{'@':path.resolve('src')}});
await fs.copyFile('public/fonts/CenturyGothic.ttf',path.join(dir,'CenturyGothic.ttf'));
await fs.writeFile(path.join(dir,'index.html'),`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:CenturyGothic;src:url(/CenturyGothic.ttf)}body{margin:0;background:#edf3fb;font-family:CenturyGothic,Arial,sans-serif;padding:22px}#root{max-width:1540px;margin:auto}@media(max-width:760px){body{padding:10px}}</style></head><body><main id="root"></main><script type="module" src="/app.js"></script></body></html>`);
const server=http.createServer(async(req,res)=>{try{const file=path.join(dir,new URL(req.url,'http://localhost').pathname==='/'?'index.html':new URL(req.url,'http://localhost').pathname);const data=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.ttf')?'font/ttf':'text/html');res.end(data);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CENTRAL_CATALOG_BROWSER_EXECUTABLE?{executablePath:process.env.CENTRAL_CATALOG_BROWSER_EXECUTABLE}:{})});const page=await browser.newPage({acceptDownloads:true});const errors=[];const results=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());page.setDefaultTimeout(15000);
try{
  for(const [name,width,height] of [['wide',1600,1000],['desktop',1200,900],['tablet',820,1000],['phone',390,844],['small-phone',320,700]]){
    await page.setViewportSize({width,height});await page.goto(url);await page.getByRole('heading',{name:'Vorlage auswählen'}).waitFor();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);if(overflow)throw new Error('Horizontal overflow in '+name);
    await page.screenshot({path:path.join(dir,name+'-catalog.png'),fullPage:true});
    await page.getByLabel('Suche',{exact:true}).fill('Leistungsnachweis mit Leistungsbestätigung');await page.getByRole('button',{name:/Leistungsnachweis mit Leistungsbestätigung/}).click();
    await page.getByLabel('Klient:in / Patient:in auswählen',{exact:true}).selectOption('22222222-2222-4222-8222-222222222222');
    await page.locator('.csdc-source').waitFor();
    const fields=page.locator('.csdc-form .csdc-field').filter({hasText:'*'});for(let i=0;i<await fields.count();i++){const entry=fields.nth(i).locator('input,textarea');if(await entry.count()&&!(await entry.inputValue()))await entry.fill('Individuelle Prüfangabe für die vereinbarte Leistung.');}
    await page.getByRole('button',{name:'Zeile hinzufügen'}).click();await page.getByLabel('Leistung, Zeile 1',{exact:true}).fill('Körperbezogene Pflege nach individueller Vereinbarung');
    await page.getByLabel('Individuelle Zusatztexte / Vereinbarungen').fill('Individuell vereinbarte Ergänzung bleibt separat erhalten.');
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Editor overflow in '+name);
    await page.locator('.csdc-editor').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(dir,name+'-editor.png'),fullPage:true});
    if(name==='desktop'){
      await page.getByRole('button',{name:'PDF-Vorschau',exact:true}).click();await page.locator('iframe').waitFor();
      const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'PDF herunterladen',exact:true}).click()]);await download.saveAs(path.join(dir,'ui-download.pdf'));
      await page.getByRole('button',{name:'Entwurf in Akte speichern',exact:true}).click();await page.getByText('Entwurf in dieser Demo-Sitzung abgelegt.',{exact:false}).waitFor();
      await page.getByRole('button',{name:/Gespeicherte Fassungen/}).click();await page.getByRole('button',{name:'Neue Fassung',exact:true}).click();await page.locator('.csdc-source').waitFor();
      await page.getByText(/Fassung 2/).last().waitFor();
      if(await page.getByLabel('Individuelle Zusatztexte / Vereinbarungen').inputValue()!=='Individuell vereinbarte Ergänzung bleibt separat erhalten.')throw new Error('Copy lost additional text');
      results.push({name,width,height,overflow:false,pdfDownloaded:true,saved:true,copyPreservesText:true});
    }else results.push({name,width,height,overflow:false});
  }
  // Fast person switches must never leave the preceding person's snapshot.
  await page.setViewportSize({width:1200,height:900});await page.goto(url);await page.getByLabel('Suche',{exact:true}).fill('Ambulanter Pflegevertrag');await page.getByRole('button',{name:/Ambulanter Pflegevertrag/}).click();
  const entity=page.getByLabel('Klient:in / Patient:in auswählen',{exact:true});await entity.selectOption('22222222-2222-4222-8222-222222222222');await entity.selectOption('33333333-3333-4333-8333-333333333333');await page.locator('.csdc-source').waitFor();
  if(await page.getByLabel(/Klient:in \/ Patient:in \*/).inputValue()!=='Ben Beispiel')throw new Error('Stale person autofill');
  await page.screenshot({path:path.join(dir,'contract-editor.png'),fullPage:true});
  await page.evaluate(()=>document.documentElement.style.setProperty('--app-font-scale','1.5'));
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('150% zoom overflow');
  await page.screenshot({path:path.join(dir,'large-text.png'),fullPage:true});
  if(errors.length)throw new Error(errors.join('\n'));
  const result={fixture:'local UI with injected services, no production writes',results,staleAutofillBlocked:true,zoom150:true,errors};await fs.writeFile(path.join(dir,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();server.close();}
