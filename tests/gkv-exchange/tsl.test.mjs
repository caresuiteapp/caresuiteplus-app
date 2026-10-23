import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, X509Certificate, generateKeyPairSync } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { TslTrustSnapshot, TSL_SCHEMA_SHA256 } from '../../services/kim/tsl.mjs';
import { TslTrustStore } from '../../services/kim/tsl-store.mjs';
import { der, fields } from '../../services/gkv/der.mjs';
import { openssl, privateWorkspace } from '../../services/gkv/openssl.mjs';
import { tslFixture, CA, OCSP, ACTIVE, REVOKED } from './tsl-fixture.mjs';

let f, base, v;
before(async () => { f = await tslFixture(); base = await f.bundle(); v = f.verifier(); });
after(async () => { await f?.close(); });
const rejected = code => error => error?.code === code;
const altered = async transform => {
  const xml = Buffer.from(transform(base.xml.toString('utf8')));
  return { ...base, xml, detachedSignature: await f.detach(xml) };
};

test('TSL: status lookup preparation authenticates the raw bundle but never returns a trust snapshot', async () => {
  const prepared = v.prepareSignerStatus(base);
  assert.deepEqual(prepared.certificate, new X509Certificate(f.signer.certificate).raw);
  assert.deepEqual(prepared.request, base.signerStatus.request);
  assert.equal(prepared.identityStatus, 'unverified'); assert.equal(prepared instanceof TslTrustSnapshot, false);
  assert.throws(() => v.prepareSignerStatus({ ...base, xml: Buffer.from('untrusted XML') }), rejected('KIM_TSL_DETACHED_SIGNATURE'));
});
async function storeFixture(run, verifier = v) {
  const dir = await mkdtemp(join(tmpdir(), 'cs-tsl-store-')), path = join(dir, 'tsl.db'), key = randomBytes(32), scopeId = randomUUID();
  const options = { path, key, scopeId, verifier }, stores = [];
  const open = (changes = {}) => { const s = new TslTrustStore({ ...options, ...changes }); stores.push(s); return s; };
  try { await run({ ...options, open, dir }); } finally { for (const s of stores) s.close(); await rm(dir, { recursive: true, force: true }); }
}

test('TSL: both signatures, XSD, signer status and extracted services authorize only a bounded local snapshot', async () => {
  const s = await v.verify(base);
  assert.equal(s.metadata.sequence, 10001); assert.equal(s.metadata.schemaSha256, TSL_SCHEMA_SHA256);
  assert.equal(s.metadata.identityStatus, 'unverified'); assert.equal(s.metadata.trustSource, 'configured-tsl-anchors');
  assert.equal(s.metadata.validUntil, f.now + 3600_001); assert.equal(s.services.length, 2);
  const verifier = s.ocspVerifierFor([f.signer.certificate, f.pki.recipient.certificate]), proof = f.proof();
  assert.deepEqual(verifier.createRequest(f.signer.certificate), proof.request);
  assert.equal(verifier.verify({ certificate: f.signer.certificate, ...proof }).status, 'good');
  assert.equal(s.services[0].supplyPoints[0], 'https://example.invalid/ocsp');
  assert.throws(() => s.services.push({}), TypeError); assert.throws(() => { s.metadata.sequence = 0; }, TypeError);
  assert.throws(() => new TslTrustSnapshot(), rejected('KIM_TSL_UNVERIFIED'));
  const bytes = s.exportBundle(); bytes.xml.fill(0); assert.deepEqual(s.exportBundle().xml, base.xml);
});

