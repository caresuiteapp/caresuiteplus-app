import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createPrivateKey, createHash, X509Certificate, sign, constants } from 'node:crypto';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import tls from 'node:tls';
import { DatabaseSync } from 'node:sqlite';
import { testPki } from './pki-fixture.mjs';
import { openssl } from '../../services/gkv/openssl.mjs';
import { der, fields, certificateParts } from '../../services/gkv/der.mjs';
import { KimMailstore } from '../../services/kim/mailstore.mjs';
import { PinnedAutVerifier } from '../../services/kim/message-auth.mjs';
import { inspectKimEnvelope } from '../../services/kim/envelope.mjs';
import { createEccKimMessage, openEccKimMessage } from '../../services/kim/client-message.mjs';
import { readMessage, verifySubmission, MAX_KIM_MESSAGE } from '../../services/kim/message.mjs';
import { createSmtpTlsServer } from '../../services/kim/smtp-server.mjs';
import { createPop3TlsServer } from '../../services/kim/pop3-server.mjs';
import { Pop3Session } from '../../services/kim/pop3.mjs';
import { sendSmtp } from '../../services/gkv/smtp.mjs';
import { ReceiptInbox } from '../../services/gkv/inbox.mjs';
import { pollMailbox } from '../../services/gkv/pop3-client.mjs';
import { parseReceipt } from '../../services/gkv/receipt-parser.mjs';
import { buildDsn, decodeXtext, encodeXtext } from '../../services/kim/dsn.mjs';

