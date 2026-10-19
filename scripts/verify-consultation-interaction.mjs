// DOM interaction checks exercise the real web components and RPC client against
// isolated PostgreSQL. They deliberately do not claim browser/layout coverage.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Window} from 'happy-dom';
import {startConsultationFixture} from './consultation-browser-fixture.mjs';

const server=await startConsultationFixture();const windows=[];
async function mount(actor){const window=new Window({url:`${server.url}/?actor=${actor}`,settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true}});windows.push(window);window.console=console;window.structuredClone=structuredClone;const nativeInterval=window.setInterval.bind(window);window.setInterval=(fn,ms,...args)=>nativeInterval(fn,ms===30000?100:ms,...args);window.addEventListener('error',e=>console.error('DOM ERROR',e.message));window.document.body.innerHTML='<div id="root"></div>';window.eval('(()=>{'+readFileSync(`${server.output}/preview.js`,'utf8')+'})()');await until(()=>window.document.querySelector('h1')?.textContent);return window;}
async function until(check,message='UI state not reached'){for(let i=0;i<250;i++){const value=check();if(value)return value;await new Promise(r=>setTimeout(r,20));}throw new Error(message);}
function button(w,text,scope=w.document){const el=[...scope.querySelectorAll('button')].find(x=>x.textContent.trim()===text);assert.ok(el,`Button: ${text}`);assert.equal(el.disabled,false,`Enabled: ${text}`);return el;}
function click(w,text,scope){button(w,text,scope).click();}
function input(w,label,value){const el=[...w.document.querySelectorAll('label')].find(x=>x.firstElementChild?.textContent===label)?.querySelector('input,textarea,select');assert.ok(el,`Field: ${label}`);assert.equal(el.disabled,false);const proto=el.tagName==='TEXTAREA'?w.HTMLTextAreaElement.prototype:el.tagName==='SELECT'?w.HTMLSelectElement.prototype:w.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new w.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));}
async function saved(w){await until(()=>w.document.querySelector('.cw-notice')?.textContent.includes('bestätigt'),'Server acknowledgement missing');await until(()=>!w.document.querySelector('.cw-modal button:disabled')||!w.document.querySelector('.cw-modal'),'Mutation did not finish');}
try{
 const office=await mount('office');await until(()=>office.document.querySelector('h3')?.textContent==='Noch keine Besuche vorhanden');
 click(office,'Qualifikationen');await until(()=>office.document.querySelector('dialog[open]'));
 input(office,'Mitarbeitende Person','00000000-0000-4000-8000-000000000041');await new Promise(r=>setTimeout(r,20));
 input(office,'Gültig ab','2025-01-01');input(office,'Geprüfte Nachweise / Vertragsgrundlage','Synthetischer Qualifikationsnachweis');
 await new Promise(r=>setTimeout(r,20));click(office,'Freigabe speichern');await until(()=>office.document.querySelector('dialog')?.textContent.includes('Qualifikationsfreigabe gespeichert.'));office.document.querySelector('button[aria-label="Dialog schließen"]').click();
 click(office,'+ Neuen Fall anlegen');await until(()=>office.document.querySelector('dialog[open]'));
 input(office,'Klientin / Klient','00000000-0000-4000-8000-000000000050');input(office,'Anlass und Hinweise für die Beratungsperson','Bitte den Entlastungsbedarf besprechen.');await new Promise(r=>setTimeout(r,20));click(office,'Fallakte anlegen');
 await until(()=>office.document.querySelector('h2')?.textContent==='Erika Sommer','New case not opened');
 input(office,'Beratungsperson','00000000-0000-4000-8000-000000000041');input(office,'Beginn (Ortszeit des Geräts)','2026-11-20T10:00');input(office,'Ende (Ortszeit des Geräts)','2026-11-20T11:00');await new Promise(r=>setTimeout(r,20));click(office,'Termin zuweisen');
 await until(()=>office.document.querySelector('.cw-subtitle')?.textContent.includes('Geplant'),'Planning not acknowledged');
 const portal=await mount('portal');await until(()=>portal.document.querySelector('.cw-visit'));
 assert.equal(portal.document.querySelector('.cw-visit-person strong').textContent,'Erika Sommer');portal.document.querySelector('.cw-visit').click();
 await until(()=>[...portal.document.querySelectorAll('button')].some(b=>b.textContent==='Übergabe gelesen'));
 assert.equal([...portal.document.querySelectorAll('button')].find(b=>b.textContent==='Besuch jetzt beginnen').disabled,true);

 click(portal,'Übergabe gelesen');await until(()=>[...portal.document.querySelectorAll('button')].find(b=>b.textContent==='Besuch jetzt beginnen')?.disabled===false);
 click(portal,'Besuch jetzt beginnen');await until(()=>portal.document.querySelector('.cw-subtitle')?.textContent.includes('In Durchführung'));
 click(portal,'+ Person ergänzen');await until(()=>portal.document.querySelector('input[value="Erika Sommer"]')||[...portal.document.querySelectorAll('input')].some(x=>x.value==='Erika Sommer'));
 click(portal,'Weiter →');await until(()=>portal.document.querySelector('.cw-section-heading h2')?.textContent==='Situation & Beratung');
 input(portal,'Aktuelle Pflegesituation','Synthetischer Test: Pflege zu Hause.');input(portal,'Sicht der pflegebedürftigen Person','Möchte Unterstützung.');input(portal,'Sicht der Pflegeperson','Wünscht Entlastung.');input(portal,'Tatsächlich gegebene Beratung und Hinweise','Entlastungsangebote besprochen.');
 input(portal,'Ist die Pflege aus fachlicher Sicht sichergestellt?','yes');input(portal,'Handlungsbedarf','none');
 [...portal.document.querySelectorAll('.cw-topic')].find(l=>l.textContent==='Pflege im Alltag').querySelector('input').click();
 await new Promise(r=>setTimeout(r,20));click(portal,'Zwischenspeichern');await until(()=>portal.document.querySelector('.cw-save-state')?.textContent.startsWith('Serverstand'));
 // Same persisted visit in the office after a read, including negative consent later.
 click(office,'Aktualisieren');await until(()=>office.document.querySelector('.cw-subtitle')?.textContent.includes('In Durchführung'));
 click(portal,'Weiter →');await until(()=>portal.document.querySelector('.cw-section-heading h2')?.textContent==='Empfehlungen & nächste Schritte');
 input(portal,'Gemeinsames Ergebnis des Besuchs','Entlastung gemeinsam vereinbart.');await new Promise(r=>setTimeout(r,20));
 // Leave through router navigation, then recover the in-memory draft on return.
 const visitLocation=portal.location.href;
 portal.history.pushState({},'',`/?actor=portal`);portal.dispatchEvent(new portal.PopStateEvent('popstate'));await until(()=>portal.document.querySelector('.cw-visit'));
 portal.document.querySelector('.cw-visit').click();await until(()=>portal.document.querySelector('.cw-section-heading'));
 [...portal.document.querySelectorAll('.cw-section-nav button')].find(b=>b.textContent.includes('Empfehlungen')).click();await until(()=>[...portal.document.querySelectorAll('textarea')].some(t=>t.value==='Entlastung gemeinsam vereinbart.'));
 click(portal,'Weiter →');await until(()=>portal.document.querySelector('.cw-section-heading h2')?.textContent==='Prüfen & bestätigen');
 input(portal,'Weitergabe von Erkenntnissen an die Pflegekasse','no');await new Promise(r=>setTimeout(r,20));
 click(portal,'Besuch jetzt beenden');await until(()=>portal.document.querySelector('.cw-subtitle')?.textContent.includes('Dokumentation offen'));
 assert.equal([...portal.document.querySelectorAll('button')].find(b=>b.textContent==='Unterschreiben & einreichen').disabled,false);
 click(portal,'Unterschreiben & einreichen');await until(()=>portal.document.querySelector('dialog[open]'));
 assert.equal([...portal.document.querySelectorAll('dialog button')].find(b=>b.textContent==='Verbindlich einreichen').disabled,true);
 // Happy DOM has no canvas renderer. Geometry/drawing are explicitly mocked here;
 // real touch, drawing and layout still require the browser acceptance gate.
 function sign(w){w.HTMLCanvasElement.prototype.getContext=()=>({beginPath(){},moveTo(){},lineTo(){},stroke(){},clearRect(){}});w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/png;base64,'+'A'.repeat(260);
  for(const canvas of w.document.querySelectorAll('canvas')){canvas.getBoundingClientRect=()=>({left:0,top:0,width:840,height:240});canvas.setPointerCapture=()=>{};canvas.hasPointerCapture=()=>false;canvas.dispatchEvent(new w.PointerEvent('pointerdown',{bubbles:true,pointerId:1,clientX:50,clientY:60}));canvas.dispatchEvent(new w.PointerEvent('pointermove',{bubbles:true,pointerId:1,clientX:110,clientY:90}));canvas.dispatchEvent(new w.PointerEvent('pointerup',{bubbles:true,pointerId:1,clientX:140,clientY:65}));}w.document.querySelector('dialog input[type="checkbox"]').click();}
 // A second session changes the saved document while signatures are being collected.
 await server.fixture.portal();let before=await server.fixture.load(true);let changing=before.encounters[0];
 await server.fixture.mutate('save',{answers:{...changing.answers,summary:'Zwischenzeitlich ergänztes Ergebnis.'}},changing);
 await until(()=>portal.document.querySelector('.cw-save-state')?.textContent.includes(`Fassung ${changing.version+1}`));
 assert.ok(portal.document.querySelector('dialog').textContent.includes('Entlastung gemeinsam vereinbart.'));
 assert.ok(!portal.document.querySelector('dialog').textContent.includes('Zwischenzeitlich ergänztes Ergebnis.'));
 sign(portal);await new Promise(r=>setTimeout(r,20));click(portal,'Verbindlich einreichen');
 await until(()=>portal.document.querySelector('dialog [role=alert]')?.textContent.includes('zwischenzeitlich'));
 await server.fixture.portal();assert.equal((await server.fixture.load(true,changing.case_id)).revisions.length,0);
 portal.document.querySelector('dialog button[aria-label="Dialog schließen"]').click();await until(()=>!portal.document.querySelector('dialog'));
 click(portal,'Unterschreiben & einreichen');await until(()=>portal.document.querySelector('dialog[open]'));
 assert.ok(portal.document.querySelector('dialog').textContent.includes('Zwischenzeitlich ergänztes Ergebnis.'));
 sign(portal);await new Promise(r=>setTimeout(r,20));click(portal,'Verbindlich einreichen');await until(()=>portal.document.querySelector('.cw-subtitle')?.textContent.includes('Zur Prüfung'));
 click(office,'Aktualisieren');await until(()=>[...office.document.querySelectorAll('button')].some(b=>b.textContent==='Rückfrage stellen'));
 click(office,'Rückfrage stellen');await until(()=>office.document.querySelector('dialog[open]'));input(office,'Betroffener Abschnitt','measures');input(office,'Was muss ergänzt oder geklärt werden?','Bitte den nächsten Kontakt konkretisieren.');await new Promise(r=>setTimeout(r,20));click(office,'Bestätigen');await until(()=>office.document.querySelector('.cw-subtitle')?.textContent.includes('Rückfrage'));
 click(portal,'Aktualisieren');await until(()=>portal.document.querySelector('.cw-alert-warning')?.textContent.includes('Bitte den nächsten Kontakt'));click(portal,'Betroffenen Abschnitt öffnen →');await until(()=>portal.document.querySelector('.cw-section-heading h2')?.textContent==='Empfehlungen & nächste Schritte');
 input(portal,'Anlass und nächster Kontakt','Telefonische Rückmeldung vereinbart.');click(portal,'Weiter →');await until(()=>portal.document.querySelector('.cw-section-heading h2')?.textContent==='Prüfen & bestätigen');
 click(portal,'Unterschreiben & einreichen');await until(()=>portal.document.querySelector('dialog[open]'));sign(portal);await new Promise(r=>setTimeout(r,20));click(portal,'Verbindlich einreichen');await until(()=>portal.document.querySelector('.cw-subtitle')?.textContent.includes('Zur Prüfung'));
 click(office,'Aktualisieren');await until(()=>[...office.document.querySelectorAll('button')].some(b=>b.textContent==='Fachlich freigeben'));click(office,'Fachlich freigeben');await until(()=>office.document.querySelector('.cw-subtitle')?.textContent.includes('Fachlich freigegeben'));
 click(portal,'Aktualisieren');await until(()=>portal.document.querySelector('.cw-subtitle')?.textContent.includes('Fachlich freigegeben'));
 const caseId=new URL(visitLocation).pathname.split('/').at(-1);await server.fixture.actor();const persisted=await server.fixture.load(false,caseId);
 assert.equal(persisted.revisions.length,2);assert.equal(persisted.revisions[1].snapshot.answers.findingsConsent,'no');assert.equal(persisted.revisions[1].snapshot.answers.followUpNote,'');assert.equal(persisted.revisions[0].snapshot.answers.followUpNote,'Telefonische Rückmeldung vereinbart.');
 console.log('PASS: real web forms + RPC + isolated PostgreSQL: qualify → create → plan → portal → start → save → recover draft → finish → sign/submit → return → correct/resign → approve.');
}catch(e){console.error(e);console.error(windows.at(-1)?.document.querySelector('main')?.textContent.slice(-6000));process.exitCode=1;}
finally{for(const w of windows)await w.happyDOM.close();await server.close();}
