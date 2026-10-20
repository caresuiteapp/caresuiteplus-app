import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash, X509Certificate } from 'node:crypto';
import { readFile, mkdtemp, rm, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import tls from 'node:tls';
import net from 'node:net';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { testPki } from './pki-fixture.mjs';
import { SeconSecurity } from '../../services/gkv/secon.mjs';
import { openssl } from '../../services/gkv/openssl.mjs';
import { inspectEnvelope, inspectSigned, der } from '../../services/gkv/der.mjs';
import { DurableOutbox } from '../../services/gkv/outbox.mjs';
import { buildClassicMessage, classicSmtpProvider } from '../../services/gkv/classic-provider.mjs';
import { sendSmtp } from '../../services/gkv/smtp.mjs';
import { createRegistrationRequest } from '../../services/gkv/registration.mjs';
import { prepareClassicDelivery, dispatchOnce, sha256 } from '../../api/_lib/gkv-transport.ts';
import { buildClassicPayload } from '../../src/lib/gkvExchange/edifact.ts';
import { fixture, invoiceId } from './fixtures.mjs';

let pki, encrypted, prepared;
const context = { senderIk: '123456789', receiverIk: '987654321' }, plaintext = Buffer.from("UNA:+.? 'UNB+UNOC:3+123456789+987654321'", 'latin1');
const day = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
const config = () => ({ senderCertificate: pki.sender.certificate, recipientCertificate: pki.recipient.certificate, trustRoots: pki.roots, rootFingerprints: [pki.rootFingerprint], crls: pki.crls, privateKeyPath: pki.sender.privateKeyPath, password: () => pki.password });
before(async () => {
  pki = await testPki(); const crypto = new SeconSecurity(config());
  encrypted = await crypto.encryptAndSign(plaintext, context);
  const d = fixture(); d.createdAt = new Date().toISOString(); d.mode = 'production'; d.receiverIk = context.receiverIk; d.cases[0].sourceInvoiceId = invoiceId;
  const hash = sha256(buildClassicPayload(d).bytes);
  prepared = await prepareClassicDelivery(d, { payloadSha256: hash, validatedSha256: hash, routingVerified: true, recipientRegistered: true, transportConfigured: true, certificateValidUntil: '2027-01-31', virusScanSha256: hash, e2eAccepted: true, sourceRevisionsCurrent: true }, crypto);
});
after(async () => { await pki?.close(); });

test('real SECON: PSS/OAEP/AES DER, sender verification and independent recipient decrypt restore every byte', async () => {
  const crypto = new SeconSecurity(config());
  const result = await crypto.verify(encrypted, { ...context, day: day(), plaintextSha256: sha256(plaintext) });
  assert.equal(result.valid, true); assert.notEqual(result.ciphertextSha256, result.plaintextSha256);
  const signed = await openssl(['cms', '-decrypt', '-inform', 'DER', '-recip', pki.recipient.path, '-inkey', pki.recipient.privateKeyPath, '-passin', 'fd:3'], { input: encrypted, password: pki.password });
  assert.deepEqual(inspectSigned(signed, new X509Certificate(pki.sender.certificate).raw), plaintext);
  const actual = await openssl(['cms', '-verify', '-binary', '-inform', 'DER', '-CAfile', join(pki.dir, 'root.pem'), '-no-CApath', '-no-CAstore'], { input: signed });
  assert.deepEqual(actual, plaintext);
  assert.notDeepEqual(await crypto.encryptAndSign(plaintext, context), encrypted, 'fresh session key and IV');
});
test('real SECON rejects wrong IK, altered ciphertext, wrong plaintext hash and day', async () => {
  const crypto = new SeconSecurity(config()), proof = { ...context, day: day(), plaintextSha256: sha256(plaintext) };
  await assert.rejects(crypto.encryptAndSign(plaintext, { ...context, receiverIk: '111111111' }));
  const corrupt = Buffer.from(encrypted); corrupt[corrupt.length - 19] ^= 1;
  for (const [bytes, expected] of [[corrupt, proof], [encrypted, { ...proof, plaintextSha256: '0'.repeat(64) }], [encrypted, { ...proof, day: '2026-01-01' }]]) await assert.rejects(crypto.verify(bytes, expected));
});
test('DER validator refuses trailing data, indefinite and nonminimal lengths, weak OAEP parameters', () => {
  for (const bytes of [Buffer.from([48, 128, 0, 0]), Buffer.from([48, 129, 1, 0]), Buffer.from([48, 0, 0]), Buffer.from([48, 3, 2, 1])]) assert.throws(() => der(bytes));
  const weak = Buffer.from(encrypted); const oid = Buffer.from('608648016503040201', 'hex'), at = weak.indexOf(oid); assert.ok(at > 0); weak[at + oid.length - 1] = 2;
  assert.throws(() => inspectEnvelope(weak, [new X509Certificate(pki.recipient.certificate).raw, new X509Certificate(pki.sender.certificate).raw]));
});
test('trust pins, missing CRLs, expired certificates and permissive private-key access fail closed', async () => {
  for (const override of [{ rootFingerprints: ['0'.repeat(64)] }, { crls: '' }, { now: () => new Date('2040-01-01') }]) await assert.rejects(new SeconSecurity({ ...config(), ...override }).encryptAndSign(plaintext, context));
  await chmod(pki.sender.privateKeyPath, 0o644);
  try { await assert.rejects(new SeconSecurity(config()).encryptAndSign(plaintext, context), /KEY_PERMISSIONS/); }
  finally { await chmod(pki.sender.privateKeyPath, 0o600); }
});
test('actual signed CRL prevents encryption for a revoked recipient', async () => {
  const revoked = await pki.revokeRecipient();
  await assert.rejects(new SeconSecurity({ ...config(), crls: revoked }).encryptAndSign(plaintext, context), /CRYPTO_REJECTED/);
});
test('real PKCS#10 registration uses encrypted RSA4096, PSS proof-of-possession and cannot overwrite a key', async () => {
  const directory = join(pki.dir, 'registration');
  const options = { directory, ik: '123456789', company: 'CareSuite Test', contact: 'Test Contact', password: Buffer.from('a-test-only-registration-passphrase') };
  const result = await createRegistrationRequest(options);
  assert.equal(result.keyBits, 4096); assert.equal(result.requestSha256, sha256(result.request));
  assert.ok((await readFile(result.privateKeyPath, 'utf8')).includes('BEGIN ENCRYPTED PRIVATE KEY'));
  await openssl(['req', '-inform', 'DER', '-verify', '-noout'], { input: result.request });
  await assert.rejects(createRegistrationRequest(options));
  assert.deepEqual(await readFile(result.requestPath), result.request);
  await assert.rejects(createRegistrationRequest({ ...options, directory: join(pki.dir, 'invalid'), company: 'Company\n/OU=IK999999999' }));
});

async function storeFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'cs-outbox-test-')), path = join(dir, 'jobs.sqlite'), key = randomBytes(32);
  const box = new DurableOutbox({ path, key }), tenantId = randomUUID(), id = randomUUID();
  const job = { id, tenantId, batchId: randomUUID(), revision: 1, invoiceIds: [randomUUID()], delivery: prepared };
  box.enqueue(job); return { dir, path, key, box, job };
}
test('outbox persists exact encrypted artifacts, rejects changed idempotency, invoice double booking and foreign tenant', async () => {
  const s = await storeFixture();
  try {
    assert.equal(s.box.enqueue(s.job), false);
    assert.throws(() => s.box.enqueue({ ...s.job, revision: 2 }), /IDEMPOTENCY/);
    assert.throws(() => s.box.enqueue({ ...s.job, id: randomUUID(), batchId: randomUUID() }));
    assert.equal(s.box.read(randomUUID(), s.job.id), null);
    assert.equal(await s.box.journal(randomUUID()).claim(s.job.id, prepared.manifestSha256), false);
    assert.deepEqual(s.box.read(s.job.tenantId, s.job.id).delivery.files[0].bytes, Buffer.from(prepared.files[0].bytes));
    s.box.close(); const disk = await readFile(s.path); assert.equal(disk.includes(Buffer.from(prepared.files[0].bytes)), false);
    const reopened = new DurableOutbox({ path: s.path, key: s.key }); assert.equal(reopened.read(s.job.tenantId, s.job.id).state, 'queued'); reopened.close();
    const wrong = new DurableOutbox({ path: s.path, key: randomBytes(32) }); assert.throws(() => wrong.read(s.job.tenantId, s.job.id), /AUTHENTICATION/); wrong.close();
  } finally { await rm(s.dir, { recursive: true, force: true }); }
});
test('outbox CAS races across independent processes and preserves sending after reopen', async () => {
  const s = await storeFixture(); s.box.close();
  try {
    const script = `import {DurableOutbox} from './services/gkv/outbox.mjs';const [path,key,tenant,id,hash]=process.argv.slice(1);const b=new DurableOutbox({path,key:Buffer.from(key,'hex')});const ok=await b.journal(tenant).claim(id,hash);console.log(ok);b.close();`;
    const race = () => new Promise((resolve, reject) => {
      const p = spawn(process.execPath, ['--import', './tests/gkv-exchange/register.mjs', '--input-type=module', '-e', script, s.path, s.key.toString('hex'), s.job.tenantId, s.job.id, prepared.manifestSha256]);
      let out = ''; p.stdout.on('data', b => out += b); p.stderr.resume(); p.on('error', reject); p.on('exit', code => code === 0 ? resolve(out.trim()) : reject(new Error('CHILD_FAILED')));
    });
    assert.deepEqual((await Promise.all([race(), race()])).sort(), ['false', 'true']);
    const b = new DurableOutbox({ path: s.path, key: s.key });
    assert.equal(b.read(s.job.tenantId, s.job.id).state, 'sending');
    assert.equal(await b.journal(s.job.tenantId).claim(s.job.id, prepared.manifestSha256), false);
    assert.equal(b.cancel(s.job.tenantId, s.job.id), false);
    assert.deepEqual(b.events(s.job.tenantId, s.job.id).map(e => e.state), ['queued', 'sending']); b.close();
  } finally { await rm(s.dir, { recursive: true, force: true }); }
});
test('SIGKILL after a durable claim never makes the job eligible for a second send', async () => {
  const s = await storeFixture(); s.box.close();
  try {
    const script = `import {DurableOutbox} from './services/gkv/outbox.mjs';const [path,key,tenant,id,hash]=process.argv.slice(1);const b=new DurableOutbox({path,key:Buffer.from(key,'hex')});if(!await b.journal(tenant).claim(id,hash))process.exit(9);process.kill(process.pid,'SIGKILL');`;
    const child = spawn(process.execPath, ['--import', './tests/gkv-exchange/register.mjs', '--input-type=module', '-e', script, s.path, s.key.toString('hex'), s.job.tenantId, s.job.id, prepared.manifestSha256]);
    child.stdout.resume(); child.stderr.resume(); const [code, signal] = await once(child, 'exit');
    assert.equal(code, null); assert.equal(signal, 'SIGKILL');
    const reopened = new DurableOutbox({ path: s.path, key: s.key });
    assert.equal(reopened.read(s.job.tenantId, s.job.id).state, 'sending');
    assert.equal(await reopened.journal(s.job.tenantId).claim(s.job.id, prepared.manifestSha256), false); reopened.close();
  } finally { await rm(s.dir, { recursive: true, force: true }); }
});

