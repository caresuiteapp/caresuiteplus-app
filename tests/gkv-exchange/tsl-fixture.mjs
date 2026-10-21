import { createHash, createPrivateKey, X509Certificate, sign, constants } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { testPki } from './pki-fixture.mjs';
import { TslVerifier } from '../../services/kim/tsl.mjs';
import { PinnedOcspVerifier } from '../../services/kim/ocsp.mjs';
import { certificateParts, der, fields } from '../../services/gkv/der.mjs';
import { tlv, sequence as seq, objectId as id, octets } from '../../services/kim/cms-codec.mjs';

export const CA = 'http://uri.etsi.org/TrstSvc/Svctype/CA/PKC', OCSP = 'http://uri.etsi.org/TrstSvc/Svctype/Certstatus/OCSP';
export const ACTIVE = 'http://uri.etsi.org/TrstSvc/Svcstatus/inaccord', REVOKED = 'http://uri.etsi.org/TrstSvc/Svcstatus/revoked';
const hash = b => createHash('sha256').update(b).digest();
const raw = c => new X509Certificate(c).raw;
const pin = certificate => ({ certificate, sha256: hash(raw(certificate)).toString('hex') });
const time = n => tlv(24, Buffer.from(new Date(n).toISOString().replace(/[-:T]/g, '').slice(0, 14) + 'Z'));
const sha = () => seq(id('608648016503040201'));
const pss = () => seq(id('2a864886f70d01010a'), seq(tlv(160, sha()), tlv(161, seq(id('2a864886f70d010108'), sha())), tlv(162, tlv(2, Buffer.from([32])))));

function xmlFixture(data) {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', ['-I', fileURLToPath(new URL('./tsl-xml-fixture.py', import.meta.url))], { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = [], errors = [];
    child.stdout.on('data', c => chunks.push(c)); child.stderr.on('data', c => errors.push(c));
    child.on('error', reject); child.on('close', c => c ? reject(new Error(Buffer.concat(errors).toString())) : resolve(JSON.parse(Buffer.concat(chunks))));
    child.stdin.end(JSON.stringify(data));
  });
}
export async function tslFixture() {
  const pki = await testPki(), signer = await pki.issueTsl(), responder = await pki.issueOcsp();
  const readKey = async c => createPrivateKey({ key: await readFile(c.privateKeyPath), passphrase: pki.password });
  const responderKey = await readKey(responder), keys = new Map([[signer.certificate, await readKey(signer)], [responder.certificate, responderKey]]);
  const now = Math.floor(Date.now() / 1000) * 1000;
  const authorities = [{ issuer: pin(pki.roots), responder: pin(responder.certificate) }];
  const statusVerifier = (clock = () => now) => new PinnedOcspVerifier({ authorities, validFrom: now - 1000, validUntil: now + 7200_000, clock });
  const services = [{ type: CA, certificate: raw(pki.roots).toString('base64'), status: ACTIVE, started: now - 1000 },
    { type: OCSP, certificate: raw(responder.certificate).toString('base64'), status: ACTIVE, started: now - 1000 }];
  const proof = (certificate = signer.certificate, { state = 'good', producedAt = now, responder: statusSigner = responder } = {}) => {
    const request = statusVerifier().createRequest(certificate);
    const certID = fields(fields(fields(fields(der(request), 48, 1)[0], 48, 1)[0], 48, 1)[0], 48, 1)[0].raw;
    const status = state === 'revoked' ? tlv(161, time(producedAt - 1000)) : tlv(state === 'unknown' ? 130 : 128, Buffer.alloc(0));
    const certHash = seq(id('2b2408030d'), octets(seq(sha(), octets(hash(raw(certificate))))));
    const single = seq(certID, status, time(producedAt), ...(state === 'unknown' ? [] : [tlv(161, seq(certHash))]));
    const data = seq(tlv(161, certificateParts(raw(statusSigner.certificate)).subject.raw), time(producedAt), seq(single));
    const basic = seq(data, seq(id('2a8648ce3d040302')), tlv(3, Buffer.concat([Buffer.from([0]), sign('sha256', data, keys.get(statusSigner.certificate))])), tlv(160, seq(raw(statusSigner.certificate))));
    return { request, response: seq(tlv(10, Buffer.from([0])), tlv(160, seq(id('2b0601050507300101'), octets(basic)))) };
  };
  const keyFor = async s => { if (!keys.has(s.certificate)) keys.set(s.certificate, await readKey(s)); return keys.get(s.certificate); };
  const detach = async (xml, s = signer, { wrapped = false } = {}) => {
    const key = await keyFor(s), rsa = key.asymmetricKeyType === 'rsa';
    const signature = sign('sha256', xml, rsa ? { key, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 } : key);
    return seq(rsa ? pss() : seq(id('2a8648ce3d040302')), rsa || wrapped ? tlv(3, Buffer.concat([Buffer.from([0]), signature])) : signature, raw(s.certificate));
  };
  const bundle = async (changes = {}) => {
    const s = changes.signer ?? signer, key = await keyFor(s), rsa = key.asymmetricKeyType === 'rsa';
    const value = await xmlFixture({ id: 'TSL_10001', sequence: 10001, issuedAt: now - 1000, nextUpdate: now + 7 * 86400_000,
      services, ...changes, signer: raw(s.certificate).toString('base64'),
      signatureMethod: rsa ? 'http://www.w3.org/2007/05/xmldsig-more#sha256-rsa-MGF1' : 'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256' });
    const inner = sign('sha256', Buffer.from(value.signedInfo, 'base64'), rsa ? { key, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 } : { key, dsaEncoding: 'ieee-p1363' });
    const xml = Buffer.from(value.xml.replace('U0lHTkFUVVJF', inner.toString('base64')));
    return { xml, detachedSignature: await detach(xml, s, changes), signerStatus: proof(s.certificate) };
  };
  const verifier = (changes = {}) => {
    const clock = changes.clock ?? (() => now);
    return new TslVerifier({ anchors: [pin(pki.roots)], signerStatusVerifier: statusVerifier(clock), environment: 'test',
      validFrom: now - 1000, validUntil: now + 86400_000, clock, ...changes });
  };
  const issueSigner = options => pki.issueTsl({ ...options, startDate: new Date(now - 86400_000).toISOString().replace(/[-:T]/g, '').slice(0, 14) + 'Z' });
  const issueResponder = async options => {
    const value = await pki.issueOcsp({ ...options, startDate: new Date(now - 86400_000).toISOString().replace(/[-:T]/g, '').slice(0, 14) + 'Z' });
    keys.set(value.certificate, await readKey(value)); return value;
  };
  return { pki, signer, responder, now, services, proof, detach, bundle, verifier, statusVerifier, issueSigner, issueResponder, pin, close: () => pki.close() };
}
