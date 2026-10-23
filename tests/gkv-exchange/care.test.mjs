import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, linkedFixture } from './fixtures.mjs';
import { hasDraftShape, validateDraft } from '../../src/lib/gkvExchange/model.ts';
import { recalculateLine } from '../../src/lib/gkvExchange/editor.ts';
import { buildTestInterchange, parseEdifact } from '../../src/lib/gkvExchange/edifact.ts';
import { daysInMonth } from '../../src/lib/gkvExchange/care.ts';
import { importInvoiceCase, verifyCaseSources } from '../../src/lib/gkvExchange/sources.ts';

function care(type='02', changes={}) {
  const d=fixture();d.serviceType=type;d.month='2026-09';d.profile.billingCode={'02':'81','03':'86','04':'91','05':'96','15':'36'}[type];
  const c=d.cases[0];c.month=d.month;
  c.lines=[recalculateLine({...c.lines[0],day:'16',startTime:'0900',remuneration:'03',code:'00',duration:'1600',pricingRule:'care_attendance',contractReference:'Synthetischer Pflegesatzvertrag 2026',...changes})];
  c.grossCents=c.lines[0].totalCents;return d;
}
const ok=d=>assert.deepEqual(validateDraft(d),[]);
const bad=(d,path)=>assert.ok(validateDraft(d).some(i=>i.path.endsWith(path)),JSON.stringify(validateDraft(d)));
test('Tagespflege uses the agreed full or half-day price once, with actual end time in ELS',()=>{
  for(const code of ['00','01']){const d=care('02',{code,unitPriceCents:9001});ok(d);assert.equal(d.cases[0].grossCents,9001);
    const segments=parseEdifact(buildTestInterchange(d).text),els=segments.find(s=>s[0][0]==='ELS');
    assert.deepEqual(els[1],['02','03','0',code]);assert.equal(els[2][0],'90,01');assert.equal(els[5][0],'1600');assert.equal(els[6][0],'1,00');
  }
});
test('Nachtpflege crosses midnight only with explicit confirmation and a matching end day',()=>{
  const d=care('03',{startTime:'2200',duration:'0600',careEndsNextDay:true});ok(d);
  d.cases[0].lines[0].careEndsNextDay=false;bad(d,'duration');
  d.cases[0].lines[0].careEndsNextDay=true;d.cases[0].lines[0].day='30';bad(d,'day');
  d.cases[0].lines[0].day='16';d.cases[0].lines[0].duration='2300';bad(d,'duration');
  const day=care('02',{startTime:'2200',duration:'0600',careEndsNextDay:true});bad(day,'careEndsNextDay');
});
test('invalid clocks, missing contract and unsupported partial absence are rejected',()=>{
  for(const duration of ['2400','1260','09','0900'])bad(care('02',{duration}),'duration');
  bad(care('02',{contractReference:''}),'totalCents');bad(care('02',{quantityHundredths:50}),'quantityHundredths');bad(care('02',{code:'02'}),'code');
  const d=care();d.cases[0].lines[0].careEndsNextDay='true';assert.equal(hasDraftShape(d),false);
});
test('Kurzzeitpflege and full inpatient daily rates cover inclusive days, with explicit absence rate',()=>{
  for(const type of ['04','05'])for(const code of ['00','02']){
    const d=care(type,{remuneration:'04',startTime:'',day:'01',duration:'0107',quantityHundredths:700,pricingRule:'care_daily',code,unitPriceCents:7001});ok(d);assert.equal(d.cases[0].grossCents,49007);
    const s=parseEdifact(buildTestInterchange(d).text).find(s=>s[0][0]==='ELS');assert.equal(s[5][0],'0107');assert.equal(s[6][0],'7,00');assert.equal(s[1][3],code);
  }
});
test('stationary periods reject bad dates, quantity mismatches, half-day codes and future end dates',()=>{
  const base={remuneration:'04',day:'01',duration:'0107',quantityHundredths:700,pricingRule:'care_daily'};
  for(const duration of ['0007','0701','0131','17'])bad(care('05',{...base,duration}),'duration');
  bad(care('05',{...base,quantityHundredths:600}),'quantityHundredths');bad(care('05',{...base,day:'02'}),'day');bad(care('05',{...base,code:'01'}),'code');
  const d=care('05',base);d.cases[0].invoiceDate='2026-09-06';bad(d,'duration');
});
test('monthly fixed price emits 99 and requires the complete calendar month and quantity one',()=>{
  const d=care('05',{remuneration:'04',startTime:'',day:'99',duration:'0130',quantityHundredths:100,pricingRule:'care_monthly',unitPriceCents:210000});ok(d);
  assert.ok(buildTestInterchange(d).text.includes("ESK+99'ELS+05:04:0:00+2100,00+++0130+1,00"));
  for(const change of [{day:'01'},{duration:'0131'},{duration:'0230'},{quantityHundredths:3000}]){const b=structuredClone(d);Object.assign(b.cases[0].lines[0],change);assert.ok(validateDraft(b).length);}
  assert.equal(daysInMonth('2028-02'),29);assert.equal(daysInMonth('2027-02'),28);assert.equal(daysInMonth('2026-13'),0);
  const future=structuredClone(d);future.month='2026-10';future.cases[0].month='2026-10';future.cases[0].lines[0].duration='0131';bad(future,'duration');
});
test('presence and absence periods cannot overlap, adjacent ranges remain valid',()=>{
  const d=care('05',{remuneration:'04',startTime:'',day:'01',duration:'0107',quantityHundredths:700,pricingRule:'care_daily'});
  d.cases[0].lines.push(recalculateLine({...d.cases[0].lines[0],code:'02',day:'08',duration:'0809',quantityHundredths:200}));
  d.cases[0].grossCents=d.cases[0].lines.reduce((sum,l)=>sum+l.totalCents,0);ok(d);
  Object.assign(d.cases[0].lines[1],{day:'07',duration:'0708'});bad(d,'duration');
});
test('malformed care positions return validation issues instead of throwing',()=>{
  for(const line of [null, 4, {}, {remuneration:'04',duration:1234}]){
    const d=care('05');d.cases[0].lines=[line];
    assert.equal(hasDraftShape(d),false);assert.ok(validateDraft(d).length);
  }
});
test('service/provider types and DiPA time content are validated independently',()=>{
  const d=care();d.profile.billingCode='96';bad(d,'profile.billingCode');d.profile.billingCode='81';d.serviceType='01';bad(d,'remuneration');
  const dipa=care('15',{remuneration:'02',code:'40',duration:'45',pricingRule:'time_proportional',unitPriceCents:6000});ok(dipa);assert.equal(dipa.cases[0].grossCents,4500);
  dipa.cases[0].lines[0].code='43';bad(dipa,'code');
});
test('monthly invoice import preserves the source day and rejects shortened periods or single-visit proofs',()=>{
  const {source}=linkedFixture();source.service_period_from='2026-09-01';source.service_period_to='2026-09-30';source.items[0].service_date='2026-09-30';
  const c=importInvoiceCase(source,'2026-09');const line=c.lines[0];Object.assign(line,{remuneration:'04',day:'99',duration:'0130',pricingRule:'care_monthly'});
  assert.equal(line.sourceItemServiceDate,'2026-09-30');assert.deepEqual(verifyCaseSources(c,source),[]);
  source.service_period_to='2026-09-29';assert.ok(verifyCaseSources(c,source).length);source.service_period_to='2026-09-30';
  line.sourceItemServiceDate='2026-09-29';assert.ok(verifyCaseSources(c,source).length);line.sourceItemServiceDate='2026-09-30';
  line.sourceId='66666666-6666-4666-8666-666666666666';assert.ok(verifyCaseSources(c,source).some(i=>i.message.includes('Monatsnachweis')));
});