for (const [name, canonical, prefix, pretty, comment] of [
  ['inclusive with indentation', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315', 'other', true, false],
  ['inclusive with comments', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315#WithComments', null, true, true],
  ['exclusive with default namespace', 'http://www.w3.org/2001/10/xml-exc-c14n#', null, false, false],
  ['exclusive with comments', 'http://www.w3.org/2001/10/xml-exc-c14n#WithComments', 'alternate', true, true],
]) test('TSL: C14N ' + name, async () => {
  const b = await f.bundle({ canonical, prefix, pretty, comment });
  assert.equal((await v.verify(b)).metadata.sequence, 10001);
});

test('TSL: official direct DER and BIT STRING wrapped ECC signatures are accepted and OpenSSL verifies the detached bytes independently', async () => {
  const b = { ...base, detachedSignature: await f.detach(base.xml, f.signer, { wrapped: true }) };
  await v.verify(b);
  await privateWorkspace(async file => {
    const key = await file('public.pem', new X509Certificate(f.signer.certificate).publicKey.export({ type: 'spki', format: 'pem' }));
    const signature = await file('signature.der', fields(der(base.detachedSignature), 48, 3)[1].raw);
    const result = await openssl(['dgst', '-sha256', '-verify', key, '-signature', signature], { input: base.xml });
    assert.match(result.toString(), /Verified OK/);
  });
});

test('TSL: RSA-PSS signs both layers and the separate RSA sequence range is enforced', async () => {
  const signer = await f.issueSigner({ name: 'tsl-rsa', curve: 'rsa' });
  const b = await f.bundle({ signer, id: 'RSA_9999', sequence: 9999 });
  assert.equal((await f.verifier({ profile: 'rsa' }).verify(b)).metadata.sequence, 9999);
  await assert.rejects(v.verify(b), rejected('KIM_TSL_ALGORITHM'));
  await assert.rejects(v.verify(await f.bundle({ id: 'WRONG_RANGE', sequence: 9999 })), rejected('KIM_TSL_PROFILE'));
  await assert.rejects(f.verifier({ profile: 'rsa' }).verify(base), rejected('KIM_TSL_ALGORITHM'));
});

test('TSL: tampered original bytes fail detached verification before invoking an unavailable XML runtime', async () => {
  const xml = Buffer.from(base.xml); xml[100] ^= 1;
  await assert.rejects(f.verifier({ python: '/nonexistent/cs-python' }).verify({ ...base, xml }), rejected('KIM_TSL_DETACHED_SIGNATURE'));
  await assert.rejects(f.verifier({ python: '/nonexistent/cs-python' }).verify(base), rejected('KIM_TSL_XML_UNAVAILABLE'));
});

test('TSL: detached DER trailing bytes and malformed signature framing fail closed', async () => {
  await assert.rejects(v.verify({ ...base, detachedSignature: Buffer.concat([base.detachedSignature, Buffer.from([0])]) }), rejected('KIM_TSL_REJECTED'));
  await assert.rejects(v.verify({ ...base, detachedSignature: Buffer.from([48, 0]) }), rejected('KIM_TSL_REJECTED'));
});

test('TSL: anchor pin mismatch and duplicated anchor configuration cannot authorize imports', () => {
  assert.throws(() => f.verifier({ anchors: [{ certificate: f.pki.roots, sha256: '0'.repeat(64) }] }), rejected('KIM_TSL_CONFIGURATION'));
  assert.throws(() => f.verifier({ anchors: [f.pin(f.pki.roots), f.pin(f.pki.roots)] }), rejected('KIM_TSL_CONFIGURATION'));
});

test('TSL: a valid detached signer is not trusted under a different CA key', async () => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'brainpoolP256r1' });
  await privateWorkspace(async file => {
    const key = await file('unrelated.key', privateKey.export({ format: 'pem', type: 'pkcs8' }));
    const root = (await openssl(['req', '-new', '-x509', '-key', key, '-sha256', '-days', '1', '-subj', '/CN=Unrelated local test CA',
      '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign'])).toString();
    await assert.rejects(f.verifier({ anchors: [f.pin(root)] }).verify(base), rejected('KIM_TSL_SIGNER'));
  });
});

test('TSL: wrong signer EKU fails even when signature and OCSP status are valid', async () => {
  const b = await f.bundle({ signer: f.responder });
  await assert.rejects(v.verify(b), rejected('KIM_TSL_SIGNER'));
});

test('TSL: signer contentCommitment and exclusive TSLSigning EKU are required', async () => {
  const signer = await f.issueSigner({ name: 'tsl-wrong-usage', usage: 'digitalSignature' });
  await assert.rejects(v.verify(await f.bundle({ signer })), rejected('KIM_TSL_SIGNER'));
  const wrongEku = await f.issueSigner({ name: 'tsl-wrong-eku', extendedUsage: '0.4.0.2231.3.0,OCSPSigning' });
  await assert.rejects(v.verify(await f.bundle({ signer: wrongEku })), rejected('KIM_TSL_SIGNER'));
});

for (const state of ['revoked', 'unknown']) test('TSL: ' + state + ' signer status blocks activation', async () => {
  await assert.rejects(v.verify({ ...base, signerStatus: f.proof(f.signer.certificate, { state }) }), rejected('KIM_TSL_SIGNER_STATUS'));
});

