import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { X509Certificate, createPrivateKey, createHash, sign, constants } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { testPki } from './pki-fixture.mjs';
import { openssl } from '../../services/gkv/openssl.mjs';
import { certificateParts, der, fields } from '../../services/gkv/der.mjs';
import { tlv, sequence as seq, objectId as id, octets } from '../../services/kim/cms-codec.mjs';
import { PinnedOcspVerifier, OcspStatusCache, OcspError } from '../../services/kim/ocsp.mjs';
import { createEccKimMessage, receiveEccKimMessage } from '../../services/kim/client-message.mjs';
import { readMessage } from '../../services/kim/message.mjs';

const O = { basic: '2b0601050507300101', certHash: '2b2408030d', sha1: '2b0e03021a', sha256: '608648016503040201',
  sha384: '608648016503040202', sha512: '608648016503040203', ecdsa: '2a8648ce3d040302', pss: '2a864886f70d01010a' };
const digest = (b, a = 'sha256') => createHash(a).update(b).digest();
const sha = b => digest(b).toString('hex');
const raw = c => new X509Certificate(c).raw;
const stamp = n => new Date(n).toISOString().replace(/[-:T]/g, '').slice(0, 14) + 'Z';
const time = n => tlv(24, Buffer.from(typeof n === 'string' ? n : stamp(n)));
const ext = (oid, value, critical = false) => seq(id(oid), ...(critical ? [tlv(1, Buffer.from([255]))] : []), octets(value));
const pss = () => seq(id(O.pss), seq(tlv(160, seq(id(O.sha256))),
  tlv(161, seq(id('2a864886f70d010108'), seq(id(O.sha256)))), tlv(162, tlv(2, Buffer.from([32])))));