const sender = 'sender@local.kim.telematik-test', recipient = 'receiver@local.kim.telematik-test', password = 'fictional-smtp-password-2026';
const serverName = 'mail.local.kim.telematik-test';
let pki, aut, rsaAut, wrongAut, clientTls, cms, autKey, rsaAutKey;
const tlv = (tag, bytes) => {
  bytes = Buffer.from(bytes);
  const n = bytes.length, length = n < 128 ? Buffer.from([n]) : Buffer.from(n.toString(16).padStart(Math.ceil(n.toString(16).length / 2) * 2, '0'), 'hex');
  return Buffer.concat([Buffer.from([tag]), ...(n < 128 ? [length] : [Buffer.from([128 + length.length]), length]), bytes]);
};
const seq = (...nodes) => tlv(48, Buffer.concat(nodes)), set = (...nodes) => tlv(49, Buffer.concat(nodes.sort(Buffer.compare)));
function trust(clock = Date.now, overrides = {}) {
  const now = clock();
  return new PinnedAutVerifier({ issuers: [{ certificate: pki.roots, sha256: pki.rootFingerprint }], validFrom: now - 1000, validUntil: now + 3600_000, clock, ...overrides });
}
function token({ cert = aut.certificate, key = autKey, alg = 'BP256R1', claims = {}, header = {}, rawHeader } = {}) {
  const h = Buffer.from(rawHeader ?? JSON.stringify({ alg, typ: 'JWT', x5c: [new X509Certificate(cert).raw.toString('base64')], ...header })).toString('base64url');
  const p = Buffer.from(JSON.stringify({ nbf: Math.floor(Date.now() / 1000), jti: randomUUID(), iss: 'LOCAL_TEST_1.5.5-1', sub: sender, aud: 'I_Message_Service', ...claims })).toString('base64url');
  const signature = sign('sha256', Buffer.from(`${h}.${p}`), alg === 'PS256' ? { key, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 } : { key, dsaEncoding: 'ieee-p1363' });
  return `Bearer ${h}.${p}.${signature.toString('base64url')}`;
}
function message({ id = `<${randomUUID()}@local.test>`, from = sender, to = recipient, auth = token(), subject = 'KOM-LE-Nachricht', version = '1.0', contentType = 'application/pkcs7-mime; smime-type=authenticated-enveloped-data', body = cms.toString('base64').match(/.{1,76}/g).join('\r\n'), extra = [], transfer = 'base64' } = {}) {
  const folded = auth === undefined ? [] : [`X-KIM-Auth: ${auth.match(/.{1,72}/g).join('\r\n ')}`];
  const mime = Buffer.from([`From: ${from}`, `To: ${to}`, `Message-ID: ${id}`, 'Date: Tue, 20 Oct 2026 10:00:00 +0000',
    `Subject: ${subject}`, `X-KOM-LE-Version: ${version}`, ...folded, 'MIME-Version: 1.0', `Content-Type: ${contentType}`, `Content-Transfer-Encoding: ${transfer}`, ...extra, '', body, ''].join('\r\n'));
  return { messageId: id, from: sender, to, mime, dsn: { envelopeId: randomUUID() } };
}
before(async () => {
  pki = await testPki().catch(e => { throw new Error("fixture base PKI", { cause: e }); }); aut = await pki.issueAut().catch(e => { throw new Error("fixture EC AUT", { cause: e }); }); rsaAut = await pki.issueAut({ name: 'aut-rsa', curve: 'rsa', policy: '1.2.276.0.76.4.75' }).catch(e => { throw new Error('fixture RSA AUT', { cause: e }); });
  wrongAut = await pki.issueAut({ name: 'aut-wrong', policy: '1.2.276.0.76.4.76' }).catch(e => { throw new Error('fixture wrong AUT', { cause: e }); });
  autKey = createPrivateKey({ key: await readFile(aut.privateKeyPath), passphrase: pki.password });
  rsaAutKey = createPrivateKey({ key: await readFile(rsaAut.privateKeyPath), passphrase: pki.password });
  clientTls = { cert: pki.sender.certificate, key: await readFile(pki.sender.privateKeyPath), passphrase: pki.password.toString() };
  const encrypted = await openssl(['cms', '-encrypt', '-aes-256-gcm', '-binary', '-outform', 'DER',
    ...[pki.sender, pki.recipient].flatMap(cert => ['-recip', cert.path, '-keyopt', 'rsa_padding_mode:oaep', '-keyopt', 'rsa_oaep_md:sha256', '-keyopt', 'rsa_mgf1_md:sha256'])], { input: Buffer.from('Opaque inner fixture; not a conformant signed KIM payload.') }).catch(e => { throw new Error('fixture encryption', { cause: e }); });
  const ci = fields(der(encrypted), 48), encryptedData = fields(fields(ci[1], 160)[0], 48);
  const entries = [pki.sender, pki.recipient].map((cert, i) => {
    const parts = certificateParts(new X509Certificate(cert.certificate).raw);
    return seq(tlv(22, Buffer.from(i ? recipient : sender)), seq(parts.issuer, parts.serial));
  });
  const attrs = tlv(162, seq(tlv(6, Buffer.from('2a8214004c04812d', 'hex')), set(set(...entries))));
  cms = seq(ci[0].raw, tlv(160, seq(...encryptedData.map(n => n.raw), attrs)));
  // OpenSSL 3.0.13 cms_asn1.c incorrectly uses tags 2/3 for authAttrs/unauthAttrs.
  // RFC 5083 requires 1/2. Verify the real encryption before adding the standards-correct
  // unprotected attribute; never adapt production bytes to that older decoder defect.
  const clear = await openssl(['cms', '-decrypt', '-inform', 'DER', '-recip', pki.recipient.path, '-inkey', pki.recipient.privateKeyPath, '-passin', 'fd:3'], { input: encrypted, password: pki.password }).catch(e => { throw new Error('fixture decryption', { cause: e }); });
  assert.match(clear.toString(), /Opaque inner fixture/);
});
after(async () => { await pki?.close(); });
async function setup({ senderQuota = 2_000_000, recipientQuota = 2_000_000, timeoutMs = 10_000, authorize = true, authVerifier, maxSubmissionsPerAccount } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'cs-kim-smtp-')), path = join(dir, 'kim.sqlite'), key = randomBytes(32), store = new KimMailstore({ path, key, maxSubmissionsPerAccount });
  for (const [address, quotaBytes] of [[sender, senderQuota], [recipient, recipientQuota]]) await store.installAccount({ address, telematikId: 'local-fixture-no-ti-registration', password, quotaBytes });
  const fingerprint = new X509Certificate(pki.sender.certificate).fingerprint256, sockets = new Set();
  const server = createSmtpTlsServer({ store, tls: { ...pki.tls, ca: pki.roots }, authorizeClient: peer => authorize && peer.fingerprint256 === fingerprint,
    authVerifier: authVerifier ?? trust(), serverName, localDomains: ['local.kim.telematik-test'], timeoutMs });
  server.on('connection', s => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const config = { host: '127.0.0.1', port: server.address().port, servername: 'localhost.test', ehlo: 'client.local.test', mode: 'tls', ca: pki.roots, ...clientTls, timeoutMs,
    credentials: async () => ({ username: sender, password: Buffer.from(password) }) };
  const mails = account => {
    const box = store.beginMailbox(account);
    try { return box.messages.map(m => ({ ...m, bytes: store.readMessage(account, box.token, m.uid) })); }
    finally { store.abandonMailbox(account, box.token); }
  };
  return { dir, path, key, store, server, config, mails,
    close: async () => { for (const s of sockets) s.destroy(); await new Promise(r => server.close(r)); await new Promise(r => setImmediate(r)); store.close(); await rm(dir, { recursive: true, force: true }); } };
}
async function wire(config) {
  const socket = tls.connect({ host: config.host, port: config.port, servername: config.servername, ca: config.ca, cert: config.cert, key: config.key, passphrase: config.passphrase, rejectUnauthorized: true });
  let buffer = '', lines = [], failure, waiter; const replies = [];
  socket.on('error', e => { failure = e; waiter?.reject(e); waiter = undefined; });
  socket.on('close', () => { failure ??= new Error('closed'); waiter?.reject(failure); waiter = undefined; });
  socket.on('data', bytes => {
    buffer += bytes.toString('latin1'); let i;
    while ((i = buffer.indexOf('\r\n')) >= 0) {
      const line = buffer.slice(0, i); buffer = buffer.slice(i + 2); lines.push(line);
      if (line[3] === ' ') { const result = { code: Number(line.slice(0, 3)), lines }; lines = []; if (waiter) { waiter.resolve(result); waiter = undefined; } else replies.push(result); }
    }
  });
  const next = () => replies.length ? Promise.resolve(replies.shift()) : failure ? Promise.reject(failure) : new Promise((resolve, reject) => { waiter = { resolve, reject }; });
  const command = line => { socket.write(line + '\r\n', 'latin1'); return next(); };
  const data = bytes => { socket.write(bytes.toString('latin1').replace(/(^|\r\n)\./g, '$1..') + '.\r\n', 'latin1'); return next(); };
  await once(socket, 'secureConnect'); assert.equal((await next()).code, 220);
  return { socket, next, command, data, login: async (user = sender) => {
    assert.equal((await command('EHLO client.local.test')).code, 250);
    assert.equal((await command(`AUTH PLAIN ${Buffer.from(`\0${user}\0${password}`).toString('base64')}`)).code, 235);
  } };
}
async function submit(w, m, recipients = [m.to], suffix = '') {
  assert.equal((await w.command(`MAIL FROM:<${m.from}> SIZE=${m.mime.length}${suffix}`)).code, 250);
  for (const r of recipients) assert.equal((await w.command(`RCPT TO:<${r}> NOTIFY=SUCCESS,FAILURE`)).code, 250);
  assert.equal((await w.command('DATA')).code, 354); return w.data(m.mime);
}