test('TSL: stale signer proof, unrelated proof and forged good JSON are not accepted', async () => {
  await assert.rejects(v.verify({ ...base, signerStatus: f.proof(f.signer.certificate, { producedAt: f.now - 3601_000 }) }), rejected('KIM_TSL_REJECTED'));
  await assert.rejects(v.verify({ ...base, signerStatus: f.proof(f.responder.certificate) }), rejected('KIM_TSL_REJECTED'));
  await assert.rejects(v.verify({ ...base, signerStatus: { status: 'good' } }), rejected('KIM_TSL_SIZE'));
});

test('TSL: authenticated, well-formed XML still must satisfy the complete pinned XSD', async () => {
  const b = await altered(s => s.replace(/<t:HistoricalInformationPeriod>0<\/t:HistoricalInformationPeriod>/, ''));
  await assert.rejects(v.verify(b), rejected('KIM_TSL_XSD'));
});

test('TSL: DOCTYPE and external entities are rejected before XML resolution', async () => {
  const b = await altered(s => s.replace('?>', '?><!DOCTYPE t:TrustServiceStatusList [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>'));
  await assert.rejects(v.verify(b), rejected('KIM_TSL_XML_DTD'));
});

test('TSL: processing instructions and declared non-UTF8 encodings fail closed', async () => {
  await assert.rejects(v.verify(await altered(s => s.replace('?>', '?><?lookup href="https://example.invalid/"?>'))), rejected('KIM_TSL_XML_PROFILE'));
  await assert.rejects(v.verify(await altered(s => s.replace('UTF-8', 'ISO-8859-1'))), rejected('KIM_TSL_XML_PROFILE'));
});

test('TSL: root references cannot point to an external resource', async () => {
  await assert.rejects(v.verify(await altered(s => s.replace('URI="#TSL_10001"', 'URI="https://example.invalid/other.xml"'))), rejected('KIM_TSL_XML_REFERENCE'));
});

test('TSL: duplicate IDs cannot shadow the signed root', async () => {
  await assert.rejects(v.verify(await altered(s => s.replace('<ds:Signature>', '<ds:Signature Id="TSL_10001">'))), rejected('KIM_TSL_XML_ID'));
});

test('TSL: nested signature or signed-object wrapping is not an accepted profile', async () => {
  await assert.rejects(v.verify(await altered(s => s.replace('</ds:Signature>', '<ds:Object Id="other"><ds:Signature/></ds:Object></ds:Signature>'))), rejected('KIM_TSL_XSD'));
});

test('TSL: XPath and unknown critical service extensions are rejected', async () => {
  await assert.rejects(v.verify(await altered(s => s.replace('xmldsig#enveloped-signature', 'TR/1999/REC-xpath-19991116'))), rejected('KIM_TSL_XML_ALGORITHM'));
  const b = await altered(s => s.replace('</t:ServiceInformation>', '<t:ServiceInformationExtensions><t:Extension Critical=" true "><x:Unknown xmlns:x="urn:unknown"/></t:Extension></t:ServiceInformationExtensions></t:ServiceInformation>'));
  await assert.rejects(v.verify(b), rejected('KIM_TSL_CRITICAL_EXTENSION'));
});

test('TSL: altered inner digest fails even after a valid detached re-signature', async () => {
  await assert.rejects(v.verify(await altered(s => s.replace('Teststadt', 'Anderstadt'))), rejected('KIM_TSL_XML_DIGEST'));
});

test('TSL: altered inner SignatureValue fails independently of the detached signature', async () => {
  const b = await altered(s => s.replace(/(<ds:SignatureValue>)([A-Za-z0-9+/])/, (_, start, c) => start + (c === 'A' ? 'B' : 'A')));
  await assert.rejects(v.verify(b), rejected('KIM_TSL_XML_SIGNATURE'));
});

test('TSL: inner KeyInfo cannot replace the detached signer certificate', async () => {
  const b = await altered(s => s.replace('<ds:X509Certificate>' + new X509Certificate(f.signer.certificate).raw.toString('base64'), '<ds:X509Certificate>' + new X509Certificate(f.responder.certificate).raw.toString('base64')));
  await assert.rejects(v.verify(b), rejected('KIM_TSL_SIGNER_BINDING'));
});

