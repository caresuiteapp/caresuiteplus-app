import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateKey, createHash, createDecipheriv, createCipheriv, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { testPki } from './pki-fixture.mjs';
import { createEccKimMessage, openEccKimMessage, receiveEccKimMessage } from '../../services/kim/client-message.mjs';
import { MAX_KIM_RECEIVE_REPORT } from '../../services/kim/receive-error.mjs';
import { readMessage, decodedBase64, MAX_KIM_MESSAGE } from '../../services/kim/message.mjs';
import { sealEccKimPayload, openEccKimPayload } from '../../services/kim/ecc-cms.mjs';
import { readKimEnvelope } from '../../services/kim/envelope.mjs';
import { decryptEciesKey } from '../../services/kim/ecies.mjs';
import { der, fields } from '../../services/gkv/der.mjs';
import { tlv, sequence, objectId, octets, OID } from '../../services/kim/cms-codec.mjs';

const sender = 'sender@local.kim.telematik-test', recipient = 'receiver@local.kim.telematik-test';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const reportConfig = { cmVersion: 'TEST_0.2.0', ptVersion: '1.5.5' };
let pki, aut, osig, encSender, encRecipient, authKey, signingKey, privateKey, now, source, built;
before(async () => {
  pki = await testPki(); aut = await pki.issueAut(); osig = await pki.issueKim({ name: 'osig', role: 'osig' });
  encSender = await pki.issueKim({ name: 'enc-sender' }); encRecipient = await pki.issueKim({ name: 'enc-recipient' });
  const key = async cert => createPrivateKey({ key: await readFile(cert.privateKeyPath), passphrase: pki.password });
  authKey = await key(aut); signingKey = await key(osig); privateKey = await key(encRecipient); now = Date.now();
  source = Buffer.from([`From: ${sender}`, `To: ${recipient}`, 'Date: Wed, 21 Oct 2026 10:00:00 +0000', 'Message-ID: <receive-error@local.test>',
    'Subject: Geheim bleibender Originalbetreff', 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8',
    'X-KIM-Dienstkennung: TEST;Fehlerpruefung;V1.0', '', 'Private Nutzdaten bleiben ohne ausdrueckliche Anhangsoption verborgen.', ''].join('\r\n'));
  built = build();
});
after(async () => { await pki?.close(); });
const certificates = () => [{ address: sender, certificate: encSender.certificate }, { address: recipient, certificate: encRecipient.certificate }];
function build(message = source) {
  return createEccKimMessage({ message, sender, envelopeRecipients: [recipient], recipients: certificates(), signingCertificate: osig.certificate,
    signingKey, authCertificate: aut.certificate, authKey, cmVersion: 'TEST_0.1.0', ptVersion: '1.5.5', now });
}
function options(bytes = built.bytes, changes = {}) { return { bytes, address: recipient, recipientCertificate: encRecipient.certificate, privateKey,
  expectedSignerCertificate: osig.certificate, expectedAuthCertificate: aut.certificate, now, ...changes }; }
