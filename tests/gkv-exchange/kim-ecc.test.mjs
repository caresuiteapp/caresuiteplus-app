import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createPrivateKey, X509Certificate, randomBytes, createCipheriv, createDecipheriv, sign } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { testPki } from './pki-fixture.mjs';
import { openssl } from '../../services/gkv/openssl.mjs';
import { der, fields, certificateParts } from '../../services/gkv/der.mjs';
import { aes256Cmac } from '../../services/kim/cmac.mjs';
import { encryptEciesKey, decryptEciesKey, inspectEciesKey } from '../../services/kim/ecies.mjs';
import { inspectKimEnvelope, readKimEnvelope } from '../../services/kim/envelope.mjs';
import { sealEccKimPayload, openEccKimPayload, verifyEccKimSignedContent } from '../../services/kim/ecc-cms.mjs';

// Independent test DER writer. It deliberately does not import the production writer.
const hex = value => Buffer.from(value, 'hex');
function tlv(tag, value) {
  const n = value.length, h = n.toString(16).padStart(Math.ceil(n.toString(16).length / 2) * 2, '0');
  return Buffer.concat([Buffer.from([tag]), n < 128 ? Buffer.from([n]) : Buffer.concat([Buffer.from([128 + h.length / 2]), hex(h)]), value]);
}
const seq = (...parts) => tlv(48, Buffer.concat(parts));
const set = (...parts) => tlv(49, Buffer.concat([...parts].sort(Buffer.compare)));
const oid = h => tlv(6, hex(h)), octet = b => tlv(4, b);
const encOid = '2a8214004c04815e';
const sender = 'sender@local.kim.telematik-test', receiver = 'receiver@local.kim.telematik-test';
const message = Buffer.concat([Buffer.from(`From: ${sender}\r\nTo: ${receiver}\r\nSubject: Lokale ECC-Pruefung\r\nContent-Type: application/octet-stream\r\n\r\n`), Buffer.from([0, 1, 128, 255, 13, 10])]);
let pki, osig, encSender, encReceiver, otherSigner, wrongCurve, wrongUsage, keySender, keyReceiver, keySigner, cms;
before(async () => {
  pki = await testPki();
  osig = await pki.issueKim({ name: 'osig', role: 'osig' });
  encSender = await pki.issueKim({ name: 'enc-sender' });
  encReceiver = await pki.issueKim({ name: 'enc-receiver', policy: '1.2.276.0.76.4.74' });
  otherSigner = await pki.issueKim({ name: 'other-osig', role: 'osig' });
  wrongCurve = await pki.issueKim({ name: 'enc-nist', curve: 'prime256v1' });
  wrongUsage = await pki.issueKim({ name: 'osig-aut-usage', role: 'osig', usage: 'digitalSignature' });
  keySender = createPrivateKey({ key: await readFile(encSender.privateKeyPath), passphrase: pki.password });
  keyReceiver = createPrivateKey({ key: await readFile(encReceiver.privateKeyPath), passphrase: pki.password });
  keySigner = createPrivateKey({ key: await readFile(osig.privateKeyPath), passphrase: pki.password });
  cms = seal();
});
after(async () => { await pki?.close(); });
function seal(overrides = {}) {
  return sealEccKimPayload({ message, sender, recipients: [{ address: sender, certificate: encSender.certificate }, { address: receiver, certificate: encReceiver.certificate }],
    signingCertificate: osig.certificate, signingKey: keySigner, ...overrides });
}
function open(bytes = cms, overrides = {}) {
  return openEccKimPayload({ bytes, address: receiver, recipientCertificate: encReceiver.certificate, privateKey: keyReceiver, expectedSignerCertificate: osig.certificate, ...overrides });
}
function outer(bytes) { return fields(fields(fields(der(bytes), 48)[1], 160)[0], 48); }
function replaceOuter(bytes, index, replacement) {
  const ci = fields(der(bytes), 48), nodes = outer(bytes).map(n => n.raw); nodes[index] = replacement;
  return seq(ci[0].raw, tlv(160, seq(...nodes)));
}
function decryptForInspection(bytes) {
  const f = readKimEnvelope(bytes), rid = seq(certificateParts(new X509Certificate(encReceiver.certificate).raw).issuer, certificateParts(new X509Certificate(encReceiver.certificate).raw).serial).toString('hex');
  const transport = decryptEciesKey(f.keys.find(k => k.rid === rid).encryptedKey, keyReceiver);
  const decipher = createDecipheriv('aes-256-gcm', transport, f.nonce); decipher.setAuthTag(f.tag);
  return { clear: Buffer.concat([decipher.update(f.ciphertext), decipher.final()]), transport };
}
function repackInner(bytes, clear, transport) {
  const data = outer(bytes), content = fields(data[2], 48);
  // Rebuild with a fresh explicit IV. Used only for deliberate signed-container tampering.
  const nonce = randomBytes(12), actual = createCipheriv('aes-256-gcm', transport, nonce);
  const ciphertext = Buffer.concat([actual.update(clear), actual.final()]);
  const replacement = seq(content[0].raw, seq(oid('60864801650304012e'), seq(octet(nonce), tlv(2, hex('10')))), tlv(128, ciphertext));
  return replaceOuter(replaceOuter(bytes, 2, replacement), 3, octet(actual.getAuthTag()));
}
function signedBytes(clear) { return clear.subarray(clear.indexOf('\r\n\r\n') + 4); }
function signedNodes(bytes) { return fields(fields(fields(der(bytes), 48)[1], 160)[0], 48); }

