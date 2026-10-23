import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateKey, X509Certificate, sign, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readKimAdmission } from '../../services/kim/certificate-admission.mjs';
import { KIM_CERTIFICATE_TYPES as TYPES } from '../../services/kim/certificate-policy.mjs';
import { tlv, sequence as seq, octets, sortedSet as set } from '../../services/kim/cms-codec.mjs';
import { sealEccKimPayload, openEccKimPayload } from '../../services/kim/ecc-cms.mjs';
import { createEccKimAuth, verifyReceivedEccKimAuth } from '../../services/kim/message-auth.mjs';
import { createEccKimMessage, openEccKimMessage } from '../../services/kim/client-message.mjs';
import { openssl, privateWorkspace } from '../../services/gkv/openssl.mjs';
import { admissionDer, professionDer, fixtureOid as id, withAdmission } from './admission-fixture.mjs';
import { tslFixture } from './tsl-fixture.mjs';

const OSIG = '1.2.276.0.76.4.78', AUT = '1.2.276.0.76.4.77', HP = '1.2.276.0.76.4.75';
const wrap = (...professions) => seq(seq(seq(seq(...professions))));
const utf8 = value => tlv(12, Buffer.from(value)), printable = value => tlv(19, Buffer.from(value));
const care = '1.2.276.0.76.4.245', consulting = '1.2.276.0.76.4.262';
const p = professionDer(), valid = admissionDer();
const rejects = expected => e => e?.code === expected;
const sha = b => createHash('sha256').update(b).digest('hex');

for (const type of [...TYPES.signing, ...TYPES.authentication, ...TYPES.encryption]) test('Admission: supported certificate type ' + type, () => {
  const professional = ['1.2.276.0.76.4.74', HP].includes(type);
  const result = readKimAdmission(admissionDer(professional ? { professionOid: '1.2.276.0.76.4.234' } : {}), type);
  assert.equal(result.telematikId, '10-LOCAL-TEST');
  assert.deepEqual(result.professionOids, [professional ? '1.2.276.0.76.4.234' : care]);
  assert.equal(result.roleVersion, 'gemSpec_OID 3.26.0'); assert.equal('identityStatus' in result, false);
});

test('Admission: multiple professions share one exact TID and remain deeply immutable', () => {
  const result = readKimAdmission(wrap(p, professionDer({ professionOid: consulting })), OSIG);
  assert.deepEqual(result.professionOids, [care, consulting]);
  assert.throws(() => result.professionOids.push(care), TypeError);
  assert.throws(() => { result.professions[0].telematikId = '10-FORGED'; }, TypeError);
  assert.throws(() => { result.telematikId = '10-FORGED'; }, TypeError);
  const hp = readKimAdmission(wrap(professionDer({ professionOid: '1.2.276.0.76.4.232' }),
    professionDer({ professionOid: '1.2.276.0.76.4.234' })), HP);
  assert.equal(hp.professions.length, 2);
});

test('Admission: authority and extra metadata remain inert; role text never grants authority', () => {
  const dn = tlv(164, seq(set(seq(id('2.5.4.3'), utf8('Local test authority')))));
  const naming = seq(id('2.999.3'), tlv(22, Buffer.from('https://never-fetch.invalid/authority')), utf8('Local'));
  const extra = professionDer({ naming: [tlv(160, naming)], extra: [octets(wrap(professionDer({ telematikId: '9-IGNORED' })))] });
  const result = readKimAdmission(seq(dn, seq(seq(tlv(160, dn), tlv(161, naming), seq(extra)))), OSIG);
  assert.equal(result.telematikId, '10-LOCAL-TEST'); assert.deepEqual(result.professionOids, [care]);
  assert.equal(readKimAdmission(admissionDer({ professionItem: 'Not a grant of doctor permissions' }), OSIG).professionOids[0], care);
  assert.throws(() => readKimAdmission(admissionDer({ professionOid: '1.2.3', professionItem: 'Betriebsstätte Gesundheits-, Kranken- und Altenpflege' }), OSIG), rejects('KIM_ADMISSION_ROLE_UNSUPPORTED'));
});

test('Admission: exact TID bytes/case and a 128-character TID are preserved without sector guesses', () => {
  for (const tid of ['1-Local-Aa', '9-Org/Test+1', '10-' + 'a'.repeat(125), '11-TEST']) {
    assert.equal(readKimAdmission(admissionDer({ telematikId: tid }), OSIG).telematikId, tid);
  }
});

