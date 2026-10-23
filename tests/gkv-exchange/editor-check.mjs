/** DOM behavior only, no layout/visual claim. Uses existing tools, installs nothing.
 * node --import ./tests/gkv-exchange/register.mjs tests/gkv-exchange/editor-check.mjs /existing/node_modules
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { runInThisContext } from 'node:vm';
import assert from 'node:assert/strict';
import { linkedFixture } from './fixtures.mjs';
const dependencies=process.argv[2];if(!dependencies)throw new Error('Path to existing dependencies required; no automatic installation.');
const require=createRequire(resolve(dependencies,'../package.json'));
const {Window}=await import(pathToFileURL(require.resolve('happy-dom')).href);
const {build}=await import(pathToFileURL(require.resolve('esbuild')).href);
const window=new Window();
for(const key of ['window','document','HTMLElement','HTMLInputElement','Event','MouseEvent','Node'])globalThis[key]=key==='window'?window:window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const OriginalMessageChannel=globalThis.MessageChannel,channels=[];
globalThis.MessageChannel=class extends OriginalMessageChannel{constructor(){super();channels.push(this);}};
const bundle=await build({stdin:{contents:`import * as React from 'react';import {createRoot} from 'react-dom/client';import {CaseEditor} from './src/components/office/gkv/GkvEditors.web';import {RevisionHistory} from './src/components/office/gkv/GkvRevisionHistory.web';globalThis.gkvEditors={React,createRoot,CaseEditor,RevisionHistory};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,tsconfigRaw:{},format:'iife',platform:'browser',jsx:'automatic',nodePaths:[dependencies],alias:{'@':resolve('src')},define:{'process.env.NODE_ENV':'"test"'}});
runInThisContext(bundle.outputFiles[0].text);
const {React,createRoot,CaseEditor,RevisionHistory}=globalThis.gkvEditors;
const container=document.createElement('div');document.body.appendChild(container);const root=createRoot(container);let current,reloads=0;
function App(){const [value,setValue]=React.useState(linkedFixture().draft.cases[0]);current=value;return React.createElement(CaseEditor,{value,index:0,onChange:setValue,onRemove:()=>{},onReload:()=>reloads++});}
const field=label=>[...container.querySelectorAll('label')].find(e=>e.firstElementChild?.textContent===label)?.querySelector('input,select,textarea');
async function fill(label,value){const input=field(label);assert.ok(input,`Missing field: ${label}`);await React.act(async()=>{if(['INPUT','TEXTAREA'].includes(input.tagName))Object.getOwnPropertyDescriptor((input.tagName==='INPUT'?window.HTMLInputElement:window.HTMLTextAreaElement).prototype,'value').set.call(input,value);else input.value=value;input.dispatchEvent(new window.Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));});}
try{
  await React.act(async()=>root.render(React.createElement(App)));
  await fill('Vergütungsart','02');await fill('Vertraglicher Leistungsschlüssel','43');await fill('Tatsächlicher Beginn (HHMM)','0900');await fill('Tatsächliche Dauer je Leistung (Minuten)','45');await fill('Preis je verschlüsselter Zeiteinheit (€)','60,00');await fill('Vertraglich vereinbarte Berechnung','time_proportional');await fill('Vertrag / Vergütungsvereinbarung mit Gültigkeit','Fiktiver Prüfvertrag Oktober 2026');
  assert.equal(current.lines[0].totalCents,4500);assert.equal(current.grossCents,4500);assert.ok(container.textContent.includes('45,00'));
  await fill('Preis je verschlüsselter Zeiteinheit (€)','60,001');assert.equal(field('Preis je verschlüsselter Zeiteinheit (€)').getAttribute('aria-invalid'),'true');assert.ok(Number.isNaN(current.grossCents));await fill('Preis je verschlüsselter Zeiteinheit (€)','60,00');assert.equal(current.grossCents,4500);
  await fill('Vergütungsart','06');await fill('Vertraglicher Leistungsschlüssel','04');await fill('Preis je Kilometer (€)','0,75');await fill('Tatsächlich gefahrene Kilometer','3,50');await fill('Vertraglich vereinbarte Berechnung','kilometres_rounded');assert.equal(current.lines[0].duration,'4');assert.equal(current.grossCents,300);
  await fill('Vertraglicher Leistungsschlüssel','03');assert.equal(current.lines[0].pricingRule,undefined);assert.equal(current.lines[0].duration,'00');
  await fill('Vergütungsart','01');await fill('Vertraglicher Leistungsschlüssel','001');await fill('Punktwert (€; optional)','0,05755');await fill('Punktzahl (optional)','100');await fill('Vertraglich vereinbarte Berechnung','points_unit');assert.equal(current.lines[0].unitPriceCents,576);assert.equal(current.grossCents,576);
  await fill('Punktwert (€; optional)','');await fill('Punktzahl (optional)','');assert.equal(current.lines[0].pricingRule,undefined);assert.equal(field('Vertraglich vereinbarte Berechnung'),undefined);
  const reload=[...container.querySelectorAll('button')].find(b=>b.textContent==='Quellrechnung erneut übernehmen');await React.act(async()=>reload.click());assert.equal(reloads,1);
  const add=[...container.querySelectorAll('button')].find(b=>b.textContent==='Zu- oder Abschlag hinzufügen');await React.act(async()=>add.click());
  await fill('Vertragliche Zuschlagsberechnung','independent_single_unit');await fill('Tarifbereich des Zuschlags','23');await fill('Zuschlagsart','1');await fill('Grund des Zu- oder Abschlags','21');await fill('Zuschlagszuordnung','1');await fill('Berechnungsart des Zuschlags','11');await fill('Zuschlag oder Abzug','1');await fill('Zuschlagswert (%)','25');await fill('Vertragsgrundlage des Zuschlags','Fiktiver Vertrag Oktober 2026');
  assert.equal(current.lines[0].unitPriceCents,576);assert.equal(current.lines[0].totalCents,720);assert.equal(current.grossCents,720);
  await fill('Zuschlag oder Abzug','0');assert.equal(current.grossCents,432);
  await fill('Zuschlagswert (%)','25.000001');assert.ok(container.textContent.includes('fünf Nachkommastellen'));assert.equal(current.grossCents,0);
  await fill('Zuschlagswert (%)','25');assert.equal(current.grossCents,432);
  await React.act(async()=>container.querySelector('[aria-label="Zu- oder Abschlag 1 entfernen"]').click());assert.equal(current.grossCents,576);assert.equal(current.lines[0].adjustmentRule,undefined);
  console.log('PASS: time, malformed money/recovery, kilometres, flat-rate reset, points/reset, source reload, surcharge/deduction/invalid recovery/removal (DOM only).');
  await fill('Vergütungsart','03');await fill('Vertraglicher Pflegesatz','01');await fill('Einzelpreis (€)','90,01');await fill('Tatsächlicher Beginn (HHMM)','0900');await fill('Tatsächliches Ende (HHMM)','1300');await fill('Vertraglich vereinbarte Berechnung','care_attendance');
  assert.equal(current.grossCents,9001);assert.equal(current.lines[0].quantityHundredths,100);
  const nextDay=[...container.querySelectorAll('label')].find(label=>label.textContent.includes('Nachtpflege endet am Folgetag')).querySelector('input');
  await React.act(async()=>nextDay.click());assert.equal(current.lines[0].careEndsNextDay,true);
  await fill('Vergütungsart','04');assert.equal(current.lines[0].careEndsNextDay,false);assert.equal(field('Tatsächlicher Beginn (HHMM)'),undefined);
  await fill('Vertraglicher Pflegesatz','00');await fill('Einzelpreis (€)','100,01');await fill('Vertraglich vereinbarte Berechnung','care_daily');await fill('Von-/Bis-Tag (TTTT)','0107');
  assert.equal(current.lines[0].day,'01');assert.equal(current.lines[0].quantityHundredths,700);assert.equal(current.grossCents,70007);
  await fill('Vertraglich vereinbarte Berechnung','care_monthly');assert.equal(current.lines[0].day,'99');assert.equal(current.lines[0].duration,'0131');assert.equal(current.lines[0].quantityHundredths,100);assert.equal(current.grossCents,10001);
  assert.equal([...container.querySelectorAll('button')].find(b=>b.textContent==='Zu- oder Abschlag hinzufügen').disabled,true);
  await fill('Vergütungsart','02');assert.equal(current.lines[0].day,'');assert.equal(current.lines[0].pricingRule,undefined);
  console.log('PASS: agreed partial-care price, next-day choice/reset, inclusive day calculation, monthly selection and remuneration reset (DOM only).');
  let copied='',historyControls;
  const saved={tenant_id:'11111111-1111-4111-8111-111111111111',batch_id:'22222222-2222-4222-8222-222222222222',revision:1,status:'draft',draft_sha256:'a'.repeat(64),recorded_at:'2026-10-19T12:00:00Z',capture_kind:'change',draft:linkedFixture().draft};
  saved.draft.cases.push({...saved.draft.cases[0],invoiceNumber:'RE2026-2',lastName:'Zweite Testperson'});
  function HistoryApp(){const [preview,setPreview]=React.useState(null),[reason,setReason]=React.useState(''),[hasMore,setMore]=React.useState(true),[canCopy,setCanCopy]=React.useState(true),[error,setError]=React.useState('');historyControls={setCanCopy,setError};return React.createElement(RevisionHistory,{rows:[saved],hasMore,pending:false,error,preview,reason,canCopy,onInspect:()=>setPreview(saved),onMore:()=>setMore(false),onRetry:()=>setError(''),onClose:()=>setPreview(null),onReason:setReason,onCopy:()=>{copied=reason;}});}
  await React.act(async()=>root.render(React.createElement(HistoryApp)));
  const click=async label=>{const button=[...container.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(button,`Missing button: ${label}`);await React.act(async()=>button.click());};
  await click('Ältere Stände laden');assert.equal([...container.querySelectorAll('button')].some(b=>b.textContent==='Ältere Stände laden'),false);
  await click('Stand 1 ansehen');assert.ok(container.querySelector('[aria-label="Ansicht von Stand 1"]'));
  assert.equal(field('Rechnungsnummer').value,'RE2026-1');assert.ok(field('Rechnungsnummer').closest('fieldset[disabled]'));
  await fill('Gespeicherten Fall ansehen','1');assert.equal(field('Rechnungsnummer').value,'RE2026-2');assert.equal(field('Nachname').value,'Zweite Testperson');
  let copyButton=[...container.querySelectorAll('button')].find(b=>b.textContent==='Als neuen Prüfentwurf übernehmen');assert.equal(copyButton.disabled,true);
  await fill('Grund für den neuen Prüfentwurf','Testüberarbeitung');assert.equal(copyButton.disabled,false);await click('Als neuen Prüfentwurf übernehmen');assert.equal(copied,'Testüberarbeitung');
  await React.act(async()=>historyControls.setCanCopy(false));assert.equal([...container.querySelectorAll('button')].some(b=>b.textContent==='Als neuen Prüfentwurf übernehmen'),false);
  await React.act(async()=>historyControls.setError('Fiktiver Ladefehler'));assert.ok(container.querySelector('[role="alert"]'));await click('Stände erneut laden');assert.equal(container.querySelector('[role="alert"]'),null);
  await click('Ansicht schließen');assert.equal(container.querySelector('[aria-label="Ansicht von Stand 1"]'),null);
  console.log('PASS: history paging action, read-only snapshot/case selection, copy reason, read-only role, retry and close (DOM only; transport callbacks are doubles).');
}finally{await React.act(async()=>root.unmount());for(const channel of channels){channel.port1.close();channel.port2.close();}globalThis.MessageChannel=OriginalMessageChannel;await window.happyDOM.close();}
