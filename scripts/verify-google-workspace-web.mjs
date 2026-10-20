// Uses the project's installed esbuild + Playwright and an existing browser.
// Only the transport/auth boundary is replaced. Components, hooks, cache, data
// adapters, forms and CSS are the actual web implementation; no live data writes.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const out = resolve('.google-workspace-qa'); mkdirSync(out,{recursive:true});
const fixtures = String.raw`
const scenario=new URLSearchParams(location.search).get('scenario');
const capabilities=Object.fromEntries(['gmail','calendar','meet','drive','docs','sheets','slides','tasks','contacts','chat'].map(k=>[k,true]));
let connected=scenario!=='disconnected';
const now=new Date().toISOString();
window.qa={calls:[],failNext:false,owner:'qa-user',tenant:'qa-tenant'};
const tasks=[{id:'task-1',title:'Abstimmung mit dem Verwaltungsteam vorbereiten',status:'needsAction',notes:'Unterlagen prüfen',due:'2026-09-15T00:00:00Z'}];
export async function invokeEdgeFunction(name,body){
 window.qa.calls.push({name,...body});
 await new Promise(r=>setTimeout(r,30));
 if(window.qa.failNext && body.action==='tasks_create'){window.qa.failNext=false;return {ok:false,error:'Google verweigert den Zugriff. Bitte Freigaben prüfen.'};}
 if(name==='google-workspace-auth'){
  if(body.action==='disconnect')connected=false;
  if(body.action==='activity')return {ok:true,data:{events:[{id:'audit',service_key:'tasks',action_key:'tasks_update',result_status:'success',created_at:now}]}};
  return {ok:true,data:{connection:{status:connected?'connected':'not_connected',email:connected?'verwaltung@beispielbetrieb.de':null,domain:'beispielbetrieb.de',capabilities:connected?capabilities:{},scopes:[],connectedAt:connected?'2026-09-10T10:00:00Z':null,lastSyncAt:connected?now:null}}};
 }
 const p=body.payload||{};let data={};
 if(body.action==='gmail_list')data={messages:[{id:'mail-1'},{id:'mail-2'}]};
 if(body.action==='gmail_metadata')data={id:p.id,threadId:p.id,labelIds:['INBOX','UNREAD'],internalDate:String(Date.now()),payload:{headers:[{name:'Subject',value:p.id==='mail-1'?'Abstimmung zur nächsten Teambesprechung':'Unterlagen für die gemeinsame Planung'},{name:'From',value:'Testkontakt <person@example.com>'}]}};
 if(body.action==='gmail_read')data={payload:{mimeType:'text/plain',body:{data:btoa('Dies ist eine synthetische Nachricht zur Funktionspruefung.')}}};
 if(body.action==='gmail_send'||body.action==='gmail_draft')data={id:'sent'};
 if(body.action==='calendar_list')data={items:[{id:'event',summary:'Gemeinsame Planung und Teambesprechung',start:{dateTime:now},end:{dateTime:now},hangoutLink:'https://meet.google.com/abc-defg-hij',htmlLink:'https://calendar.google.com/calendar/event?eid=test'}]};
 if(body.action==='calendar_create')data={id:'new-event',htmlLink:'https://calendar.google.com/calendar/event?eid=new'};
 if(body.action==='drive_list')data={files:[{id:'file',name:'Planungsunterlagen für die gemeinsame Abstimmung',mimeType:'application/vnd.google-apps.document',modifiedTime:now,webViewLink:'https://docs.google.com/document/d/test/edit',owners:[{displayName:'Verwaltung'}]}]};
 if(body.action==='drive_upload'||body.action==='drive_create_folder')data={id:'new-file',webViewLink:'https://drive.google.com/file/d/test/view'};
 if(body.action==='docs_create')data={documentId:'doc'};
 if(body.action==='sheets_create')data={spreadsheetId:'sheet'};
 if(body.action==='slides_create')data={presentationId:'slides'};
 if(body.action==='tasks_lists')data={items:[{id:'team',title:'Verwaltung'}]};
 if(body.action==='tasks_list')data={items:tasks.filter(t=>p.showCompleted||t.status!=='completed')};
 if(body.action==='tasks_create'){tasks.push({id:'new-task',...p.task,status:'needsAction'});data=tasks.at(-1);}
 if(body.action==='tasks_update'){Object.assign(tasks.find(t=>t.id===p.id),p.task);data=tasks.find(t=>t.id===p.id);}
 if(body.action==='contacts_list')data={connections:[{resourceName:'people/1',names:[{displayName:'Testkontakt mit ausführlichem Namen'}],emailAddresses:[{value:'person@example.com'}],phoneNumbers:[{value:'0123 456789'}]}]};
 if(body.action==='chat_spaces')data={spaces:[{name:'spaces/team',displayName:'Verwaltung',spaceType:'SPACE'}]};
 return {ok:true,data:{data:structuredClone(data)}};
}
export const useAuth=()=>({user:{id:window.qa.owner},profile:{tenantId:window.qa.tenant,roleKey:'business_admin'}});
export const usePermissions=()=>({roleKey:'business_admin'});
`;
const plugin={name:'qa-transport',setup(b){
 b.onResolve({filter:/^@\/lib\/supabase\/edgeFunctions$|^@\/lib\/auth\/context$|^@\/hooks\/usePermissions$/},()=>({path:'fixture',namespace:'qa'}));
 b.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:fixtures,loader:'ts',resolveDir:process.cwd()}));
}};
await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{WorkspaceDashboard}from'./src/components/googleWorkspace/WorkspaceDashboard.web';import{GoogleWorkspaceWidget}from'./src/components/googleWorkspace/GoogleWorkspaceWidget.web';const params=new URLSearchParams(location.search);createRoot(document.getElementById('root')).render(<><WorkspaceDashboard fontScale={Number(params.get('scale')||1)}/><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12,marginTop:20}}>{['overview','gmail','calendar','drive','tasks'].map(service=><div key={service} style={{height:180,borderRadius:18,overflow:'hidden'}}><GoogleWorkspaceWidget service={service}/></div>)}</div></>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'browser',format:'iife',jsx:'automatic',outfile:out+'/ui.js',plugins:[plugin],define:{'process.env.NODE_ENV':'"production"'},resolveExtensions:['.web.tsx','.tsx','.web.ts','.ts','.js','.json']});
const html='<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:Century Gothic;src:url(/font.ttf)}html,body{margin:0;font-family:Century Gothic,Arial,sans-serif;background:#e1ecf8}#root{max-width:1600px;padding:16px;margin:auto}*{box-sizing:border-box}</style><div id="root"></div><script src="/ui.js"></script></html>';
const server=createServer((req,res)=>{if(req.url==='/font.ttf'){res.setHeader('Content-Type','font/ttf');res.end(readFileSync('public/fonts/CenturyGothic.ttf'));}else if(req.url==='/ui.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(out+'/ui.js'));}else{res.setHeader('Content-Type','text/html');res.end(html);}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)});
const report=[]; const errors=[]; const base='http://127.0.0.1:'+server.address().port;
const expectVisible=async locator=>{await locator.waitFor({state:'visible'});};
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}});page.on('pageerror',e=>errors.push(e.message));
 for(const view of [{name:'desktop',width:1440,height:1050,scale:1},{name:'narrow',width:390,height:844,scale:1},{name:'large-font',width:900,height:1000,scale:1.5}]){
  await page.setViewportSize({width:view.width,height:view.height});await page.goto(base+'/?scale='+view.scale);await expectVisible(page.getByText('verwaltung@beispielbetrieb.de',{exact:true}).first());await expectVisible(page.locator('.cs-w-preview-item').first());await page.evaluate(()=>document.fonts.ready);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,view.name+' horizontal overflow');await page.screenshot({path:out+'/'+view.name+'.png',fullPage:true});
  await page.locator('nav').getByRole('button',{name:'Gmail',exact:true}).click();await page.getByRole('button',{name:'E-Mail schreiben'}).click();await page.screenshot({path:out+'/'+view.name+'-form.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);report.push({view:view.name,overflow,form:true});
 }
 await page.setViewportSize({width:1440,height:1050});await page.goto(base);await expectVisible(page.locator('.cs-w-preview-item').first());
 await page.locator('nav').getByRole('button',{name:'Gmail',exact:true}).click();await page.getByRole('button',{name:'Abstimmung zur nächsten Teambesprechung',exact:false}).click();await expectVisible(page.getByText('Dies ist eine synthetische Nachricht zur Funktionspruefung.',{exact:true}));
 await page.getByRole('button',{name:'E-Mail schreiben'}).click();await page.getByLabel('Empfänger:in').fill('person@example.com');await page.getByLabel('Betreff',{exact:true}).fill('Prüfung');await page.getByLabel('Nachricht',{exact:true}).fill('Nachricht für den Test');
 await page.locator('form[aria-label="Neue E-Mail"]').evaluate(form=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
 await expectVisible(page.getByText('E-Mail an person@example.com gesendet.',{exact:true}));assert.equal(await page.evaluate(()=>window.qa.calls.filter(c=>c.action==='gmail_send').length),1);report.push({emailRead:true,emailSend:true,duplicateSubmitPrevented:true});
 await page.locator('nav').getByRole('button',{name:'Tasks',exact:true}).click();await page.getByRole('button',{name:'Abstimmung mit dem Verwaltungsteam vorbereiten',exact:false}).click();await page.getByRole('button',{name:'Als erledigt markieren',exact:true}).click();await expectVisible(page.getByText('Aufgabenstatus in Google aktualisiert.',{exact:true}));await expectVisible(page.getByText('In dieser Auswahl sind keine Aufgaben vorhanden.',{exact:true}));
 await page.getByRole('combobox').selectOption('team');await page.getByRole('button',{name:'Neu erstellen'}).click();await page.getByLabel('Titel',{exact:true}).fill('Neue Aufgabe');await page.getByLabel('Fällig am (optional)').fill('2026-09-15');await page.evaluate(()=>window.qa.failNext=true);await page.getByRole('button',{name:'Speichern',exact:true}).click();await expectVisible(page.getByRole('alert').filter({hasText:'Google verweigert'}));assert.equal(await page.getByLabel('Titel',{exact:true}).inputValue(),'Neue Aufgabe');await page.getByRole('button',{name:'Speichern',exact:true}).click();await expectVisible(page.getByText('Erfolgreich in Google gespeichert.',{exact:true}));
 const taskCall=await page.evaluate(()=>window.qa.calls.filter(c=>c.action==='tasks_create').at(-1));assert.equal(taskCall.payload.taskListId,'team');assert.equal(taskCall.payload.task.due,'2026-09-15T00:00:00.000Z');report.push({taskComplete:true,taskCreate:true,selectedList:true,errorPreservesInput:true});
 await page.locator('nav').getByRole('button',{name:'Drive',exact:true}).click();await page.getByRole('button',{name:'Hinzufügen',exact:false}).click();await page.getByLabel('Datei',{exact:true}).setInputFiles({name:'prüfung.bin',mimeType:'application/octet-stream',buffer:Buffer.from([0,255,128,13,10])});await page.getByRole('button',{name:'Speichern',exact:true}).click();await expectVisible(page.getByText('Erfolgreich in Google gespeichert.',{exact:false}));assert.equal(await page.evaluate(()=>window.qa.calls.find(c=>c.action==='drive_upload').payload.base64),'AP+ADQo=');report.push({binaryUpload:true});
 await page.locator('nav').getByRole('button',{name:'Meet',exact:true}).click();await page.getByRole('button',{name:'Neu erstellen'}).click();await page.getByLabel('Titel',{exact:true}).fill('Videoabstimmung');await page.getByLabel('Beginn (Ortszeit)').fill('2026-09-15T10:00');await page.getByLabel('Ende (Ortszeit)').fill('2026-09-15T11:00');await page.getByRole('button',{name:'Speichern',exact:true}).click();await expectVisible(page.getByText('Videotermin gespeichert.',{exact:false}));assert.equal(await page.evaluate(()=>window.qa.calls.find(c=>c.action==='calendar_create').payload.createMeet),true);report.push({meetCreate:true});
 await page.locator('nav').getByRole('button',{name:'Chat',exact:true}).click();await page.getByRole('button',{name:'Nachricht',exact:true}).click();await page.getByLabel('Nachricht',{exact:true}).fill('Gezielte Nachricht');await page.getByRole('button',{name:'Senden',exact:true}).click();await expectVisible(page.getByText('Nachricht an „Verwaltung“ gesendet.',{exact:true}));assert.equal(await page.evaluate(()=>window.qa.calls.find(c=>c.action==='chat_send').payload.space),'spaces/team');report.push({selectedChatSpace:true});
 await page.getByRole('button',{name:'Verbindung trennen',exact:true}).click();assert.equal(await page.evaluate(()=>window.qa.calls.filter(c=>c.action==='disconnect').length),0);await page.getByRole('button',{name:'Jetzt trennen',exact:true}).click();await expectVisible(page.getByRole('button',{name:'Google-Konto verbinden',exact:true}));report.push({disconnectConfirmation:true});
 await page.goto(base+'/?scenario=disconnected');await expectVisible(page.getByRole('button',{name:'Google-Konto verbinden',exact:true}));assert.equal(await page.evaluate(()=>window.qa.calls.filter(c=>c.name==='google-workspace-proxy').length),0);await page.screenshot({path:out+'/not-connected.png',fullPage:true});report.push({noUnconnectedDataRequests:true});
 assert.deepEqual(errors,[]);writeFileSync(out+'/browser-results.json',JSON.stringify({report,errors},null,2));console.log(JSON.stringify({report,errors}));
}catch(error){const pages=browser.contexts().flatMap(c=>c.pages());if(pages[0]){await pages[0].screenshot({path:out+'/failure.png',fullPage:true});console.error((await pages[0].locator('body').innerText()).slice(0,10000));}console.error('Browser errors',errors);throw error;}finally{await browser.close();server.close();}
