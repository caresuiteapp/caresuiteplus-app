import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateKey, createHash, X509Certificate, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { testPki } from './pki-fixture.mjs';
import { createEccKimMessage, openEccKimMessage, KimMessageError } from '../../services/kim/client-message.mjs';
import { createEccKimAuth, verifyReceivedEccKimAuth, PinnedAutVerifier, unfoldAutHeader } from '../../services/kim/message-auth.mjs';
import { readMessage, verifySubmission, decodedBase64, decodeKimMimeEntity, MAX_KIM_MESSAGE } from '../../services/kim/message.mjs';
import { sealEccKimPayload } from '../../services/kim/ecc-cms.mjs';
import { readKimEnvelope } from '../../services/kim/envelope.mjs';

const sender = 'sender@local.kim.telematik-test', recipient = 'receiver@local.kim.telematik-test', third = 'third@local.kim.telematik-test';
const cmVersion = 'TEST_0.1.0', ptVersion = '1.5.5'; // Test identifiers, no assigned product identity.
const sha = b => createHash('sha256').update(b).digest('hex');
let pki, aut, osig, encSender, encRecipient, wrongCurve, authKey, signingKey, keySender, keyRecipient, now, built, source;
before(async () => {
  pki = await testPki();
  aut = await pki.issueAut(); osig = await pki.issueKim({ name: 'osig', role: 'osig' });
  encSender = await pki.issueKim({ name: 'enc-sender' }); encRecipient = await pki.issueKim({ name: 'enc-recipient' });
  wrongCurve = await pki.issueAut({ name: 'wrong-curve', curve: 'prime256v1' });
  const key = async cert => createPrivateKey({ key: await readFile(cert.privateKeyPath), passphrase: pki.password });
  authKey = await key(aut); signingKey = await key(osig); keySender = await key(encSender); keyRecipient = await key(encRecipient);
  now = Date.now(); source = original(); built = build();
});
after(async () => { await pki?.close(); });
function original({ headers = [], body = Buffer.from('Unveraenderter Testinhalt.\r\n.leading dot\r\n'), omit = [] } = {}) {
  const lines = [`From: "Sender  Name" <${sender}>`, `Sender: ${sender}`, `Reply-To: ${sender}`, `To: ${recipient}`,
    'Date: Wed, 21 Oct 2026 10:00:00 +0000', 'Message-ID: <test-message@local.test>', 'Subject: Vertraulicher Betreff',
    'MIME-Version: 1.0', 'Content-Type: application/octet-stream', 'Content-Transfer-Encoding: binary',
    'X-KIM-Dienstkennung: TEST;Lokale-Pruefung;V1.0', 'X-KIM-Sendersystem: CareSuite-Test', ...headers];
  return Buffer.concat([Buffer.from(lines.filter(s => !omit.includes(s.split(':')[0].toLowerCase())).join('\r\n') + '\r\n\r\n'), body]);
}
function certificates() { return [{ address: sender, certificate: encSender.certificate }, { address: recipient, certificate: encRecipient.certificate }]; }
function build(changes = {}) {
  return createEccKimMessage({ message: source, sender, envelopeRecipients: [recipient], recipients: certificates(),
    signingCertificate: osig.certificate, signingKey, authCertificate: aut.certificate, authKey, cmVersion, ptVersion, now, ...changes });
}
function open(bytes = built.bytes, changes = {}) {
  return openEccKimMessage({ bytes, address: recipient, recipientCertificate: encRecipient.certificate, privateKey: keyRecipient,
    expectedSignerCertificate: osig.certificate, expectedAuthCertificate: aut.certificate, now, ...changes });
}
function changeHeader(bytes, name, value, { append = false } = {}) {
  const p = readMessage(bytes), lines = p.headers.filter(h => append || h.name !== name.toLowerCase()).map(h => h.raw);
  if (value !== undefined) lines.push(`${name}: ${value}`);
  return Buffer.concat([Buffer.from(lines.join('\r\n') + '\r\n\r\n'), p.body]);
}
function fd(clock = () => now) {
  return new PinnedAutVerifier({ issuers: [{ certificate: pki.roots, sha256: pki.rootFingerprint }],
    validFrom: clock() - 1000, validUntil: clock() + 3600_000, clock });
}
function auth(changes = {}) { return createEccKimAuth({ sender, certificate: aut.certificate, privateKey: authKey, cmVersion, now, ...changes }); }
function authOpen(header, changes = {}) {
  return verifyReceivedEccKimAuth({ header, sender, expectedCertificate: aut.certificate, cmVersion, now, ...changes });
}
function signedToken({ claims = {}, headers = {}, rawClaims } = {}) {
  const parts = auth().slice(7).split('.');
  const h = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(parts[0], 'base64url')), ...headers })).toString('base64url');
  const p = Buffer.from(rawClaims ?? JSON.stringify({ ...JSON.parse(Buffer.from(parts[1], 'base64url')), ...claims })).toString('base64url');
  return `Bearer ${h}.${p}.${sign('sha256', Buffer.from(`${h}.${p}`), { key: authKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}

test('generated ECC AUT has fresh UUIDs and actual signatures verified by the existing FD', () => {
  const a = auth(), b = auth(); assert.notEqual(a, b);
  assert.equal(fd().verify(a, sender).sender, sender);
  assert.equal(authOpen(a).identityStatus, 'unverified');
  const claims = JSON.parse(Buffer.from(a.split('.')[1], 'base64url'));
  assert.equal(claims.iss, cmVersion); assert.equal(claims.aud, 'I_Message_Service');
  assert.equal(claims.nbf, Math.floor(now / 1000)); assert.match(claims.jti, /^[0-9a-f-]{36}$/);
});
test('AUT generation refuses OSIG/ENC roles, mismatched keys, curves, dates and invalid product identifiers', () => {
  for (const change of [{ certificate: osig.certificate, privateKey: signingKey }, { certificate: encSender.certificate, privateKey: keySender },
    { privateKey: keySender }, { certificate: wrongCurve.certificate }, { certificate: aut.certificate + aut.certificate },
    { now: NaN }, { now: -1 }, { now: now + 31 * 86_400_000 }, { cmVersion: 'unassigned' }, { cmVersion: 'TEST_1.0.0-256' }]) {
    assert.throws(() => auth(change), /^Error: KIM_AUTH_SIGNING_REJECTED$/);
  }
});
test('receive-time AUT refuses invalid signed claims, duplicate JSON keys and mismatched explicit certificates', () => {
  for (const token of [signedToken({ claims: { sub: recipient } }), signedToken({ claims: { nbf: Math.floor(now / 1000) + 1 } }),
    signedToken({ claims: { aud: 'other' } }), signedToken({ claims: { iss: 'TEST_9.9.9' } }), signedToken({ claims: { jti: 'bad-id' } }),
    signedToken({ claims: { nbf: 1.5 } }), signedToken({ claims: { exp: 0 } }), signedToken({ headers: { alg: 'ES256' } }),
    signedToken({ headers: { x5c: [new X509Certificate(aut.certificate).raw.toString('base64'), 'extra'] } }),
    signedToken({ rawClaims: '{"sub":"ignored","s\\u0075b":"other"}' }), auth().slice(0, -2) + 'AA']) {
    assert.throws(() => authOpen(token), /^Error: KIM_AUTH_REJECTED$/);
  }
  assert.throws(() => authOpen(auth(), { expectedCertificate: osig.certificate }), /AUTH_REJECTED/);
  assert.throws(() => authOpen(auth(), { expectedCertificate: undefined }), /AUTH_REJECTED/);
});
test('receiving an older message does not reapply FD token TTL, while future tokens still fail', () => {
  const later = now + 2 * 86_400_000, a = auth();
  assert.throws(() => fd(() => later).verify(a, sender), /AUTH_REJECTED/);
  assert.equal(authOpen(a, { now: later }).identityStatus, 'unverified');
  assert.equal(open(built.bytes, { now: later }).headerIntegrity, 'matched');
  assert.throws(() => authOpen(a, { now: now - 2000 }), /AUTH_REJECTED/);
});
test('complete wire message protects exact prepared bytes, hides subject/body and keeps trust explicitly pending', () => {
  const received = open(), inner = readMessage(received.message), outer = readMessage(built.bytes);
  assert.equal(sha(received.message), built.protectedMessageSha256); assert.deepEqual(inner.body, readMessage(source).body);
  assert.equal(inner.one('subject'), 'Vertraulicher Betreff'); assert.equal(outer.one('subject'), 'KOM-LE-Nachricht');
  assert.equal(built.bytes.includes(Buffer.from('Vertraulicher Betreff')), false); assert.equal(built.bytes.includes(inner.body), false);
  assert.equal(received.deliveryStatus, 'held-for-trust-validation'); assert.equal(received.identityStatus, 'unverified');
  assert.equal(inner.one('x-kim-integritycheckresult'), undefined); assert.equal(received.authentication.identityStatus, 'unverified');
  assert.equal(unfoldAutHeader(inner.one('x-kim-auth')), unfoldAutHeader(outer.one('x-kim-auth')));
  const submission = verifySubmission(built.bytes, { sender, recipients: [{ address: recipient }], authVerifier: fd(), now });
  assert.equal(submission.errorCode, undefined); assert.equal(submission.id, built.messageId);
  assert.equal(sha(open(built.bytes, { address: sender, recipientCertificate: encSender.certificate, privateKey: keySender }).message), built.protectedMessageSha256);
  assert.ok(built.bytes.toString('ascii').split('\r\n').every(l => l.length <= 998));
});
test('old and duplicate client tokens are replaced before signing, leaving the input unchanged', () => {
  const input = original({ headers: ['X-KIM-Auth: stale', 'x-kim-auth: duplicate', 'X-KIM-CMVersion: stale', 'X-KIM-PTVersion: stale'] }), snapshot = Buffer.from(input);
  const first = build({ message: input }), second = build({ message: input });
  assert.deepEqual(input, snapshot);
  for (const item of [first, second]) {
    const parsed = readMessage(open(item.bytes).message);
    assert.equal(parsed.headers.filter(h => h.name === 'x-kim-auth').length, 1);
    assert.equal(parsed.one('x-kim-cmversion'), cmVersion); assert.equal(parsed.one('x-kim-ptversion'), ptVersion);
    assert.equal(parsed.one('x-kim-auth').includes('stale'), false);
  }
  assert.notEqual(readMessage(first.bytes).one('x-kim-auth'), readMessage(second.bytes).one('x-kim-auth'));
});
test('missing Date and Message-ID are generated once and are identical inside and outside', () => {
  const generated = build({ message: original({ omit: ['date', 'message-id'] }) }), inner = readMessage(open(generated.bytes).message), outer = readMessage(generated.bytes);
  assert.equal(inner.one('date'), outer.one('date')); assert.equal(inner.one('message-id'), outer.one('message-id'));
  assert.equal(Date.parse(inner.one('date')), Math.floor(now / 1000) * 1000);
  assert.notEqual(generated.messageId, build({ message: original({ omit: ['message-id'] }) }).messageId);
});
test('construction checks MAIL FROM, visible recipients, explicit RCPT list and exact certificate-address coverage', () => {
  const changes = [{ sender: recipient }, { message: changeHeader(source, 'Sender', recipient) }, { message: changeHeader(source, 'Reply-To', 'bad@example.test') },
    { message: changeHeader(source, 'To', third) }, { message: changeHeader(source, 'Cc', third) }, { message: changeHeader(source, 'Bcc', third) },
    { envelopeRecipients: [] }, { envelopeRecipients: [recipient, recipient.toUpperCase()] }, { envelopeRecipients: [recipient, third] },
    { recipients: certificates().slice(1) }, { recipients: [...certificates(), { address: third, certificate: encSender.certificate }] },
    { message: changeHeader(source, 'From', sender, { append: true }) }, { message: changeHeader(source, 'To', recipient, { append: true }) }];
  for (const change of changes) assert.throws(() => build(change), KimMessageError);
  const hidden = build({ message: original({ omit: ['to'], headers: ['Bcc:'] }) });
  assert.equal(open(hidden.bytes).headerIntegrity, 'matched');
});
test('changes, additions, deletions and duplicate protected headers cannot survive reception', () => {
  for (const [name, value] of [['From', recipient], ['Sender', recipient], ['Reply-To', recipient], ['To', sender], ['Cc', sender], ['Bcc', sender],
    ['Date', 'Thu, 22 Oct 2026 10:00:00 +0000'], ['Message-ID', '<different@local.test>'], ['X-KIM-Dienstkennung', 'changed'],
    ['X-KIM-Sendersystem', undefined], ['X-KIM-Unrequested', 'added'], ['X-KIM-Auth', 'Bearer invalid'], ['X-KIM-CMVersion', 'TEST_9.9.9']]) {
    assert.throws(() => open(changeHeader(built.bytes, name, value)), e => e instanceof KimMessageError && e.stage === 'headers', name);
  }
  for (const name of ['From', 'To', 'Message-ID', 'X-KIM-Auth', 'X-KIM-Dienstkennung']) {
    const raw = readMessage(built.bytes).headers.find(h => h.name === name.toLowerCase()).raw;
    const value = raw.slice(raw.indexOf(':') + 1).trim(); // Keep legal physical folding for the long AUT.
    assert.throws(() => open(changeHeader(built.bytes, name, value, { append: true })), /HEADERS_REJECTED/);
  }
});
test('unfolding preserves quoted spaces, accepts equivalent line folding and rejects changed display values', () => {
  const folded = changeHeader(built.bytes, 'From', `"Sender  Name"\r\n <${sender}>`);
  assert.equal(open(folded).headerIntegrity, 'matched');
  assert.throws(() => open(changeHeader(built.bytes, 'From', `"Sender Name" <${sender}>`)), /HEADER_MISMATCH/);
  const token = readMessage(built.bytes).one('x-kim-auth').replace(/[ \t]/g, '');
  const refolded = `Bearer ${token.slice(6).match(/.{1,63}/g).join('\r\n\t')}`;
  assert.equal(open(changeHeader(built.bytes, 'X-KIM-Auth', refolded)).headerIntegrity, 'matched');
  assert.equal(open(changeHeader(built.bytes, 'Received', 'from local.test by test.invalid; Wed, 21 Oct 2026 10:00:00 +0000')).headerIntegrity, 'matched');
});
test('sender-supplied success/error annotations and ambiguous metadata are rejected', () => {
  for (const [name, value] of [['X-KIM-IntegrityCheckResult', '01'], ['X-KIM-DecryptionResult', '00'], ['X-KIM-Fehlermeldung', '4008'],
    ['X-KIM-IntegrityCheckRefID', 'claimed-reference'], ['X-KOM-LE-Version', '1.0'], ['Date', 'Sat, 31 Feb 2026 10:00:00 +0000'],
    ['Date', 'Wed, 21 Oct 2026 25:00:00 +0000'], ['Date', '2026-10-21'], ['Message-ID', 'invalid'], ['MIME-Version', '2.0']]) {
    assert.throws(() => build({ message: changeHeader(source, name, value) }), KimMessageError);
  }
  assert.throws(() => build({ message: changeHeader(source, 'X-KIM-Dienstkennung', 'duplicate', { append: true }) }), KimMessageError);
});
test('unsupported versions, ambiguous MIME, noncanonical base64 and oversized wire data do not reach decryption', () => {
  for (const [name, value] of [['X-KOM-LE-Version', '1.5'], ['X-KOM-LE-Version', undefined], ['Content-Type', 'multipart/mixed; boundary=test'],
    ['Content-Transfer-Encoding', 'binary'], ['MIME-Version', '2.0'], ['Subject', 'other'],
    ['Content-Type', 'application/pkcs7-mime; smime-type=authenticated-enveloped-data; smime-type=signed-data']]) {
    assert.throws(() => open(changeHeader(built.bytes, name, value)), e => e instanceof KimMessageError && e.stage === 'mime');
  }
  assert.throws(() => open(Buffer.concat([built.bytes, Buffer.from('!')])), /KIM_MESSAGE_MIME/);
  assert.throws(() => open(Buffer.alloc(MAX_KIM_MESSAGE + 1)), /KIM_MESSAGE_MIME/);
});
test('decryption/signature/auth failures return only bounded diagnostic codes, never plaintext', () => {
  const outer = readMessage(built.bytes), cms = decodedBase64(outer.body), parsed = readKimEnvelope(cms), changed = Buffer.from(cms);
  const cipherOffset = changed.indexOf(parsed.ciphertext); assert.ok(cipherOffset >= 0); changed[cipherOffset] ^= 1;
  const damaged = Buffer.concat([built.bytes.subarray(0, built.bytes.indexOf('\r\n\r\n') + 4), Buffer.from(changed.toString('base64'))]);
  const attempts = [() => open(damaged), () => open(built.bytes, { privateKey: keySender }),
    () => open(built.bytes, { expectedSignerCertificate: encSender.certificate }), () => open(built.bytes, { expectedAuthCertificate: osig.certificate })];
  for (const run of attempts) assert.throws(run, e => {
    assert.ok(e instanceof KimMessageError); assert.equal(e.message.includes('Testinhalt'), false);
    assert.equal('cause' in e, false); assert.equal('messageBytes' in e, false); return true;
  });
});
test('even a valid inner signature cannot assert a visible recipient absent from protected certificate mappings', () => {
  const inner = changeHeader(open().message, 'To', third);
  const cms = sealEccKimPayload({ message: inner, sender, recipients: certificates(), signingCertificate: osig.certificate, signingKey, now });
  const outer = changeHeader(built.bytes, 'To', third), p = readMessage(outer);
  const bytes = Buffer.concat([Buffer.from(p.headers.map(h => h.raw).join('\r\n') + '\r\n\r\n'), Buffer.from(cms.toString('base64'))]);
  assert.throws(() => open(bytes), /HEADERS_REJECTED/);
});
test('binary content stays byte-identical and actual encoded output remains inside the SMTP limit', () => {
  const binary = Buffer.concat([Buffer.from([0, 255, 128, 13, 10]), Buffer.alloc(1_000_000, 173)]);
  const message = original({ body: binary }), sent = build({ message });
  assert.deepEqual(readMessage(open(sent.bytes).message).body, binary);
  assert.ok(sent.bytes.length < MAX_KIM_MESSAGE); assert.ok(sent.bytes.length > message.length * 1.3);
  assert.throws(() => build({ message: original({ body: Buffer.alloc(15_000_000, 65) }) }), /PREPARATION_REJECTED/);
  assert.throws(() => build({ message: original({ headers: ['X-Large: ' + 'a'.repeat(999)] }) }), /PREPARATION_REJECTED/);
});
test('nested MIME decoder enforces RFC822 transfer restrictions and rejects duplicate/folded header attacks', () => {
  const entity = (headers, body) => Buffer.concat([Buffer.from(headers.join('\r\n') + '\r\n\r\n'), Buffer.from(body)]);
  const options = { type: 'message/rfc822' }, head = ['Content-Type: message/rfc822'];
  assert.deepEqual(decodeKimMimeEntity(entity(head, 'From: test\r\n\r\nbody\r\n'), options), Buffer.from('From: test\r\n\r\nbody\r\n'));
  for (const value of [entity([...head, 'Content-Transfer-Encoding: base64'], 'YQ=='), entity([...head, ...head], 'body'),
    entity(head, Buffer.from([255])), entity(head, 'bare\nnewline'), entity(head, '\0'), entity([' invalid-first', ...head], 'body')]) {
    assert.throws(() => decodeKimMimeEntity(value, options));
  }
  assert.deepEqual(decodeKimMimeEntity(entity([...head, 'Content-Transfer-Encoding: binary'], Buffer.from([0, 255])), options), Buffer.from([0, 255]));
});
