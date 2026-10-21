import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateKey, X509Certificate, sign, constants } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { selectCertificateType, KIM_CERTIFICATE_TYPES as TYPES } from '../../services/kim/certificate-policy.mjs';
import { certificateParts, fields } from '../../services/gkv/der.mjs';
import { openssl } from '../../services/gkv/openssl.mjs';
import { tlv, sequence as seq, objectId as id, octets } from '../../services/kim/cms-codec.mjs';
import { createEccKimAuth } from '../../services/kim/message-auth.mjs';
import { sealEccKimPayload } from '../../services/kim/ecc-cms.mjs';
import { tslFixture, CA } from './tsl-fixture.mjs';

const OID = '1.2.276.0.76.4.78', TYPE = seq(id('2a8214004c044e'));
const CP = seq(id('2a8214004c048123')); // ...163, an issuance policy, not a certificate type.
const CPS = seq(seq(id('2b06010505070201'), tlv(22, Buffer.from('https://unqueried.invalid/cps'))));
const rejects = code => e => e?.code === code;
let f, snapshot, osig, aut, enc, rootKey, signingKey, authKey;
before(async () => {
  f = await tslFixture();
  const startDate = new Date(f.now - 86400000).toISOString().replace(/[-:T]/g, '').slice(0, 14) + 'Z';
  osig = await f.pki.issueKim({ name: 'policy-osig', role: 'osig', startDate });
  aut = await f.pki.issueAut({ name: 'policy-aut', startDate });
  enc = await f.pki.issueKim({ name: 'policy-enc', startDate });
  const key = async path => createPrivateKey({ key: await readFile(path), passphrase: f.pki.password });
  rootKey = await key(join(f.pki.dir, 'root.key')); signingKey = await key(osig.privateKeyPath); authKey = await key(aut.privateKeyPath);
  snapshot = await f.verifier().verify(await f.bundle());
});
after(async () => { await f?.close(); });

function withPolicies(certificate, encoded) {
  const p = certificateParts(new X509Certificate(certificate).raw);
  const tbs = seq(...p.tbs.map(n => n.tag !== 163 ? n.raw : tlv(163, seq(...fields(fields(n, 163, 1)[0], 48)
    .filter(e => fields(e, 48)[0].value.toString('hex') !== '551d20').map(e => e.raw),
    ...(encoded === undefined ? [] : [seq(id('551d20'), octets(encoded))])))));
  const signature = sign('sha256', tbs, { key: rootKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 });
  const raw = seq(tbs, p.signatureAlgorithm.raw, tlv(3, Buffer.concat([Buffer.from([0]), signature])));
  assert.equal(new X509Certificate(raw).verify(new X509Certificate(f.pki.roots).publicKey), true);
  return raw;
}

for (const [purpose, suffix, expected] of [
  ['signing', '4e', OID], ['authentication', '4b', '1.2.276.0.76.4.75'],
  ['authentication', '4d', '1.2.276.0.76.4.77'], ['encryption', '4a', '1.2.276.0.76.4.74'],
  ['encryption', '4c', '1.2.276.0.76.4.76'],
]) test('certificate type: ' + expected + ' selects its intended KIM use alongside issuance policy', () => {
  assert.equal(selectCertificateType(seq(CP, seq(id('2a8214004c04' + suffix))), TYPES[purpose]), expected);
});

test('certificate type: issuance-policy CPS is allowed and a multibyte first OID arc is decoded exactly', () => {
  assert.equal(selectCertificateType(seq(seq(id('2a8214004c048123'), CPS), TYPE), TYPES.signing), OID);
  assert.equal(selectCertificateType(seq(seq(id('883703'))), ['2.999.3']), '2.999.3');
  assert.throws(() => TYPES.signing.push('1.2.3'), TypeError);
});