for (const [label, encoded, expected = 'FORMAT', type = OSIG] of [
  ['missing extension', undefined, 'MISSING'],
  ['empty extension', Buffer.alloc(0)],
  ['trailing DER', Buffer.concat([valid, Buffer.from([0])])],
  ['indefinite BER', Buffer.from([48, 128, 0, 0])],
  ['multiple Admissions', seq(seq(seq(seq(p)), seq(seq(p))))],
  ['no ProfessionInfo', wrap()],
  ['too many professions', wrap(...Array(17).fill(p))],
  ['duplicate roles', wrap(p, p), 'ROLE_DUPLICATE'],
  ['different TIDs', wrap(p, professionDer({ professionOid: consulting, telematikId: '10-OTHER' })), 'IDENTITY_CONFLICT'],
  ['TID case mismatch', wrap(p, professionDer({ professionOid: consulting, telematikId: '10-local-test' })), 'IDENTITY_CONFLICT'],
  ['missing registrationNumber', admissionDer({ telematikId: null }), 'TELEMATIK_ID'],
  ['multiple registrationNumbers', admissionDer({ extra: [printable('10-OTHER')] })],
  ['UTF8 registrationNumber', wrap(seq(seq(utf8('Care')), seq(id(care)), utf8('10-TEST'))), 'TELEMATIK_ID'],
  ['PrintableString professionItem', wrap(seq(seq(printable('Care')), seq(id(care)), printable('10-TEST')))],
  ['invalid UTF8', wrap(seq(seq(tlv(12, Buffer.from([0xc0, 0xaf]))), seq(id(care)), printable('10-TEST')))],
  ['BOM in text', admissionDer({ professionItem: '\ufeffCare' })],
  ['control character in text', admissionDer({ professionItem: 'Care\nForged' })],
  ['overlong professionItem', admissionDer({ professionItem: 'Ä'.repeat(129) })],
  ['two professionItems', wrap(seq(seq(utf8('Care'), utf8('Doctor')), seq(id(care)), printable('10-TEST')))],
  ['two professionOIDs', wrap(seq(seq(utf8('Care')), seq(id(care), id(consulting)), printable('10-TEST')))],
  ['nonminimal OID', wrap(seq(seq(utf8('Care')), seq(tlv(6, Buffer.from('2a808214004c048175', 'hex'))), printable('10-TEST')))],
  ['unterminated OID', wrap(seq(seq(utf8('Care')), seq(tlv(6, Buffer.from('2a8214004c0481', 'hex'))), printable('10-TEST')))],
  ['certificate type as a role', admissionDer({ professionOid: OSIG }), 'ROLE_UNSUPPORTED'],
  ['insured role in HBA', admissionDer({ professionOid: '1.2.276.0.76.4.49' }), 'ROLE_UNSUPPORTED', HP],
  ['technical FD role', admissionDer({ professionOid: '1.2.276.0.76.4.172' }), 'ROLE_UNSUPPORTED'],
  ['HBA role in SMC-B', admissionDer({ professionOid: '1.2.276.0.76.4.234' }), 'ROLE_TYPE_MISMATCH'],
  ['SMC-B role in HBA', valid, 'ROLE_TYPE_MISMATCH', HP],
  ['unknown future role', admissionDer({ professionOid: '1.2.276.0.76.4.999' }), 'ROLE_UNSUPPORTED'],
  ['unsupported certificate type', valid, 'CONFIGURATION', '1.2.3'],
  ['unsupported authority name form', seq(tlv(134, Buffer.from('https://unqueried.invalid')), seq(seq(seq(p))))],
  ['duplicated optional namingAuthority', wrap(professionDer({ naming: [tlv(160, seq()), tlv(160, seq())] }))],
  ['out-of-order optional fields', seq(seq(seq(seq(p), tlv(161, seq()))))],
  ['oversized opaque profession info', admissionDer({ extra: [octets(Buffer.alloc(1025))] })],
  ['oversized extension', Buffer.alloc(8193)],
]) test('Admission rejects ' + label, () => {
  assert.throws(() => readKimAdmission(encoded, type), rejects('KIM_ADMISSION_' + expected));
});

test('Admission: malformed TID formats never get silently normalized', () => {
  for (const tid of ['6-RESERVED', '12-FUTURE', '01-TEST', '0-TEST', '10-', '10- TEST', '10-TEST ', '10 TEST', '10-TEST\n', '10-TEST\0', '10-TЕST', '10-' + 'a'.repeat(126)]) {
    assert.throws(() => readKimAdmission(admissionDer({ telematikId: tid }), OSIG), e => /^KIM_ADMISSION_(?:FORMAT|TELEMATIK_ID)$/.test(e?.code));
  }
});