test('AES-256 CMAC matches four published NIST vectors, including empty and partial final blocks', () => {
  // NIST AES_CMAC.pdf, CMAC-AES256 examples 1..4 (0,16,20,64 bytes).
  const key = hex('603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4');
  const plaintext = hex('6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411e5fbc1191a0a52eff69f2445df4f9b17ad2b417be66c3710');
  for (const [size, tag] of [[0, '028962f61b7bf89efc6b551f4667d983'], [16, '28a7023f452e8f82bd4bf28d8c37c35c'], [20, '156727dc0878944a023c1fe03bad6d93'], [64, 'e1992190549f6ed5696a2c056c315410']]) {
    assert.equal(aes256Cmac(key, plaintext.subarray(0, size)).toString('hex'), tag);
  }
  assert.throws(() => aes256Cmac(Buffer.alloc(16), plaintext), /CMAC_INPUT/);
});

test('TI ECIES decoder accepts the published gemSpec_Krypt card-format example', () => {
  // Published STRUCTURE example, not a known-answer decryption vector (no private key published).
  const vector = Buffer.from('poGOBgkrJAMDAggBAQd/SUOGQQRouC6tM2TQQ+RP3pptgdAaDF8Te7IVCkUBe2H+PJSLK4W/BXIXkndiBwEfftd5wk4pjzCdC2j1q14/CIWcW89nhjEC7G47UAu2ZqmbIhxstkXV3UI2UUek/qwBwtb26aUild+5kkTZXf5674OKHSdj6IFwjggvhYt9b/CTsA==', 'base64');
  const value = inspectEciesKey(vector);
  assert.equal(value.point.length, 65); assert.equal(value.ciphertext.length, 48);
  assert.equal(value.tag.toString('hex'), '2f858b7d6ff093b0');
});

test('TI ECIES encrypts real 32-byte keys with a fresh ephemeral key for every recipient/use', () => {
  const key = randomBytes(32), publicKey = new X509Certificate(encReceiver.certificate).publicKey;
  const a = encryptEciesKey(key, publicKey), b = encryptEciesKey(key, publicKey);
  assert.equal(a.length, 145); assert.notDeepEqual(a, b);
  assert.deepEqual(decryptEciesKey(a, keyReceiver), key); assert.deepEqual(decryptEciesKey(b, keyReceiver), key);
  assert.throws(() => decryptEciesKey(a, keySender), /ECIES_REJECTED/);
  assert.throws(() => encryptEciesKey(Buffer.alloc(31), publicKey), /ECIES_REJECTED/);
  assert.throws(() => encryptEciesKey(key, generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey), /ECIES_REJECTED/);
});