let pki, responder, rsa, wrong, badEku, leaf, other, now, key, rsaKey, wrongKey, wire, receiveOptions;
before(async () => {
  pki = await testPki();
  const startDate = stamp(Date.now() - 86_400_000);
  responder = await pki.issueOcsp({ startDate });
  rsa = await pki.issueOcsp({ name: 'ocsp-rsa', curve: 'rsa', startDate });
  wrong = await pki.issueOcsp({ name: 'ocsp-unpinned', startDate });
  badEku = await pki.issueOcsp({ name: 'ocsp-server-only', extendedUsage: 'serverAuth', startDate });
  leaf = await pki.issueKim({ name: 'status-leaf', role: 'osig' });
  other = await pki.issueAut({ name: 'other-leaf' });
  const readKey = async c => createPrivateKey({ key: await readFile(c.privateKeyPath), passphrase: pki.password });
  key = await readKey(responder); rsaKey = await readKey(rsa); wrongKey = await readKey(wrong);
  const encSender = await pki.issueKim({ name: 'status-enc-sender' }), encReceiver = await pki.issueKim({ name: 'status-enc-receiver' });
  now = Math.floor(Date.now() / 1000) * 1000;
  const sender = 'sender@local.kim.telematik-test', recipient = 'receiver@local.kim.telematik-test';
  wire = createEccKimMessage({ message: Buffer.from(`From: ${sender}\r\nTo: ${recipient}\r\nSubject: Local OCSP test\r\nMIME-Version: 1.0\r\nContent-Type: text/plain\r\n\r\nPRIVATE TEST CONTENT\r\n`),
    sender, envelopeRecipients: [recipient], recipients: [{ address: sender, certificate: encSender.certificate }, { address: recipient, certificate: encReceiver.certificate }],
    signingCertificate: leaf.certificate, signingKey: await readKey(leaf), authCertificate: other.certificate, authKey: await readKey(other), cmVersion: 'TEST_0.1.0', ptVersion: '1.5.5', now });
  receiveOptions = { bytes: wire.bytes, address: recipient, recipientCertificate: encReceiver.certificate, privateKey: await readKey(encReceiver),
    expectedSignerCertificate: leaf.certificate, expectedAuthCertificate: other.certificate, now };
});
after(async () => { await pki?.close(); });
const pinned = c => ({ certificate: c, sha256: sha(raw(c)) });
function checker({ signer = responder, clock = () => now, validFrom = now - 7200_000, validUntil = now + 7200_000, authorities } = {}) {
  return new PinnedOcspVerifier({ authorities: authorities ?? [{ issuer: pinned(pki.roots), responder: pinned(signer.certificate) }], validFrom, validUntil, clock });
}
function identity({ certificate = leaf.certificate, hash = 'sha256', nullParameters = false, nameHash, keyHash, serial } = {}) {
  const c = certificateParts(raw(certificate)), issuer = certificateParts(raw(pki.roots)), bits = fields(issuer.tbs[6], 48, 2)[1].value.subarray(1);
  return seq(seq(id(O[hash]), ...(nullParameters ? [tlv(5, Buffer.alloc(0))] : [])),
    octets(nameHash ?? digest(c.issuer, hash)), octets(keyHash ?? digest(bits, hash)), serial ?? c.serial);
}
function single(options = {}) {
  const { certificate = leaf.certificate, state = 'good', hashName = 'sha256', hashBytes, omitHash = false,
    singleExtensions = [], thisUpdate = now - 1000, nextUpdate = now + 600_000, revokedAt = now - 10_000,
    reason, certificateId = identity(options) } = options;
  const status = state === 'revoked' ? tlv(161, Buffer.concat([time(revokedAt),
    ...(reason !== undefined ? [tlv(160, tlv(10, Buffer.from([reason])))] : [])])) : tlv(state === 'unknown' ? 130 : 128, Buffer.alloc(0));
  const exts = [...(omitHash ? [] : [ext(O.certHash, seq(seq(id(O[hashName])), octets(hashBytes ?? digest(raw(certificate), hashName))))]), ...singleExtensions];
  return seq(certificateId, status, time(thisUpdate), ...(nextUpdate === null ? [] : [tlv(160, time(nextUpdate))]),
    ...(exts.length ? [tlv(161, seq(...exts))] : []));
}
function response(options = {}) {
  const { signer = responder, signingKey = key, algorithm = seq(id(O.ecdsa)), byKey = false, producedAt = now,
    singles = [single(options)], responseExtensions = [], included = [raw(signer.certificate)], badSignature = false,
    responderId, rsaPadding = constants.RSA_PKCS1_PSS_PADDING } = options;
  const cert = certificateParts(raw(signer.certificate));
  const rid = responderId ?? (byKey ? tlv(162, octets(digest(fields(cert.tbs[6], 48, 2)[1].value.subarray(1), 'sha1'))) : tlv(161, cert.subject.raw));
  const data = seq(rid, time(producedAt), seq(...singles), ...(responseExtensions.length ? [tlv(161, seq(...responseExtensions))] : []));
  const signature = sign('sha256', data, signingKey.asymmetricKeyType === 'rsa'
    ? { key: signingKey, padding: rsaPadding, saltLength: 32 } : { key: signingKey, dsaEncoding: 'der' });
  if (badSignature) signature[signature.length - 1] ^= 1;
  const basic = seq(data, algorithm, tlv(3, Buffer.concat([Buffer.from([0]), signature])), ...(included.length ? [tlv(160, seq(...included))] : []));
  return seq(tlv(10, Buffer.from([0])), tlv(160, seq(id(O.basic), octets(basic))));
}
function check(bytes = response(), changes = {}, verifier = checker()) {
  const certificate = changes.certificate ?? leaf.certificate;
  return verifier.verify({ certificate, request: verifier.createRequest(certificate), response: bytes, ...changes });
}
const fails = (fn, code) => assert.throws(fn, e => e instanceof OcspError && e.code === code && e.message === code);

