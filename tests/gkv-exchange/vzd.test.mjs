import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { setImmediate as tick } from 'node:timers/promises';
import { testPki } from './pki-fixture.mjs';
import { vzdFixture, record, entryReply, searchDone } from './vzd-fixture.mjs';
import { VzdLdapsDirectory, lookupVzd } from '../../services/kim/vzd.mjs';
import { tlv, sequence, octets } from '../../services/kim/cms-codec.mjs';
import { fields } from '../../services/gkv/der.mjs';

let pki, enc;
const address = 'receiver@local.kim.telematik-test', code = c => e => e?.code === c;
before(async () => { pki = await testPki(); enc = await pki.issueKim({ name: 'directory-enc' }); });
after(async () => pki?.close());
const attributes = () => record(address, [enc.certificate]);
async function fixture(run, handler = ({ socket }) => socket.write(Buffer.concat([entryReply(attributes()), searchDone()])), changes) {
  const f = await vzdFixture(pki, handler, changes); try { await run(f); } finally { await f.close(); }
}
async function rejectRecord(change, expected) {
  await fixture(async ({ directory }) => assert.rejects(directory.lookup(address), code(expected)), ({ socket }) => {
    socket.write(Buffer.concat([entryReply(change(attributes())), searchDone()]));
  });
}

test('VZD: real verified LDAPS, anonymous LDAPv3 bind and bounded subtree query', async () => fixture(async ({ directory, requests }) => {
  const r = await directory.lookup(address.toUpperCase());
  assert.equal(r.address, address); assert.equal(r.telematikId, '10-LOCAL-TEST');
  assert.deepEqual(r.certificates, [new X509Certificate(enc.certificate).raw]); assert.equal(r.version, '1.5');
  assert.equal(r.identityStatus, 'unverified'); assert.equal(r.trustSource, 'configured-ldaps-peer');
  assert.match(r.serverSha256, /^[a-f0-9]{64}$/); assert.ok(r.checkedAt <= Date.now());
  assert.equal(requests[0].bytes.toString('hex'), '300c020101600702010304008000');
  assert.equal(requests.length, 2);
}, ({ socket, request }) => {
  assert.equal(request[0].value.toString(), 'dc=data,dc=vzd');
  assert.equal(request[1].value[0], 2); assert.equal(request[2].value[0], 0);
  assert.equal(request[3].value[0], 2); assert.equal(request[4].value[0], 10); assert.equal(request[5].value[0], 0);
  assert.deepEqual(fields(request[7], 48).map(x => x.value.toString()), ['telematikID', 'mail', 'kimData', 'komLeData', 'userCertificate;binary']);
  socket.write(Buffer.concat([entryReply(attributes()), searchDone()]));
}));

test('VZD: kimData-only address, capabilities and application tags survive fragmented responses', async () => fixture(async ({ directory }) => {
  const r = await directory.lookup(address); assert.equal(r.version, '1.5+'); assert.deepEqual(r.appTags, ['DALE-UV', 'eEB']);
}, async ({ socket }) => {
  const a = attributes().filter(([n]) => n !== 'mail'); a.find(([n]) => n === 'kimData')[1] = [address + ',1.5+,DALE-UV|eEB'];
  const bytes = Buffer.concat([entryReply(a), searchDone()]);
  for (let i = 0; i < bytes.length; i += 7) { socket.write(bytes.subarray(i, i + 7)); await tick(); }
}));

test('VZD: literal wildcard mailbox cannot widen the equality or kimData prefix assertion', async () => fixture(async ({ directory }) => {
  const r = await directory.lookup('*@local.kim.telematik-test'); assert.equal(r.address, '*@local.kim.telematik-test');
}, ({ socket, address: wanted, request }) => {
  const filter = fields(request[6], 0xa1, 2), prefix = fields(filter[1], 0xa4, 2);
  assert.equal(prefix[0].value.toString(), 'kimData');
  assert.equal(fields(prefix[1], 48, 1)[0].value.toString(), '*@local.kim.telematik-test,');
  socket.write(Buffer.concat([entryReply(record(wanted, [enc.certificate])), searchDone()]));
}));

test('VZD: mail-only records default to 1.0; komLeData can supply the version', async () => {
  for (const version of [undefined, '1.5']) await fixture(async ({ directory }) => {
    assert.equal((await directory.lookup(address)).version, version ?? '1.0');
  }, ({ socket }) => {
    const a = attributes().filter(([n]) => n !== 'kimData'); if (version) a.push(['komLeData', [version + ',' + address]]);
    socket.write(Buffer.concat([entryReply(a), searchDone()]));
  });
});