test('TI ECIES rejects altered lengths, OID, point encoding, cipher marker, ciphertext and MAC', () => {
  const bytes = encryptEciesKey(randomBytes(32), new X509Certificate(encReceiver.certificate).publicKey);
  for (const offset of [0, 1, 2, 13, 14, 16, 17, 18, 19, 84, 85, 86, 87, 134, 135, 136, 137, 144]) {
    const changed = Buffer.from(bytes); changed[offset] ^= 1;
    assert.throws(() => decryptEciesKey(changed, keyReceiver), /ECIES_REJECTED/, `offset ${offset}`);
  }
  const offCurve = Buffer.from(bytes); offCurve.fill(0, 20, 84);
  for (const bad of [offCurve, bytes.subarray(1), Buffer.concat([bytes, Buffer.from([0])])]) assert.throws(() => inspectEciesKey(bad), /ECIES_REJECTED/);
  const substitutedPoint = Buffer.from(bytes), other = encryptEciesKey(randomBytes(32), new X509Certificate(encReceiver.certificate).publicKey);
  other.copy(substitutedPoint, 19, 19, 84);
  assert.throws(() => decryptEciesKey(substitutedPoint, keyReceiver), /ECIES_REJECTED/);
});

// CLI reference path: separate ECDH, SHA-256, AES-ECB/CBC and CMAC operations.
// Only random, short-lived TEST keys appear in CLI arguments. Never used for application secrets.
async function referenceKeys(privateKeyPath, publicDer, password) {
  const peer = join(pki.dir, 'ecies-reference-peer.der'); await writeFile(peer, publicDer, { mode: 0o600 });
  const shared = await openssl(['pkeyutl', '-derive', '-inkey', privateKeyPath, ...(password ? ['-passin', 'fd:3'] : []), '-peerkey', peer, '-peerform', 'DER'], { password });
  const enc = await openssl(['dgst', '-sha256', '-binary'], { input: Buffer.concat([shared, hex('00000001')]) });
  const mac = await openssl(['dgst', '-sha256', '-binary'], { input: Buffer.concat([shared, hex('00000002')]) });
  const iv = await openssl(['enc', '-aes-256-ecb', '-nopad', '-K', enc.toString('hex')], { input: Buffer.alloc(16) });
  return { enc, mac, iv };
}
const publicDer = point => Buffer.concat([hex('305a301406072a8648ce3d020106092b2403030208010107034200'), point]);
async function referenceTag(key, ciphertext) {
  const padded = Buffer.concat([ciphertext, hex('80000000000000000000000000000000')]);
  const mac = await openssl(['mac', '-cipher', 'AES-256-CBC', '-macopt', `hexkey:${key.toString('hex')}`, '-binary', 'CMAC'], { input: padded });
  return mac.subarray(0, 8);
}
test('OpenSSL CLI independently derives, authenticates and decrypts the generated TI ECIES transport', async () => {
  const key = randomBytes(32), value = encryptEciesKey(key, new X509Certificate(encReceiver.certificate).publicKey);
  const k = await referenceKeys(encReceiver.privateKeyPath, publicDer(value.subarray(19, 84)), pki.password);
  assert.deepEqual(await referenceTag(k.mac, value.subarray(87, 135)), value.subarray(137));
  const clear = await openssl(['enc', '-d', '-aes-256-cbc', '-nopad', '-K', k.enc.toString('hex'), '-iv', k.iv.toString('hex')], { input: value.subarray(87, 135) });
  assert.deepEqual(clear, Buffer.concat([key, hex('80000000000000000000000000000000')]));
  const shape = await openssl(['asn1parse', '-inform', 'DER'], { input: value });
  assert.match(shape.toString(), /brainpoolP256r1/); assert.match(shape.toString(), /appl \[ 73 \]/);
});

test('TI ECIES decrypts a CLI-generated counterpart and rejects an authenticated wrong ISO padding', async () => {
  const path = join(pki.dir, 'reference-ephemeral.pem');
  await openssl(['genpkey', '-algorithm', 'EC', '-pkeyopt', 'ec_paramgen_curve:brainpoolP256r1', '-out', path]);
  const publicBytes = await openssl(['pkey', '-in', path, '-pubout', '-outform', 'DER']);
  const key = randomBytes(32), k = await referenceKeys(path, new X509Certificate(encReceiver.certificate).publicKey.export({ type: 'spki', format: 'der' }));
  async function value(padding) {
    const cipher = await openssl(['enc', '-aes-256-cbc', '-nopad', '-K', k.enc.toString('hex'), '-iv', k.iv.toString('hex')], { input: Buffer.concat([key, padding]) });
    return Buffer.concat([hex('a6818e06092b24030302080101077f49438641'), publicBytes.subarray(-65), hex('863102'), cipher, hex('8e08'), await referenceTag(k.mac, cipher)]);
  }
  assert.deepEqual(decryptEciesKey(await value(hex('80000000000000000000000000000000')), keyReceiver), key);
  const bad = await value(Buffer.alloc(16, 16)); // PKCS#7 is not COS ISO padding.
  assert.throws(() => decryptEciesKey(bad, keyReceiver), /ECIES_REJECTED/);
});

