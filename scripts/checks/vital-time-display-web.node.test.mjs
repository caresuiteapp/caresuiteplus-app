import test from 'node:test';
import assert from 'node:assert/strict';
import {vitalTimeDisplay,vitalTimeFieldDisplay,validVitalActualTimeField,vitalFollowUpChronologyError} from '../../src/lib/pflege/vitalTimeDisplay.web.ts';
import {validateVitalMeasurement,validateVitalFollowUp} from '../../src/lib/pflege/vitalMeasurementDomain.ts';
import {VITAL_SIGN_CATALOG} from '../../src/lib/pflege/vitalCatalog.ts';

const invalid = ['2026-02-30T12:00:00.123456Z','2025-02-29T12:00:00Z','2026-04-31T12:00:00Z','0000-01-01T12:00:00Z','2026-13-01T12:00:00Z','2026-01-00T12:00:00Z','2026-10-08T24:00:00Z','2026-10-08T12:60:00Z','2026-10-08T12:00:60Z','2026-10-08T12:00:00','2026-10-08','2026-10-08T12:00:00+24:00','2026-10-08T12:00:00+02:60','2026-10-08T12:00:00.1234567Z',' 2026-10-08T12:00:00Z','2026-10-08T12:00:00Z ','2026-10-08  12:00:00Z'];
for(const raw of invalid)test(`Unconfirmed native calendar/zone original remains exact and is never normalized: ${raw}`,()=>{
 const source=Object.freeze({occurredAt:raw,recordedAt:'2026-10-08T13:00:00Z'}),before=Object.getOwnPropertyDescriptors(source);
 const result=vitalTimeFieldDisplay(source,'occurredAt');assert.equal(result.state,'invalid');assert.equal(result.raw,raw);assert.equal(validVitalActualTimeField(source),false);assert.deepEqual(Object.getOwnPropertyDescriptors(source),before);
});
const valid=['2024-02-29T12:00:00Z','0001-01-01T12:00:00Z','2026-10-08T12:00:00Z','2026-10-08 12:00:00+00:00','2026-10-08T12:00:00+02:00','2026-10-08 12:00:00-03:30',...Array.from({length:6},(_,i)=>`2026-10-08T12:00:00.${'123456'.slice(0,i+1)}Z`)];
for(const raw of valid)test(`Native read precision/calendar/offset is preserved: ${raw}`,()=>{
 const result=vitalTimeDisplay(raw);assert.equal(result.state,'valid');assert.equal(result.raw,raw);assert.ok(result.display.includes('Original: '+raw));assert.ok(result.display.includes('(Berlin)'));const fraction=/\.(\d{1,6})/.exec(raw)?.[1];if(fraction)assert.ok(result.display.includes(','+fraction));
});
for(const [value,state] of [[undefined,'undefined'],[null,'null'],['','empty'],[0,'invalid'],[false,'invalid'],[true,'invalid'],[Symbol('raw'),'invalid'],[NaN,'invalid'],[Infinity,'invalid'],[{},'invalid'],[[],'invalid'],[new Date('2026-10-08T12:00:00Z'),'invalid']])test(`Missing or unsupported actual original is not a confirmed event: ${String(state)} ${typeof value}`,()=>{
 const result=vitalTimeDisplay(value);assert.equal(result.state,state);assert.equal(validVitalActualTimeField({occurredAt:value}),false);
});
test('Invalid/missing originals never construct Intl or invoke a cached formatter',()=>{
 const Native=Intl.DateTimeFormat,method=Native.prototype.formatToParts;let constructions=0,formats=0;
 function Forbidden(){constructions++;throw Error('Invalid original reached Intl');}
 Intl.DateTimeFormat=Forbidden;Native.prototype.formatToParts=function(){formats++;throw Error('Invalid original reached cached Intl');};
 try{for(const raw of [...invalid,undefined,null,'',0,false,Symbol('raw'),{toString(){throw Error('No coercion');}}])assert.notEqual(vitalTimeDisplay(raw).state,'valid');assert.equal(constructions,0);assert.equal(formats,0);}
 finally{Intl.DateTimeFormat=Native;Native.prototype.formatToParts=method;}
});
test('Absent/null/ownundefined/empty timestamp originals are distinct own field states',()=>{
 assert.equal(vitalTimeFieldDisplay({},'occurredAt').state,'missing');assert.equal(vitalTimeFieldDisplay({occurredAt:undefined},'occurredAt').state,'undefined');assert.equal(vitalTimeFieldDisplay({occurredAt:null},'occurredAt').state,'null');assert.equal(vitalTimeFieldDisplay({occurredAt:''},'occurredAt').state,'empty');
});
test('A timestamp accessor is never executed or passed to Intl',()=>{
 let calls=0;const source={get occurredAt(){calls++;throw Error('Original getter must not run');}};assert.equal(vitalTimeFieldDisplay(source,'occurredAt').state,'unreadable');assert.equal(validVitalActualTimeField(source),false);assert.equal(calls,0);assert.equal(typeof Object.getOwnPropertyDescriptor(source,'occurredAt').get,'function');
});
test('Inherited/class/nonenumerable timestamp values are not own confirmed native time data',()=>{
 let calls=0;const inherited=Object.create({get occurredAt(){calls++;throw Error('Inherited getter');}});class Holder{occurredAt='2026-10-08T12:00:00Z';}const hidden=Object.defineProperty({},'occurredAt',{value:'2026-10-08T12:00:00Z'});for(const source of [inherited,new Holder(),hidden,[],null])assert.equal(vitalTimeFieldDisplay(source,'occurredAt').state,'unreadable');assert.equal(calls,0);
});
test('Unsupported timestamp coercion hooks remain untouched',()=>{
 let calls=0;const raw={toString(){calls++;throw Error('No implicit timestamp');},[Symbol.toPrimitive](){calls++;throw Error('No primitive coercion');}};assert.equal(vitalTimeFieldDisplay({occurredAt:raw},'occurredAt').state,'invalid');assert.equal(calls,0);
});
test('Only the selected timestamp is projected; no whole-DTO or scope grant is manufactured',()=>{
 let calls=0;const source={tenantId:'foreign',occurredAt:'2026-10-08T12:00:00Z',get unrelatedOriginal(){calls++;throw Error('Out of timestamp scope');}};source[Symbol('unrelated')]='opaque';assert.equal(vitalTimeFieldDisplay(source,'occurredAt').state,'valid');assert.equal(calls,0);assert.equal(source.tenantId,'foreign');assert.equal(Object.getOwnPropertySymbols(source).length,1);
});
test('Unknown actual time never adopts recorded or legacy measured clocks',()=>{
 const source={occurredAt:null,recordedAt:'2026-10-08T12:00:00.123456Z',measured_at:'2026-10-09T12:00:00.654321Z'};assert.equal(vitalTimeFieldDisplay(source,'occurredAt').state,'null');assert.equal(vitalTimeFieldDisplay(source,'recordedAt').raw,source.recordedAt);assert.equal(validVitalActualTimeField(source),false);assert.equal(source.occurredAt,null);
});
test('Two original instants within one millisecond keep distinct microsecond evidence',()=>{
 const a=vitalTimeDisplay('2026-10-08T12:00:00.000001Z'),b=vitalTimeDisplay('2026-10-08T12:00:00.000002Z');assert.notEqual(a.display,b.display);assert.ok(a.display.includes(',000001'));assert.ok(b.display.includes(',000002'));assert.notEqual(a.raw,b.raw);
});
test('Berlin DST fold keeps both original offsets and never conflates equal wall clocks',()=>{
 const a=vitalTimeDisplay('2026-10-25T02:30:00.123456+02:00'),b=vitalTimeDisplay('2026-10-25T02:30:00.123456+01:00');assert.equal(a.state,'valid');assert.equal(b.state,'valid');assert.ok(a.display.includes('02:30:00,123456'));assert.ok(b.display.includes('02:30:00,123456'));assert.ok(a.display.includes('GMT+2'));assert.ok(b.display.includes('GMT+1'));assert.notEqual(a.raw,b.raw);
});
test('Explicit-offset spring instant is projected without inventing a Berlin local-date agreement',()=>{
 const a=vitalTimeDisplay('2026-03-29T02:30:00.123456+01:00');assert.equal(a.state,'valid');assert.equal(a.raw,'2026-03-29T02:30:00.123456+01:00');assert.ok(a.display.includes('03:30:00,123456'));assert.ok(a.display.includes('GMT+2'));
});
test('Plan agreement and actual/capture originals remain separate even at equal instants',()=>{
 const source={occurredAt:'2026-10-08T12:00:00.123456Z',recordedAt:'2026-10-08 14:00:00.123456+02:00',nextReviewAt:'2026-10-09T12:00:00.654321Z'};for(const field of ['occurredAt','recordedAt','nextReviewAt'])assert.equal(vitalTimeFieldDisplay(source,field).raw,source[field]);assert.equal(vitalTimeFieldDisplay({nextReviewAt:'2026-10-09'},'nextReviewAt').state,'invalid');
});
test('Native read microseconds and space do not widen the shared new-write grammar',()=>{
 const draft={clientId:'11111111-1111-4111-8111-111111111111',type:'pulse',occurredAt:'2026-10-08T12:00:00.123Z',catalogVersion:'2026-10-08T10:00:00.123456Z',configurationVersion:'none',valuesJson:'{"value":72}',contextJson:'{}',note:''};const definition=VITAL_SIGN_CATALOG.find(d=>d.key==='pulse'),now=Date.parse('2026-10-08T13:00:00Z');assert.equal(validateVitalMeasurement(draft,definition,now),null);
 for(const occurredAt of ['2026-10-08T12:00:00.123456Z','2026-10-08 12:00:00.123Z']){assert.equal(vitalTimeDisplay(occurredAt).state,'valid');assert.ok(validateVitalMeasurement({...draft,occurredAt},definition,now));}
 const follow={measurementId:draft.clientId,observedAt:draft.occurredAt,observation:'Raw observation',action:'Raw actual action',responsiblePerson:'Native person',outcome:'resolved',nextReviewAt:''};assert.ok(validateVitalFollowUp({...follow,observedAt:'2026-10-08T12:00:00.123456Z'},null,now));
});
test('A new control earlier by native microseconds is denied even when Date.parse conflates it',()=>{
 const raw='2026-10-08T12:00:00.123457Z',observed='2026-10-08T12:00:00.123Z';assert.equal(Date.parse(raw),Date.parse(observed));assert.ok(vitalFollowUpChronologyError({occurredAt:raw},observed));assert.equal(raw,'2026-10-08T12:00:00.123457Z');
});
test('Exact equal or later native instants remain distinct from a fabricated chronology error',()=>{
 const source={occurredAt:'2026-10-08T12:00:00.123000Z'};assert.equal(vitalFollowUpChronologyError(source,'2026-10-08T12:00:00.123Z'),null);assert.equal(vitalFollowUpChronologyError(source,'2026-10-08T12:00:00.124Z'),null);assert.equal(source.occurredAt,'2026-10-08T12:00:00.123000Z');
});
test('Space/offset native head precision is compared without rewriting either original',()=>{
 const source=Object.freeze({occurredAt:'2026-10-08 14:00:00.000001+02:00'});assert.ok(vitalFollowUpChronologyError(source,'2026-10-08T12:00:00.000Z'));assert.equal(vitalFollowUpChronologyError(source,'2026-10-08T12:00:00.001Z'),null);assert.equal(source.occurredAt,'2026-10-08 14:00:00.000001+02:00');
});
test('Unknown/getter head and unzoned/Space new event cannot establish new chronology',()=>{
 let calls=0;const source={get occurredAt(){calls++;throw Error('No original getter');}};assert.ok(vitalFollowUpChronologyError(source,'2026-10-08T12:00:00Z'));assert.equal(calls,0);for(const raw of [undefined,null,'','2026-02-30T12:00:00Z'])assert.ok(vitalFollowUpChronologyError({occurredAt:raw},'2026-10-08T12:00:00Z'));for(const raw of ['2026-10-08T12:00:00','2026-10-08 12:00:00Z',Symbol('raw')])assert.ok(vitalFollowUpChronologyError({occurredAt:'2026-10-08T11:00:00Z'},raw));
});
test('Throwing descriptor reflection is an unreadable time source, never an unhandled new-save error',()=>{
 const source=new Proxy({occurredAt:'2026-10-08T12:00:00Z'},{getOwnPropertyDescriptor(){throw Error('Unknown original reflection');}});assert.equal(vitalTimeFieldDisplay(source,'occurredAt').state,'unreadable');assert.equal(validVitalActualTimeField(source),false);assert.ok(vitalFollowUpChronologyError(source,'2026-10-08T12:00:00Z'));
});
test('Throwing prototype/reflection of an out-of-contract record stays explicitly unreadable',()=>{
 const source=new Proxy({},{getPrototypeOf(){throw Error('Unknown original prototype');}}),revoked=Proxy.revocable({},{});revoked.revoke();for(const record of [source,revoked.proxy])assert.equal(vitalTimeFieldDisplay(record,'occurredAt').state,'unreadable');
});