async function smtpServer({ rejectAt, disconnectAfterData, advertiseDsn = true } = {}) {
  const commands = [], data = []; const sockets = new Set();
  const server = tls.createServer(pki.tls, socket => {
    sockets.add(socket); socket.on('error', () => {}); socket.on('close', () => sockets.delete(socket));
    socket.write('220 localhost.test ESMTP\r\n'); let buffer = '', inData = false;
    socket.on('data', chunk => {
      buffer += chunk.toString('latin1'); let at;
      while ((at = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, at); buffer = buffer.slice(at + 2);
        if (inData) {
          if (line === '.') { inData = false; if (disconnectAfterData) socket.destroy(); else socket.write('250 2.0.0 accepted\r\n'); }
          else data.push(line.startsWith('..') ? line.slice(1) : line);
        } else {
          commands.push(line);
          if (rejectAt && line.startsWith(rejectAt)) { socket.write('550 5.7.1 rejected\r\n'); continue; }
          if (line.startsWith('EHLO')) socket.write(`250-localhost.test\r\n250-SIZE 32000000\r\n${advertiseDsn ? '250-DSN\r\n' : ''}250 AUTH PLAIN\r\n`);
          else if (line.startsWith('AUTH')) socket.write('235 2.7.0 authenticated\r\n');
          else if (line.startsWith('MAIL') || line.startsWith('RCPT')) socket.write('250 2.1.0 ok\r\n');
          else if (line === 'DATA') { inData = true; socket.write('354 continue\r\n'); }
          else if (line === 'QUIT') socket.end('221 bye\r\n');
        }
      }
    });
  });
  server.on('tlsClientError', () => {}); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return { commands, data, config: { host: '127.0.0.1', port: server.address().port, servername: 'localhost.test', ehlo: 'client.test', ca: pki.roots, mode: 'tls', credentials: () => ({ username: 'sender@test.invalid', password: Buffer.from('local-test') }) }, close: async () => { for (const s of sockets) s.destroy(); await new Promise(resolve => server.close(resolve)); } };
}
test('real TLS SMTP delivery carries exactly AUF + encrypted payload, sender IK subject and persisted sent state', async () => {
  const server = await smtpServer(), s = await storeFixture();
  try {
    const provider = classicSmtpProvider({ ...context, from: 'sender@test.invalid', to: 'receiver@test.invalid', smtp: server.config });
    assert.equal(await dispatchOnce(s.job.id, prepared, s.box.journal(s.job.tenantId), provider), 'sent');
    assert.equal(s.box.read(s.job.tenantId, s.job.id).state, 'sent');
    const mime = server.data.join('\r\n'); assert.ok(mime.includes('Subject: 123456789\r\n'));
    assert.equal((mime.match(/Content-Disposition: attachment/g) ?? []).length, 2);
    assert.ok(mime.includes(Buffer.from(prepared.files[0].bytes).toString('base64').slice(0, 76)));
    assert.equal(await dispatchOnce(s.job.id, prepared, s.box.journal(s.job.tenantId), provider), 'already_claimed');
    assert.equal(server.commands.filter(c => c === 'DATA').length, 1);
  } finally { s.box.close(); await server.close(); await rm(s.dir, { recursive: true, force: true }); }
});
test('lost SMTP acknowledgement becomes durable delivery_unknown and never automatically retries', async () => {
  const server = await smtpServer({ disconnectAfterData: true }), s = await storeFixture();
  try {
    const provider = classicSmtpProvider({ ...context, from: 'sender@test.invalid', to: 'receiver@test.invalid', smtp: server.config });
    assert.equal(await dispatchOnce(s.job.id, prepared, s.box.journal(s.job.tenantId), provider), 'delivery_unknown');
    assert.equal(await dispatchOnce(s.job.id, prepared, s.box.journal(s.job.tenantId), provider), 'already_claimed');
  } finally { s.box.close(); await server.close(); await rm(s.dir, { recursive: true, force: true }); }
});
test('SMTP requires verified TLS, advertised DSN and recipient acceptance before DATA', async () => {
  const message = buildClassicMessage(prepared, { from: 'sender@test.invalid', to: 'receiver@test.invalid', messageId: '<test@client.test>', date: new Date() });
  for (const variant of ['wrong-host', 'missing-dsn', 'rejected-recipient']) {
    const server = await smtpServer({ advertiseDsn: false, rejectAt: variant === 'rejected-recipient' ? 'RCPT' : undefined });
    try {
      const cfg = { ...server.config, ...(variant === 'wrong-host' ? { servername: 'wrong.test' } : {}) };
      await assert.rejects(sendSmtp({ ...message, ...(variant === 'missing-dsn' ? { dsn: {} } : {}) }, cfg));
      assert.equal(server.commands.includes('DATA'), false);
    } finally { await server.close(); }
  }
});
test('STARTTLS upgrades before authentication, reissues EHLO and applies DSN envelope + dot transparency', async () => {
  const sockets = new Set(), commands = [], data = [];
  const server = net.createServer(raw => {
    sockets.add(raw); raw.on('error', () => {}); raw.write('220 localhost.test ESMTP\r\n');
    let buffer = '';
    const initial = chunk => {
      buffer += chunk.toString(); let at;
      while ((at = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, at); buffer = buffer.slice(at + 2); commands.push(`plain:${line}`);
        if (line.startsWith('EHLO')) raw.write('250-localhost.test\r\n250 STARTTLS\r\n');
        else if (line === 'STARTTLS') {
          raw.off('data', initial); raw.write('220 upgrade\r\n');
          const secure = new tls.TLSSocket(raw, { isServer: true, secureContext: tls.createSecureContext(pki.tls) });
          sockets.add(secure); secure.on('error', () => {}); let input = '', body = false;
          secure.on('data', b => {
            input += b.toString(); let end;
            while ((end = input.indexOf('\r\n')) >= 0) {
              const l = input.slice(0, end); input = input.slice(end + 2);
              if (body) { if (l === '.') { body = false; secure.write('250 accepted\r\n'); } else data.push(l); }
              else {
                commands.push(`tls:${l}`);
                if (l.startsWith('EHLO')) secure.write('250-localhost.test\r\n250-DSN\r\n250 AUTH PLAIN\r\n');
                else if (l.startsWith('AUTH')) secure.write('235 authenticated\r\n');
                else if (l.startsWith('MAIL') || l.startsWith('RCPT')) secure.write('250 ok\r\n');
                else if (l === 'DATA') { body = true; secure.write('354 data\r\n'); }
              }
            }
          });
        }
      }
    }; raw.on('data', initial);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const result = await sendSmtp({ from: 'sender@test.invalid', to: 'receiver@test.invalid', messageId: '<dot@test.invalid>', dsn: {}, mime: Buffer.from('From: sender@test.invalid\r\n\r\n.line\r\n') },
      { host: '127.0.0.1', port: server.address().port, servername: 'localhost.test', ehlo: 'client.test', ca: pki.roots, mode: 'starttls', credentials: () => ({ username: 'sender@test.invalid', password: Buffer.from('test-only') }) });
    assert.equal(result.reference, '<dot@test.invalid>'); assert.equal(commands.filter(c => c.includes('EHLO')).length, 2);
    assert.ok(!commands.some(c => c.startsWith('plain:AUTH'))); assert.ok(commands.includes('tls:MAIL FROM:<sender@test.invalid> RET=HDRS'));
    assert.ok(commands.includes('tls:RCPT TO:<receiver@test.invalid> NOTIFY=SUCCESS,FAILURE,DELAY')); assert.ok(data.includes('..line'));
  } finally { for (const s of sockets) s.destroy(); await new Promise(resolve => server.close(resolve)); }
});
test('silent TLS handshake is bounded by the SMTP deadline', async () => {
  const sockets = new Set(), server = net.createServer(s => { sockets.add(s); s.on('error', () => {}); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const message = buildClassicMessage(prepared, { from: 'sender@test.invalid', to: 'receiver@test.invalid', messageId: '<timeout@client.test>', date: new Date() });
    await assert.rejects(sendSmtp(message, { host: '127.0.0.1', port: server.address().port, servername: 'localhost.test', ehlo: 'client.test', mode: 'tls', ca: pki.roots, timeoutMs: 100 }), /TIMEOUT/);
  } finally { for (const s of sockets) s.destroy(); await new Promise(resolve => server.close(resolve)); }
});
