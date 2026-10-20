import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, X509Certificate } from 'node:crypto';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import tls from 'node:tls';
import net from 'node:net';
import { testPki } from './pki-fixture.mjs';
import { fixture, invoiceId } from './fixtures.mjs';
import { SeconSecurity } from '../../services/gkv/secon.mjs';
import { DurableOutbox } from '../../services/gkv/outbox.mjs';
import { ReceiptInbox } from '../../services/gkv/inbox.mjs';
import { parseReceipt } from '../../services/gkv/receipt-parser.mjs';
import { classifyReceipt, classifyPending } from '../../services/gkv/receipt-worker.mjs';
import { pollMailbox } from '../../services/gkv/pop3-client.mjs';
import { KimMailstore } from '../../services/kim/mailstore.mjs';
import { createPop3TlsServer } from '../../services/kim/pop3-server.mjs';
import { runExchangeCycle } from '../../services/gkv/exchange-worker.mjs';
import { prepareClassicDelivery, sha256 } from '../../api/_lib/gkv-transport.ts';
import { buildClassicPayload } from '../../src/lib/gkvExchange/edifact.ts';

let pki, clientTls, prepared;
const account = 'care@local.kim.telematik-test', password = 'fictional-mailbox-password-2026';
before(async () => {
  pki = await testPki();
  clientTls = { cert: pki.sender.certificate, key: await readFile(pki.sender.privateKeyPath), passphrase: pki.password.toString() };
  const d = fixture(); d.createdAt = new Date().toISOString(); d.mode = 'production'; d.receiverIk = '987654321'; d.physicalReceiverIk = '987654321'; d.cases[0].sourceInvoiceId = invoiceId;
  const digest = sha256(buildClassicPayload(d).bytes);
  // Release/participation assertions are explicit test fixtures, not actual admissions.
  prepared = await prepareClassicDelivery(d, { payloadSha256: digest, validatedSha256: digest, routingVerified: true, recipientRegistered: true,
    transportConfigured: true, certificateValidUntil: '2027-01-31', virusScanSha256: digest, e2eAccepted: true, sourceRevisionsCurrent: true },
  new SeconSecurity({ senderCertificate: pki.sender.certificate, recipientCertificate: pki.recipient.certificate, trustRoots: pki.roots,
    rootFingerprints: [pki.rootFingerprint], crls: pki.crls, privateKeyPath: pki.sender.privateKeyPath, password: () => pki.password }));
});
after(async () => { await pki?.close(); });