for (const [name, times] of [
  ['expired list', () => ({ issuedAt: f.now - 5000, nextUpdate: f.now })],
  ['future issue time', () => ({ issuedAt: f.now + 1000 })],
  ['validity longer than 30 days', () => ({ nextUpdate: f.now + 31 * 86400_000 })],
]) test('TSL: ' + name + ' cannot yield a snapshot', async () => {
  await assert.rejects(v.verify(await f.bundle(times())), rejected('KIM_TSL_TIME'));
});

test('TSL: expired anchor provisioning and expired snapshots never create status verifiers', async () => {
  await assert.rejects(f.verifier({ validUntil: f.now }).verify(base), rejected('KIM_TSL_ANCHOR_EXPIRED'));
  let now = f.now;
  const s = await f.verifier({ clock: () => now }).verify(base);
  now = s.metadata.validUntil;
  assert.throws(() => s.ocspVerifierFor(f.signer.certificate), rejected('KIM_TSL_SNAPSHOT_EXPIRED'));
  assert.throws(() => s.exportBundle(), rejected('KIM_TSL_SNAPSHOT_EXPIRED'));
});

test('TSL: copied input buffers and post-worker clock checks prevent asynchronous mutation or expiry', async () => {
  const b = { xml: Buffer.from(base.xml), detachedSignature: Buffer.from(base.detachedSignature), signerStatus: { request: Buffer.from(base.signerStatus.request), response: Buffer.from(base.signerStatus.response) } };
  const result = v.verify(b); b.xml.fill(0); b.detachedSignature.fill(0); b.signerStatus.response.fill(0);
  assert.equal((await result).metadata.sequence, 10001);
  let now = f.now; const pending = f.verifier({ clock: () => now }).verify(base); now += 3601_000;
  await assert.rejects(pending, rejected('KIM_TSL_REJECTED'));
});

test('TSL: revoked CA requires explicit compromise model and a certificate issued before the cutoff', async () => {
  const services = f.services.map(s => s.type === CA ? { ...s, status: REVOKED, started: f.now + 500 } : s);
  let now = f.now + 1000;
  const s = await f.verifier({ clock: () => now }).verify(await f.bundle({ services }));
  assert.throws(() => s.ocspVerifierFor(f.signer.certificate), rejected('KIM_TSL_ISSUER'));
  assert.equal(s.ocspVerifierFor(f.signer.certificate, { model: 'nonqes-compromise' }).createRequest(f.signer.certificate).length > 0, true);
  const early = await v.verify(await f.bundle({ services: f.services.map(s => s.type === CA ? { ...s, status: REVOKED, started: 1000 } : s) }));
  assert.throws(() => early.ocspVerifierFor(f.signer.certificate, { model: 'nonqes-compromise' }), rejected('KIM_TSL_ISSUER'));
  assert.throws(() => s.ocspVerifierFor(f.signer.certificate, { model: 'qes' }), rejected('KIM_TSL_VALIDATION_MODEL'));
});

test('TSL: future service entries and absent responders do not authorize a status path', async () => {
  const future = await v.verify(await f.bundle({ services: f.services.map(s => s.type === CA ? { ...s, started: f.now + 1000 } : s) }));
  assert.throws(() => future.ocspVerifierFor(f.signer.certificate), rejected('KIM_TSL_ISSUER'));
  const noResponder = await v.verify(await f.bundle({ services: f.services.filter(s => s.type !== OCSP) }));
  assert.throws(() => noResponder.ocspVerifierFor(f.signer.certificate), rejected('KIM_TSL_RESPONDER'));
});

test('TSL: duplicated service identities and revoked OCSP entries are rejected', async () => {
  await assert.rejects(v.verify(await f.bundle({ services: [...f.services, f.services[0]] })), rejected('KIM_TSL_SERVICE_DUPLICATE'));
  await assert.rejects(v.verify(await f.bundle({ services: f.services.map(s => s.type === OCSP ? { ...s, status: REVOKED } : s) })), rejected('KIM_TSL_SERVICE_STATUS'));
});

test('TSL store: encrypted originals survive restart and must be fully reverified with fresh signer proof', async () => storeFixture(async ({ open, path }) => {
  const a = open(); await assert.rejects(a.load({ signerStatus: base.signerStatus }), rejected('KIM_TSL_STORE_EMPTY'));
  assert.equal((await a.activate(base)).changed, true); a.close();
  const b = open(), loaded = await b.load({ signerStatus: f.proof() });
  assert.equal(loaded.metadata.xmlSha256, (await v.verify(base)).metadata.xmlSha256);
  await assert.rejects(b.load(), rejected('KIM_TSL_SIZE'));
  assert.equal((await b.activate(base)).changed, false);
  b.close(); const disk = await readFile(path);
  assert.equal(disk.includes(Buffer.from('TrustServiceStatusList')), false);
  assert.equal(disk.includes(Buffer.from('Isolated local fixture')), false);
}));