let f, snapshot, osig, aut, enc, rollover, rootKey, signingKey, authKey, recipientKey, rolloverKey;
before(async () => {
  f = await tslFixture();
  const startDate = new Date(f.now - 86400000).toISOString().replace(/[-:T]/g, '').slice(0, 14) + 'Z';
  osig = await f.pki.issueKim({ name: 'admission-osig', role: 'osig', startDate });
  aut = await f.pki.issueAut({ name: 'admission-aut', startDate });
  enc = await f.pki.issueKim({ name: 'admission-enc', startDate });
  rollover = await f.pki.issueKim({ name: 'admission-rollover', startDate });
  const key = async path => createPrivateKey({ key: await readFile(path), passphrase: f.pki.password });
  rootKey = await key(join(f.pki.dir, 'root.key')); signingKey = await key(osig.privateKeyPath); authKey = await key(aut.privateKeyPath);
  recipientKey = await key(enc.privateKeyPath); rolloverKey = await key(rollover.privateKeyPath);
  snapshot = await f.verifier().verify(await f.bundle());
});
after(async () => { await f?.close(); });

test('Admission: independent OpenSSL DER generation and certificate text decoding agree', async () => privateWorkspace(async file => {
  const path = await file('admission.cnf', `asn1=SEQUENCE:root
[root]
contents=SEQUENCE:admissions
[admissions]
entry=SEQUENCE:entry
[entry]
professions=SEQUENCE:professions
[professions]
profession=SEQUENCE:profession
[profession]
items=SEQUENCE:items
oids=SEQUENCE:oids
tid=PRINTABLESTRING:10-OPENSSL-TEST
[items]
item=UTF8:Local test institution
[oids]
oid=OID:1.2.276.0.76.4.245
`);
  const out = await file('admission.der', Buffer.alloc(0));
  await openssl(['asn1parse', '-genconf', path, '-out', out, '-noout']);
  const encoded = await readFile(out);
  assert.equal(readKimAdmission(encoded, OSIG).telematikId, '10-OPENSSL-TEST');
  const cert = withAdmission(osig.certificate, encoded, rootKey);
  assert.equal(new X509Certificate(cert).verify(new X509Certificate(f.pki.roots).publicKey), true);
  const decoded = (await openssl(['x509', '-inform', 'DER', '-noout', '-text'], { input: cert })).toString();
  assert.match(decoded, /10-OPENSSL-TEST/); assert.match(decoded, /1\.2\.276\.0\.76\.4\.245/);
}));

test('TSL Admission: original certificate hash, signed attributes and type share one actual issuer', () => {
  const result = snapshot.certificateAdmissionFor(osig.certificate, { policyList: TYPES.signing });
  assert.equal(result.certificateSha256, sha(new X509Certificate(osig.certificate).raw));
  assert.equal(result.issuerSha256, f.pki.rootFingerprint); assert.equal(result.identityStatus, 'unverified');
  assert.equal(result.admission.telematikId, '10-LOCAL-TEST');
  assert.deepEqual(snapshot.ocspPlanFor(osig.certificate, { policyList: TYPES.signing }).admission, result.admission);
  assert.throws(() => { result.admission = {}; }, TypeError);
  const altered = Buffer.from(new X509Certificate(osig.certificate).raw); altered[altered.length - 1] ^= 1;
  assert.throws(() => snapshot.certificateAdmissionFor(altered, { policyList: TYPES.signing }), rejects('KIM_TSL_ISSUER'));
  assert.throws(() => snapshot.certificateAdmissionFor(osig.certificate, { policyList: TYPES.signing, isCurrent: () => false }), rejects('KIM_TSL_SUPERSEDED'));
});

test('TSL Admission: a valid CA signature or good OCSP result cannot replace absent or inconsistent identity attributes', () => {
  for (const [encoded, error] of [[undefined, 'MISSING'], [admissionDer({ telematikId: null }), 'TELEMATIK_ID'],
    [admissionDer({ professionOid: '1.2.276.0.76.4.234' }), 'ROLE_TYPE_MISMATCH'],
    [wrap(p, professionDer({ professionOid: consulting, telematikId: '10-OTHER' })), 'IDENTITY_CONFLICT']]) {
    const cert = withAdmission(osig.certificate, encoded, rootKey);
    assert.equal(new X509Certificate(cert).verify(new X509Certificate(f.pki.roots).publicKey), true);
    const proof = f.proof(cert); assert.equal(snapshot.ocspVerifierFor(cert).verify({ certificate: cert, ...proof }).status, 'good');
    assert.equal(snapshot.certificateTypeFor(cert, { policyList: TYPES.signing }).certificateTypeOid, OSIG);
    assert.throws(() => snapshot.ocspPlanFor(cert, { policyList: TYPES.signing }), rejects('KIM_TSL_ADMISSION_' + error));
  }
});

test('TSL Admission: duplicate and critical extensions fail before attribute extraction', () => {
  for (const options of [{ duplicate: true }, { critical: true }]) {
    assert.throws(() => snapshot.certificateAdmissionFor(withAdmission(osig.certificate, valid, rootKey, options), { policyList: TYPES.signing }), e => e?.code?.startsWith('KIM_TSL_'));
  }
});