test('ECC CMS signs then encrypts and recovers exact binary message bytes for sender and receiver', () => {
  assert.deepEqual(inspectKimEnvelope(cms, [sender, receiver]), { profile: 'ti-ecies-brainpoolp256r1-aes256gcm', recipients: 2 });
  assert.deepEqual(open().message, message);
  assert.deepEqual(open(cms, { address: sender.toUpperCase(), recipientCertificate: encSender.certificate, privateKey: keySender }).message, message);
  assert.equal(open().identityStatus, 'unverified');
  assert.equal(cms.includes(message), false); assert.equal(cms.includes(new X509Certificate(osig.certificate).raw), false);
  assert.notDeepEqual(seal(), cms);
});

test('OpenSSL verifies the actual inner ECDSA CMS and ESS certificate binding against the isolated CA', async () => {
  const { clear } = decryptForInspection(cms), signed = signedBytes(clear), data = signedNodes(signed);
  assert.equal(fields(data[3], 160).length, 1); assert.equal(fields(data[4], 49).length, 1);
  const independentlyVerified = await openssl(['cms', '-verify', '-binary', '-inform', 'DER', '-cades', '-nointern', '-certfile', osig.path,
    '-CAfile', join(pki.dir, 'root.pem'), '-no-CApath', '-no-CAstore', '-purpose', 'any'], { input: signed });
  assert.deepEqual(independentlyVerified, Buffer.concat([Buffer.from('Content-Type: message/rfc822\r\nMIME-Version: 1.0\r\n\r\n'), message]));
});

test('ECC CMS binds certificate roles, keys, validity and sender recovery before encrypting', () => {
  for (const change of [{ signingCertificate: wrongUsage.certificate }, { signingCertificate: encSender.certificate },
    { signingKey: keySender }, { signingCertificate: otherSigner.certificate }, { now: Date.now() + 31 * 86_400_000 },
    { recipients: [{ address: sender, certificate: wrongCurve.certificate }] },
    { recipients: [{ address: receiver, certificate: encReceiver.certificate }] },
    { recipients: [{ address: sender, certificate: encSender.certificate }, { address: receiver, certificate: encSender.certificate }] },
    { recipients: [{ address: sender, certificate: encSender.certificate + encReceiver.certificate }] }]) assert.throws(() => seal(change));
  for (const change of [{ expectedSignerCertificate: otherSigner.certificate }, { expectedSignerCertificate: undefined }, { privateKey: keySender },
    { address: sender }, { recipientCertificate: encSender.certificate }, { now: Date.now() + 31 * 86_400_000 }]) assert.throws(() => open(cms, change));
});

test('ECC CMS rejects ciphertext and GCM tag changes before returning plaintext', () => {
  const nodes = outer(cms), content = fields(nodes[2], 48);
  const cipher = Buffer.from(content[2].value); cipher[0] ^= 1;
  const tag = Buffer.from(nodes[3].value); tag[15] ^= 1;
  for (const changed of [replaceOuter(cms, 2, seq(content[0].raw, content[1].raw, tlv(128, cipher))), replaceOuter(cms, 3, octet(tag))]) {
    assert.throws(() => open(changed), /DECRYPT_REJECTED/);
  }
});

test('Signed recipient-emails copy detects a validly structured change to an unprotected sender address', () => {
  const nodes = outer(cms), attr = fields(fields(nodes[4], 162)[0], 48), values = fields(fields(attr[1], 49)[0], 49);
  const entries = values.map(n => { const f = fields(n, 48); return seq(tlv(22, Buffer.from(f[0].value.toString() === sender ? 'attacker@local.kim.telematik-test' : f[0].value)), f[1].raw); });
  const changed = replaceOuter(cms, 4, tlv(162, seq(attr[0].raw, set(set(...entries)))));
  assert.equal(inspectKimEnvelope(changed, [receiver]).recipients, 2); // FD cannot know this was altered.
  assert.throws(() => open(changed), /SIGNATURE_REJECTED/);
});

