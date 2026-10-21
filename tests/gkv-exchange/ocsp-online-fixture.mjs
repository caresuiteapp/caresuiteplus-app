// Isolated local OCSP responder fixture, not an application responder or TI identity.
import { createHash, createPrivateKey, X509Certificate, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { certificateParts, der, fields } from '../../services/gkv/der.mjs';
import { tlv, sequence as seq, objectId as id, octets } from '../../services/kim/cms-codec.mjs';
import { testPki } from './pki-fixture.mjs';
import { PinnedOcspVerifier } from '../../services/kim/ocsp.mjs';
import { createEccKimMessage } from '../../services/kim/client-message.mjs';

const hash = b => createHash('sha256').update(b).digest();
const stamp = n => new Date(n).toISOString().replace(/[-:T]/g, '').slice(0, 14) + 'Z';
const time = n => tlv(24, Buffer.from(stamp(n)));
const sha256 = () => seq(id('608648016503040201'));
export async function onlineFixture() {
  const pki = await testPki(), responder = await pki.issueOcsp({ startDate: stamp(Date.now() - 86400_000) });
  const signing = await pki.issueKim({ name: 'online-osig', role: 'osig' }), authentication = await pki.issueAut({ name: 'online-aut' });
  const encSender = await pki.issueKim({ name: 'online-enc-sender' }), encReceiver = await pki.issueKim({ name: 'online-enc-receiver' });
  const readKey = async c => createPrivateKey({ key: await readFile(c.privateKeyPath), passphrase: pki.password });
  const key = await readKey(responder), now = Math.floor(Date.now() / 1000) * 1000;
  const pin = pem => ({ certificate: pem, sha256: hash(new X509Certificate(pem).raw).toString('hex') });
  const authorities = [{ issuer: pin(pki.roots), responder: pin(responder.certificate) }];
  const verifier = (clock = () => now, changes = {}) => new PinnedOcspVerifier({ authorities, validFrom: now - 1000, validUntil: now + 7200_000, clock, ...changes });
  const v = verifier(), identities = [signing, authentication].map(c => ({ raw: new X509Certificate(c.certificate).raw, request: v.createRequest(c.certificate) }));
  const response = (request, { state = 'good', producedAt = now, badSignature = false } = {}) => {
    const certificate = identities.find(c => c.request.equals(Buffer.from(request)))?.raw;
    if (!certificate) throw new Error('TEST_UNKNOWN_REQUEST');
    const certID = fields(fields(fields(fields(der(request), 48, 1)[0], 48, 1)[0], 48, 1)[0], 48, 1)[0].raw;
    const status = state === 'revoked' ? tlv(161, time(producedAt - 1000)) : tlv(state === 'unknown' ? 130 : 128, Buffer.alloc(0));
    const certHash = seq(id('2b2408030d'), octets(seq(sha256(), octets(hash(certificate)))));
    const single = seq(certID, status, time(producedAt), ...(state === 'unknown' ? [] : [tlv(161, seq(certHash))]));
    const signer = new X509Certificate(responder.certificate), data = seq(tlv(161, certificateParts(signer.raw).subject.raw), time(producedAt), seq(single));
    const signature = sign('sha256', data, key); if (badSignature) signature[signature.length - 1] ^= 1;
    const basic = seq(data, seq(id('2a8648ce3d040302')), tlv(3, Buffer.concat([Buffer.from([0]), signature])), tlv(160, seq(signer.raw)));
    return seq(tlv(10, Buffer.from([0])), tlv(160, seq(id('2b0601050507300101'), octets(basic))));
  };
  const sender = 'sender@local.kim.telematik-test', recipient = 'receiver@local.kim.telematik-test';
  const wire = createEccKimMessage({ message: Buffer.from(`From: ${sender}\r\nTo: ${recipient}\r\nSubject: Local durable status test\r\nMIME-Version: 1.0\r\nContent-Type: text/plain\r\n\r\nLOCAL PRIVATE TEST BODY\r\n`),
    sender, envelopeRecipients: [recipient], recipients: [{ address: sender, certificate: encSender.certificate }, { address: recipient, certificate: encReceiver.certificate }],
    signingCertificate: signing.certificate, signingKey: await readKey(signing), authCertificate: authentication.certificate, authKey: await readKey(authentication),
    cmVersion: 'TEST_0.1.0', ptVersion: '1.5.5', now });
  return { pki, signing, authentication, now, verifier, authorities, response,
    message: { bytes: wire.bytes, address: recipient, recipientCertificate: encReceiver.certificate, privateKey: await readKey(encReceiver),
      expectedSignerCertificate: signing.certificate, expectedAuthCertificate: authentication.certificate, now },
    close: () => pki.close() };
}