for (const [label, encoded, expected] of [
  ['missing policy extension', undefined, 'MISSING'],
  ['empty policy sequence', seq(), 'FORMAT'],
  ['issuance policy only', seq(CP), 'MISMATCH'],
  ['wrong certificate type', seq(seq(id('2a8214004c044d'))), 'MISMATCH'],
  ['type qualifier', seq(seq(id('2a8214004c044e'), CPS)), 'QUALIFIER'],
  ['duplicated type', seq(TYPE, TYPE), 'FORMAT'],
  ['duplicated issuance policy', seq(CP, CP, TYPE), 'FORMAT'],
  ['two KIM certificate types', seq(TYPE, seq(id('2a8214004c044d'))), 'AMBIGUOUS'],
  ['nonminimal OID arc', seq(seq(id('2a808214004c044e'))), 'FORMAT'],
  ['unterminated OID arc', seq(seq(id('2a8214004c04ce'))), 'FORMAT'],
  ['type as UTF8 text', seq(seq(tlv(12, Buffer.from(OID)))), 'FORMAT'],
  ['empty qualifier sequence', seq(seq(id('2a8214004c048123'), seq()), TYPE), 'FORMAT'],
  ['malformed qualifier', seq(seq(id('2a8214004c048123'), seq(seq(id('2b06010505070201')))), TYPE), 'FORMAT'],
  ['trailing bytes', Buffer.concat([seq(TYPE), Buffer.from([0])]), 'FORMAT'],
  ['too many policy entries', seq(...Array(33).fill(TYPE)), 'FORMAT'],
]) test('certificate type rejects ' + label, () => {
  assert.throws(() => selectCertificateType(encoded, TYPES.signing), rejects('KIM_CERT_POLICY_' + expected));
});

test('certificate type: empty, duplicate and noncanonical allowed lists cannot weaken the requested purpose', () => {
  for (const list of [undefined, [], [OID, OID], [OID,,], ['1.02.3'], ['1.40.3'], ['2.3.'], ['2.3.4\n'], Array(17).fill(OID)]) {
    assert.throws(() => selectCertificateType(seq(TYPE), list), rejects('KIM_CERT_POLICY_CONFIGURATION'));
  }
});

test('TSL certificate type: actual signed certificate, CA binding and OpenSSL policy decoding agree', async () => {
  const cert = withPolicies(osig.certificate, seq(CP, TYPE));
  const result = snapshot.certificateTypeFor(cert, { policyList: TYPES.signing });
  assert.equal(result.certificateTypeOid, OID); assert.equal(result.identityStatus, 'unverified');
  assert.equal(snapshot.ocspPlanFor(cert, { policyList: TYPES.signing }).certificateTypeOid, OID);
  assert.throws(() => { result.certificateTypeOid = '1.2.3'; }, TypeError);
  assert.throws(() => snapshot.services[0].extensionOids.push('1.2.3'), TypeError);
  const decoded = (await openssl(['x509', '-inform', 'DER', '-noout', '-text'], { input: cert })).toString();
  assert.match(decoded, /Policy: 1\.2\.276\.0\.76\.4\.163/); assert.match(decoded, /Policy: 1\.2\.276\.0\.76\.4\.78/);
});

test('TSL certificate type: valid signatures do not excuse missing, qualified or ambiguous type extensions', () => {
  for (const [encoded, error] of [[undefined, 'MISSING'], [seq(seq(id('2a8214004c044e'), CPS)), 'QUALIFIER'],
    [seq(TYPE, seq(id('2a8214004c044d'))), 'AMBIGUOUS']]) {
    const cert = withPolicies(osig.certificate, encoded);
    assert.throws(() => snapshot.certificateTypeFor(cert, { policyList: TYPES.signing }), rejects('KIM_TSL_CERT_TYPE_' + error));
  }
  assert.throws(() => snapshot.ocspPlanFor(osig.certificate), rejects('KIM_TSL_CERT_TYPE_CONFIGURATION'));
  assert.throws(() => snapshot.certificateTypeFor(osig.certificate, { policyList: TYPES.authentication }), rejects('KIM_TSL_CERT_TYPE_MISMATCH'));
});