function dsn({ original = '<job@sender.test>', envelopeId, action = 'delivered', status = '2.0.0', recipient = 'receiver@test.invalid', extraHeaders = [], extraRecipient = [], returnedId } = {}) {
  const boundary = 'test_receipt--';
  const lines = ['From: postmaster@test.invalid', 'To: sender@test.invalid', 'Message-ID: <receipt@receiver.test>',
    ...(original ? [`In-Reply-To: ${original}`] : []), ...extraHeaders,
    `Content-Type: multipart/report; report-type=delivery-status; boundary="${boundary}"`, '',
    `--${boundary}`, 'Content-Type: text/plain; charset=us-ascii', '', 'Transport notification',
    `--${boundary}`, 'Content-Type: message/delivery-status', 'Content-Transfer-Encoding: 7bit', '',
    'Reporting-MTA: dns; receiver.test', ...(envelopeId ? [`Original-Envelope-Id: ${envelopeId}`] : []), '',
    `Final-Recipient: rfc822; ${recipient}`, `Action: ${action}`, `Status: ${status}`, ...extraRecipient];
  if (returnedId) lines.push(`--${boundary}`, 'Content-Type: text/rfc822-headers', '', `Message-ID: ${returnedId}`);
  lines.push(`--${boundary}--`, ''); return Buffer.from(lines.join('\r\n'));
}
function classic(binding, { rejected = false, quoteOnly = false, duplicate = false } = {}) {
  const f = binding.classicFacts, facts = f.files.map(x => `${x.name}, ${x.size}, ${x.stamp}`);
  return Buffer.from([`Subject: ${rejected ? 'Dateiablehnung' : 'Annahmebestaetigung'} ${f.procedure} Absender: ${f.senderIk} Empfaenger: ${f.receiverIk} Datei Nr.: ${f.transfer}`,
    'Message-ID: <file-receipt@receiver.test>', 'Content-Type: text/plain; charset=us-ascii', '', 'Test receipt',
    ...(quoteOnly ? [] : facts), ...(duplicate ? [facts[0]] : []), '------------Original Nachricht------------', ...facts, ''].join('\r\n'));
}
async function local() {
  const dir = await mkdtemp(join(tmpdir(), 'cs-receipt-test-')), tenantId = randomUUID(), mailboxId = randomUUID(), key = randomBytes(32);
  const inboxPath = join(dir, 'inbox.sqlite'), inbox = new ReceiptInbox({ path: inboxPath, key });
  const outbox = new DurableOutbox({ path: join(dir, 'outbox.sqlite'), key: randomBytes(32) }), id = randomUUID();
  outbox.enqueue({ id, tenantId, batchId: randomUUID(), revision: 1, invoiceIds: [randomUUID()], delivery: prepared });
  const binding = outbox.bindDispatch(tenantId, id, { routeId: 'receiver-test', routeVersion: '1', from: 'sender@test.invalid', to: 'receiver@test.invalid', dsn: true, createdAt: new Date().toISOString() });
  await outbox.journal(tenantId).claim(id, prepared.manifestSha256);
  await outbox.journal(tenantId).finish(id, 'delivery_unknown');
  const mailbox = { tenantId, mailboxId, host: '127.0.0.1', port: 1995, servername: 'localhost.test', username: account };
  const store = (bytes, uid = randomUUID()) => inbox.record({ tenantId, mailboxId, uid, bytes });
  return { dir, tenantId, mailboxId, key, inboxPath, inbox, outbox, id, binding, mailbox, store,
    close: async () => { inbox.close(); outbox.close(); await rm(dir, { recursive: true, force: true }); } };
}
async function mailboxServer(s, { authorize = true } = {}) {
  const store = new KimMailstore({ path: join(s.dir, 'kim.sqlite'), key: randomBytes(32) });
  await store.installAccount({ address: account, telematikId: 'fictional-local-test', password, quotaBytes: 1_000_000 });
  const fingerprint = new X509Certificate(pki.sender.certificate).fingerprint256, sockets = new Set();
  const server = createPop3TlsServer({ store, tls: { ...pki.tls, ca: pki.roots }, authorizeClient: peer => authorize && peer.fingerprint256 === fingerprint });
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const config = { host: '127.0.0.1', port: server.address().port, servername: 'localhost.test', username: account, password: () => Buffer.from(password), ca: pki.roots, ...clientTls };
  return { store, server, config,
    deliver: bytes => store.deliver({ account, id: `<${randomUUID()}@sender.test>`, bytes, expires: Date.now() + 3600_000 }),
    count: () => { const session = store.beginMailbox(account); store.abandonMailbox(account, session.token); return session.messages.length; },
    nextClosed: () => new Promise(resolve => server.once('secureConnection', socket => socket.once('close', resolve))),
    close: async () => { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); await new Promise(resolve => setImmediate(resolve)); store.close(); } };
}
const poll = (s, server, extra = {}) => pollMailbox({ inbox: s.inbox, tenantId: s.tenantId, mailboxId: s.mailboxId, config: server.config, ...extra });

test('DSN parser distinguishes all actions and rejects contradictory or duplicate status/correlation fields', () => {
  for (const [action, status] of [['delivered', '2.0.0'], ['failed', '5.1.1'], ['delayed', '4.4.1'], ['relayed', '2.0.0'], ['expanded', '2.0.0']]) {
    const r = parseReceipt(dsn({ action, status, returnedId: '<job@sender.test>' })); assert.equal(r.recipients[0].action, action);
  }
  assert.throws(() => parseReceipt(dsn({ action: 'delivered', status: '5.1.1' })), /ACTION_STATUS/);
  assert.throws(() => parseReceipt(dsn({ extraRecipient: ['Status: 2.0.0'] })), /DUPLICATE/);
  assert.throws(() => parseReceipt(dsn({ extraHeaders: ['In-Reply-To: <other@sender.test>'] })), /DUPLICATE/);
  assert.throws(() => parseReceipt(dsn({ returnedId: '<other@sender.test>' })), /CONFLICTING_MESSAGE_IDS/);
  assert.throws(() => parseReceipt(dsn({ envelopeId: '<job@sender.test>' })), /ENVELOPE_ID/);
  assert.throws(() => parseReceipt(Buffer.from(dsn().toString().replaceAll('\r\n', '\n'))), /RECEIPT_LINES/);
  assert.throws(() => parseReceipt(Buffer.from('Content-Type: application/pkcs7-mime\r\n\r\nopaque\r\n')), /FORMAT_UNSUPPORTED/);
});

