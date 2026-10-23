import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateKey, X509Certificate, sign, constants } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readVzdAdmission } from '../../services/kim/certificate-admission.mjs';
import { certificateParts, fields } from '../../services/gkv/der.mjs';
import { tlv, sequence as seq, octets, objectId } from '../../services/kim/cms-codec.mjs';
import { admissionDer, professionDer, fixtureOid as id, withAdmission } from './admission-fixture.mjs';
import { tslFixture, CA, REVOKED } from './tsl-fixture.mjs';

const role = { professionOid: '1.2.276.0.76.4.171', professionItem: 'Verzeichnisdienst-TI', telematikId: null };
const code = expected => e => e?.code === expected;
const serverError = e => /^KIM_TSL_(?:SERVER|CERT_TYPE|CERTIFICATE|SERVICE)(?:_|$)/.test(e?.code);
let f, server, rootKey, snapshot, services, startDate;
before(async () => {
  f = await tslFixture();
  startDate = new Date(f.now - 86400000).toISOString().replace(/[-:T]/g, '').slice(0, 14) + 'Z';
  server = await f.pki.issueVzd({ startDate });
  rootKey = createPrivateKey({ key: await readFile(join(f.pki.dir, 'root.key')), passphrase: f.pki.password });
  services = f.services.map(s => s.type === CA ? { ...s, extensionOids: [...s.extensionOids, '1.2.276.0.76.4.157'] } : s);
  snapshot = await f.verifier().verify(await f.bundle({ services }));
});
after(async () => f?.close());

test('VZD Admission: technical service role has no participant identity', () => {
  const a = readVzdAdmission(admissionDer(role));
  assert.equal(a.professionOid, role.professionOid); assert.equal(a.professionItem, role.professionItem);
  assert.equal(a.kind, 'technical-service'); assert.equal('telematikId' in a, false);
  assert.throws(() => { a.professionOid = '1.2.3'; }, TypeError);
});
for (const [label, bytes, error] of [
  ['missing', undefined, 'MISSING'],
  ['wrong role', admissionDer({ ...role, professionOid: '1.2.276.0.76.4.172' }), 'SERVICE_ROLE'],
  ['wrong label', admissionDer({ ...role, professionItem: 'Verzeichnisdienst' }), 'SERVICE_ROLE'],
  ['participant ID', admissionDer({ ...role, telematikId: '10-NOT-A-SERVICE' }), 'SERVICE_IDENTITY'],
  ['extra opaque data', admissionDer({ ...role, extra: [octets(Buffer.from('ignored'))] }), 'SERVICE_IDENTITY'],
  ['two professions', seq(seq(seq(seq(professionDer(role), professionDer(role))))), 'FORMAT'],
  ['trailing bytes', Buffer.concat([admissionDer(role), Buffer.from([0])]), 'FORMAT'],
  ['oversized', Buffer.alloc(8193), 'FORMAT'],
]) test('VZD Admission rejects ' + label, () => assert.throws(() => readVzdAdmission(bytes), code('KIM_ADMISSION_' + error)));

test('VZD server: OpenSSL-issued C.ZD.TLS-S passes type, CA, profile and raw OCSP verification together', () => {
  const profile = snapshot.directoryServerFor(server.certificate);
  assert.equal(profile.certificateTypeOid, '1.2.276.0.76.4.157');
  assert.equal(profile.issuerSha256, f.pki.rootFingerprint); assert.equal(profile.identityStatus, 'unverified');
  assert.equal(profile.serverProfile.curve, 'prime256v1'); assert.equal(profile.serverProfile.dnsName, 'localhost.test');
  assert.equal(profile.admission.professionOid, role.professionOid); assert.equal('telematikId' in profile.admission, false);
  const plan = snapshot.directoryServerOcspPlanFor(server.certificate), proof = f.proof(server.certificate);
  assert.deepEqual(plan.request, proof.request);
  assert.equal(plan.verifier.verify({ certificate: server.certificate, ...proof }).status, 'good');
  assert.throws(() => { profile.serverProfile.keyUsage.push('keyEncipherment'); }, TypeError);
});

test('VZD server: both supported ECC curves are accepted, larger and RSA keys fail closed', async () => {
  const bp = await f.pki.issueVzd({ name: 'vzd-brainpool', curve: 'brainpoolP256r1', startDate });
  assert.equal(snapshot.directoryServerFor(bp.certificate).serverProfile.curve, 'brainpoolP256r1');
  for (const curve of ['secp384r1', 'rsa']) {
    const c = await f.pki.issueVzd({ name: 'vzd-key-' + curve, curve, startDate });
    assert.throws(() => snapshot.directoryServerFor(c.certificate), code('KIM_TSL_SERVER_KEY'));
  }
});

