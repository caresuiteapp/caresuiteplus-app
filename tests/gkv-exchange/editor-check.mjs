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
const bundle=await build({stdin:{contents:`import * as React from 'react';import {createRoot} from 'react-dom/client';import {CaseEditor} from './src/components/office/gkv/GkvEditors.web';globalThis.gkvEditors={React,createRoot,CaseEditor};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,tsconfigRaw:{},format:'iife',platform:'browser',jsx:'automatic',nodePaths:[dependencies],alias:{'@':resolve('src')},define:{'process.env.NODE_ENV':'"test"'}});
runInThisContext(bundle.outputFiles[0].text);
const {React,createRoot,CaseEditor}=globalThis.gkvEditors;
const container=document.createElement('div');document.body.appendChild(container);const root=createRoot(container);let current,reloads=0;
function App(){const [value,setValue]=React.useState(linkedFixture().draft.cases[0]);current=value;return React.createElement(CaseEditor,{value,index:0,onChange:setValue,onRemove:()=>{},onReload:()=>reloads++});}
const field=label=>[...container.querySelectorAll('label')].find(e=>e.firstElementChild?.textContent===label)?.querySelector('input,select');
async function fill(label,value){const input=field(label);assert.ok(input,`Missing field: ${label}`);await React.act(async()=>{if(input.tagName==='INPUT')Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,value);else input.value=value;input.dispatchEvent(new window.Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));});}
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
  console.log('PASS: time, malformed money/recovery, kilometres, flat-rate reset, points/reset, source reload (DOM only).');
}finally{await React.act(async()=>root.unmount());for(const channel of channels){channel.port1.close();channel.port2.close();}globalThis.MessageChannel=OriginalMessageChannel;await window.happyDOM.close();}
