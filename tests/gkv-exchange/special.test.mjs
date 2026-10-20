import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, linkedFixture } from './fixtures.mjs';
import { validateDraft, hasDraftShape } from '../../src/lib/gkvExchange/model.ts';
import { emptyAid, aidAmounts } from '../../src/lib/gkvExchange/special.ts';
import { calculatePrice } from '../../src/lib/gkvExchange/pricing.ts';
import { buildTestInterchange, parseEdifact } from '../../src/lib/gkvExchange/edifact.ts';
import { importInvoiceCase, verifyCaseSources } from '../../src/lib/gkvExchange/sources.ts';

function aidFixture(tax='add'){
  const d=fixture(),c=d.cases[0],l=c.lines[0];d.serviceType='06';d.profile.employeeNumberRequired=false;
  Object.assign(d.profile,{billingCode:'19',taxTreatment:tax==='exempt'?'exempt':'taxable',taxExemptionCode:tax==='exempt'?'01':'',taxNumber:'DE123456789'});
  Object.assign(l,{remuneration:'05',code:'5001010001',unitPriceCents:10003,quantityHundredths:200,contractReference:'Fiktiver Liefervertrag',aid:{...emptyAid(),kind:'technical',vatTreatment:tax,vatCode:tax==='exempt'?'':'1',supplyCode:'00',approvalReference:'GEN-1',approvalDate:'2026-10-01',coPaymentCents:1000}});
  l.totalCents=calculatePrice(l).totalCents;c.grossCents=l.totalCents;c.coPaymentCents=1000;return d;
}
test('HIL sequence, per-unit VAT rounding and invoice totals match the specified fields',()=>{
  const d=aidFixture();assert.deepEqual(validateDraft(d),[]);assert.equal(d.cases[0].grossCents,23808);
  const text=buildTestInterchange(d).text;
  assert.ok(text.includes("UST+DE123456789'"));
  assert.ok(text.includes("HIL+1+19,01+10,00+GEN-1+20261001+00'"));
  assert.ok(text.includes("IAF+238,08+10,00+0,00+228,08'"));
  const s=parseEdifact(text);assert.equal(s.filter(x=>x[0][0]==='HIL').length,1);
});
test('included VAT is never added twice or emitted as additional HIL tax',()=>{
  const d=aidFixture('included');assert.deepEqual(validateDraft(d),[]);
  assert.equal(d.cases[0].grossCents,20006);
  assert.deepEqual(aidAmounts(d.cases[0].lines[0]),{netCents:16812,vatCents:3194,totalCents:20006,vatUnitCents:1597,vatRate:19});
  assert.ok(buildTestInterchange(d).text.includes("HIL+++10,00+GEN-1+20261001+00'"));
});
test('tax-exempt aid remains explicit and cannot mix with taxable invoice profile',()=>{
  const d=aidFixture('exempt');assert.deepEqual(validateDraft(d),[]);assert.equal(d.cases[0].grossCents,20006);
  d.profile.taxTreatment='taxable';assert.ok(validateDraft(d).some(i=>i.path.endsWith('vatTreatment')));
});
test('technical aid requires authorization, reserved codes fail and reuse requires inventory',()=>{
  for(const change of [{approvalReference:''},{supplyCode:'07'},{supplyCode:'23'},{supplyCode:'02',inventoryNumber:''},{inventoryRequired:true},{productCodeRequired:true},{productCode:'ABC'},{description:'Forbidden with full code'}]){
    const d=aidFixture();Object.assign(d.cases[0].lines[0].aid,change);assert.ok(validateDraft(d).length,JSON.stringify(change));assert.throws(()=>buildTestInterchange(d));
  }
});
test('missing full product number requires product group plus description, retaining escaped values',()=>{
  const d=aidFixture('exempt'),l=d.cases[0].lines[0];l.code='50';l.aid.description="Muster+Sonderteil";
  assert.deepEqual(validateDraft(d),[]);assert.ok(buildTestInterchange(d).text.includes('Muster?+Sonderteil'));
  l.code='5001';assert.ok(validateDraft(d).some(i=>i.path.endsWith('code')));
});
test('fractional quantities, invalid aid shapes, mixed services and copayment mismatches are rejected',()=>{
  for(const mutate of [d=>d.cases[0].lines[0].quantityHundredths=150,d=>d.serviceType='01',d=>d.cases[0].coPaymentCents=0,d=>d.profile.taxNumber='',d=>d.profile.billingCode='36',d=>d.cases[0].lines[0].aid.coPaymentCents=999999]){
    const d=aidFixture();mutate(d);assert.throws(()=>buildTestInterchange(d));
  }
  for(const value of [null,{},'bad',{...emptyAid(),coPaymentCents:NaN}]){const d=aidFixture();d.cases[0].lines[0].aid=value;assert.equal(hasDraftShape(d),false);assert.ok(validateDraft(d).length);}
  for(const value of [0,123,true,{}]){const d=aidFixture();d.profile.taxNumber=value;assert.equal(hasDraftShape(d),false);assert.ok(validateDraft(d).length);}
});
test('taxable source import is explicit and exact net, VAT, quantity and gross are rechecked',()=>{
  const {source}=linkedFixture();Object.assign(source.items[0],{unit_price:'100.03',quantity:'2',net_amount:'200.06',vat_amount:'38.02',vat_rate:'19',gross_amount:'238.08'});source.total_amount='238.08';
  assert.throws(()=>importInvoiceCase(source,'2026-10'));
  const c=importInvoiceCase(source,'2026-10','06');const l=aidFixture().cases[0].lines[0];Object.assign(c.lines[0],l);
  assert.deepEqual(verifyCaseSources(c,source),[]);
  for(const key of ['net_amount','vat_amount','quantity','vat_rate']){const changed=structuredClone(source);changed.items[0][key]='1.00';assert.ok(verifyCaseSources(c,changed).some(i=>i.path.startsWith('lines')));}
});
function specialFixture(service='12',monthly=false){
  const d=fixture(),c=d.cases[0],l=c.lines[0];d.serviceType=service;
  c.agreement={reference:'Fiktiver Bescheid',from:'2026-10-01',until:'2026-10-31',exchangeReference:'Fiktive Teilnahmevereinbarung',limitCents:8000};
  Object.assign(l,{remuneration:'99',code:'99'});
  if(monthly){Object.assign(l,{day:'99',pricingRule:'special_monthly'});d.createdAt='2026-11-01T10:00:00Z';c.invoiceDate='2026-11-01';}
  return d;
}
test('08/11/12/14 use their actual service key and require case-specific agreement',()=>{
  for(const code of ['08','11','12','14']){const d=specialFixture(code);assert.deepEqual(validateDraft(d),[]);assert.ok(buildTestInterchange(d).text.includes(`ELS+${code}:99:0:99`));delete d.cases[0].agreement;assert.throws(()=>buildTestInterchange(d));}
});
test('fixed special monthly amounts require full-period coverage and closed month',()=>{
  for(const code of ['08','12','14'])assert.deepEqual(validateDraft(specialFixture(code,true)),[]);
  for(const change of [d=>d.cases[0].agreement.from='2026-10-02',d=>d.cases[0].agreement.until='2026-10-30',d=>d.cases[0].invoiceDate='2026-10-20',d=>d.serviceType='11',d=>d.serviceType='01',d=>d.cases[0].lines.push({...d.cases[0].lines[0]})]){const d=specialFixture('12',true);change(d);assert.throws(()=>buildTestInterchange(d));}
});
test('special award cap, invalid dates, missing exchange reference and unsupported remuneration block export',()=>{
  for(const change of [d=>d.cases[0].agreement.limitCents=7999,d=>d.cases[0].agreement.from='2026-02-30',d=>d.cases[0].agreement.exchangeReference='',d=>d.cases[0].lines[0].remuneration='08']){const d=specialFixture();change(d);assert.throws(()=>buildTestInterchange(d));}
});
test('special monthly source requires complete invoice period and cannot attach a single visit',()=>{
  const {source}=linkedFixture();const c=importInvoiceCase(source,'2026-10');Object.assign(c.lines[0],specialFixture('12',true).cases[0].lines[0]);
  assert.deepEqual(verifyCaseSources(c,source),[]);
  source.service_period_to='2026-10-30';assert.ok(verifyCaseSources(c,source).some(i=>i.path.endsWith('day')));
});