test('correlated DSNs retain unverified origin and never turn transport reports into accepted invoices or retriable jobs', async () => {
  const s = await local(); s.inbox.bindMailbox(s.mailbox);
  try {
    for (const [action, status] of [['delivered', '2.0.0'], ['failed', '5.1.1'], ['delayed', '4.4.1'], ['relayed', '2.0.0'], ['expanded', '2.0.0']]) {
      const record = s.store(dsn({ original: s.binding.messageId, envelopeId: s.id, action, status }));
      const result = classifyReceipt({ ...s, id: record.id });
      assert.equal(result.state, 'classified'); assert.equal(result.authenticity, 'unverified');
      assert.equal(result.outcome, `transport_${action}`); assert.equal(result.jobId, s.id);
      assert.equal(s.outbox.read(s.tenantId, s.id).state, 'delivery_unknown');
      assert.deepEqual(classifyReceipt({ ...s, id: record.id }), result);
    }
    assert.deepEqual(s.outbox.pending(s.tenantId), []);
    const onlyEnvelope = s.store(dsn({ original: null, envelopeId: s.id }));
    assert.equal(classifyReceipt({ ...s, id: onlyEnvelope.id }).jobId, s.id);
    assert.equal(s.outbox.cancel(s.tenantId, s.id), false);
    assert.equal(s.inbox.get(randomUUID(), s.store(dsn()).id), null);
  } finally { await s.close(); }
});

test('correlation rejects wrong recipients, conflicting identifiers and pre-send spoofing', async () => {
  const s = await local(); s.inbox.bindMailbox(s.mailbox);
  try {
    for (const [options, reason] of [
      [{ original: s.binding.messageId, recipient: 'other@test.invalid' }, 'RECEIPT_RECIPIENT_CONFLICT'],
      [{ original: s.binding.messageId, extraRecipient: ['Original-Recipient: rfc822; other@test.invalid'] }, 'RECEIPT_RECIPIENT_CONFLICT'],
      [{ original: s.binding.messageId, envelopeId: randomUUID() }, 'RECEIPT_BINDING_CONFLICT'],
      [{ original: '<other@sender.test>', envelopeId: s.id }, 'RECEIPT_BINDING_CONFLICT'],
      [{ original: undefined }, 'RECEIPT_NO_MATCH'],
    ]) {
      const record = s.store(dsn(options)), result = classifyReceipt({ ...s, id: record.id });
      assert.equal(result.state, 'quarantined'); assert.equal(result.reason, reason);
    }
    const queued = randomUUID();
    s.outbox.enqueue({ id: queued, tenantId: s.tenantId, batchId: randomUUID(), revision: 1, invoiceIds: [randomUUID()], delivery: prepared });
    const binding = s.outbox.bindDispatch(s.tenantId, queued, { routeId: 'receiver-test', routeVersion: '1', from: s.binding.from, to: s.binding.to, createdAt: new Date().toISOString() });
    const record = s.store(dsn({ original: binding.messageId }));
    assert.equal(classifyReceipt({ ...s, id: record.id }).reason, 'RECEIPT_JOB_NOT_SENT');
  } finally { await s.close(); }
});

