import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePrice, formatFixed } from '../../src/lib/gkvExchange/pricing.ts';
import { validateDraft } from '../../src/lib/gkvExchange/model.ts';
import { buildTestInterchange, parseEdifact } from '../../src/lib/gkvExchange/edifact.ts';
import { fixture } from './fixtures.mjs';
const line=(overrides={})=>({...fixture().cases[0].lines[0],contractReference:'Fiktiver Prüfvertrag ab 2026-10-01',...overrides});
test('proportional time uses the encoded unit and rounds only the final cent amount',()=>{
  assert.equal(calculatePrice(line({remuneration:'02',code:'43',duration:'20',unitPriceCents:1000,pricingRule:'time_proportional'})).totalCents,333);
  assert.equal(calculatePrice(line({remuneration:'02',code:'23',duration:'7',unitPriceCents:201,pricingRule:'time_proportional'})).totalCents,281);
  assert.equal(calculatePrice(line({remuneration:'02',code:'63',duration:'15',unitPriceCents:101,pricingRule:'time_proportional'})).totalCents,152);
});
test('started-unit tariffs require an explicit choice and preserve actual duration',()=>{
  const l=line({remuneration:'02',code:'33',duration:'16',unitPriceCents:1200,pricingRule:'time_started_unit'});
  assert.deepEqual(calculatePrice(l),{unitPriceCents:1200,totalCents:2400,duration:'16'});
  assert.throws(()=>calculatePrice({...l,pricingRule:undefined}));assert.throws(()=>calculatePrice({...l,contractReference:''}));
});
test('all six time unit codes calculate the exact same one-hour charge',()=>{
  for(const [code,price]of [['13',100],['23',500],['33',1500],['43',6000],['53',144000],['63',1000]])assert.equal(calculatePrice(line({remuneration:'02',code,duration:'60',unitPriceCents:price,pricingRule:'time_proportional'})).totalCents,6000);
});
test('kilometres round commercially before calculation with maximum field protection',()=>{
  const km=line({remuneration:'06',code:'04',unitPriceCents:75,pricingRule:'kilometres_rounded',distanceKm:'3,49'});
  assert.deepEqual(calculatePrice(km),{unitPriceCents:75,totalCents:225,duration:'3'});
  assert.deepEqual(calculatePrice({...km,distanceKm:'3.50'}),{unitPriceCents:75,totalCents:300,duration:'4'});
  assert.throws(()=>calculatePrice({...km,distanceKm:'9999.50'}));assert.throws(()=>calculatePrice({...km,distanceKm:'3.499'}));
});
test('point value preserves five decimals and rounds each unit price before quantity',()=>{
  const l=line({remuneration:'01',code:'001',pointValue:'0.05755',points:'100',quantityHundredths:300,pricingRule:'points_unit'});
  assert.deepEqual(calculatePrice(l),{unitPriceCents:576,totalCents:1728,duration:'00'});
  assert.equal(formatFixed('0,05755',1,5),'0,05755');assert.equal(formatFixed('1',1,5),'1,00000');
  assert.throws(()=>calculatePrice({...l,pointValue:'0.057555'}));assert.throws(()=>calculatePrice({...l,points:'1.5'}));
});
test('point and time EDIFACT fields are emitted in their specified positions',()=>{
  const d=fixture();d.serviceType='01';const l=line({remuneration:'01',code:'001',startTime:'0915',pointValue:'0.05755',points:'100',pricingRule:'points_unit'});Object.assign(l,calculatePrice(l));d.cases[0].lines=[l];d.cases[0].grossCents=l.totalCents;
  assert.deepEqual(validateDraft(d),[]);const els=parseEdifact(buildTestInterchange(d).text).find(s=>s[0][0]==='ELS');assert.deepEqual(els.slice(1,7),[['01','01','0','001'],['5,76'],['0,05755'],['100'],['00'],['1,00']]);
  Object.assign(l,{remuneration:'02',code:'43',pointValue:'',points:'',duration:'45',pricingRule:'time_proportional',unitPriceCents:6000});Object.assign(l,calculatePrice(l));d.cases[0].grossCents=l.totalCents;
  assert.deepEqual(validateDraft(d),[]);assert.equal(l.totalCents,4500);assert.ok(buildTestInterchange(d).text.includes('ELS+01:02:0:43+60,00+++45+1,00'));
});
test('stored totals, kilometres, unit prices and unsupported surcharge data cannot bypass validation',()=>{
  const d=fixture();const l=line({remuneration:'06',code:'04',startTime:'0915',distanceKm:'3.5',duration:'3',pricingRule:'kilometres_rounded'});d.cases[0].lines=[l];assert.ok(validateDraft(d).some(x=>x.path.endsWith('duration')));
  assert.throws(()=>calculatePrice(line({unitPriceCents:999999999999,quantityHundredths:999999})));
  const s=fixture();s.cases[0].lines[0].surcharges=[];assert.ok(validateDraft(s).some(x=>x.message.includes('ZUS')));
});
