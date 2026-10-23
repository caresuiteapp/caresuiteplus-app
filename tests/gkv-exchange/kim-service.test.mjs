import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KimMailstore } from '../../services/kim/mailstore.mjs';
import { Pop3Session } from '../../services/kim/pop3.mjs';

const address = 'sender@caresuite.kim.telematik-test', recipient = 'receiver@other.kim.telematik-test';
const password = 'local-fictional-password-2026';
async function setup(quotaBytes = 100_000) {
  const dir = await mkdtemp(join(tmpdir(), 'cs-kim-test-')), path = join(dir, 'kim.sqlite'), key = randomBytes(32);
  let now = Date.now(); const clock = () => now, store = new KimMailstore({ path, key, clock });
  await store.installAccount({ address, telematikId: 'test-only-no-real-ti-identity', password, quotaBytes });
  return { dir, path, key, clock, store, now: () => now, advance: n => now += n, close: async () => { store.close(); await rm(dir, { recursive: true, force: true }); } };
}
const bytes = Buffer.from('From: sender@caresuite.kim.telematik-test\r\nMessage-ID: <one@test.invalid>\r\n\r\n.local fixture\r\n');
async function login(store) {
  const p = new Pop3Session(store, { tlsVerified: true });
  assert.match((await p.command(`USER ${address}`)).toString(), /^\+OK/);
  assert.match((await p.command(`PASS ${password}`)).toString(), /^\+OK/); return p;
}
test('KIM password hashes and three-strike lock survive reopen; concurrent attempts cannot lose failure counts', async () => {
  const s = await setup();
  try {
    assert.equal(await s.store.authenticate(address, password), true);
    const second = new KimMailstore({ path: s.path, key: s.key, clock: s.clock });
    assert.deepEqual(await Promise.all([s.store.authenticate(address, 'wrong'), second.authenticate(address, 'wrong'), s.store.authenticate(address, 'wrong')]), [false, false, false]);
    assert.equal(await second.authenticate(address, password), false); second.close();
    const reopened = new KimMailstore({ path: s.path, key: s.key, clock: s.clock });
    assert.equal(await reopened.authenticate(address, password), false);
    s.advance(30_001); assert.equal(await reopened.authenticate(address, password), true);
    assert.equal(await reopened.authenticate('missing@caresuite.kim.telematik-test', password), false); reopened.close();
    assert.equal((await readFile(s.path)).includes(Buffer.from(password)), false);
  } finally { await s.close(); }
});
test('password changes require old credential and invalidate existing sessions', async () => {
  const s = await setup();
  try {
    const session = s.store.beginMailbox(address);
    await assert.rejects(s.store.changePassword(address, 'wrong', 'different-fictional-password'));
    await s.store.changePassword(address, password, 'different-fictional-password');
    assert.throws(() => s.store.touchMailbox(address, session.token), /SESSION/);
    assert.equal(await s.store.authenticate(address, password), false);
    assert.equal(await s.store.authenticate(address, 'different-fictional-password'), true);
  } finally { await s.close(); }
});
test('mail delivery quota and Message-ID conflicts are transactional; UID survives restart', async () => {
  const s = await setup(bytes.length);
  try {
    const message = { account: address, id: '<one@test.invalid>', bytes, expires: s.now() + 100_000 };
    const uid = s.store.deliver(message); assert.equal(s.store.deliver(message), uid);
    assert.throws(() => s.store.deliver({ ...message, bytes: Buffer.from('different') }), /CONFLICT/);
    assert.throws(() => s.store.deliver({ ...message, id: '<two@test.invalid>' }), /QUOTA/);
    const second = new KimMailstore({ path: s.path, key: s.key, clock: s.clock }), mailbox = second.beginMailbox(address);
    assert.equal(mailbox.messages[0].uid, uid); assert.deepEqual(second.readMessage(address, mailbox.token, uid), bytes);
    assert.throws(() => s.store.beginMailbox(address), /LOCKED/);
    second.endMailbox(address, mailbox.token); second.close();
  } finally { await s.close(); }
});
test('POP3 number/UID, dot transparency, RSET, QUIT and aborted deletion use the real durable mailstore', async () => {
  const s = await setup();
  try {
    const uid = s.store.deliver({ account: address, id: '<one@test.invalid>', bytes, expires: s.now() + 100_000 });
    let p = await login(s.store);
    assert.equal((await p.command('STAT')).toString(), `+OK 1 ${bytes.length}\r\n`);
    assert.equal((await p.command('UIDL 1')).toString(), `+OK 1 ${uid}\r\n`);
    assert.ok((await p.command('RETR 1')).toString().endsWith('\r\n..local fixture\r\n.\r\n'));
    await p.command('DELE 1'); assert.match((await p.command('RETR 1')).toString(), /^-ERR/);
    await p.command('RSET'); assert.match((await p.command('RETR 1')).toString(), /^\+OK/);
    await p.command('DELE 1'); p.disconnect();
    p = await login(s.store); assert.match((await p.command('STAT')).toString(), /^\+OK 1 /);
    await p.command('DELE 1'); assert.match((await p.command('QUIT')).toString(), /^\+OK/);
    p = await login(s.store); assert.equal((await p.command('STAT')).toString(), '+OK 0 0\r\n'); p.disconnect();
    assert.throws(() => new Pop3Session(s.store, { tlsVerified: false }), /TLS_REQUIRED/);
  } finally { await s.close(); }
});
test('expired mailbox owner cannot commit deletions after another session obtains the lock', async () => {
  const s = await setup();
  try {
    const uid = s.store.deliver({ account: address, id: '<one@test.invalid>', bytes, expires: s.now() + 2_000_000 });
    const old = s.store.beginMailbox(address); s.advance(900_001); const fresh = s.store.beginMailbox(address);
    assert.throws(() => s.store.endMailbox(address, old.token, [uid]), /SESSION/);
    assert.deepEqual(s.store.readMessage(address, fresh.token, uid), bytes); s.store.endMailbox(address, fresh.token);
  } finally { await s.close(); }
});
test('KAS opaque payloads have unguessable IDs, recipient/owner isolation, HEAD, quota and one-hour expiry grace', async () => {
  const s = await setup(100);
  try {
    // Opaque storage fixture, not a simulated successful KIM S/MIME signature.
    const cipherFixture = randomBytes(70), expires = s.now() + 10_000;
    const id = s.store.addAttachment({ owner: address, recipients: [recipient], bytes: cipherFixture, expires });
    assert.match(id, /^[a-f0-9-]{36}$/);
    const head = s.store.readAttachment(id, recipient, { head: true }); assert.equal(head.octets, 70); assert.equal(head.bytes, undefined);
    assert.deepEqual(s.store.readAttachment(id, recipient).bytes, cipherFixture);
    assert.throws(() => s.store.readAttachment(id, address), /FORBIDDEN/);
    assert.throws(() => s.store.addAttachment({ owner: address, recipients: [recipient], bytes: randomBytes(31), expires }), /QUOTA/);
    s.advance(10_001); assert.equal(s.store.readAttachment(id, recipient, { head: true }).octets, 70);
    s.advance(3_600_000); assert.throws(() => s.store.readAttachment(id, recipient), /FORBIDDEN/);
    assert.equal(s.store.purgeExpired().attachments, 1);
    const other = s.store.addAttachment({ owner: address, recipients: [recipient], bytes: randomBytes(70), expires: s.now() + 1000 });
    assert.equal(s.store.deleteAttachment(address, other), true); assert.throws(() => s.store.readAttachment(other, recipient));
  } finally { await s.close(); }
});
test('deactivation blocks credentials, mailbox access and further delivery', async () => {
  const s = await setup();
  try {
    const session = s.store.beginMailbox(address); s.store.deactivate(address);
    assert.equal(await s.store.authenticate(address, password), false);
    assert.throws(() => s.store.touchMailbox(address, session.token));
    assert.throws(() => s.store.deliver({ account: address, id: '<one@test.invalid>', bytes, expires: s.now() + 1000 }));
  } finally { await s.close(); }
});