test('OCSP request contains exactly one certificate and no requester, signature or extensions; OpenSSL decodes the actual bytes', async () => {
  const request = checker().createRequest(leaf.certificate), file = join(pki.dir, 'request.der');
  await writeFile(file, request);
  const cli = (await openssl(['ocsp', '-reqin', file, '-req_text'])).toString();
  assert.match(cli, /Hash Algorithm: sha256/); assert.doesNotMatch(cli, /Requestor Name:|Request Extensions:|Signature Algorithm:/);
  assert.deepEqual(request, seq(seq(seq(seq(identity())))));
  assert.equal((cli.match(/Certificate ID:/g) ?? []).length, 1);
});
test('good evidence checks signature, exact CertID and whole-certificate hash but never asserts TI identity', () => {
  const b = response(), r = check(b);
  assert.equal(r.status, 'good'); assert.equal(r.trustSource, 'configured-pins'); assert.equal(r.identityStatus, 'unverified');
  assert.equal(r.certificateSha256, sha(raw(leaf.certificate))); assert.equal(r.responseSha256, sha(b));
  assert.equal(r.validUntil, now + 3600_001); assert(Object.isFrozen(r));
});
test('OpenSSL independently verifies generated response signature and serial status with an explicitly trusted fixture responder', async () => {
  const b = response(), path = join(pki.dir, 'verified-response.der'); await writeFile(path, b);
  const cli = (await openssl(['ocsp', '-respin', path, '-issuer', join(pki.dir, 'root.pem'), '-sha256', '-cert', leaf.path,
    '-verify_other', responder.path, '-trust_other', '-no_intern', '-no_nonce', '-no-CAfile', '-no-CApath', '-no-CAstore'])).toString();
  assert.match(cli, /: good\s/); assert.equal(check(b).status, 'good');
});
test('byKey identifies only the pinned signing key; an embedded replacement certificate does not become trusted', () => {
  assert.equal(check(response({ byKey: true, included: [] })).status, 'good');
  fails(() => check(response({ signer: wrong, signingKey: wrongKey, byKey: true })), 'KIM_OCSP_RESPONDER');
  // Same subject DN with another key must still fail the signature test.
  fails(() => check(response({ signer: wrong, signingKey: wrongKey })), 'KIM_OCSP_SIGNATURE');
});
test('RSA-PSS/SHA256 responder is supported; RSA PKCS1 signature and altered PSS parameters are not', () => {
  const v = checker({ signer: rsa });
  assert.equal(check(response({ signer: rsa, signingKey: rsaKey, algorithm: pss() }), {}, v).status, 'good');
  fails(() => check(response({ signer: rsa, signingKey: rsaKey, algorithm: seq(id('2a864886f70d01010b'), tlv(5, Buffer.alloc(0))), rsaPadding: constants.RSA_PKCS1_PADDING }), {}, v), 'KIM_OCSP_ALGORITHM');
  const a = pss(); a[a.length - 1] = 20;
  fails(() => check(response({ signer: rsa, signingKey: rsaKey, algorithm: a }), {}, v), 'KIM_OCSP_FORMAT');
});
test('SHA1 is only an identifier option; NULL and absent algorithm parameters normalize to the same requested CertID', () => {
  const v = checker();
  for (const hash of ['sha1', 'sha256']) for (const nullParameters of [false, true]) {
    assert.equal(check(response({ hash, nullParameters }), { request: v.createRequest(leaf.certificate, { hashAlgorithm: hash }) }, v).status, 'good');
  }
  fails(() => v.createRequest(leaf.certificate, { hashAlgorithm: 'md5' }), 'KIM_OCSP_ALGORITHM');
  fails(() => check(response({ hash: 'sha1' })), 'KIM_OCSP_RESPONSE_BINDING');
});
test('a response for another serial, issuer name, issuer key, or request cannot authorize the checked certificate', () => {
  for (const o of [{ certificate: other.certificate }, { nameHash: Buffer.alloc(32) }, { keyHash: Buffer.alloc(32) }]) {
    fails(() => check(response(o)), 'KIM_OCSP_RESPONSE_BINDING');
  }
  fails(() => check(response(), { request: checker().createRequest(other.certificate) }), 'KIM_OCSP_REQUEST_BINDING');
});
test('certHash is mandatory for good and revoked; SHA256/384/512 are supported and SHA1 is rejected', () => {
  for (const state of ['good', 'revoked']) {
    fails(() => check(response({ state, omitHash: true })), 'KIM_OCSP_CERTHASH_MISSING');
    fails(() => check(response({ state, hashBytes: Buffer.alloc(32) })), 'KIM_OCSP_CERTHASH_MISMATCH');
  }
  for (const hashName of ['sha256', 'sha384', 'sha512']) assert.equal(check(response({ hashName })).status, 'good');
  fails(() => check(response({ hashName: 'sha1' })), 'KIM_OCSP_ALGORITHM');
});
test('revoked and unknown remain explicit negative statuses; an unknown certificate needs no certHash', () => {
  const r = check(response({ state: 'revoked', reason: 1 }));
  assert.equal(r.status, 'revoked'); assert.equal(r.revokedAt, now - 10_000); assert.equal(r.reason, 1);
  assert.equal(check(response({ state: 'unknown', omitHash: true })).status, 'unknown');
  fails(() => check(response({ state: 'revoked', reason: 7 })), 'KIM_OCSP_FORMAT');
});
test('freshness follows producedAt at inclusive one-hour/five-minute boundaries, independent of old thisUpdate/nextUpdate', () => {
  for (const producedAt of [now - 3600_000, now + 300_000]) {
    assert.equal(check(response({ producedAt, thisUpdate: now - 86400_000, nextUpdate: now - 7200_000 })).status, 'good');
  }
  fails(() => check(response({ producedAt: now - 3601_000 })), 'KIM_OCSP_STALE');
  fails(() => check(response({ producedAt: now + 301_000 })), 'KIM_OCSP_STALE');
  assert.equal(check(response({ nextUpdate: null })).status, 'good');
});
test('invalid calendar values, time encoding and leap seconds do not normalize into accepted timestamps', () => {
  for (const value of ['20260230010000Z', '20261021015960Z', '20261021010000+0000', '20261021010000.0Z']) {
    fails(() => check(response({ producedAt: value })), 'KIM_OCSP_TIME_FORMAT');
  }
});
test('snapshot expiry, future snapshot and expired leaf never fall back to embedded certificates or system roots', () => {
  fails(() => check(response(), {}, checker({ validUntil: now })), 'KIM_OCSP_TRUST_UNAVAILABLE');
  fails(() => check(response(), {}, checker({ validFrom: now + 1 })), 'KIM_OCSP_TRUST_UNAVAILABLE');
  const later = now + 8 * 86400_000;
  fails(() => checker({ validFrom: later - 1000, validUntil: later + 1000, clock: () => later }).createRequest(leaf.certificate), 'KIM_OCSP_CERTIFICATE');
});
test('invalid pins, CA-as-responder, incorrect EKU, duplicate authorizations and oversized snapshots are rejected', () => {
  const authority = { issuer: pinned(pki.roots), responder: pinned(responder.certificate) };
  for (const authorities of [[], [authority, authority], [{ ...authority, responder: pinned(pki.roots) }],
    [{ ...authority, responder: pinned(badEku.certificate) }], [{ ...authority, issuer: { ...authority.issuer, sha256: '0'.repeat(64) } }]]) {
    fails(() => checker({ authorities }), 'KIM_OCSP_CONFIGURATION');
  }
  fails(() => checker({ validFrom: now - 1, validUntil: now + 86400_000 }), 'KIM_OCSP_CONFIGURATION');
});
test('a modified signature or a response signed over different data cannot pass', () => {
  fails(() => check(response({ badSignature: true })), 'KIM_OCSP_SIGNATURE');
  const b = response(), mark = b.indexOf(Buffer.from(stamp(now))); assert(mark > 0); b[mark + 13] ^= 1;
  fails(() => check(b), 'KIM_OCSP_SIGNATURE');
});
test('additional status records are bounded, all structures are parsed, and duplicate CertIDs are rejected', () => {
  assert.equal(check(response({ singles: [single({ certificate: other.certificate }), single()] })).status, 'good');
  fails(() => check(response({ singles: [single(), single({ nullParameters: true })] })), 'KIM_OCSP_FORMAT');
  fails(() => check(response({ singles: [] })), 'KIM_OCSP_FORMAT');
  fails(() => check(response({ singles: Array.from({ length: 101 }, () => single()) })), 'KIM_OCSP_FORMAT');
});
test('critical unknown and duplicate extensions are rejected; noncritical opaque extensions cannot override status', () => {
  const harmless = ext('2a0304', Buffer.from([5, 0]));
  assert.equal(check(response({ singleExtensions: [harmless], responseExtensions: [harmless] })).status, 'good');
  fails(() => check(response({ singleExtensions: [ext('2a0304', Buffer.alloc(0), true)] })), 'KIM_OCSP_CRITICAL_EXTENSION');
  fails(() => check(response({ responseExtensions: [ext('2a0304', Buffer.alloc(0), true)] })), 'KIM_OCSP_CRITICAL_EXTENSION');
  fails(() => check(response({ singleExtensions: [ext(O.certHash, Buffer.from([5, 0]))] })), 'KIM_OCSP_FORMAT');
});
test('protocol errors, trailing data, indefinite DER and response-size limits have fixed codes without native details', () => {
  for (const status of [1, 2, 3, 5, 6]) fails(() => check(seq(tlv(10, Buffer.from([status])))), 'KIM_OCSP_RESPONDER_ERROR');
  for (const b of [Buffer.concat([response(), Buffer.from([0])]), Buffer.from([48, 128, 0, 0]), Buffer.from([48, 0])]) fails(() => check(b), 'KIM_OCSP_FORMAT');
  fails(() => check(Buffer.alloc(262145)), 'KIM_OCSP_SIZE');
});
test('OpenSSL-produced response is decoded and signature checked, then rejected for its missing TI certHash', async () => {
  const req = join(pki.dir, 'cli-request.der'), res = join(pki.dir, 'cli-response.der');
  await writeFile(req, checker().createRequest(leaf.certificate));
  await openssl(['ocsp', '-index', join(pki.dir, 'index'), '-CA', join(pki.dir, 'root.pem'), '-rsigner', responder.path,
    '-rkey', responder.privateKeyPath, '-passin', 'fd:3', '-rmd', 'sha256', '-reqin', req, '-respout', res, '-resp_key_id'], { password: pki.password });
  const cliBytes = await readFile(res);
  fails(() => check(cliBytes), 'KIM_OCSP_CERTHASH_MISSING');
});
test('cache reuses both good and negative evidence, coalesces concurrent checks and returns immutable metadata', async () => {
  for (const state of ['good', 'revoked', 'unknown']) {
    let calls = 0;
    const cache = new OcspStatusCache({ verifier: checker(), clock: () => now });
    try {
      const obtain = async request => { calls++; assert.deepEqual(request, checker().createRequest(leaf.certificate)); return response({ state }); };
      const [a, b] = await Promise.all([cache.check({ certificate: leaf.certificate, obtain }), cache.check({ certificate: leaf.certificate, obtain })]);
      assert.equal(calls, 1); assert.equal(a.status, state); assert.deepEqual(a, b); assert(Object.isFrozen(a));
      const c = await cache.check({ certificate: leaf.certificate, obtain }); assert.equal(c.source, 'cache'); assert.equal(calls, 1);
    } finally { cache.close(); }
  }
});
test('expired cache evidence is pruned and refreshed; unknown transport outcomes are never cached as good', async () => {
  let clock = now, calls = 0;
  const v = checker({ clock: () => clock }), cache = new OcspStatusCache({ verifier: v, clock: () => clock });
  try {
    const obtain = async () => { calls++; return response({ producedAt: clock }); };
    await cache.check({ certificate: leaf.certificate, obtain }); clock += 3600_001;
    await assert.rejects(cache.check({ certificate: leaf.certificate, obtain: async () => { throw new Error('secret URL/token'); } }), { message: 'KIM_OCSP_UNAVAILABLE' });
    assert.equal(cache.prune(), 0);
    assert.equal((await cache.check({ certificate: leaf.certificate, obtain })).source, 'response'); assert.equal(calls, 2);
  } finally { cache.close(); }
});
test('cache cannot retain evidence past snapshot expiry or silently evict fresh entries at its capacity', async () => {
  let clock = now;
  const cache = new OcspStatusCache({ verifier: checker({ clock: () => clock, validUntil: now + 1000 }), clock: () => clock, maxEntries: 1 });
  try {
    await cache.check({ certificate: leaf.certificate, obtain: async () => response() });
    await assert.rejects(cache.check({ certificate: other.certificate, obtain: async () => response({ certificate: other.certificate }) }), { code: 'KIM_OCSP_CACHE_CAPACITY' });
    clock += 1000;
    await assert.rejects(cache.check({ certificate: leaf.certificate, obtain: async () => response() }), { code: 'KIM_OCSP_TRUST_UNAVAILABLE' });
    assert.equal(cache.prune(), 0);
  } finally { cache.close(); }
});
test('cache timeout aborts the callback and close aborts pending checks without accepting late responses', async () => {
  const cache = new OcspStatusCache({ verifier: checker(), clock: () => now, timeoutMs: 50 }); let signal, release;
  const waiting = cache.check({ certificate: leaf.certificate, obtain: (_, s) => { signal = s; return new Promise(resolve => { release = resolve; }); } });
  await assert.rejects(waiting, { code: 'KIM_OCSP_TIMEOUT' }); assert.equal(signal.aborted, true);
  release(response()); await new Promise(resolve => setImmediate(resolve)); assert.equal(cache.prune(), 0);
  let startedAfterClose = false;
  const pending = cache.check({ certificate: leaf.certificate, obtain: () => { startedAfterClose = true; return new Promise(() => {}); } });
  cache.close(); await assert.rejects(pending, { code: 'KIM_OCSP_CACHE_CLOSED' });
  assert.equal(startedAfterClose, false);
  await assert.rejects(cache.check({ certificate: leaf.certificate }), { code: 'KIM_OCSP_CACHE_CLOSED' });
});