test('VZD: LDAP BER non-minimal definite lengths are accepted independently of DER certificates', async () => fixture(async ({ directory }) => {
  assert.equal((await directory.lookup(address)).telematikId, '10-LOCAL-TEST');
}, ({ socket }) => {
  const done = searchDone(); socket.write(Buffer.concat([entryReply(attributes()), Buffer.from([48, 0x82, 0, 12]), done.subarray(2)]));
}));

for (const [name, change, expected] of [
  ['duplicate identity attribute', a => [...a, ['TelematikID', ['10-OTHER']]], 'ENTRY_FORMAT'],
  ['multiple identity values', a => a.map(([n, v]) => [n, n === 'telematikID' ? ['10-LOCAL-TEST', '10-OTHER'] : v]), 'ENTRY_FORMAT'],
  ['missing identity', a => a.filter(([n]) => n !== 'telematikID'), 'ENTRY_IDENTITY'],
  ['control character identity', a => a.map(([n, v]) => [n, n === 'telematikID' ? ['10-LOCAL\nTEST'] : v]), 'LDAP_FORMAT'],
  ['malformed UTF8 identity', a => a.map(([n, v]) => [n, n === 'telematikID' ? [Buffer.from([0xc3, 0x28])] : v]), 'LDAP_FORMAT'],
  ['unrelated address', a => a.map(([n, v]) => [n, n === 'mail' ? ['other@local.kim.telematik-test'] : n === 'kimData' ? ['other@local.kim.telematik-test,1.5'] : v]), 'ADDRESS_MISMATCH'],
  ['komLeData alone is not ownership', a => [...a.filter(([n]) => !['mail', 'kimData'].includes(n)), ['komLeData', ['1.5,' + address]]], 'ADDRESS_MISMATCH'],
  ['duplicate modern address', a => a.map(([n, v]) => [n, n === 'kimData' ? [address + ',1.5', address.toUpperCase() + ',1.0'] : v]), 'ENTRY_FORMAT'],
  ['contradictory version', a => [...a, ['komLeData', ['1.0,' + address]]], 'ENTRY_CONFLICT'],
  ['unsupported version', a => a.map(([n, v]) => [n, n === 'kimData' ? [address + ',9.9'] : v]), 'ENTRY_FORMAT'],
  ['duplicate application tag', a => a.map(([n, v]) => [n, n === 'kimData' ? [address + ',1.5,eEB|eEB'] : v]), 'ENTRY_FORMAT'],
  ['missing certificates', a => a.filter(([n]) => n !== 'userCertificate;binary'), 'CERTIFICATES'],
  ['duplicate certificate bytes', a => a.map(([n, v]) => [n, n === 'userCertificate;binary' ? [...v, ...v] : v]), 'CERTIFICATES'],
  ['certificate option alias duplicate', a => [...a, ['userCertificate', [new X509Certificate(enc.certificate).raw]]], 'ENTRY_FORMAT'],
  ['oversized certificate', a => a.map(([n, v]) => [n, n === 'userCertificate;binary' ? [Buffer.alloc(12001)] : v]), 'ENTRY_FORMAT'],
  ['too many certificates', a => a.map(([n, v]) => [n, n === 'userCertificate;binary' ? Array(51).fill(v[0]) : v]), 'ENTRY_FORMAT'],
  ['providedBy never substitutes an identity', a => [...a.filter(([n]) => n !== 'telematikID'), ['providedBy', ['10-LOCAL-TEST']]], 'ENTRY_FORMAT'],
]) test('VZD rejects ' + name, async () => rejectRecord(change, 'KIM_VZD_' + expected));

test('VZD: multiple entries are ambiguous even when their IDs agree', async () => fixture(async ({ directory }) => {
  await assert.rejects(directory.lookup(address), code('KIM_VZD_AMBIGUOUS'));
}, ({ socket }) => socket.write(Buffer.concat([entryReply(attributes()), entryReply(attributes()), searchDone()]))));

test('VZD: a partial entry followed by size/time-limit result is never returned', async () => {
  for (const status of [3, 4, 10, 50]) await fixture(async ({ directory }) => {
    await assert.rejects(directory.lookup(address), code('KIM_VZD_LDAP_RESULT'));
  }, ({ socket }) => socket.write(Buffer.concat([entryReply(attributes()), searchDone(status)])));
});