test('GKV Anlage 7 matches both exact file sizes, creation stamp, DAV IK and transfer; ignores quoted originals', async () => {
  const s = await local(); s.inbox.bindMailbox(s.mailbox);
  try {
    for (const rejected of [false, true]) {
      const bytes = classic(s.binding, { rejected }), record = s.store(bytes);
      assert.equal(classifyReceipt({ ...s, id: record.id }).outcome, rejected ? 'file_rejected' : 'file_received');
      assert.equal(s.outbox.read(s.tenantId, s.id).state, 'delivery_unknown');
    }
    assert.throws(() => parseReceipt(classic(s.binding, { quoteOnly: true })), /CLASSIC_PAIR/);
    assert.throws(() => parseReceipt(classic(s.binding, { duplicate: true })), /CLASSIC_PAIR/);
    const [head, body] = classic(s.binding).toString().split('\r\n\r\n');
    for (const [encoding, encoded] of [['base64', Buffer.from(body).toString('base64')], ['quoted-printable', body.replace('Test receipt', '=54est receipt')]]) {
      const bytes = Buffer.from(`${head}\r\nContent-Transfer-Encoding: ${encoding}\r\n\r\n${encoded}\r\n`);
      assert.equal(parseReceipt(bytes).outcome, 'file_received');
    }
    const changed = classic(s.binding).toString().replace('Empfaenger: 987654321', 'Empfaenger: 123456789');
    assert.equal(classifyReceipt({ ...s, id: s.store(Buffer.from(changed)).id }).reason, 'RECEIPT_NO_MATCH');
    // Same transfer number/second/size can be ambiguous; never select an arbitrary job.
    const other = randomUUID(); s.outbox.enqueue({ id: other, tenantId: s.tenantId, batchId: randomUUID(), revision: 1, invoiceIds: [randomUUID()], delivery: prepared });
    s.outbox.bindDispatch(s.tenantId, other, { routeId: 'receiver-test', routeVersion: '1', from: s.binding.from, to: s.binding.to, createdAt: new Date().toISOString() });
    assert.equal(classifyReceipt({ ...s, id: s.store(classic(s.binding)).id }).reason, 'RECEIPT_AMBIGUOUS');
  } finally { await s.close(); }
});

test('inbox persists encrypted originals, prevents UID/account substitution and recovers pending analysis after reopen', async () => {
  const s = await local(); s.inbox.bindMailbox(s.mailbox);
  try {
    const bytes = classic(s.binding), record = s.store(bytes, 'stable-UID');
    assert.equal(s.store(bytes, 'stable-UID').inserted, false);
    assert.throws(() => s.store(Buffer.from(bytes.toString().replace('Test receipt', 'Changed receipt')), 'stable-UID'), /UID_CONFLICT/);
    assert.throws(() => s.inbox.bindMailbox({ ...s.mailbox, username: 'other@test.invalid' }), /MAILBOX_CHANGED/);
    const reopened = new ReceiptInbox({ path: s.inboxPath, key: s.key });
    assert.deepEqual(reopened.get(s.tenantId, record.id).bytes, bytes);
    assert.equal(classifyPending({ ...s, inbox: reopened })[0].analysis.outcome, 'file_received');
    assert.deepEqual(classifyPending({ ...s, inbox: reopened }), []); reopened.close();
    const wrongKey = new ReceiptInbox({ path: s.inboxPath, key: randomBytes(32) });
    assert.throws(() => wrongKey.get(s.tenantId, record.id), /AUTHENTICATION/); wrongKey.close();
    for (const path of [s.inboxPath, `${s.inboxPath}-wal`]) assert.equal((await readFile(path)).includes(Buffer.from('Test receipt')), false);
  } finally { await s.close(); }
});

test('real mTLS POP3 -> encrypted inbox -> receipt classification -> QUIT removes only durably stored originals', async () => {
  const s = await local(), server = await mailboxServer(s);
  try {
    const bytes = Buffer.from(dsn({ original: s.binding.messageId, envelopeId: s.id }).toString().replace('Transport notification', '.Leading dot\r\n..Two leading dots'));
    const uid = server.deliver(bytes); let receiptId;
    const closed = server.nextClosed();
    assert.deepEqual(await poll(s, server, { onStored: id => { receiptId = id; classifyReceipt({ ...s, id }); } }), { stored: 1, duplicates: 0, skippedTooLarge: 0, deleted: 1 });
    await closed;
    const record = s.inbox.get(s.tenantId, receiptId);
    assert.deepEqual(record.bytes, bytes); assert.equal(record.uid, uid); assert.equal(record.deletionConfirmed, true);
    assert.equal(record.analysis.outcome, 'transport_delivered'); assert.equal(record.analysis.authenticity, 'unverified');
    assert.equal(server.count(), 0); assert.equal(s.outbox.read(s.tenantId, s.id).state, 'delivery_unknown');
  } finally { await server.close(); await s.close(); }
});