test('AUT verifies actual Brainpool and RSA-PSS signatures, issuer pins, policy, lifetime and sender binding', async () => {
  const v = trust(); assert.equal(v.verify(token(), sender.toUpperCase()).sender, sender);
  assert.equal(v.verify(token({ cert: rsaAut.certificate, key: rsaAutKey, alg: 'PS256' }), sender).sender, sender);
  for (const claims of [{ aud: 'another-service' }, { sub: recipient }, { nbf: Math.floor(Date.now() / 1000) + 60 }, { nbf: Math.floor(Date.now() / 1000) - 7201 }, { exp: 1 }, { jti: 'not-a-uuid' }]) assert.throws(() => v.verify(token({ claims }), sender), /AUTH_REJECTED/);
  const broken = token(); assert.throws(() => v.verify(broken.slice(0, -8) + 'AAAAAAAA', sender), /AUTH_REJECTED/);
  const wrongKey = createPrivateKey({ key: await readFile(wrongAut.privateKeyPath), passphrase: pki.password });
  assert.throws(() => v.verify(token({ cert: wrongAut.certificate, key: wrongKey }), sender), /AUTH_REJECTED/);
  const cert64 = new X509Certificate(aut.certificate).raw.toString('base64');
  assert.throws(() => v.verify(token({ rawHeader: `{"alg":"none","al\\u0067":"BP256R1","typ":"JWT","x5c":["${cert64}"]}` }), sender), /AUTH_REJECTED/);
  assert.throws(() => trust(Date.now, { issuers: [{ certificate: pki.roots, sha256: '0'.repeat(64) }] }), /TRUST_CONFIGURATION/);
  const expired = trust(Date.now, { validFrom: Date.now() - 10000, validUntil: Date.now() - 1 });
  assert.throws(() => expired.verify(token(), sender), /TRUST_UNAVAILABLE/);
});
test('outer CMS inspector accepts real OAEP/GCM bytes and rejects missing or mismatched recipient associations', () => {
  assert.equal(inspectKimEnvelope(cms, [sender, recipient]).recipients, 2);
  assert.throws(() => inspectKimEnvelope(cms, ['other@local.kim.telematik-test']), /INVALID/);
  assert.throws(() => inspectKimEnvelope(Buffer.concat([cms, Buffer.from([0])]), [sender]), /INVALID/);
  const noAttribute = fields(fields(fields(der(cms), 48)[1], 160)[0], 48);
  assert.throws(() => inspectKimEnvelope(seq(fields(der(cms), 48)[0].raw, tlv(160, seq(...noAttribute.slice(0, -1).map(n => n.raw)))), [sender]), /INVALID/);
});
test('real mTLS SMTP commits original and DSN; own POP3 client retrieves the exact accepted bytes', async () => {
  const s = await setup(); let pop, inbox;
  try {
    const m = message(), result = await sendSmtp(m, s.config); assert.equal(result.reference, m.messageId);
    assert.deepEqual(s.mails(recipient)[0].bytes, m.mime);
    const notification = s.mails(sender)[0].bytes, parsed = parseReceipt(notification);
    assert.equal(parsed.originalMessageId, m.messageId); assert.equal(parsed.envelopeId, m.dsn.envelopeId);
    assert.equal(parsed.recipients[0].action, 'delivered'); assert.match(notification.toString(), /Arrival-Date:/);
    assert.equal(notification.includes(Buffer.from('X-KIM-Auth')), false); assert.equal(notification.includes(cms), false);
    pop = createPop3TlsServer({ store: s.store, tls: { ...pki.tls, ca: pki.roots }, authorizeClient: p => p.fingerprint256 === new X509Certificate(pki.sender.certificate).fingerprint256 });
    pop.listen(0, '127.0.0.1'); await once(pop, 'listening');
    inbox = new ReceiptInbox({ path: join(s.dir, 'inbox.sqlite'), key: randomBytes(32) });
    const tenantId = randomUUID(), mailboxId = randomUUID(), ids = [];
    const polled = await pollMailbox({ inbox, tenantId, mailboxId, config: { ...s.config, port: pop.address().port, username: recipient, password: async () => Buffer.from(password) }, onStored: async id => ids.push(id) });
    assert.equal(polled.stored, 1); assert.equal(s.mails(recipient).length, 0);
    assert.deepEqual(inbox.get(tenantId, ids[0]).bytes, m.mime);
    await sendSmtp(m, s.config); assert.equal(s.mails(recipient).length, 0); assert.equal(s.mails(sender).length, 1);
  } finally { if (pop) await new Promise(r => pop.close(r)); inbox?.close(); await s.close(); }
});
test('SMTP binds AUTH and MAIL FROM, closes relay, resets transactions and supports LOGIN with case aliases', async () => {
  const s = await setup(); let w;
  try {
    w = await wire(s.config);
    assert.equal((await w.command(`MAIL FROM:<${sender}>`)).code, 503);
    const greeting = await w.command('EHLO client.local.test'); assert.match(greeting.lines.join('\n'), /AUTH LOGIN PLAIN/); assert.match(greeting.lines.join('\n'), /SIZE 22020096/);
    assert.equal((await w.command(`MAIL FROM:<${sender}>`)).code, 530);
    assert.equal((await w.command(`AUTH PLAIN ${Buffer.from(`${recipient}\0${sender}\0${password}`).toString('base64')}`)).code, 535);
    assert.equal((await w.command('AUTH LOGIN')).code, 334);
    assert.equal((await w.command(Buffer.from(sender.toUpperCase()).toString('base64'))).code, 334);
    assert.equal((await w.command(Buffer.from(password).toString('base64'))).code, 235);
    assert.equal((await w.command(`MAIL FROM:<${recipient}>`)).code, 553);
    assert.equal((await w.command(`MAIL FROM:<${sender.toUpperCase()}>`)).code, 250);
    assert.equal((await w.command('RCPT TO:<other@external.kim.telematik-test>')).code, 550);
    assert.equal((await w.command('DATA')).code, 503);
    assert.equal((await w.command('RSET')).code, 250);
    assert.equal((await w.command(`RCPT TO:<${recipient}>`)).code, 503);
    assert.equal((await w.command('QUIT')).code, 221);
    assert.equal(s.mails(recipient).length, 0);
  } finally { w?.socket.destroy(); await s.close(); }
});
test('complete ECC message with generated AUT traverses SMTP and POP3, then checks protected bytes and headers', async () => {
  const signer = await pki.issueKim({ name: 'smtp-osig', role: 'osig' });
  const encSender = await pki.issueKim({ name: 'smtp-enc-sender' }), encReceiver = await pki.issueKim({ name: 'smtp-enc-receiver' });
  const signingKey = createPrivateKey({ key: await readFile(signer.privateKeyPath), passphrase: pki.password });
  const recipientKey = createPrivateKey({ key: await readFile(encReceiver.privateKeyPath), passphrase: pki.password });
  const id = `<${randomUUID()}@local.test>`;
  const original = Buffer.from([`From: ${sender}`, `To: ${recipient}`, `Message-ID: ${id}`, 'Date: Tue, 20 Oct 2026 10:00:00 +0000',
    'Subject: Lokale ECC-Integration', 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', '', 'Fiktive Nachricht, keine Versichertendaten.', '.Dot-Transparenz', ''].join('\r\n'));
  const built = createEccKimMessage({ message: original, sender, envelopeRecipients: [recipient],
    recipients: [{ address: sender, certificate: encSender.certificate }, { address: recipient, certificate: encReceiver.certificate }],
    signingCertificate: signer.certificate, signingKey, authCertificate: aut.certificate, authKey: autKey, cmVersion: 'TEST_0.1.0', ptVersion: '1.5.5' });
  const m = { messageId: built.messageId, from: sender, to: recipient, mime: built.bytes, dsn: { envelopeId: randomUUID() } };
  const s = await setup(); let pop, inbox;
  try {
    await sendSmtp(m, s.config);
    assert.deepEqual(s.mails(recipient)[0].bytes, m.mime);
    const dsn = parseReceipt(s.mails(sender)[0].bytes); assert.equal(dsn.originalMessageId, id); assert.equal(dsn.recipients[0].action, 'delivered');
    pop = createPop3TlsServer({ store: s.store, tls: { ...pki.tls, ca: pki.roots }, authorizeClient: p => p.fingerprint256 === new X509Certificate(pki.sender.certificate).fingerprint256 });
    pop.listen(0, '127.0.0.1'); await once(pop, 'listening');
    inbox = new ReceiptInbox({ path: join(s.dir, 'ecc-inbox.sqlite'), key: randomBytes(32) });
    const tenantId = randomUUID(), mailboxId = randomUUID(), ids = [];
    const polled = await pollMailbox({ inbox, tenantId, mailboxId, config: { ...s.config, port: pop.address().port, username: recipient, password: async () => Buffer.from(password) }, onStored: async value => ids.push(value) });
    assert.equal(polled.stored, 1); assert.equal(s.mails(recipient).length, 0);
    const stored = inbox.get(tenantId, ids[0]).bytes; assert.deepEqual(stored, m.mime);
    const decoded = openEccKimMessage({ bytes: stored, address: recipient, recipientCertificate: encReceiver.certificate, privateKey: recipientKey,
      expectedSignerCertificate: signer.certificate, expectedAuthCertificate: aut.certificate });
    assert.equal(createHash('sha256').update(decoded.message).digest('hex'), built.protectedMessageSha256);
    assert.deepEqual(readMessage(decoded.message).body, readMessage(original).body);
    assert.equal(decoded.identityStatus, 'unverified'); assert.equal(decoded.deliveryStatus, 'held-for-trust-validation');
    assert.equal(decoded.headerIntegrity, 'matched');
    await sendSmtp(m, s.config); assert.equal(s.mails(recipient).length, 0); assert.equal(s.mails(sender).length, 1);
  } finally { if (pop) await new Promise(r => pop.close(r)); inbox?.close(); await s.close(); }
});
test('invalid AUT, originator, reply-to and duplicate auth headers reject before any durable delivery', async () => {
  const s = await setup(); let w;
  try {
    w = await wire(s.config); await w.login();
    const cases = [{ from: recipient }, { extra: ['Reply-To: external@example.test'] }, { extra: [`Sender: ${recipient}`] },
      { auth: token({ claims: { sub: recipient } }) }, { auth: 'Bearer invalid' }, { extra: ['X-KIM-Auth: Bearer invalid'] }];
    for (const options of cases) assert.equal((await submit(w, message(options))).code, 550);
    assert.equal(s.mails(recipient).length, 0); assert.equal(s.mails(sender).length, 0);
    // A_23422-01(3): only the self-send originator/token checks are exempt; outer CMS remains checked.
    const self = message({ to: sender, from: 'unparseable self-forward origin', auth: 'Bearer invalid' });
    assert.equal((await submit(w, self)).code, 250); assert.equal(s.mails(sender).length, 2);
  } finally { w?.socket.destroy(); await s.close(); }
});
test('profile failures create only a body-free fdgerr DSN; fdgerr_6 copies only decoded plain notification text', async () => {
  const s = await setup(); let w;
  try {
    w = await wire(s.config); await w.login();
    for (const [options, expected] of [[{ subject: 'wrong' }, 'fdgerr_2'], [{ version: '99.0' }, 'fdgerr_3'],
      [{ contentType: 'text/plain' }, 'fdgerr_4'], [{ body: Buffer.from('not a CMS container').toString('base64') }, 'fdgerr_1']]) {
      const m = message(options); assert.equal((await submit(w, m)).code, 250);
      const dsn = s.mails(sender).find(r => r.bytes.includes(Buffer.from(m.messageId))).bytes;
      assert.match(dsn.toString(), new RegExp(`X-KIM-Fehlermeldung: ${expected}`)); assert.equal(dsn.includes(Buffer.from('X-KIM-Auth')), false);
      assert.equal(parseReceipt(dsn).recipients[0].action, 'failed');
    }
    const body = 'Local notification\r\n.leading dot\r\n..two dots', m = message({ contentType: 'text/plain; charset=UTF-8', transfer: '7bit', body, extra: ['X-KIM-Fehlermeldung: cm-test'], subject: 'any value' });
    assert.equal((await submit(w, m)).code, 250);
    const dsn = s.mails(sender).find(r => r.bytes.includes(Buffer.from(m.messageId))).bytes.toString();
    assert.match(dsn, /X-KIM-Fehlermeldung: fdgerr_6/); assert.equal(s.mails(recipient).length, 0);
    const b64 = dsn.split('Content-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0].replace(/\s/g, '');
    assert.match(Buffer.from(b64, 'base64').toString(), /Local notification\r\n\.leading dot\r\n\.\.two dots/);
  } finally { w?.socket.destroy(); await s.close(); }
});
test('expired trust and unsupported CMS do not become permanent profile failures or success DSNs', async () => {
  const outer = fields(der(cms), 48), parts = fields(fields(outer[1], 160)[0], 48), recipients = fields(parts[1], 49);
  const unsupported = seq(outer[0].raw, tlv(160, seq(parts[0].raw, set(tlv(161, recipients[0].value), ...recipients.slice(1).map(n => n.raw)), ...parts.slice(2).map(n => n.raw))));
  assert.throws(() => verifySubmission(message({ body: unsupported.toString('base64').match(/.{1,76}/g).join('\r\n') }).mime,
    { sender, recipients: [{ address: recipient }], authVerifier: trust(), now: Date.now() }), /ENVELOPE_UNSUPPORTED/);
  const s = await setup({ authVerifier: trust(Date.now, { validFrom: Date.now() - 10000, validUntil: Date.now() - 1 }) }); let w;
  try {
    w = await wire(s.config); await w.login(); assert.equal((await submit(w, message())).code, 451);
    assert.equal(s.mails(recipient).length, 0); assert.equal(s.mails(sender).length, 0);
  } finally { w?.socket.destroy(); await s.close(); }
});
test('quota errors, deactivated recipients and mandatory DSN failure have atomic delivery outcomes', async () => {
  const fullSender = await setup({ senderQuota: 1 });
  try {
    await assert.rejects(sendSmtp(message(), fullSender.config), /REJECTED_452/);
    assert.equal(fullSender.mails(recipient).length, 0); assert.equal(fullSender.mails(sender).length, 0);
  } finally { await fullSender.close(); }
  const fullRecipient = await setup({ recipientQuota: 1 });
  try {
    await sendSmtp(message(), fullRecipient.config); assert.equal(fullRecipient.mails(recipient).length, 0);
    assert.equal(parseReceipt(fullRecipient.mails(sender)[0].bytes).recipients[0].status, '5.2.2');
  } finally { await fullRecipient.close(); }
  const disabled = await setup();
  try {
    disabled.store.deactivate(recipient); await sendSmtp(message(), disabled.config);
    assert.equal(parseReceipt(disabled.mails(sender)[0].bytes).recipients[0].status, '5.1.1');
  } finally { await disabled.close(); }
});
test('multi-recipient commit, case deduplication, DSN ENVID/ORCPT and NOTIFY NEVER preserve the transaction', async () => {
  const s = await setup(); let w;
  try {
    w = await wire(s.config); await w.login(); const m = message();
    assert.equal((await w.command(`MAIL FROM:<${sender}> ENVID=job+2Bone+3Dtwo RET=FULL`)).code, 250);
    assert.equal((await w.command(`RCPT TO:<${recipient}> NOTIFY=FAILURE,SUCCESS ORCPT=rfc822;${recipient}`)).code, 250);
    assert.equal((await w.command(`RCPT TO:<${recipient.toUpperCase()}> NOTIFY=SUCCESS,FAILURE ORCPT=rfc822;${recipient}`)).code, 250);
    assert.equal((await w.command(`RCPT TO:<${sender}> NOTIFY=SUCCESS`)).code, 250);
    assert.equal((await w.command('DATA')).code, 354); assert.equal((await w.data(m.mime)).code, 250);
    const dsn = s.mails(sender).find(r => r.bytes.includes(Buffer.from('multipart/report'))).bytes;
    assert.match(dsn.toString(), /Original-Envelope-Id: job\+2Bone\+3Dtwo/); assert.match(dsn.toString(), /Original-Recipient: rfc822;/);
    // The earlier GKV correlation parser intentionally only accepts its own UUID-style ENVID subset.
    assert.equal([...dsn.toString().matchAll(/^Final-Recipient: /gm)].length, 2); assert.equal(s.mails(recipient).length, 1);
    const next = message(); assert.equal((await w.command(`MAIL FROM:<${sender}>`)).code, 250);
    assert.equal((await w.command(`RCPT TO:<${recipient}> NOTIFY=NEVER,SUCCESS`)).code, 501);
    assert.equal((await w.command(`RCPT TO:<${recipient}> NOTIFY=NEVER`)).code, 250);
    assert.equal((await w.command('DATA')).code, 354); assert.equal((await w.data(next.mime)).code, 250);
    assert.equal(s.mails(sender).length, 2); assert.equal(s.mails(recipient).length, 2);
  } finally { w?.socket.destroy(); await s.close(); }
});
test('concurrent duplicate submissions use one persistent acceptance; changed bytes or envelope conflict', async () => {
  const s = await setup();
  try {
    const m = message(); await Promise.all([sendSmtp(m, s.config), sendSmtp(m, s.config)]);
    assert.equal(s.mails(recipient).length, 1); assert.equal(s.mails(sender).length, 1);
    await assert.rejects(sendSmtp({ ...m, mime: Buffer.from(m.mime.toString().replace('Subject: KOM-LE-Nachricht', 'Subject: changed')) }, s.config), /REJECTED_554/);
    await assert.rejects(sendSmtp({ ...m, dsn: { envelopeId: randomUUID() } }, s.config), /REJECTED_554/);
    const box = s.store.beginMailbox(recipient); s.store.endMailbox(recipient, box.token, box.messages.map(r => r.uid));
    const reopened = new KimMailstore({ path: s.path, key: s.key });
    const credential = await reopened.authenticateSubmission(sender, password), checked = verifySubmission(m.mime, { sender, recipients: [{ address: recipient }], authVerifier: trust(), now: Date.now() });
    const replay = reopened.commitLocalSubmission({ session: credential, ...checked, bytes: m.mime, recipients: [{ address: recipient, notify: ['SUCCESS', 'FAILURE', 'DELAY'] }], envelopeId: m.dsn.envelopeId, serverName });
    assert.equal(replay.duplicate, true); reopened.close(); assert.equal(s.mails(recipient).length, 0);
  } finally { await s.close(); }
});
test('password change invalidates authenticated SMTP sessions before DATA can commit', async () => {
  const s = await setup(); let w;
  try {
    w = await wire(s.config); await w.login(); const m = message();
    assert.equal((await w.command(`MAIL FROM:<${sender}>`)).code, 250); assert.equal((await w.command(`RCPT TO:<${recipient}>`)).code, 250);
    assert.equal((await w.command('DATA')).code, 354);
    await s.store.changePassword(sender, password, 'changed-local-fictional-password');
    assert.equal((await w.data(m.mime)).code, 550); assert.equal(s.mails(recipient).length, 0);
  } finally { w?.socket.destroy(); await s.close(); }
});
test('actual SIZE, malformed CRLF and truncated DATA cannot smuggle a transaction or create delivery', async () => {
  const s = await setup(); let w;
  try {
    w = await wire(s.config); await w.login();
    assert.equal((await w.command(`MAIL FROM:<${sender}> SIZE=${MAX_KIM_MESSAGE + 1}`)).code, 552);
    assert.equal((await w.command(`MAIL FROM:<${sender}> SIZE=10`)).code, 250);
    assert.equal((await w.command(`RCPT TO:<${recipient}>`)).code, 250); assert.equal((await w.command('DATA')).code, 354);
    assert.equal((await w.data(Buffer.from('12345678901\r\n'))).code, 552); w.socket.destroy();
    w = await wire(s.config); await w.login();
    assert.equal((await w.command(`MAIL FROM:<${sender}>`)).code, 250); assert.equal((await w.command(`RCPT TO:<${recipient}>`)).code, 250);
    assert.equal((await w.command('DATA')).code, 354); w.socket.write('From: test\n.\nMAIL FROM:<evil>\r\n');
    assert.equal((await w.next()).code, 554); w.socket.destroy();
    w = await wire(s.config); await w.login();
    assert.equal((await w.command(`MAIL FROM:<${sender}>`)).code, 250); assert.equal((await w.command(`RCPT TO:<${recipient}>`)).code, 250);
    assert.equal((await w.command('DATA')).code, 354); w.socket.end('From: incomplete\r\n'); await once(w.socket, 'close');
    assert.equal(s.mails(recipient).length, 0); assert.equal(s.mails(sender).length, 0);
  } finally { w?.socket.destroy(); await s.close(); }
});
test('mTLS host authorization and absolute connection deadline precede any credential or message processing', async () => {
  const rejected = await setup({ authorize: false, timeoutMs: 500 });
  try { await assert.rejects(sendSmtp(message(), rejected.config)); assert.equal(rejected.mails(sender).length, 0); } finally { await rejected.close(); }
  const timeout = await setup({ timeoutMs: 200 }); let w;
  try { w = await wire(timeout.config); await once(w.socket, 'close'); assert.equal(timeout.mails(recipient).length, 0); }
  finally { w?.socket.destroy(); await timeout.close(); }
  const identity = await setup(); let credentials = 0;
  try {
    const base = { ...identity.config, credentials: async () => { credentials++; return { username: sender, password: Buffer.from(password) }; } };
    await assert.rejects(sendSmtp(message(), { ...base, cert: undefined, key: undefined, passphrase: undefined }));
    await assert.rejects(sendSmtp(message(), { ...base, servername: 'wrong.local.test' }));
    assert.equal(credentials, 0); assert.equal(identity.mails(recipient).length, 0);
  } finally { await identity.close(); }
});
test('POP3 TOP returns the headers and requested dot-stuffed lines, never deletes the message', async () => {
  const s = await setup();
  try {
    const original = Buffer.from('From: local\r\nSubject: TOP fixture\r\n\r\n.first\r\nsecond\r\nthird\r\n');
    s.store.deliver({ account: recipient, id: '<top@local.test>', bytes: original, expires: Date.now() + 10000 });
    const p = new Pop3Session(s.store, { tlsVerified: true });
    await p.command(`USER ${recipient.toUpperCase()}`); await p.command(`PASS ${password}`);
    assert.match((await p.command('CAPA')).toString(), /\r\nTOP\r\n/);
    assert.equal((await p.command('TOP 1 0')).toString(), '+OK\r\nFrom: local\r\nSubject: TOP fixture\r\n\r\n.\r\n');
    assert.match((await p.command('TOP 1 2')).toString(), /\r\n\.\.first\r\nsecond\r\n\.\r\n$/);
    assert.match((await p.command('TOP 1 -1')).toString(), /^-ERR/);
    await p.command('QUIT'); assert.deepEqual(s.mails(recipient)[0].bytes, original);
  } finally { await s.close(); }
});
test('DSN xtext rejects header injection and never attaches ordinary original data', () => {
  assert.equal(decodeXtext(encodeXtext('a+b=c d')), 'a+b=c d');
  for (const value of ['a+0D+0AX-Injected:yes', 'bad=raw', 'bad+2g', 'bad+', 'raw space']) assert.throws(() => decodeXtext(value));
  assert.throws(() => buildDsn({ serverName, sender, originalId: '<id@local.test>', arrival: Date.now(), results: [{ address: recipient, action: 'delivered', status: '5.0.0' }] }));
});
test('lost SMTP acceptance followed by SIGKILL preserves the journal, original and DSN exactly once', async () => {
  const s = await setup(); let child, w;
  try {
    const configuration = join(s.dir, 'child.json');
    await writeFile(configuration, JSON.stringify({ path: s.path, key: s.key.toString('base64'), tls: { key: pki.tls.key.toString(), cert: pki.tls.cert.toString(), passphrase: pki.tls.passphrase, ca: pki.roots },
      issuers: [{ certificate: pki.roots, sha256: pki.rootFingerprint }], fingerprint: new X509Certificate(pki.sender.certificate).fingerprint256 }), { mode: 0o600 });
    const source = `
      import {readFileSync} from 'node:fs';
      import {KimMailstore} from './services/kim/mailstore.mjs';
      import {PinnedAutVerifier} from './services/kim/message-auth.mjs';
      import {createSmtpTlsServer} from './services/kim/smtp-server.mjs';
      const c=JSON.parse(readFileSync(process.argv[1],'utf8'));
      const store=new KimMailstore({path:c.path,key:Buffer.from(c.key,'base64')});
      const now=Date.now(), authVerifier=new PinnedAutVerifier({issuers:c.issuers,validFrom:now-1000,validUntil:now+3600000});
      const server=createSmtpTlsServer({store,tls:c.tls,authorizeClient:p=>p.fingerprint256===c.fingerprint,authVerifier,
        serverName:'${serverName}',localDomains:['local.kim.telematik-test']});
      // Test-only interception: die after the real SQLite COMMIT, before the peer receives its 250.
      server.on('secureConnection',socket=>{const write=socket.write.bind(socket);socket.write=(bytes,...args)=>{
        if(String(bytes).startsWith('250 2.0.0 Accepted ')){process.kill(process.pid,'SIGKILL');return false;}
        return write(bytes,...args);
      };});
      server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
    `;
    child = spawn(process.execPath, ['--input-type=module', '-e', source, configuration], { cwd: process.cwd(), stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    child.stderr.resume();
    const [ready] = await once(child, 'message'); const stopped = once(child, 'exit');
    w = await wire({ ...s.config, port: ready.port }); await w.login(); const m = message();
    await assert.rejects(submit(w, m, [recipient], ` ENVID=${m.dsn.envelopeId}`));
    const [, signal] = await stopped; assert.equal(signal, 'SIGKILL');
    assert.equal(s.mails(recipient).length, 1); assert.equal(s.mails(sender).length, 1);
    const box = s.store.beginMailbox(recipient); s.store.endMailbox(recipient, box.token, box.messages.map(m => m.uid));
    // Match the original NOTIFY tuple used by submit(), then retry via the restarted/live host.
    w.socket.destroy(); w = await wire(s.config); await w.login();
    assert.equal((await submit(w, m, [recipient], ` ENVID=${m.dsn.envelopeId}`)).code, 250);
    assert.equal(s.mails(recipient).length, 0); assert.equal(s.mails(sender).length, 1);
  } finally { w?.socket.destroy(); if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); await s.close(); }
});
test('submission journal cap rejects new work without evicting duplicate protection', async () => {
  const s = await setup({ maxSubmissionsPerAccount: 1 });
  try {
    const m = message(); await sendSmtp(m, s.config);
    await assert.rejects(sendSmtp(message(), s.config), /REJECTED_452/);
    await sendSmtp(m, s.config); assert.equal(s.mails(recipient).length, 1); assert.equal(s.mails(sender).length, 1);
    const encrypted = new DatabaseSync(s.path), row = encrypted.prepare('SELECT result FROM kim_submissions').get(); encrypted.close();
    assert.equal(Buffer.from(row.result).includes(Buffer.from(recipient)), false);
  } finally { await s.close(); }
});
test('new address case aliases cannot create a second account; legacy mixed-case encrypted mail stays readable', async () => {
  const s = await setup();
  try {
    await assert.rejects(s.store.installAccount({ address: sender.toUpperCase(), password, telematikId: 'another-test', quotaBytes: 1000 }));
    const db = new DatabaseSync(s.path);
    // Simulate an old account row before the new normalization rule, without changing ciphertext AAD.
    db.prepare('UPDATE kim_accounts SET address=? WHERE address=?').run(sender.toUpperCase(), sender); db.close();
    const bytes = Buffer.from('From: case fixture\r\n\r\npreserved\r\n');
    s.store.deliver({ account: sender, id: '<legacy@local.test>', bytes, expires: Date.now() + 10000 });
    assert.equal(await s.store.authenticate(sender, password), true); assert.deepEqual(s.mails(sender)[0].bytes, bytes);
    const reopened = new KimMailstore({ path: s.path, key: s.key }), box = reopened.beginMailbox(sender);
    assert.deepEqual(reopened.readMessage(sender, box.token, box.messages[0].uid), bytes); reopened.endMailbox(sender, box.token); reopened.close();
  } finally { await s.close(); }
});
test('actual unannounced data larger than 21 MiB is rejected before a message or notification is stored', async () => {
  const s = await setup(); let w;
  try {
    w = await wire(s.config); await w.login();
    assert.equal((await w.command(`MAIL FROM:<${sender}>`)).code, 250); assert.equal((await w.command(`RCPT TO:<${recipient}>`)).code, 250);
    assert.equal((await w.command('DATA')).code, 354);
    const oversized = Buffer.from(('A'.repeat(998) + '\r\n').repeat(Math.ceil((MAX_KIM_MESSAGE + 1) / 1000)));
    assert.equal((await w.data(oversized)).code, 552);
    assert.equal(s.mails(recipient).length, 0); assert.equal(s.mails(sender).length, 0);
  } finally { w?.socket.destroy(); await s.close(); }
});