// Re-sign changed DER with the real isolated CA: these cases cannot be rejected
// merely because a test broke the certificate's cryptographic signature.
function extensionCertificate(name, value, critical = false, duplicate = false) {
  const p = certificateParts(new X509Certificate(server.certificate).raw);
  const extension = seq(objectId(name), ...(critical ? [tlv(1, Buffer.from([255]))] : []), octets(value ?? Buffer.alloc(0)));
  const tbs = seq(...p.tbs.map(n => n.tag !== 163 ? n.raw : tlv(163, seq(...fields(fields(n, 163, 1)[0], 48)
    .filter(e => fields(e, 48)[0].value.toString('hex') !== name).map(e => e.raw),
    ...(value === undefined ? [] : duplicate ? [extension, extension] : [extension])))));
  const signature = sign('sha256', tbs, { key: rootKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 });
  const result = seq(tbs, p.signatureAlgorithm.raw, tlv(3, Buffer.concat([Buffer.from([0]), signature])));
  assert.equal(new X509Certificate(result).verify(new X509Certificate(f.pki.roots).publicKey), true);
  return result;
}
for (const [label, name, value, critical = false, duplicate = false] of [
  ['missing SKI', '551d0e', undefined],
  ['missing AIA', '2b06010505070101', undefined],
  ['missing SAN', '551d11', undefined],
  ['missing issuance policy', '551d20', seq(seq(id('1.2.276.0.76.4.157')))],
  ['wrong issuance policy', '551d20', seq(seq(id('1.2.276.0.76.4.158')), seq(id('1.2.276.0.76.4.157')))],
  ['conflicting participant type', '551d20', seq(seq(id('1.2.276.0.76.4.78')), seq(id('1.2.276.0.76.4.157')))],
  ['missing critical KU', '551d0f', tlv(3, Buffer.from('0780', 'hex'))],
  ['extra key usage', '551d0f', tlv(3, Buffer.from('05a0', 'hex')), true],
  ['wrong EKU', '551d25', seq(id('1.3.6.1.5.5.7.3.2'))],
  ['extra EKU', '551d25', seq(id('1.3.6.1.5.5.7.3.1'), id('1.3.6.1.5.5.7.3.2'))],
  ['wrong DNS', '551d11', seq(tlv(130, Buffer.from('different.test')))],
  ['wildcard DNS', '551d11', seq(tlv(130, Buffer.from('*.test')))],
  ['extra DNS', '551d11', seq(tlv(130, Buffer.from('localhost.test')), tlv(130, Buffer.from('different.test')))],
  ['duplicate extension', '551d25', seq(id('1.3.6.1.5.5.7.3.1')), false, true],
  ['unknown noncritical extension', '2a03', seq()],
  ['CA certificate', '551d13', seq(tlv(1, Buffer.from([255]))), true],
  ['missing critical BC', '551d13', seq()],
  ['wrong AIA method', '2b06010505070101', seq(seq(id('1.3.6.1.5.5.7.48.2'), tlv(134, Buffer.from('https://unqueried.invalid'))))],
]) test('VZD signed certificate rejects ' + label, () => {
  assert.throws(() => snapshot.directoryServerFor(extensionCertificate(name, value, critical, duplicate)), serverError);
});

test('VZD server: wrong or missing signed Admission is not rescued by a good raw OCSP proof', () => {
  for (const [encoded, expected] of [[undefined, 'EXTENSIONS'], [admissionDer(), 'ADMISSION_SERVICE_IDENTITY'],
    [admissionDer({ ...role, professionOid: '1.2.276.0.76.4.172' }), 'ADMISSION_SERVICE_ROLE']]) {
    const c = withAdmission(server.certificate, encoded, rootKey), proof = f.proof(c);
    assert.equal(snapshot.ocspVerifierFor(c).verify({ certificate: c, ...proof }).status, 'good');
    assert.throws(() => snapshot.directoryServerOcspPlanFor(c), code('KIM_TSL_SERVER_' + expected));
  }
});

test('VZD server: an extra subject attribute is rejected even with a matching SAN and valid CA signature', async () => {
  const c = await f.pki.issueVzd({ name: 'vzd-extra-subject', startDate, subject: '/C=DE/O=CareSuite Test/OU=Not permitted/CN=localhost.test' });
  assert.throws(() => snapshot.directoryServerFor(c.certificate), code('KIM_TSL_SERVER_SUBJECT'));
});

test('VZD server: CA permission, current status and actual signature cannot be replaced by a local pin', async () => {
  const noPermission = await f.verifier().verify(await f.bundle());
  assert.throws(() => noPermission.directoryServerFor(server.certificate), code('KIM_TSL_CERT_TYPE_CA_NOT_AUTHORIZED'));
  const revoked = await f.verifier().verify(await f.bundle({ services: services.map(s => s.type === CA ? { ...s, status: REVOKED } : s) }));
  assert.throws(() => revoked.directoryServerFor(server.certificate, { model: 'nonqes-compromise' }), code('KIM_TSL_ISSUER'));
  const corrupted = Buffer.from(new X509Certificate(server.certificate).raw); corrupted[corrupted.length - 1] ^= 1;
  assert.throws(() => snapshot.directoryServerFor(corrupted), code('KIM_TSL_ISSUER'));
  assert.throws(() => snapshot.directoryServerFor(server.certificate, { isCurrent: () => false }), code('KIM_TSL_SUPERSEDED'));
});