test('CMS and AUT use the same strict type parser before signing any outgoing material', () => {
  const badOsig = withPolicies(osig.certificate, seq(TYPE, TYPE));
  assert.throws(() => sealEccKimPayload({ message: Buffer.from('test'), sender: 'sender@local.kim.telematik-test',
    recipients: [{ address: 'sender@local.kim.telematik-test', certificate: enc.certificate }], signingCertificate: badOsig, signingKey, now: f.now }),
  e => e.message === 'KIM_CMS_CERTIFICATE');
  const authOptions = { sender: 'sender@local.kim.telematik-test', certificate: aut.certificate, privateKey: authKey, cmVersion: 'TEST_0.1.0', now: f.now };
  assert.match(createEccKimAuth(authOptions), /^Bearer /);
  const badAut = withPolicies(aut.certificate, seq(seq(id('2a8214004c044d'), CPS)));
  assert.throws(() => createEccKimAuth({ ...authOptions, certificate: badAut }), e => e.message === 'KIM_AUTH_SIGNING_REJECTED');
});

const NS = 'http://uri.etsi.org/02231/v2#';
const wrap = inner => `<t:ServiceInformationExtensions xmlns:t="${NS}" xmlns:x="urn:untrusted:extension">${inner}</t:ServiceInformationExtensions>`;
const ext = (oid, value = 'oid_local_fixture') => `<t:Extension Critical="false"><t:ExtensionOID>${oid}</t:ExtensionOID><t:ExtensionValue>${value}</t:ExtensionValue></t:Extension>`;
async function customList(extensionXml) {
  return f.verifier().verify(await f.bundle({ services: f.services.map(s => s.type === CA ? { ...s, extensionXml } : s) }));
}

for (const [label, xml] of [
  ['wrong numeric OID with correct text label', wrap(ext('1.2.276.0.76.4.77', 'oid_smc_b_osig'))],
  ['foreign namespace', wrap(`<t:Extension Critical="false"><x:ExtensionOID>${OID}</x:ExtensionOID><x:ExtensionValue>oid_smc_b_osig</x:ExtensionValue></t:Extension>`)],
  ['nested OID', wrap(`<t:Extension Critical="false"><x:Wrapper><t:ExtensionOID>${OID}</t:ExtensionOID></x:Wrapper></t:Extension>`)],
  ['OID inside opaque complex value', wrap(`<t:Extension Critical="false"><t:ExtensionOID>1.2.276.0.76.4.77</t:ExtensionOID><t:ExtensionValues><t:ExtensionOID>${OID}</t:ExtensionOID></t:ExtensionValues></t:Extension>`)],
]) test('TSL type authorization cannot come from ' + label, async () => {
  const s = await customList(xml);
  assert.throws(() => s.certificateTypeFor(osig.certificate, { policyList: TYPES.signing }), rejects('KIM_TSL_CERT_TYPE_CA_NOT_AUTHORIZED'));
});

for (const [label, xml, error] of [
  ['missing paired value', wrap(`<t:Extension Critical="false"><t:ExtensionOID>${OID}</t:ExtensionOID></t:Extension>`), 'KIM_TSL_SERVICE_EXTENSION'],
  ['duplicate OID entries', wrap(ext(OID) + ext(OID)), 'KIM_TSL_SERVICE_EXTENSION'],
  ['noncanonical numeric OID', wrap(ext('1.2.276.0.076.4.78')), 'KIM_TSL_SERVICE_EXTENSION'],
  ['invalid second arc', wrap(ext('1.40.3')), 'KIM_TSL_SERVICE_EXTENSION'],
  ['critical extension', wrap(ext(OID).replace('Critical="false"', 'Critical="true"')), 'KIM_TSL_CRITICAL_EXTENSION'],
  ['extension count overflow', wrap(Array(129).fill(ext(OID)).join('')), 'KIM_TSL_XML_LIMIT'],
]) test('TSL rejects authenticated but malformed extension: ' + label, async () => {
  await assert.rejects(customList(xml), rejects(error));
});

test('TSL authorization uses only the issuing CA; absent extensions and OCSP service OIDs cannot grant a type', async () => {
  const s = await f.verifier().verify(await f.bundle({ services: f.services.map(service => ({ ...service,
    extensionOids: service.type === CA ? [] : [OID] })) }));
  assert.throws(() => s.certificateTypeFor(osig.certificate, { policyList: TYPES.signing }), rejects('KIM_TSL_CERT_TYPE_CA_NOT_AUTHORIZED'));
});