function receive(bytes = built.bytes, changes = {}, config = {}) { return receiveEccKimMessage(options(bytes, changes), { ...reportConfig, ...config }); }
function change(bytes, name, value, append = false) {
  const p = readMessage(bytes), headers = p.headers.filter(h => append || h.name !== name.toLowerCase()).map(h => h.raw);
  if (value !== undefined) headers.push(`${name}: ${value}`);
  return Buffer.concat([Buffer.from(headers.join('\r\n') + '\r\n\r\n'), p.body]);
}
function withCms(outer, cms) {
  return Buffer.concat([outer.subarray(0, outer.indexOf('\r\n\r\n') + 4), Buffer.from(cms.toString('base64').match(/.{1,76}/g).join('\r\n') + '\r\n')]);
}
// A different implementation (Python stdlib email) parses MIME, encoded words, QP and Base64.
const parseScript = `import sys,json,base64
from email import policy
from email.parser import BytesParser
m=BytesParser(policy=policy.default).parsebytes(sys.stdin.buffer.read())
parts=[]
for p in m.iter_parts():
 d=p.get_payload(decode=True)
 parts.append({'type':p.get_content_type(),'name':p.get_filename(),'transfer':p.get('Content-Transfer-Encoding'),'body':base64.b64encode(d).decode() if d is not None else None,'defects':[type(x).__name__ for x in p.defects]})
print(json.dumps({'headers':list(m.items()),'subject':str(m['Subject']),'boundary':m.get_boundary(),'parts':parts,'defects':[type(x).__name__ for x in m.defects]}))`;
function mime(bytes) {
  const r = spawnSync('python', ['-c', parseScript], { input: bytes, maxBuffer: 4_000_000 });
  assert.equal(r.status, 0, r.stderr?.toString());
  const parsed = JSON.parse(r.stdout), headEnd = bytes.indexOf('\r\n\r\n') + 4;
  assert.deepEqual(parsed.defects, []); const first = Buffer.from(`--${parsed.boundary}\r\n`), marker = Buffer.from(`\r\n--${parsed.boundary}`);
  let start = bytes.indexOf(first, headEnd) + first.length;
  parsed.parts = parsed.parts.map(p => {
    const end = bytes.indexOf(marker, start); assert.ok(end >= start);
    const raw = bytes.subarray(start, end), body = raw.subarray(raw.indexOf('\r\n\r\n') + 4);
    start = end + marker.length + 2; return { ...p, rawBody: body, decoded: p.body === null ? undefined : Buffer.from(p.body, 'base64') };
  });
  parsed.one = name => parsed.headers.filter(h => h[0].toLowerCase() === name.toLowerCase()).map(h => h[1]);
  return parsed;
}
function diagnosticJSON(parsed) { return JSON.parse(parsed.parts.find(p => p.type === 'application/json').decoded); }
function damagedCiphertext() {
  const cms = decodedBase64(readMessage(built.bytes).body), data = readKimEnvelope(cms), changed = Buffer.from(cms);
  changed[changed.indexOf(data.ciphertext)] ^= 1; return withCms(built.bytes, changed);
}
function changedInner(rewrite) {
  const cms = decodedBase64(readMessage(built.bytes).body), parsed = readKimEnvelope(cms);
  const entry = parsed.keys.find(k => parsed.mappings.some(m => m.rid === k.rid && m.address === recipient));
  const transport = decryptEciesKey(entry.encryptedKey, privateKey), decipher = createDecipheriv('aes-256-gcm', transport, parsed.nonce);
  decipher.setAuthTag(parsed.tag); const clear = rewrite(Buffer.concat([decipher.update(parsed.ciphertext), decipher.final()]));
  const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', transport, nonce), encrypted = Buffer.concat([cipher.update(clear), cipher.final()]);
  const ci = fields(der(cms), 48), data = fields(fields(ci[1], 160)[0], 48).map(n => n.raw);
  data[2] = sequence(objectId(OID.data), sequence(objectId(OID.aes256gcm), sequence(octets(nonce), tlv(2, Buffer.from([16])))), tlv(128, encrypted));
  data[3] = octets(cipher.getAuthTag()); transport.fill(0); return withCms(built.bytes, sequence(ci[0].raw, tlv(160, sequence(...data))));
}

