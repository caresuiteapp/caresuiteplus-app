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
function input(w,label,value){const scope=w.document.querySelector('dialog[open]')??w.document;const el=[...scope.querySelectorAll('label')].find(x=>x.firstElementChild?.textContent===label)?.querySelector('input,textarea,select');assert.ok(el,`Field: ${label}`);assert.equal(el.disabled,false);const proto=el.tagName==='TEXTAREA'?w.HTMLTextAreaElement.prototype:el.tagName==='SELECT'?w.HTMLSelectElement.prototype:w.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new w.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));}
async function saved(w){await until(()=>w.document.querySelector('.cw-notice')?.textContent.includes('bestätigt'),'Server acknowledgement missing');await until(()=>!w.document.querySelector('.cw-modal button:disabled')||!w.document.querySelector('.cw-modal'),'Mutation did not finish');}
try{
 const office=await mount('office');await until(()=>office.document.querySelector('h3')?.textContent==='Noch keine Besuche vorhanden');
 // Team templates persist as drafts and are published with a deliberate review.
 click(office,'Teamvorlagen');await until(()=>office.document.querySelector('dialog[open]'));
 click(office,'+ Teamvorlage erstellen');await until(()=>office.document.querySelector('dialog form'));
 input(office,'Mit einem Standardbaustein beginnen','45-transfer');await new Promise(r=>setTimeout(r,20));click(office,'Standard als Ausgangspunkt übernehmen');await new Promise(r=>setTimeout(r,20));
 input(office,'Vorlagentitel','Lernbaustein des Teams');await new Promise(r=>setTimeout(r,20));click(office,'Vorlagenentwurf speichern');
 await until(()=>[...office.document.querySelectorAll('dialog button')].some(b=>b.textContent==='Teamfreigabe vorbereiten'));
 click(office,'Teamfreigabe vorbereiten');await until(()=>[...office.document.querySelectorAll('dialog button')].some(b=>b.textContent==='Geprüfte Fassung freigeben'));
 assert.equal([...office.document.querySelectorAll('dialog button')].find(b=>b.textContent==='Geprüfte Fassung freigeben').disabled,true);
 input(office,'Prüfvermerk zur Teamfreigabe','Synthetische fachliche Prüfung.');await new Promise(r=>setTimeout(r,20));click(office,'Geprüfte Fassung freigeben');
 await until(()=>office.document.querySelector('dialog .cw-template-card')?.textContent.includes('Freigabe 2'));
 office.document.querySelector('button[aria-label="Dialog schließen"]').click();await until(()=>!office.document.querySelector('dialog'));
 click(office,'Qualifikationen');await until(()=>office.document.querySelector('dialog[open]'));
 input(office,'Mitarbeitende Person','00000000-0000-4000-8000-000000000041');await new Promise(r=>setTimeout(r,20));
 assert.equal(office.document.querySelector('dialog input[type=checkbox]').checked,false);office.document.querySelector('dialog input[type=checkbox]').click();input(office,'Gültig ab','2025-01-01');input(office,'Geprüfte Nachweise / Vertragsgrundlage','Synthetischer Qualifikationsnachweis');
 await new Promise(r=>setTimeout(r,20));click(office,'Freigabe speichern');await until(()=>office.document.querySelector('dialog')?.textContent.includes('Qualifikationsfreigabe gespeichert.'));office.document.querySelector('button[aria-label="Dialog schließen"]').click();
 click(office,'+ Neuen Fall anlegen');await until(()=>office.document.querySelector('dialog[open]'));
 input(office,'Vorlage für die Vorbereitung','37-relief');await new Promise(r=>setTimeout(r,20));click(office,'Vorbereitung ergänzen');await new Promise(r=>setTimeout(r,20));assert.ok(office.document.querySelector('dialog textarea').value.includes('Entlastung'));input(office,'Klientin / Klient','00000000-0000-4000-8000-000000000050');input(office,'Anlass und Hinweise für die Beratungsperson','Bitte den Entlastungsbedarf besprechen.');await new Promise(r=>setTimeout(r,20));click(office,'Fallakte anlegen');
 await until(()=>office.document.querySelector('h2')?.textContent==='Erika Sommer','New case not opened');
 input(office,'Beratungsperson','00000000-0000-4000-8000-000000000041');input(office,'Beginn (Ortszeit des Geräts)','2026-11-20T10:00');await new Promise(r=>setTimeout(r,20));click(office,'60 Minuten');await new Promise(r=>setTimeout(r,20));click(office,'Termin zuweisen');
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
 // A second complete visit uses the training library and persists only actual observations.
 click(office,'← Alle Besuche');await until(()=>office.document.querySelector('.cw-visits'));
 click(office,'Qualifikationen');await until(()=>office.document.querySelector('dialog[open]'));
 input(office,'Mitarbeitende Person','00000000-0000-4000-8000-000000000041');await new Promise(r=>setTimeout(r,20));
 input(office,'Leistungsart','45');await new Promise(r=>setTimeout(r,20));
 assert.equal(office.document.querySelector('dialog input[type=checkbox]').checked,false);
 office.document.querySelector('.cw-evidence-builder').open=true;
 input(office,'Bezeichnung / Referenz / Ablageort','Synthetische Schulungsqualifikation');input(office,'Ausstellende oder vertragliche Stelle','Teststelle');input(office,'Geprüft am','2026-10-01');await new Promise(r=>setTimeout(r,20));click(office,'Nachweis ergänzen');
 input(office,'Gültig ab','2025-01-01');office.document.querySelector('dialog input[type=checkbox]').click();await new Promise(r=>setTimeout(r,20));click(office,'Freigabe speichern');
 await until(()=>office.document.querySelector('dialog')?.textContent.includes('Qualifikationsfreigabe gespeichert.'));office.document.querySelector('button[aria-label="Dialog schließen"]').click();
 click(office,'Vorlagenbibliothek');await until(()=>office.document.querySelector('dialog[open]'));
 input(office,'Vorlagen für','45');input(office,'Vorlagen suchen','Transfers');await until(()=>office.document.querySelectorAll('.cw-template-card').length===1);
 office.document.querySelector('.cw-template-card').click();await until(()=>office.document.querySelector('.cw-template-preview'));
 click(office,'Mit dieser Vorlage planen');await until(()=>office.document.querySelector('dialog h2')?.textContent==='Neuen Beratungsfall anlegen');
 input(office,'Klientin / Klient','00000000-0000-4000-8000-000000000050');await new Promise(r=>setTimeout(r,20));click(office,'Fallakte anlegen');
 await until(()=>office.document.querySelector('.cw-subtitle')?.textContent.includes('Häusliche Schulung § 45 · Noch zu planen'));
 input(office,'Beratungsperson','00000000-0000-4000-8000-000000000041');input(office,'Beginn (Ortszeit des Geräts)','2026-11-21T10:00');await new Promise(r=>setTimeout(r,20));click(office,'45 Minuten');await new Promise(r=>setTimeout(r,20));click(office,'Termin zuweisen');
 await until(()=>office.document.querySelector('.cw-subtitle')?.textContent.includes('Geplant'));
 click(portal,'← Alle Besuche');await until(()=>portal.document.querySelector('.cw-visits'));click(portal,'Aktualisieren');await until(()=>portal.document.querySelector('.cw-visit .cw-training'));
 portal.document.querySelector('.cw-visit .cw-training').closest('button').click();await until(()=>[...portal.document.querySelectorAll('button')].some(b=>b.textContent==='Übergabe gelesen'));
 assert.ok(portal.document.querySelector('.cw-handover').textContent.includes('Gewünschten Transfer'));
 click(portal,'Übergabe gelesen');await until(()=>[...portal.document.querySelectorAll('button')].find(b=>b.textContent==='Besuch jetzt beginnen')?.disabled===false);click(portal,'Besuch jetzt beginnen');await until(()=>portal.document.querySelector('.cw-subtitle')?.textContent.includes('In Durchführung'));
 click(portal,'+ Person ergänzen');await until(()=>portal.document.querySelector('.cw-repeat-item'));input(portal,'Name','Synthetische Pflegeperson');click(portal,'Weiter →');await until(()=>portal.document.querySelector('.cw-section-heading h2')?.textContent==='Situation & Beratung');
 input(portal,'Aktuelle Pflegesituation','Synthetischer Schulungsfall.');input(portal,'Handlungsbedarf','none');click(portal,'Weiter →');await until(()=>portal.document.querySelector('.cw-section-heading h2')?.textContent==='Lernziele & Übungen');
 const teamOption=[...portal.document.querySelectorAll('select option')].find(o=>o.textContent.includes('Lernbaustein des Teams'));assert.ok(teamOption,'Published team template in employee portal');
 input(portal,'Schulungsbaustein auswählen',teamOption.value);await until(()=>portal.document.querySelector('.cw-template-preview'));click(portal,'Lernziel übernehmen');await until(()=>portal.document.querySelector('.cw-repeat-item'));
 assert.equal([...portal.document.querySelectorAll('select')].find(s=>s.closest('label').textContent.startsWith('Lernergebnis')).value,'');
 assert.ok([...portal.document.querySelectorAll('button')].find(b=>b.textContent==='Lernziel bereits vorhanden')?.disabled);
 click(portal,'Zwischenspeichern');await until(()=>portal.document.querySelector('.cw-save-state')?.textContent.startsWith('Serverstand'));
 await server.fixture.portal();const training=(await server.fixture.load(true)).encounters.find(e=>e.service_kind==='45');
 assert.equal(training.answers.goals.length,1);assert.equal(training.answers.goals[0].result,'');assert.equal(training.answers.goals[0].practice,'');assert.equal(training.answers.goals[0].method,'');assert.equal(training.answers.findingsConsent,'');
 click(portal,'Gemeinsam unter Anleitung geübt');input(portal,'Gemeinsam durchgeführte Übung','Synthetische dokumentierte Übung.');input(portal,'Lernergebnis','supported');click(portal,'Individuelle Übungsanleitung');click(portal,'Weiter →');await until(()=>portal.document.querySelector('.cw-section-heading h2')?.textContent==='Empfehlungen & nächste Schritte');
 input(portal,'Gemeinsames Ergebnis des Besuchs','Synthetisch vereinbarter nächster Schritt.');input(portal,'Empfehlung vorbereiten','practice');await new Promise(r=>setTimeout(r,20));click(portal,'Empfehlung übernehmen');await until(()=>portal.document.querySelector('.cw-repeat-item'));
 click(portal,'Pflegende Person');click(portal,'In 7 Tagen');await new Promise(r=>setTimeout(r,20));click(portal,'Weiter →');await until(()=>portal.document.querySelector('.cw-section-heading h2')?.textContent==='Prüfen & bestätigen');
 click(portal,'Besuch jetzt beenden');await until(()=>portal.document.querySelector('.cw-subtitle')?.textContent.includes('Dokumentation offen'));
 click(portal,'Unterschreiben & einreichen');await until(()=>portal.document.querySelector('dialog[open]'));sign(portal);await new Promise(r=>setTimeout(r,20));click(portal,'Verbindlich einreichen');await until(()=>portal.document.querySelector('.cw-subtitle')?.textContent.includes('Zur Prüfung'));
 click(office,'Aktualisieren');await until(()=>[...office.document.querySelectorAll('button')].some(b=>b.textContent==='Fachlich freigeben'));click(office,'Fachlich freigeben');await until(()=>office.document.querySelector('.cw-subtitle')?.textContent.includes('Fachlich freigegeben'));
 await server.fixture.actor();const trainingResult=await server.fixture.load(false,training.case_id);const approved=trainingResult.revisions[0].snapshot.answers;
 assert.equal(approved.goals[0].result,'supported');assert.equal(approved.goals[0].method,'Gemeinsam unter Anleitung geübt');assert.equal(approved.measures[0].status,'open');assert.equal(approved.measures[0].owner,'Pflegende Person');assert.equal(approved.materials,'Individuelle Übungsanleitung');
 // The approved recommendation becomes a shared task, without rewriting signatures.
 await until(()=>office.document.querySelectorAll('.cw-task-card').length===1);
 click(office,'Rückmeldung erfassen');await until(()=>office.document.querySelector('dialog[open]'));
 input(office,'Rückmeldung / Ergebnis / Grund der Änderung','Rückmeldung der Pflegeperson zusätzlich dokumentiert.');await new Promise(r=>setTimeout(r,20));
 click(portal,'Aktualisieren');await until(()=>portal.document.querySelectorAll('.cw-task-card').length===1);
 click(portal,'Rückmeldung erfassen');await until(()=>portal.document.querySelector('dialog[open]'));
 input(portal,'Aufgabenstatus','done');input(portal,'Rückmeldung / Ergebnis / Grund der Änderung','Übungsfortschritt telefonisch bestätigt.');await new Promise(r=>setTimeout(r,20));click(portal,'Rückmeldung speichern');
 await until(()=>!portal.document.querySelector('dialog'));
 await until(()=>office.document.querySelector('dialog .cw-alert-warning')?.textContent.includes('zwischenzeitlich'));
 assert.equal([...office.document.querySelectorAll('dialog button')].find(b=>b.textContent==='Rückmeldung speichern').disabled,true);
 click(office,'Aktuellen Status übernehmen – meine Rückmeldung behalten');await new Promise(r=>setTimeout(r,20));
 assert.ok(office.document.querySelector('dialog textarea').value.includes('zusätzlich dokumentiert'));click(office,'Rückmeldung speichern');await until(()=>!office.document.querySelector('dialog'));
 click(office,'Erledigt',office.document.querySelector('.cw-followups'));await until(()=>office.document.querySelector('.cw-task-card')?.textContent.includes('zusätzlich dokumentiert'));
 await server.fixture.actor();const followed=await server.fixture.load(false,training.case_id);assert.equal(followed.followUps[0].status,'done');assert.equal(followed.followUps[0].version,3);assert.deepEqual(followed.revisions,trainingResult.revisions);assert.deepEqual(followed.encounters[0].answers,trainingResult.encounters[0].answers);assert.equal(followed.encounters[0].version,trainingResult.encounters[0].version);
 click(portal,'← Alle Besuche');await until(()=>portal.document.querySelector('.cw-visits'));click(portal,'Erledigt',portal.document.querySelector('.cw-followups'));await until(()=>portal.document.querySelector('.cw-task-card')?.textContent.includes('zusätzlich dokumentiert'));
 assert.ok(![...portal.document.querySelectorAll('button')].some(b=>b.textContent==='Teamvorlagen'),'No template management in the employee portal');
 console.log('PASS: office + employee §37.3/§45 forms, qualification, team draft/publication/application, planning, actual documentation/signatures/review, shared follow-up completion and simultaneous-edit recovery; signed revisions unchanged.');
}catch(e){console.error(e);console.error(windows.at(-1)?.document.querySelector('main')?.textContent.slice(-6000));process.exitCode=1;}
finally{for(const w of windows)await w.happyDOM.close();await server.close();}