const sender = 'sender@local.kim.telematik-test', receiver = 'receiver@local.kim.telematik-test';
const cmsOptions = () => ({ message: Buffer.from('Local Admission fixture'), sender,
  recipients: [{ address: sender, certificate: enc.certificate }, { address: receiver, certificate: rollover.certificate }],
  signingCertificate: osig.certificate, signingKey, now: f.now });

test('CMS: key rollover certificates for the same recipient must have exactly the same TID', () => {
  const options = cmsOptions(); options.recipients[1].address = sender;
  const bytes = sealEccKimPayload(options);
  for (const [c, key] of [[enc, recipientKey], [rollover, rolloverKey]]) {
    const result = openEccKimPayload({ bytes, address: sender, recipientCertificate: c.certificate, privateKey: key, expectedSignerCertificate: osig.certificate, now: f.now });
    assert.deepEqual(result.message, options.message); assert.equal(result.identityStatus, 'unverified'); result.message.fill(0);
  }
  for (const tid of ['10-OTHER', '10-local-test']) {
    options.recipients[1].certificate = withAdmission(rollover.certificate, admissionDer({ telematikId: tid }), rootKey);
    assert.throws(() => sealEccKimPayload(options), e => e.message === 'KIM_CMS_RECIPIENT_IDENTITY_CONFLICT');
  }
});

test('CMS/AUT: malformed, duplicate and critical Admissions fail in software-key construction', () => {
  const options = cmsOptions();
  for (const invalid of [undefined, admissionDer({ telematikId: null }), admissionDer({ professionOid: '1.2.3' })]) {
    assert.throws(() => sealEccKimPayload({ ...options, signingCertificate: withAdmission(osig.certificate, invalid, rootKey) }), /KIM_CMS_CERTIFICATE/);
    assert.throws(() => sealEccKimPayload({ ...options, recipients: [{ address: sender, certificate: withAdmission(enc.certificate, invalid, rootKey) }] }), /KIM_CMS_CERTIFICATE/);
    assert.throws(() => createEccKimAuth({ sender, certificate: withAdmission(aut.certificate, invalid, rootKey), privateKey: authKey, cmVersion: 'TEST_0.1.0', now: f.now }), /KIM_AUTH_SIGNING_REJECTED/);
  }
  for (const ext of [{ duplicate: true }, { critical: true }]) {
    assert.throws(() => sealEccKimPayload({ ...options, signingCertificate: withAdmission(osig.certificate, valid, rootKey, ext) }), /KIM_CMS_CERTIFICATE/);
    assert.throws(() => createEccKimAuth({ sender, certificate: withAdmission(aut.certificate, valid, rootKey, ext), privateKey: authKey, cmVersion: 'TEST_0.1.0', now: f.now }), /KIM_AUTH_SIGNING_REJECTED/);
  }
});

test('AUT receive: a mathematically valid token cannot bypass missing Admission through x5c or sub', () => {
  const options = { sender, certificate: aut.certificate, privateKey: authKey, cmVersion: 'TEST_0.1.0', now: f.now };
  const good = createEccKimAuth(options), [h, p] = good.slice(7).split('.');
  assert.equal(verifyReceivedEccKimAuth({ ...options, expectedCertificate: aut.certificate, header: good }).identityStatus, 'unverified');
  const bad = withAdmission(aut.certificate, undefined, rootKey), header = JSON.parse(Buffer.from(h, 'base64url'));
  header.x5c = [bad.toString('base64')];
  const data = Buffer.from(JSON.stringify(header)).toString('base64url') + '.' + p;
  const signature = sign('sha256', Buffer.from(data), { key: authKey, dsaEncoding: 'ieee-p1363' });
  assert.throws(() => verifyReceivedEccKimAuth({ ...options, expectedCertificate: bad, header: `Bearer ${data}.${signature.toString('base64url')}` }), /KIM_AUTH_REJECTED/);
});

test('KIM local message: distinct OSIG/AUT TIDs are not mistaken for a recipient identity conflict', () => {
  const authCertificate = withAdmission(aut.certificate, admissionDer({ telematikId: '10-AUTH-OTHER' }), rootKey);
  const result = createEccKimMessage({ ...cmsOptions(), message: Buffer.from(`From: ${sender}\r\nTo: ${receiver}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain\r\n\r\nLocal test\r\n`),
    envelopeRecipients: [receiver], authCertificate, authKey, cmVersion: 'TEST_0.1.0', ptVersion: '1.5.5' });
  const opened = openEccKimMessage({ bytes: result.bytes, address: receiver, recipientCertificate: rollover.certificate, privateKey: rolloverKey,
    expectedSignerCertificate: osig.certificate, expectedAuthCertificate: authCertificate, now: f.now });
  assert.equal(opened.identityStatus, 'unverified'); assert.equal(opened.deliveryStatus, 'held-for-trust-validation'); opened.message.fill(0);
});
