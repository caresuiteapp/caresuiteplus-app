import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDraft, isDate, isMonth, hasDraftShape } from '../../src/lib/gkvExchange/model.ts';
import { buildTestInterchange, parseEdifact, validateEnvelope, segment, latin1Bytes, decodeLatin1 } from '../../src/lib/gkvExchange/edifact.ts';
import { parseCarrierDirectory, resolveCarrierRoute } from '../../src/lib/gkvExchange/kostentraeger.ts';
import { assertTransition, applyReceipt, releaseIssues } from '../../src/lib/gkvExchange/lifecycle.ts';
import { parseHundredths, lineTotal } from '../../src/lib/gkvExchange/editor.ts';
import { fixture, directorySource } from './fixtures.mjs';

test('consultation fixture produces the independently specified PLGA and PLAA sequence', () => {
  const d = fixture(); assert.deepEqual(validateDraft(d), []);
  const file = buildTestInterchange(d);
  assert.equal(file.name, 'TPFL0001');
  assert.equal(file.text, "UNB+UNOC:3+123456789+109876543+20261019:1215+1+PL106001SEK+0'UNH+1+PLGA:6'FKT+01++123456789+181234567+181234567+123456789'REC+RE2026-1:0+20261018+1+EUR'SRD+11:05001+09'UST++J+01'GES+80,00+0,00+0,00+80,00'NAM+Musterpflege GmbH'UNT+8+1'UNH+2+PLAA:6'FKT+01+123456789+181234567+181234567+123456789'REC+RE2026-1:0+20261018+1+EUR'INV+A123456789+BELEG1'NAD+Mustermann+Erika+19500101'MAN+202610+++2'ESK+16'ELS+09:08:0:1+80,00+++00+1,00+123456789'IAF+80,00+0,00+0,00+80,00'UNT+10+2'UNZ+2+1'");
});
test('AUF is exactly 348 Latin-1 bytes, with byte counts and distinct receiver roles', () => {
  const d = fixture(); d.physicalReceiverIk = '108765432'; const f = buildTestInterchange(d), a = decodeLatin1(f.order);
  assert.equal(f.order.length, 348); assert.equal(a.slice(0, 19), '5000000100000348000');
  assert.equal(a.slice(19, 27), 'TPFL0001'); assert.equal(a.slice(62, 77), '109876543      '); assert.equal(a.slice(77, 92), '108765432      ');
  assert.equal(a.slice(104, 115), 'PL106001SEK'); assert.equal(a.slice(115, 129), '20261019121530');
  assert.equal(Number(a.slice(178, 190)), f.bytes.length); assert.equal(a.slice(202, 210), 'I1000000'); assert.equal(a.slice(318, 320), '09');
});
test('delimiter escaping round-trips without destroying escaped component separators', () => {
  const text = "Müller+Sohn: O'Neil?,";
  const parsed = parseEdifact(segment('NAM', [text])); assert.equal(parsed[0][1][0], text);
  assert.equal(latin1Bytes(text)[1], 252); assert.equal(decodeLatin1(latin1Bytes(text)), text);
  assert.throws(() => latin1Bytes('€'), /ISO/);
});
test('truncated, corrupted and mixed envelopes are rejected', () => {
  const text = buildTestInterchange(fixture()).text;
  for (const bad of [text.replace('UNT+8', 'UNT+7'), text.replace('UNZ+2', 'UNZ+1'), text.replace('UNZ+2+1', 'UNZ+2+9'), text.replace('UNH+2', 'UNH+1')]) assert.throws(() => validateEnvelope(parseEdifact(bad)));
  assert.throws(() => parseEdifact("NAM+bad?")); assert.throws(() => parseEdifact("NAM+bad?x'")); assert.throws(() => parseEdifact('UNA:*.? \''));
});
test('unsupported generation dates fail closed at both version boundaries', () => {
  for (const date of ['2026-04-30T10:00:00Z', '2027-02-01T10:00:00Z', '2027-01-31T23:00:00Z']) { const d = fixture(); d.createdAt = date; assert.ok(validateDraft(d).some(i => i.path === 'createdAt')); assert.throws(() => buildTestInterchange(d)); }
  assert.equal(isDate('2026-02-30'), false); assert.equal(isDate('2028-02-29'), true); assert.equal(isMonth('2026-13'), false);
});
test('production and KIM never pass through the test exporter', () => {
  const d = fixture(); d.mode = 'production'; assert.throws(() => buildTestInterchange(d), /Echtdatei/);
  d.mode = 'test'; d.channel = 'kim'; assert.ok(validateDraft(d).some(i => i.path === 'channel')); assert.throws(() => buildTestInterchange(d));
  d.serviceType = '01'; d.cases[0].lines[0].remuneration = '99'; d.cases[0].lines[0].code = '99'; assert.throws(() => buildTestInterchange(d), /KIM/);
});
test('incorrect sums, duplicate invoices and unconfirmed proofs block generation', () => {
  const d = fixture(); d.cases[0].lines[0].totalCents++; d.cases[0].proofConfirmed = 'yes'; d.cases.push(structuredClone(d.cases[0]));
  const issues = validateDraft(d); for (const suffix of ['totalCents', 'grossCents', 'invoiceNumber', 'documentNumber', 'proofConfirmed']) assert.ok(issues.some(i => i.path.endsWith(suffix)), suffix);
  assert.throws(() => buildTestInterchange(d));
});
test('time and unsupported financial profiles cannot silently use flat-rate calculation', () => {
  const d = fixture(); const l = d.cases[0].lines[0]; l.remuneration = '02'; l.code = '4A'; l.startTime = '0900'; l.duration = '60';
  assert.ok(validateDraft(d).some(i => i.path.endsWith('totalCents') && i.severity === 'error'));
  assert.ok(!validateDraft(d).some(i => i.path.endsWith('code')));
  d.profile.taxExemptionCode = '99'; assert.ok(validateDraft(d).some(i => i.path === 'profile.taxExemptionCode'));
});
test('mandatory employee number cannot be switched off for an ambulatory provider', () => {
  const d = fixture(); d.profile.ambulatoryProvider = true; d.profile.employeeNumberRequired = false; d.cases[0].lines[0].employeeNumber = '';
  assert.ok(validateDraft(d).some(i => i.path.endsWith('employeeNumber')));
});
test('malformed JSON produces validation errors rather than runtime crashes', () => {
  for (const d of [null, [], {}, {profile:{},cases:[{lines:[{}]}]}, {...fixture(),cases:[null]}, {...fixture(),cases:Array(501).fill(null)}]) assert.ok(validateDraft(d).some(i => i.severity === 'error'));
});
test('draft persistence accepts incomplete text but rejects unsafe numeric structures', () => {
  const d=fixture(); d.cases[0].invoiceNumber='';assert.equal(hasDraftShape(d),true);
  d.cases[0].lines[0].quantityHundredths=NaN;assert.equal(hasDraftShape(d),false);
  assert.equal(hasDraftShape({...fixture(),cases:[{lines:[]}]}),false);
});
test('decimal parsing and cent rounding are exact at half cents and large values', () => {
  assert.equal(parseHundredths('1,01'), 101); assert.equal(parseHundredths('0.09'), 9); assert.ok(Number.isNaN(parseHundredths('1,001'))); assert.ok(Number.isNaN(parseHundredths('-1')));
  assert.equal(lineTotal({unitPriceCents:101,quantityHundredths:50}), 51);
  assert.ok(Number.isNaN(lineTotal({unitPriceCents:999999999999,quantityHundredths:999999})));
});
const query = { insuranceIk:'181234567', service:'09',channel:'classic',day:'2026-10-19',state:'05' };
test('KOTR import follows insurance to payer to recipient and preserves validity', () => {
  const d = parseCarrierDirectory(directorySource(), 'EKPFL202610');
  const r = resolveCarrierRoute(d, query); assert.equal(r.payerIk, '182345678'); assert.equal(r.receiverIk, '109876543'); assert.equal(r.address, 'test@example.invalid');
});
test('expired recipients, wrong delivery types and ambiguous links fail closed', () => {
  assert.throws(() => resolveCarrierRoute(parseCarrierDirectory(directorySource({receiverUntil:'20261018'}), 'EKPFL202610'), query));
  assert.throws(() => resolveCarrierRoute(parseCarrierDirectory(directorySource({delivery:'30'}), 'EKPFL202610'), query));
  const d = parseCarrierDirectory(directorySource(), 'EKPFL202610'); d.records[1].links.push({...d.records[1].links[0],ik:'108765432'}); assert.throws(() => resolveCarrierRoute(d, query), /mehrdeutig/);
});
test('VDT on UEM can invalidate an otherwise current DFU address', () => {
  const source = directorySource().replace("UEM+1+01+I1'VDT+20260501+20270131", "UEM+1+01+I1'VDT+20260501+20261018");
  assert.throws(() => resolveCarrierRoute(parseCarrierDirectory(source, 'EKPFL202610'), query), /Empfangsadresse/);
});
test('KIM VZD is marked for directory lookup, never mistaken for an email address', () => {
  const d = parseCarrierDirectory(directorySource({delivery:'30',address:'VZD',protocol:'080'}), 'EKPFL202610');
  assert.equal(resolveCarrierRoute(d, {...query,channel:'kim'}).needsDirectoryLookup, true);
});
test('a receipt must correlate and delivery never means accepted or paid', () => {
  const expected={messageId:'outbound-1',payloadSha256:'a'.repeat(64)};
  const receipt={messageId:'receipt-1',inReplyTo:'outbound-1',payloadSha256:'a'.repeat(64),kind:'delivered',receivedAt:'2026-10-19T10:00:00Z'};
  assert.equal(applyReceipt('sent',expected,receipt),'delivered'); assert.equal(applyReceipt('delivered',expected,receipt),'delivered');
  assert.throws(()=>applyReceipt('sent',expected,{...receipt,inReplyTo:'other'})); assert.throws(()=>assertTransition('sent','accepted')); assert.throws(()=>assertTransition('accepted','draft'));
});
test('readiness requires server-owned evidence bound to the exact payload', () => {
  const d=fixture(); d.mode='production'; const issues=releaseIssues(d,{payloadSha256:'a'.repeat(64),validatedSha256:'b'.repeat(64),routingVerified:false,recipientRegistered:false,transportConfigured:false,e2eAccepted:false,sourceRevisionsCurrent:false,kimSignaturesVerified:false,kimSchemaValidated:false});
  for(const path of ['validation','routing','registration','transport','certificate','malware','sources','acceptance']) assert.ok(issues.some(i=>i.path===path),path);
});