for (const [name, reply, expected] of [
  ['empty result', () => searchDone(), 'NOT_FOUND'],
  ['search referral', () => sequence(tlv(2, Buffer.from([2])), tlv(0x73, octets(Buffer.from('ldaps://untrusted.invalid/')))), 'LDAP_REFERRAL'],
  ['wrong message ID', () => { const b = searchDone(); b[4] = 9; return b; }, 'LDAP_MESSAGE'],
  ['indefinite BER', () => Buffer.from([48, 128, 0, 0]), 'LDAP_FORMAT'],
  ['oversized frame header', () => Buffer.from([48, 0x84, 0, 0x30, 0, 0]), 'RESPONSE_SIZE'],
  ['extra frame after completion', () => Buffer.concat([entryReply(attributes()), searchDone(), searchDone()]), 'LDAP_MESSAGE'],
]) test('VZD rejects ' + name, async () => fixture(async ({ directory }) => {
  await assert.rejects(directory.lookup(address), code('KIM_VZD_' + expected));
}, ({ socket }) => socket.write(reply())));

test('VZD: truncated streams, absolute timeout and caller cancellation cannot yield partial records', async () => {
  await fixture(async ({ directory }) => assert.rejects(directory.lookup(address), code('KIM_VZD_INCOMPLETE')), ({ socket }) => socket.end(entryReply(attributes()).subarray(0, 30)));
  await fixture(async ({ directory }) => assert.rejects(directory.lookup(address), code('KIM_VZD_TIMEOUT')), ({ socket }) => socket.write(entryReply(attributes())), { client: { timeoutMs: 50 } });
  const controller = new AbortController();
  await fixture(async ({ directory }) => assert.rejects(directory.lookup(address, { signal: controller.signal }), code('KIM_VZD_ABORTED')), () => controller.abort());
});

test('VZD: wrong TLS pin, hostname or CA prevents any LDAP data', async () => fixture(async ({ options, requests }) => {
  for (const change of [{ serverSha256: '0'.repeat(64) }, { url: options.url.replace('localhost.test', 'other.test') }, { ca: enc.certificate }]) {
    if (change.ca) assert.throws(() => new VzdLdapsDirectory({ ...options, ...change }), code('KIM_VZD_CONFIGURATION'));
    else await assert.rejects(new VzdLdapsDirectory({ ...options, ...change }).lookup(address), e => ['KIM_VZD_TLS_PEER', 'KIM_VZD_CONNECTION'].includes(e?.code));
  }
  assert.equal(requests.length, 0);
}));

test('VZD: invalid routes, environment crossover and pre-aborted calls do not send a lookup', async () => fixture(async ({ options, directory, requests }) => {
  for (const url of ['ldap://localhost.test', 'ldaps://user:secret@localhost.test', 'ldaps://localhost.test/dc=other', 'ldaps://localhost.test?filter=x']) {
    assert.throws(() => new VzdLdapsDirectory({ ...options, url }), code('KIM_VZD_CONFIGURATION'));
  }
  assert.throws(() => new VzdLdapsDirectory({ ...options, ca: undefined }), code('KIM_VZD_CONFIGURATION'));
  await assert.rejects(directory.lookup(address.replace('-test', '')), code('KIM_VZD_ENVIRONMENT'));
  await assert.rejects(directory.lookup(address, { signal: AbortSignal.abort() }), code('KIM_VZD_ABORTED'));
  await assert.rejects(directory.lookup('x*)(uid=*)@local.kim.telematik-test'), code('KIM_VZD_ADDRESS'));
  assert.equal(requests.length, 0);
}));

test('VZD: lookup overrides and forged instances cannot supply fabricated records', async () => fixture(async ({ options, requests }) => {
  class FakeDirectory extends VzdLdapsDirectory { lookup() { return { telematikId: '10-FORGED' }; } }
  assert.equal((await lookupVzd(new FakeDirectory(options), address)).telematikId, '10-LOCAL-TEST');
  assert.equal(requests.length, 2);
  await assert.rejects(lookupVzd(Object.create(VzdLdapsDirectory.prototype), address), TypeError);
}));

test('VZD: per-instance concurrent socket limit is enforced and released on abort', async () => fixture(async ({ directory }) => {
  const stop = new AbortController(), pending = Array.from({ length: 8 }, () => directory.lookup(address, { signal: stop.signal }));
  await assert.rejects(directory.lookup(address), code('KIM_VZD_BUSY')); stop.abort();
  const results = await Promise.allSettled(pending); assert.ok(results.every(r => r.status === 'rejected' && r.reason.code === 'KIM_VZD_ABORTED'));
  assert.equal((await directory.lookup(address)).telematikId, '10-LOCAL-TEST');
}));