test('Inner signature manipulation remains rejected even after a recipient regenerates a valid GCM envelope', () => {
  const { clear, transport } = decryptForInspection(cms), modified = Buffer.from(clear); modified[modified.length - 1] ^= 1;
  assert.throws(() => open(repackInner(cms, modified, transport)), /SIGNATURE_REJECTED/);
});

test('ECC outer parser rejects duplicate recipients, NULL algorithm parameters and malformed point wrappers', () => {
  const data = outer(cms), entries = fields(data[1], 49), r = fields(entries[0], 48);
  const nullAlgorithm = seq(r[0].raw, r[1].raw, seq(oid(encOid), tlv(5, Buffer.alloc(0))), r[3].raw);
  const corrupted = Buffer.from(r[3].value); corrupted[19] = 2;
  const badPoint = seq(r[0].raw, r[1].raw, r[2].raw, octet(corrupted));
  for (const recipients of [set(entries[0].raw, entries[0].raw), set(nullAlgorithm, entries[1].raw), set(badPoint, entries[1].raw), tlv(49, Buffer.concat(entries.map(n => n.raw).reverse()))]) {
    assert.throws(() => inspectKimEnvelope(replaceOuter(cms, 1, recipients), [receiver]), /ENVELOPE_INVALID/);
  }
  assert.throws(() => inspectKimEnvelope(Buffer.concat([cms, Buffer.from([0])]), [receiver]), /ENVELOPE_INVALID/);
});

test('ECC signed decoder rejects altered digest, ESS binding, extra certificates and signed-attribute duplicates', () => {
  const { clear } = decryptForInspection(cms), bytes = signedBytes(clear), data = signedNodes(bytes), ci = fields(der(bytes), 48);
  const si = fields(fields(data[4], 49)[0], 48), attrs = fields(si[3], 160).map(n => n.raw);
  const check = value => verifyEccKimSignedContent({ bytes: value, recipientEmails: readKimEnvelope(cms).recipientEmails, expectedSignerCertificate: osig.certificate });
  assert.deepEqual(check(bytes).content.subarray(-message.length), message);
  function rebuilt(newAttrs, certificates = data[3].raw) {
    const setBytes = set(...newAttrs), info = [...si.map(n => n.raw)]; info[3] = tlv(160, der(setBytes).value);
    info[5] = octet(sign('sha256', setBytes, keySigner)); // Valid signature isolates attribute policy checks.
    return seq(ci[0].raw, tlv(160, seq(data[0].raw, data[1].raw, data[2].raw, certificates, set(seq(...info)))));
  }
  for (const target of ['2a864886f70d010904', '2a864886f70d010910022f']) {
    const changed = attrs.map(a => { const value = fields(der(a), 48); if (value[0].value.toString('hex') !== target) return a; const b = Buffer.from(a); b[b.length - 1] ^= 1; return b; });
    assert.throws(() => check(rebuilt(changed)), /SIGNATURE_REJECTED/);
  }
  assert.throws(() => check(rebuilt([...attrs.slice(1), attrs[1]])), /SIGNATURE_REJECTED/);
  assert.throws(() => check(rebuilt(attrs, tlv(160, Buffer.concat([new X509Certificate(osig.certificate).raw, new X509Certificate(otherSigner.certificate).raw])))), /SIGNATURE_REJECTED/);
  assert.throws(() => check(rebuilt(attrs.reverse()).subarray(1)), /SIGNATURE_REJECTED/);
});

test('ECC codec enforces input bounds and supports multiple certificates for the same mailbox', () => {
  assert.throws(() => seal({ message: Buffer.alloc(0) }), /CMS_SIZE/);
  assert.throws(() => seal({ message: Buffer.alloc(15_000_001) }), /CMS_SIZE/);
  const repeatedAddress = seal({ recipients: [{ address: sender, certificate: encSender.certificate }, { address: sender.toUpperCase(), certificate: encReceiver.certificate }] });
  assert.equal(inspectKimEnvelope(repeatedAddress, [sender]).recipients, 1);
  assert.deepEqual(open(repeatedAddress, { address: sender }).message, message);
});