test('TSL store: rollback and illegal ID/sequence combinations remain blocked across reopen', async () => storeFixture(async ({ open }) => {
  const s = open(); await s.activate(await f.bundle({ id: 'TSL_10002', sequence: 10002 })); s.close();
  const reopened = open();
  await assert.rejects(reopened.activate(base), rejected('KIM_TSL_ROLLBACK'));
  await assert.rejects(reopened.activate(await f.bundle({ id: 'TSL_10002', sequence: 10003 })), rejected('KIM_TSL_ROLLBACK'));
  await assert.rejects(reopened.activate(await f.bundle({ id: 'OTHER_10002', sequence: 10002 })), rejected('KIM_TSL_ROLLBACK'));
  assert.equal((await reopened.load({ signerStatus: f.proof() })).metadata.sequence, 10002);
}));

test('TSL store: same ID/sequence with changed bytes is equivocation; randomized detached signature is idempotent', async () => storeFixture(async ({ open }) => {
  const s = open(); await s.activate(base);
  const resigned = { ...base, detachedSignature: await f.detach(base.xml) };
  assert.equal((await s.activate(resigned)).changed, false);
  await assert.rejects(s.activate(await f.bundle({ nextUpdate: f.now + 86400_000 })), rejected('KIM_TSL_EQUIVOCATION'));
}));

test('TSL store: wrong key, environment, profile or anchor set cannot reuse the checkpoint', async () => storeFixture(async ({ open }) => {
  const s = open(); await s.activate(base); s.close();
  assert.throws(() => open({ key: randomBytes(32) }), rejected('KIM_TSL_STORE_CONFIGURATION'));
  assert.throws(() => open({ verifier: f.verifier({ environment: 'reference' }) }), rejected('KIM_TSL_STORE_BINDING'));
  assert.throws(() => open({ verifier: f.verifier({ profile: 'rsa' }) }), rejected('KIM_TSL_STORE_BINDING'));
}));

test('TSL store: ciphertext and high-water metadata tampering are detected on reopen', async () => storeFixture(async ({ open, path, scopeId }) => {
  const s = open(); await s.activate(base); s.close();
  const db = new DatabaseSync(path); db.prepare('UPDATE kim_tsl_trust_v1 SET sequence=9999 WHERE scope_id=?').run(scopeId); db.close();
  assert.throws(() => open(), rejected('KIM_TSL_STORE_CONFIGURATION'));
}));

test('TSL store: competing handles cannot overwrite the highest accepted sequence', async () => storeFixture(async ({ open }) => {
  const a = open(), b = open(), newer = await f.bundle({ id: 'TSL_10003', sequence: 10003 });
  const results = await Promise.allSettled([a.activate(base), b.activate(newer)]);
  assert.equal(results[1].status, 'fulfilled');
  if (results[0].status === 'rejected') assert.equal(results[0].reason.code, 'KIM_TSL_ROLLBACK');
  assert.equal((await a.load({ signerStatus: f.proof() })).metadata.sequence, 10003);
}));

test('TSL store: closing during validation cannot persist an import', async () => storeFixture(async ({ open }) => {
  const a = open(), pending = a.activate(base); a.close();
  await assert.rejects(pending, rejected('KIM_TSL_STORE_CLOSED'));
  await assert.rejects(open().load({ signerStatus: f.proof() }), rejected('KIM_TSL_STORE_EMPTY'));
}));

test('TSL store: expiry blocks load without erasing the durable rollback boundary', async () => {
  let now = f.now;
  await storeFixture(async ({ open }) => {
    const a = open(); await a.activate(await f.bundle({ id: 'TSL_10005', sequence: 10005, nextUpdate: f.now + 1000 }));
    now += 2000;
    await assert.rejects(a.load({ signerStatus: f.proof() }), rejected('KIM_TSL_TIME'));
    await assert.rejects(a.activate(base), rejected('KIM_TSL_ROLLBACK'));
    assert.equal((await a.activate(await f.bundle({ id: 'TSL_10006', sequence: 10006 }))).changed, true);
  }, f.verifier({ clock: () => now }));
});
