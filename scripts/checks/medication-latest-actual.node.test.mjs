import test from 'node:test';
import assert from 'node:assert/strict';
import {latestActualMedicationInstant as latest} from '../../src/lib/pflege/medicationLatestActual.web.ts';
const event=(occurredAt,status='administered',extra={})=>({status,occurredAt,...extra});

test('Nacherfasste ältere Gabe verdrängt keine mikrosekundengenau spätere tatsächliche Gabe',()=>{
 const older='2026-10-09T08:00:00.000001Z',newer='2026-10-09T10:00:00.000002+02:00';
 assert.equal(Date.parse(older),Date.parse(newer));
 assert.equal(latest([event(older,'administered',{createdAt:'2026-10-09T10:00:00Z'}),event(newer,'late',{createdAt:'2026-10-09T09:00:00Z'})]),newer);
});
test('Native tatsächliche Rohzeit gewinnt unabhängig von Originalreihenfolge und Zeitzone',()=>{
 const old=event('2026-10-09T08:00:00.123455Z'),newer=event('2026-10-09T10:00:00.123456+02:00');
 assert.equal(latest([old,newer]),newer.occurredAt);assert.equal(latest([newer,old]),newer.occurredAt);
});
test('Gleiche tatsächliche Zeit behält erste Rohfassung ohne erfundene UUID-/Erfassungsordnung',()=>{
 const a=event('2026-10-09T08:00:00.1Z','late',{id:'lower',createdAt:'2026-10-09T09:00:00Z'}),b=event('2026-10-09T10:00:00.100000+02:00','administered',{id:'higher',createdAt:'2026-10-09T10:00:00Z'});
 assert.equal(latest([a,b]),a.occurredAt);assert.equal(latest([b,a]),b.occurredAt);
});
for(const status of ['omitted','refused','held','scheduled','unknown','completed','Administered',''])test(`Status ${JSON.stringify(status)} bestätigt keine tatsächliche Gabe`,()=>{
 const valid=event('2026-10-09T08:00:00.000001Z');assert.equal(latest([event('2026-10-09T12:00:00Z',status),valid]),valid.occurredAt);assert.equal(latest([event('2026-10-09T12:00:00Z',status)]),null);
});
for(const occurredAt of [null,'','not-a-time','2026-02-30T08:00:00Z','0000-10-09T08:00:00Z','2026-10-09T24:00:00Z','2026-10-09T08:00:00','2026-10-09T08:00:00.1234567Z','2026-10-09T08:00:00+24:00','2026-10-09T08:00:60Z','2026-10-09T08:00:00Z '])test(`Ungültige Altzeit ${JSON.stringify(occurredAt)} bleibt ohne bestätigte tatsächliche Zeit`,()=>{
 const invalid=event(occurredAt,'administered',{scheduledAt:'2026-10-09T12:00:00Z',administeredAt:'2026-10-09T11:00:00Z',createdAt:'2026-10-09T13:00:00Z'}),good=event('2026-10-09T08:00:00.000001Z');
 assert.equal(latest([invalid]),null);assert.equal(latest([invalid,good]),good.occurredAt);assert.equal(latest([good,invalid]),good.occurredAt);
});
test('Ausdrücklich leerer vollständiger Verlauf enthält keine bestätigte tatsächliche Gabe',()=>assert.equal(latest([]),null));
test('Projektion erhält tief gefrorene Originale, native Kennungen, Personenbelege, Folgebelege und Rohzeiten',()=>{
 const values=[event('2026-10-09T08:00:00.000001Z','administered',{id:'native-first',administeredByName:'Original author',createdAt:'2026-10-09T10:00:00.123456Z',scheduledAt:'2026-10-09T07:00:00Z',administeredAt:'2026-10-09T07:30:00Z',followUps:[{id:'native-follow-up',observedAt:'2026-10-09T09:00:00.000001Z'}]}),event('2026-10-09T08:00:00.000002Z','late',{id:'native-second'})];
 const before=structuredClone(values);for(const value of values){if(value.followUps){Object.freeze(value.followUps[0]);Object.freeze(value.followUps);}Object.freeze(value);}Object.freeze(values);
 assert.equal(latest(values),values[1].occurredAt);assert.deepEqual(values,before);
});
test('Native Sekunden-/Millisekunden-/Mikrosekundenpräzision bleibt wörtlich erhalten',()=>{
 for(const occurredAt of ['2026-10-09T08:00:00Z','2026-10-09T08:00:00.1Z','2026-10-09T08:00:00.123Z','2026-10-09T08:00:00.123456Z','2026-10-09T05:00:00.123456-03:00'])assert.equal(latest([event(occurredAt)]),occurredAt);
});