test('SIGKILL after durable receive keeps POP3 original; restarted worker re-fetches without duplicate processing', async () => {
  const s = await local(), server = await mailboxServer(s);
  try {
    const bytes = classic(s.binding), uid = server.deliver(bytes), configPath = join(s.dir, 'test-config.json');
    await writeFile(configPath, JSON.stringify({ inboxPath: s.inboxPath, key: s.key.toString('hex'), tenantId: s.tenantId, mailboxId: s.mailboxId,
      config: { ...server.config, password, key: clientTls.key.toString(), cert: clientTls.cert } }), { mode: 0o600 });
    const script = `import {readFile} from 'node:fs/promises';import {ReceiptInbox} from './services/gkv/inbox.mjs';import {pollMailbox} from './services/gkv/pop3-client.mjs';
      const p=JSON.parse(await readFile(process.argv[1],'utf8'));const inbox=new ReceiptInbox({path:p.inboxPath,key:Buffer.from(p.key,'hex')});
      await pollMailbox({inbox,tenantId:p.tenantId,mailboxId:p.mailboxId,config:{...p.config,password:()=>Buffer.from(p.config.password)},onStored:()=>process.kill(process.pid,'SIGKILL')});`;
    const closed = server.nextClosed(), child = spawn(process.execPath, ['--input-type=module', '-e', script, configPath]);
    child.stdout.resume(); child.stderr.resume(); const [code, signal] = await once(child, 'exit');
    assert.equal(code, null); assert.equal(signal, 'SIGKILL'); await closed;
    assert.equal(server.count(), 1);
    const pending = s.inbox.pending(s.tenantId, s.mailboxId); assert.equal(pending.length, 1);
    assert.equal(s.inbox.get(s.tenantId, pending[0]).uid, uid);
    const closedAgain = server.nextClosed();
    assert.deepEqual(await poll(s, server, { onStored: id => classifyReceipt({ ...s, id }) }), { stored: 0, duplicates: 1, skippedTooLarge: 0, deleted: 1 });
    await closedAgain; assert.equal(server.count(), 0);
    assert.equal(s.inbox.get(s.tenantId, pending[0]).analysis.outcome, 'file_received');
  } finally { await server.close(); await s.close(); }
});

test('POP3 does not release credentials to a wrong TLS hostname or a client rejected by the server', async () => {
  for (const reason of ['hostname', 'client-policy', 'missing-client-cert']) {
    const s = await local(), server = await mailboxServer(s, { authorize: reason !== 'client-policy' }); let secrets = 0;
    try {
      const config = { ...server.config, password: () => { secrets++; return Buffer.from(password); } };
      if (reason === 'hostname') config.servername = 'wrong.test';
      if (reason === 'missing-client-cert') { delete config.cert; delete config.key; }
      await assert.rejects(poll(s, server, { config })); assert.equal(secrets, 0);
      assert.deepEqual(s.inbox.pending(s.tenantId, s.mailboxId), []);
    } finally { await server.close(); await s.close(); }
  }
});

test('inbox quota failure and oversized POP3 messages leave originals in the mailbox', async () => {
  const s = await local(), server = await mailboxServer(s), limited = new ReceiptInbox({ path: join(s.dir, 'limited.sqlite'), key: randomBytes(32), maxMailboxBytes: 1 });
  try {
    server.deliver(dsn()); let closed = server.nextClosed();
    await assert.rejects(poll(s, server, { inbox: limited }), /INBOX_QUOTA/); await closed; assert.equal(server.count(), 1);
    closed = server.nextClosed();
    assert.deepEqual(await poll(s, server, { config: { ...server.config, maxMessageBytes: 10 } }), { stored: 0, duplicates: 0, skippedTooLarge: 1, deleted: 0 });
    await closed; assert.equal(server.count(), 1);
  } finally { limited.close(); await server.close(); await s.close(); }
});

