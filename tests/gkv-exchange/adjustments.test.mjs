import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePrice } from '../../src/lib/gkvExchange/pricing.ts';
import { ADJUSTMENT_RULE, adjustmentIssues, calculateAdjustments } from '../../src/lib/gkvExchange/adjustments.ts';
import { hasDraftShape, validateDraft } from '../../src/lib/gkvExchange/model.ts';
import { buildTestInterchange, parseEdifact, validateEnvelope } from '../../src/lib/gkvExchange/edifact.ts';
import { verifyCaseSources } from '../../src/lib/gkvExchange/sources.ts';
import { fixture, linkedFixture } from './fixtures.mjs';
const adjustment=(overrides={})=>({tariff:'08',kind:'1',code:'21',text:'Fiktiver Testzuschlag',allocation:'1',calculation:'11',direction:'1',value:'25',contractReference:'Fiktiver Prüfvertrag 2026, Abschnitt 4',...overrides});
const line=(overrides={})=>({...fixture().cases[0].lines[0],adjustmentRule:ADJUSTMENT_RULE,adjustments:[adjustment()],...overrides});

test('independent percentage and fixed adjustments use the original base and their declared sign',()=>{
  const l=line({adjustments:[adjustment(),adjustment({value:'10'}),adjustment({calculation:'12',value:'2.50',direction:'0'})]});
  assert.deepEqual(calculateAdjustments(l,8000),[{resultCents:2000,signedCents:2000,end:'0'},{resultCents:800,signedCents:800,end:'0'},{resultCents:250,signedCents:-250,end:'1'}]);
  assert.equal(calculatePrice(l).totalCents,10550);assert.equal(calculatePrice(l).unitPriceCents,8000);
});
test('five-decimal values round each result commercially, including deductions',()=>{
  const l=line({unitPriceCents:5,adjustments:[adjustment({value:'10'}),adjustment({calculation:'12',value:'0,00500',direction:'0'})]});
  assert.deepEqual(calculateAdjustments(l,5).map(a=>a.signedCents),[1,-1]);assert.equal(calculatePrice(l).totalCents,5);
  assert.equal(calculatePrice(line({adjustments:[adjustment({calculation:'12',value:'0.00499'})]})).totalCents,8000);
});
test('negative totals and ZUS result overflow fail closed',()=>{
  assert.throws(()=>calculatePrice(line({adjustments:[adjustment({direction:'0',value:'100.00001'})],unitPriceCents:9000000})),/unzulässigen/);
  assert.throws(()=>calculatePrice(line({unitPriceCents:999999999999})),/99.999/);
  assert.throws(()=>calculatePrice(line({adjustments:[adjustment({calculation:'12',direction:'0',value:'80.01'})]})),/unzulässigen/);
});
test('single-unit, rounding choice and contract restrictions cannot be bypassed',()=>{
  for(const change of [{quantityHundredths:200},{adjustmentRule:undefined},{remuneration:'02',code:'43',duration:'60',pricingRule:'time_proportional',contractReference:'Vertrag'},{remuneration:'06',code:'04',pricingRule:'kilometres_rounded',distanceKm:'3',contractReference:'Vertrag'},{adjustments:[adjustment({contractReference:''})]},{adjustments:[adjustment({calculation:'13'})]}])assert.throws(()=>calculatePrice(line(change)));
});
test('tariff-region mapping, reserved codes, assignment and required employee are validated',()=>{
  assert.deepEqual(adjustmentIssues(line({adjustments:[adjustment({tariff:'23'})]}),'09'),[]);
  for(const change of [{tariff:'03'},{code:'01'},{code:'20'},{kind:'2'},{allocation:'2'},{code:'00',text:''},{code:'04'},{value:'25.000001'},{text:'€'}])assert.ok(adjustmentIssues(line({adjustments:[adjustment(change)]}),'09').length);
  assert.deepEqual(adjustmentIssues(line({secondEmployeeNumber:'999999998',adjustments:[adjustment({code:'04'})]}),'09'),[]);
  assert.ok(adjustmentIssues(line({remuneration:'07',code:'10'}),'10').length);
});
test('shared travel charges must be a percentage deduction on the travel ELS',()=>{
  const l=line({remuneration:'06',code:'03',startTime:'0900',adjustments:[adjustment({code:'02',allocation:'2',direction:'0',value:'50'})]});
  assert.deepEqual(adjustmentIssues(l,'01'),[]);assert.equal(calculatePrice(l).totalCents,4000);
  l.adjustments[0].direction='1';assert.throws(()=>calculatePrice(l));
});
test('stored adjustment structure is bounded while incomplete text remains a savable draft',()=>{
  const d=fixture();d.cases[0].lines[0]=line({adjustments:[adjustment({value:'',tariff:''})]});assert.equal(hasDraftShape(d),true);assert.ok(validateDraft(d).length);
  for(const bad of [null,{},[null],[{value:12}],Array.from({length:21},()=>adjustment())]){d.cases[0].lines[0].adjustments=bad;assert.equal(hasDraftShape(d),false);assert.doesNotThrow(()=>validateDraft(d));assert.ok(validateDraft(d).length);}
});
test('ZUS fields, deltas, five decimals, escaping, end markers and totals are serialized together',()=>{
  const d=fixture(),l=line({adjustments:[adjustment({text:"Test +:?'",value:'12.5'}),adjustment({calculation:'12',value:'2.50',direction:'0'})]});
  Object.assign(l,calculatePrice(l));d.cases[0].lines=[l];d.cases[0].grossCents=l.totalCents;
  assert.deepEqual(validateDraft(d),[]);const file=buildTestInterchange(d);const segments=parseEdifact(file.text);validateEnvelope(segments);
  const zus=segments.filter(s=>s[0][0]==='ZUS');
  assert.deepEqual(zus[0].slice(1),[['08','1','21'],["Test +:?'"],['1'],['11'],['1'],['12,50000'],['10,00'],['0']]);
  assert.deepEqual(zus[1].slice(3),[['1'],['12'],['0'],['2,50000'],['2,50'],['1']]);
  assert.equal(segments.find(s=>s[0][0]==='ELS')[2][0],'80,00');assert.equal(segments.find(s=>s[0][0]==='IAF')[1][0],'87,50');
  const first=segments.findIndex(s=>s[0][0]==='ZUS');assert.equal(segments[first-1][0][0],'ELS');assert.equal(segments[first+2][0][0],'IAF');
});
test('a changed total or legacy surcharge cannot be silently exported',()=>{
  const d=fixture();d.cases[0].lines[0]=line();assert.ok(validateDraft(d).some(i=>i.path.endsWith('totalCents')));assert.throws(()=>buildTestInterchange(d));
  d.cases[0].lines[0]=line({adjustments:[],adjustmentRule:undefined,surcharges:[]});assert.throws(()=>buildTestInterchange(d),/ZUS/);
});
test('source validation compares the total including adjustments and still rejects changed sources',()=>{
  const {draft,source}=linkedFixture(),c=draft.cases[0];
  c.lines[0]={...c.lines[0],unitPriceCents:6400,adjustments:[adjustment()],adjustmentRule:ADJUSTMENT_RULE};Object.assign(c.lines[0],calculatePrice(c.lines[0]));
  assert.equal(c.lines[0].totalCents,8000);assert.deepEqual(verifyCaseSources(c,source),[]);assert.deepEqual(validateDraft(draft),[]);
  c.lines[0].adjustments[0].value='26';Object.assign(c.lines[0],calculatePrice(c.lines[0]));c.grossCents=c.lines[0].totalCents;assert.ok(verifyCaseSources(c,source).length);
});