test('non-KIM messages pass byte-for-byte without interpreting forged success headers', () => {
  const original = change(source, 'X-KIM-IntegrityCheckResult', '01'), r = receive(original, { privateKey: undefined });
  assert.equal(r.kind, 'unprotected'); assert.deepEqual(r.bytes, original); assert.equal(r.identityStatus, 'unverified');
  assert.equal(r.deliveryStatus, 'unprotected'); assert.equal(r.originalSha256, hash(original));
});
test('unsupported version yields a 4008 multipart error with the exact encrypted original', () => {
  const original = change(built.bytes, 'X-KOM-LE-Version', '1.5'), r = receive(original), m = mime(r.bytes);
  assert.equal(r.diagnostic.errorCode, '4008'); assert.equal(m.subject, 'Die KIM-Version der empfangenen Nachricht wird nicht unterstützt');
  assert.equal(m.parts.filter(p => p.type === 'text/plain').length, 1); assert.equal(m.one('X-KOM-LE-Version').length, 0);
  assert.deepEqual(m.parts.find(p => p.type === 'message/rfc822').rawBody, original);
  assert.equal(r.originalSha256, hash(original)); assert.deepEqual(m.one('X-KIM-Fehlermeldung'), ['4008']);
});
test('only an explicitly unavailable recipient key receives the 4009/01 classification', () => {
  const r = receive(built.bytes, { privateKey: undefined }), m = mime(r.bytes);
  assert.deepEqual(m.one('X-KIM-DecryptionResult'), ['01']); assert.deepEqual(m.one('X-KIM-Fehlermeldung'), ['4009']);
  assert.deepEqual(m.parts.find(p => p.type === 'message/rfc822').rawBody, built.bytes);
  const other = receive(built.bytes, { privateKey: authKey });
  assert.equal(other.diagnostic.errorCode, 'XCS_DECRYPT'); assert.equal(other.diagnostic.decryptionResult, 'XCS_DECRYPT');
  assert.equal(receive(built.bytes, { address: 'other@local.kim.telematik-test' }).diagnostic.errorCode, 'XCS_RECIPIENT');
});
test('invalid MIME/CMS and duplicated KIM version produce 4010/02 diagnostics', () => {
  for (const original of [change(built.bytes, 'Content-Type', 'text/plain'), change(built.bytes, 'X-KOM-LE-Version', '1.0', true),
    withCms(built.bytes, Buffer.from('not a CMS container'))]) {
    const r = receive(original), m = mime(r.bytes);
    assert.equal(r.diagnostic.errorCode, '4010'); assert.equal(r.diagnostic.decryptionResult, '02');
    assert.deepEqual(m.parts.find(p => p.type === 'message/rfc822').rawBody, original);
  }
  const unsupported = decodedBase64(readMessage(built.bytes).body), algorithm = Buffer.from(OID.ecies, 'hex');
  const offset = unsupported.indexOf(algorithm); assert.ok(offset >= 0); unsupported[offset + algorithm.length - 1] ^= 1;
  assert.equal(receive(withCms(built.bytes, unsupported)).diagnostic.errorCode, 'XCS_PROFILE');
});
test('malformed or ambiguous source headers cannot become active headers of a new error message', () => {
  const invalid = Buffer.from('From: attacker\nInjected: value\r\n\r\nraw body'), r = receive(invalid), m = mime(r.bytes);
  assert.equal(r.diagnostic.errorCode, '4010'); assert.equal(r.diagnostic.headerSource, 'fallback');
  assert.deepEqual(m.one('From'), [recipient]); assert.equal(m.one('Injected').length, 0);
  assert.deepEqual(m.parts.find(p => p.type === 'message/rfc822').rawBody, invalid);
  let ambiguous = change(built.bytes, 'X-KOM-LE-Version', '1.5');
  ambiguous = change(change(change(ambiguous, 'From', sender, true), 'Date', '31 Feb 2026'), 'To', 'not an address');
  const fixed = mime(receive(ambiguous).bytes);
  assert.deepEqual(fixed.one('From'), [recipient]); assert.deepEqual(fixed.one('To'), [recipient]);
  assert.ok(Number.isFinite(Date.parse(fixed.one('Date')[0])));
});
test('GCM authentication failure never produces decrypted attachments, even with the option enabled', () => {
  const original = damagedCiphertext(), r = receive(original, {}, { includeDecryptedOriginal: true }), m = mime(r.bytes);
  assert.equal(r.diagnostic.errorCode, 'XCS_DECRYPT'); assert.equal(r.diagnostic.decryptedOriginalAttached, false);
  assert.deepEqual(m.parts.find(p => p.type === 'message/rfc822').rawBody, original);
  assert.equal(r.bytes.includes(readMessage(source).body), false); assert.throws(() => openEccKimMessage(options(original)), /DECRYPT_REJECTED/);
});
test('header mismatch uses protected inner headers and defaults to a body-free integrity report', () => {
  const original = change(built.bytes, 'From', recipient), r = receive(original), m = mime(r.bytes), report = diagnosticJSON(m);
  assert.equal(r.diagnostic.kind, 'integrity'); assert.equal(r.diagnostic.integrityResult, 'XCS_HEADER');
  assert.equal(r.diagnostic.headerSource, 'decrypted'); assert.deepEqual(m.one('From'), [sender]);
  assert.equal(m.parts.filter(p => p.type === 'message/rfc822').length, 0); assert.equal(r.bytes.includes(readMessage(source).body), false);
  assert.equal(report.originalSha256, hash(original)); assert.equal(report.identityStatus, 'unverified');
  assert.equal(report.decryptedOriginalAttached, false); assert.equal(r.deliveryStatus, 'diagnostic-only');
  assert.equal(m.parts.find(p => p.type === 'text/plain').transfer, 'quoted-printable');
  assert.match(m.parts.find(p => p.type === 'text/plain').decoded.toString(), /ungeprüft/);
});
test('explicit attachment option retains exact protected plaintext with a fresh reference and a warning', () => {
  const original = change(built.bytes, 'To', sender), expected = openEccKimMessage(options()).message;
  const r = receive(original, {}, { includeDecryptedOriginal: true }), m = mime(r.bytes), attached = m.parts.find(p => p.type === 'message/rfc822');
  assert.deepEqual(attached.rawBody, expected); assert.equal(attached.name, `${r.diagnostic.referenceId}.eml`);
  assert.equal(r.diagnostic.decryptedOriginalAttached, true);
  assert.match(m.parts.find(p => p.type === 'text/plain').decoded.toString(), /Sicherheitsprüfung/);
  assert.equal(m.one('X-KIM-IntegrityCheckRefID').length, 1);
  for (const p of m.parts.filter(p => p.name)) assert.ok(p.name.includes(r.diagnostic.referenceId));
});
test('a mathematically correct local message yields integrity 07, never a positive trust result', () => {
  const snapshot = Buffer.from(built.bytes), r = receive(), m = mime(r.bytes);
  assert.equal(r.diagnostic.errorCode, 'XCS_TRUST'); assert.deepEqual(m.one('X-KIM-IntegrityCheckResult'), ['07']);
  assert.deepEqual(m.one('X-KIM-DecryptionResult'), ['00']); assert.equal(r.identityStatus, 'unverified');
  assert.equal(r.deliveryStatus, 'diagnostic-only'); assert.equal(m.parts.some(p => p.type === 'message/rfc822'), false);
  assert.deepEqual(built.bytes, snapshot);
});
test('AUT failure produces result 10 and never claims a verified sender', () => {
  const r = receive(built.bytes, { expectedAuthCertificate: osig.certificate }), m = mime(r.bytes);
  assert.equal(r.diagnostic.integrityResult, '10'); assert.deepEqual(m.one('X-KIM-IntegrityCheckResult'), ['10']);
  assert.equal(r.identityStatus, 'unverified'); assert.equal(m.parts.some(p => p.type === 'message/rfc822'), false);
});
test('an invalid inner signature remains diagnostic-only after a recipient recomputes a valid GCM envelope', () => {
  const original = changedInner(clear => { clear[clear.length - 1] ^= 1; return clear; });
  assert.throws(() => openEccKimMessage(options(original)), /SIGNATURE_REJECTED/);
  assert.throws(() => openEccKimPayload({ bytes: decodedBase64(readMessage(original).body), address: recipient,
    recipientCertificate: encRecipient.certificate, privateKey, expectedSignerCertificate: osig.certificate, now }), /SIGNATURE_REJECTED/);
  const r = receive(original), m = mime(r.bytes);
  assert.equal(r.diagnostic.integrityResult, 'XCS_SIGNATURE'); assert.equal(m.parts.some(p => p.type === 'message/rfc822'), false);
  const allowed = receive(original, {}, { includeDecryptedOriginal: true }), inspected = mime(allowed.bytes);
  assert.equal(hash(inspected.parts.find(p => p.type === 'message/rfc822').rawBody), built.protectedMessageSha256);
  assert.equal(allowed.identityStatus, 'unverified'); assert.equal(allowed.deliveryStatus, 'diagnostic-only');
});
test('unrecoverable signed content cannot be represented as a decrypted original', () => {
  const original = changedInner(clear => Buffer.concat([clear.subarray(0, clear.indexOf('\r\n\r\n') + 4), Buffer.from('not signed DER')]));
  const r = receive(original, {}, { includeDecryptedOriginal: true }), m = mime(r.bytes);
  assert.equal(r.diagnostic.integrityResult, 'XCS_SIGNATURE'); assert.equal(r.diagnostic.decryptedOriginalAttached, false);
  assert.equal(m.parts.some(p => p.type === 'message/rfc822'), false); assert.equal(r.diagnostic.headerSource, 'outer');
});
test('stale or forged integrity references and success annotations are replaced exactly once', () => {
  let plaintext = openEccKimMessage(options()).message;
  plaintext = change(change(change(plaintext, 'X-KIM-IntegrityCheckResult', '01'), 'X-KIM-IntegrityCheckRefID', 'stale-ref'), 'X-KIM-Fehlermeldung', 'forged');
  const cms = sealEccKimPayload({ message: plaintext, sender, recipients: certificates(), signingCertificate: osig.certificate, signingKey, now });
  const r = receive(withCms(built.bytes, cms)), m = mime(r.bytes);
  assert.deepEqual(m.one('X-KIM-IntegrityCheckResult'), ['XCS_HEADER']); assert.deepEqual(m.one('X-KIM-Fehlermeldung'), ['XCS_INTEGRITY']);
  assert.deepEqual(m.one('X-KIM-IntegrityCheckRefID'), [r.diagnostic.referenceId]); assert.notEqual(r.diagnostic.referenceId, 'stale-ref');
  assert.equal(m.parts.filter(p => p.type === 'text/plain').length, 1);
});
test('Received order and the sole outer Return-Path replace inner transport claims in the diagnostic', () => {
  const input = change(change(source, 'Received', 'from forged.invalid'), 'Return-Path', '<forged@local.kim.telematik-test>');
  let original = build(input).bytes;
  original = change(change(change(original, 'Received', 'from first.local'), 'Received', 'from second.local', true), 'Return-Path', '<>');
  const m = mime(receive(original).bytes);
  assert.deepEqual(m.one('Received'), ['from first.local', 'from second.local']); assert.deepEqual(m.one('Return-Path'), ['<>']);
  const duplicate = receive(change(original, 'Return-Path', '<another@local.kim.telematik-test>', true));
  assert.equal(mime(duplicate.bytes).one('Return-Path').length, 0); assert.ok(duplicate.diagnostic.omittedHeaderNames.includes('return-path'));
});
test('external verification reports require the exact original hash and retain their original bytes', () => {
  const xml = Buffer.from('<?xml version="1.0"?><TestReport>Opaque fixture, no TI validation</TestReport>');
  const r = receive(built.bytes, {}, { verificationReport: { bytes: xml, sourceSha256: hash(built.bytes) } }), m = mime(r.bytes);
  const p = m.parts.find(p => p.type === 'application/xml'); assert.deepEqual(p.decoded, xml);
  assert.equal(p.name, `VerificationReport_${r.diagnostic.referenceId}.xml`); assert.equal(r.diagnostic.externalReportSha256, hash(xml));
  assert.equal(r.identityStatus, 'unverified'); assert.equal(r.diagnostic.integrityResult, '07');
  for (const report of [{ bytes: xml, sourceSha256: '0'.repeat(64) }, { bytes: Buffer.alloc(262145), sourceSha256: hash(built.bytes) }, { bytes: Buffer.alloc(0), sourceSha256: hash(built.bytes) }]) {
    assert.throws(() => receive(built.bytes, {}, { verificationReport: report }), /REPORT_BINDING/);
  }
});
test('reports have fresh references and re-enter the receiver without recursion or interpretation as signed mail', () => {
  const first = receive(), second = receive(); assert.notEqual(first.diagnostic.referenceId, second.diagnostic.referenceId);
  const round = receive(first.bytes); assert.equal(round.kind, 'unprotected'); assert.deepEqual(round.bytes, first.bytes); assert.equal(round.identityStatus, 'unverified');
  const m = mime(first.bytes), report = diagnosticJSON(m);
  assert.equal(report.referenceId, m.one('X-KIM-IntegrityCheckRefID')[0]);
  assert.equal(JSON.stringify(report).includes('Bearer'), false); assert.equal(JSON.stringify(report).includes('Private Nutzdaten'), false);
});
test('binary RFC822 diagnostic attachments preserve final CRLF, no final CRLF and arbitrary body octets', () => {
  for (const body of [Buffer.from('line\r\n'), Buffer.from('no trailing newline'), Buffer.from([0, 255, 10, 13, 0])]) {
    const input = Buffer.concat([source.subarray(0, source.indexOf('\r\n\r\n') + 4), body]), item = build(input);
    const r = receive(item.bytes, {}, { includeDecryptedOriginal: true }), m = mime(r.bytes);
    assert.equal(hash(m.parts.find(p => p.type === 'message/rfc822').rawBody), item.protectedMessageSha256);
  }
});
test('configuration and output limits fail explicitly without mutating or truncating the original', () => {
  const snapshot = Buffer.from(built.bytes);
  for (const cfg of [{ includeDecryptedOriginal: 'true' }, { cmVersion: 'bad' }, { ptVersion: '999.1.0' }]) assert.throws(() => receive(built.bytes, {}, cfg), /CONFIGURATION/);
  assert.throws(() => receive(Buffer.alloc(MAX_KIM_MESSAGE + 1)), /INPUT_LIMIT/);
  const headers = [`From: ${sender}`, 'Date: Wed, 21 Oct 2026 10:00:00 +0000', 'Message-ID: <header-limit@local.test>',
    'X-KOM-LE-Version: 1.0', 'Content-Type: text/plain'];
  while (headers.length < 500) headers.push(`X-KIM-Limit-${headers.length}: value`);
  const near = Buffer.from(headers.join('\r\n') + '\r\n\r\nbody');
  assert.doesNotThrow(() => readMessage(near)); assert.throws(() => receive(near), /REPORT_LIMIT/);
  assert.deepEqual(built.bytes, snapshot);
});
test('the local error-envelope budget accommodates an original at the full SMTP byte limit', () => {
  const head = Buffer.from(`From: ${sender}\r\nX-KOM-LE-Version: 1.5\r\n\r\n`);
  const original = Buffer.concat([head, Buffer.alloc(MAX_KIM_MESSAGE - head.length, 65)]), before = hash(original);
  const result = receive(original);
  assert.ok(result.bytes.length > MAX_KIM_MESSAGE); assert.ok(result.bytes.length <= MAX_KIM_RECEIVE_REPORT);
  assert.equal(result.originalSha256, before); assert.equal(hash(original), before);
  assert.ok(result.bytes.includes(original));
});