test('malformed receipts are preserved in quarantine before POP3 deletion, with no billing-state change', async () => {
  const s = await local(), server = await mailboxServer(s); let receiptId;
  try {
    const bytes = dsn({ original: s.binding.messageId, extraRecipient: ['Status: 5.0.0'] }); server.deliver(bytes);
    const closed = server.nextClosed();
    await poll(s, server, { onStored: id => { receiptId = id; classifyReceipt({ ...s, id }); } }); await closed;
    const record = s.inbox.get(s.tenantId, receiptId); assert.equal(record.state, 'quarantined'); assert.deepEqual(record.bytes, bytes);
    assert.equal(server.count(), 0); assert.equal(s.outbox.read(s.tenantId, s.id).state, 'delivery_unknown');
  } finally { await server.close(); await s.close(); }
});

async function hostilePop3({ duplicateUid = false, wrongSize = false, dropQuit = false, messages = [dsn()] } = {}) {
  const sockets = new Set(), commands = [];
  const server = tls.createServer(pki.tls, socket => {
    sockets.add(socket); socket.on('error', () => {}); socket.on('close', () => sockets.delete(socket)); socket.write('+OK\r\n'); let input = '';
    socket.on('data', bytes => {
      input += bytes.toString('latin1'); let end;
      while ((end = input.indexOf('\r\n')) >= 0) {
        const line = input.slice(0, end); input = input.slice(end + 2); commands.push(line.split(' ')[0]);
        if (line === 'UIDL') socket.write('+OK\r\n1 stableUID\r\n' + (duplicateUid ? '2 stableUID\r\n' : '') + '.\r\n');
        else if (line === 'LIST') socket.write(`+OK\r\n1 ${messages[0].length + (wrongSize ? 1 : 0)}\r\n.\r\n`);
        else if (line === 'RETR 1') socket.write('+OK\r\n' + messages[0].toString('latin1').replace(/(^|\r\n)\./g, '$1..') + '.\r\n');
        else if (line === 'QUIT') { if (dropQuit) socket.destroy(); else socket.end('+OK\r\n'); }
        else socket.write('+OK\r\n');
      }
    });
  });
  server.on('tlsClientError', () => {}); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return { commands, config: { host: '127.0.0.1', port: server.address().port, servername: 'localhost.test', username: account, password: () => Buffer.from(password), ca: pki.roots },
    close: async () => { for (const s of sockets) s.destroy(); await new Promise(resolve => server.close(resolve)); } };
}
test('hostile POP3 duplicate UID and false octet count cannot cause DELE', async () => {
  for (const variant of ['duplicateUid', 'wrongSize']) {
    const s = await local(), server = await hostilePop3({ [variant]: true });
    try { await assert.rejects(poll(s, server)); assert.equal(server.commands.includes('DELE'), false); }
    finally { await server.close(); await s.close(); }
  }
});
test('lost QUIT acknowledgement preserves the inbox; reuse of that UID for changed bytes is rejected before DELE', async () => {
  const s = await local(), messages = [dsn()], server = await hostilePop3({ dropQuit: true, messages });
  try {
    await assert.rejects(poll(s, server), /POP3_CLOSED/);
    const pending = s.inbox.pending(s.tenantId, s.mailboxId); assert.equal(pending.length, 1);
    assert.equal(s.inbox.get(s.tenantId, pending[0]).deletionConfirmed, false);
    assert.equal(server.commands.filter(c => c === 'DELE').length, 1);
    messages[0] = dsn({ action: 'failed', status: '5.1.1' });
    await assert.rejects(poll(s, server), /INBOX_UID_CONFLICT/);
    assert.equal(server.commands.filter(c => c === 'DELE').length, 1);
    assert.equal(s.inbox.get(s.tenantId, pending[0]).sha256, sha256(dsn()));
  } finally { await server.close(); await s.close(); }
});
test('silent POP3 TLS handshake has a deadline and never obtains a password', async () => {
  const s = await local(), sockets = new Set(), server = net.createServer(socket => { sockets.add(socket); socket.on('error', () => {}); }); let secrets = 0;
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    await assert.rejects(poll(s, { config: { host: '127.0.0.1', port: server.address().port, servername: 'localhost.test', username: account,
      password: () => { secrets++; return Buffer.from(password); }, ca: pki.roots, timeoutMs: 100 } }), /POP3_TIMEOUT/);
    assert.equal(secrets, 0);
  } finally { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); await s.close(); }
});