function receive(statusOptions = {}, overrides = {}) {
  const verifier = checker(), signing = { request: verifier.createRequest(leaf.certificate), response: response(statusOptions) },
    authentication = { request: verifier.createRequest(other.certificate), response: response({ certificate: other.certificate }) };
  return receiveEccKimMessage({ ...receiveOptions, ocsp: { verifier, signing, authentication, ...overrides } }, { cmVersion: 'TEST_0.1.0', ptVersion: '1.5.5' });
}
test('receiver attaches bound OCSP evidence for the actual OSIG/AUT leaves; two good statuses still cannot grant TI trust', () => {
  const result = receive();
  assert.equal(result.kind, 'diagnostic'); assert.equal(result.diagnostic.integrityResult, '07');
  assert.equal(result.identityStatus, 'unverified'); assert.equal(result.deliveryStatus, 'diagnostic-only');
  assert.equal(result.originalSha256, sha(wire.bytes)); assert.equal(result.diagnostic.decryptedOriginalAttached, false);
  assert.deepEqual(result.diagnostic.certificateStatus.map(s => [s.purpose, s.status, s.certificateSha256]), [
    ['signing', 'good', sha(raw(leaf.certificate))], ['authentication', 'good', sha(raw(other.certificate))]]);
  assert.equal(readMessage(result.bytes).one('x-kim-integritycheckresult'), '07');
});
test('receiver rejects revoked OSIG and unknown AUT status with explicit diagnostics and no positive integrity header', () => {
  const revoked = receive({ state: 'revoked' });
  assert.equal(revoked.diagnostic.errorCode, 'XCS_CERT_STATUS'); assert.equal(revoked.diagnostic.certificateStatus[0].status, 'revoked');
  const verifier = checker(), authentication = { request: verifier.createRequest(other.certificate), response: response({ certificate: other.certificate, state: 'unknown', omitHash: true }) };
  const unknown = receive({}, { authentication });
  assert.equal(unknown.diagnostic.errorCode, 'XCS_CERT_STATUS'); assert.equal(unknown.diagnostic.certificateStatus[1].status, 'unknown');
  for (const r of [revoked, unknown]) { assert.equal(r.diagnostic.decryptedOriginalAttached, false); assert.equal(readMessage(r.bytes).one('x-kim-integritycheckresult'), 'XCS_CERT_STATUS'); }
});
test('receiver reports invalid/mismatched evidence and forged caller status objects without accepting a boolean trust assertion', () => {
  const verifier = checker(), request = verifier.createRequest(other.certificate);
  const mismatch = receive({}, { signing: { request, response: response({ certificate: other.certificate }) } });
  assert.equal(mismatch.diagnostic.certificateStatus[0].code, 'KIM_OCSP_REQUEST_BINDING');
  const fake = receive({}, { verifier: { verify: () => ({ status: 'good', identityStatus: 'verified' }) } });
  assert(fake.diagnostic.certificateStatus.every(s => s.status === 'unavailable' && s.code === 'KIM_OCSP_CONFIGURATION'));
  const tampered = receive({ badSignature: true }); assert.equal(tampered.diagnostic.certificateStatus[0].code, 'KIM_OCSP_SIGNATURE');
  assert.equal(tampered.diagnostic.errorCode, 'XCS_CERT_STATUS');
  const nullProof = receiveEccKimMessage({ ...receiveOptions, ocsp: null }, { cmVersion: 'TEST_0.1.0', ptVersion: '1.5.5' });
  assert.equal(nullProof.diagnostic.errorCode, 'XCS_CERT_STATUS');
});