test('POP3 deadline also bounds a stalled secret provider after successful TLS', async () => {
  const s = await local(), server = await mailboxServer(s); let called = false;
  try {
    const closed = server.nextClosed();
    await assert.rejects(poll(s, server, { config: { ...server.config, timeoutMs: 150, password: () => { called = true; return new Promise(() => {}); } } }), /POP3_TIMEOUT/);
    await closed; assert.equal(called, true);
  } finally { await server.close(); await s.close(); }
});

test('one service cycle sends via actual TLS SMTP, retrieves its DSN via own mTLS POP3 and does not repeat either action', async () => {
  const s = await local(), mail = await mailboxServer(s), queued = randomUUID(), sockets = new Set(); let sends = 0, receiptId;
  s.outbox.enqueue({ id: queued, tenantId: s.tenantId, batchId: randomUUID(), revision: 1, invoiceIds: [randomUUID()], delivery: prepared });
  const smtp = tls.createServer(pki.tls, socket => {
    sockets.add(socket); socket.on('error', () => {}); socket.on('close', () => sockets.delete(socket)); socket.write('220 localhost.test\r\n'); let input = '', body = false;
    socket.on('data', bytes => {
      input += bytes.toString('latin1'); let end;
      while ((end = input.indexOf('\r\n')) >= 0) {
        const line = input.slice(0, end); input = input.slice(end + 2);
        if (body) {
          if (line === '.') {
            sends++; body = false;
            const binding = s.outbox.dispatchBinding(s.tenantId, queued);
            mail.deliver(dsn({ original: binding.messageId, envelopeId: binding.envelopeId })); socket.write('250 accepted\r\n');
          }
        } else if (line.startsWith('EHLO')) socket.write('250-localhost.test\r\n250 DSN\r\n');
        else if (line.startsWith('MAIL') || line.startsWith('RCPT')) socket.write('250 ok\r\n');
        else if (line === 'DATA') { body = true; socket.write('354 data\r\n'); }
        else if (line === 'QUIT') socket.end('221 bye\r\n');
      }
    });
  });
  smtp.on('tlsClientError', () => {}); smtp.listen(0, '127.0.0.1'); await once(smtp, 'listening');
  const routes = [{ id: 'receiver-test', version: '1', tenantId: s.tenantId, enabled: true, senderIk: '123456789', receiverIk: '987654321',
    from: 'sender@test.invalid', to: 'receiver@test.invalid', dsn: true,
    smtp: { host: '127.0.0.1', port: smtp.address().port, servername: 'localhost.test', ehlo: 'sender.test', ca: pki.roots, mode: 'tls' } }];
  const settings = { ...s, routes, mailboxes: [{ id: s.mailboxId, tenantId: s.tenantId, config: mail.config }] };
  // Capture the record identifier through the existing persistent API, with no synthetic receipt-state writes.
  const record = s.inbox.record.bind(s.inbox); s.inbox.record = input => { const value = record(input); receiptId = value.id; return value; };
  try {
    let closed = mail.nextClosed(); const first = await runExchangeCycle(settings); await closed;
    assert.deepEqual(first.dispatch, [{ id: queued, state: 'sent' }]); assert.equal(first.received[0].deleted, 1);
    const receipt = s.inbox.get(s.tenantId, receiptId);
    assert.equal(receipt.analysis.jobId, queued); assert.equal(receipt.analysis.outcome, 'transport_delivered');
    assert.equal(receipt.analysis.authenticity, 'unverified'); assert.equal(s.outbox.read(s.tenantId, queued).state, 'sent');
    closed = mail.nextClosed(); const second = await runExchangeCycle(settings); await closed;
    assert.deepEqual(second.dispatch, []); assert.equal(second.received[0].stored, 0); assert.equal(sends, 1);
    await assert.rejects(runExchangeCycle({ ...settings, mailboxes: [{ ...settings.mailboxes[0], tenantId: randomUUID() }] }), /WORKER_MAILBOXES/);
  } finally { for (const socket of sockets) socket.destroy(); await new Promise(resolve => smtp.close(resolve)); await mail.close(); await s.close(); }
});
