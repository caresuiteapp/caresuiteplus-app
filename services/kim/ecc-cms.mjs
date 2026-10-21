import { X509Certificate, createHash, createPublicKey, randomBytes, createCipheriv, createDecipheriv, sign, verify, timingSafeEqual } from 'node:crypto';
import { der, fields, oid, certificateParts } from '../gkv/der.mjs';
import { kimAddress } from './address.mjs';
import { brainpoolPublicKey, encryptEciesKey, decryptEciesKey } from './ecies.mjs';
import { readKimEnvelope } from './envelope.mjs';
import { selectCertificateType, KIM_CERTIFICATE_TYPES } from './certificate-policy.mjs';
import { readKimAdmission, ADMISSION_EXTENSION_HEX } from './certificate-admission.mjs';
import { decodeKimMimeEntity } from './message.mjs';
import { OID, tlv, sequence as seq, sortedSet as set, objectId as id, octets, attribute, isOrdered } from './cms-codec.mjs';

const MAX_CONTENT = 15_000_000, MAX_CMS = 22_020_096;
const digest = bytes => createHash('sha256').update(bytes).digest();
const integer = n => tlv(2, Buffer.from([n]));
const sha256 = () => seq(id(OID.sha256));
const signedMime = Buffer.from('Content-Type: application/pkcs7-mime; smime-type=signed-data\r\nContent-Transfer-Encoding: binary\r\n\r\n');
const messageMime = Buffer.from('Content-Type: message/rfc822\r\nMIME-Version: 1.0\r\nContent-Transfer-Encoding: binary\r\n\r\n');
function inputBytes(bytes, limit) {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > limit) throw new Error('KIM_CMS_SIZE');
  return Buffer.from(bytes);
}
function hashAlgorithm(node) {
  const a = fields(node, 48); oid(a[0], OID.sha256);
  if (a.length > 2 || (a[1] && (a[1].tag !== 5 || a[1].value.length))) throw new Error('KIM_CMS_PROFILE');
}
/** Certificate type/key and Admission checks only. No claim of TI trust, OCSP, VZD or SMC-B key custody.
 * A receiver must supply the expected signer certificate from its own trusted resolution.
 * Neither an embedded leaf nor this module can make that resolution trusted.
 */
function certificate(input, role, now) {
  if (typeof input === 'string') {
    if (input.length > 20_000 || !/^\s*-----BEGIN CERTIFICATE-----[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----\s*$/.test(input)) throw new Error('KIM_CMS_CERTIFICATE');
  } else if (!(input instanceof Uint8Array) || input.length > 12_000) throw new Error('KIM_CMS_CERTIFICATE');
  const cert = new X509Certificate(input), parts = certificateParts(cert.raw);
  if (typeof input !== 'string' && !cert.raw.equals(Buffer.from(input))) throw new Error('KIM_CMS_CERTIFICATE');
  if (cert.ca || (now !== undefined && (!Number.isSafeInteger(now) || now < cert.validFromDate.getTime() || now >= cert.validToDate.getTime()))) throw new Error('KIM_CMS_CERTIFICATE');
  brainpoolPublicKey(cert.publicKey);
  const extensionNodes = parts.tbs.filter(n => n.tag === 163);
  if (extensionNodes.length !== 1) throw new Error('KIM_CMS_CERTIFICATE');
  const extensions = new Map();
  for (const e of fields(fields(extensionNodes[0], 163, 1)[0], 48)) {
    const f = fields(e, 48), key = f[0]?.value.toString('hex');
    if (f[0]?.tag !== 6 || ![2, 3].includes(f.length) || f.at(-1).tag !== 4 || extensions.has(key)
      || (f.length === 3 && (f[1].tag !== 1 || f[1].value.toString('hex') !== 'ff' || key === ADMISSION_EXTENSION_HEX))) throw new Error('KIM_CMS_CERTIFICATE');
    extensions.set(key, f.at(-1).value);
  }
  const usage = der(extensions.get('551d0f') ?? Buffer.alloc(0));
  // C.HCI.OSIG is nonRepudiation/contentCommitment, NOT the AUT digitalSignature role.
  const expectedUsage = role === 'osig' ? '0640' : '0308';
  if (usage.tag !== 3 || usage.value.toString('hex') !== expectedUsage) throw new Error('KIM_CMS_CERTIFICATE');
  try {
    const type = selectCertificateType(extensions.get('551d20'), KIM_CERTIFICATE_TYPES[role === 'osig' ? 'signing' : 'encryption']);
    const admission = readKimAdmission(extensions.get(ADMISSION_EXTENSION_HEX), type);
    return { cert, admission, rid: seq(parts.issuer, parts.serial) };
  } catch { throw new Error('KIM_CMS_CERTIFICATE'); }
}
function recipientsFor(sender, recipients, now) {
  if (!Array.isArray(recipients) || !recipients.length || recipients.length > 1000) throw new Error('KIM_CMS_RECIPIENTS');
  const identities = new Set(), addressIds = new Map(), entries = recipients.map(entry => {
    const address = kimAddress(entry.address), c = certificate(entry.certificate, 'enc', now), key = c.rid.toString('hex');
    if (identities.has(key)) throw new Error('KIM_CMS_RECIPIENTS');
    // KOM-LE-A_2178: key rollover may supply multiple certificates for one
    // address, but all must identify the same recipient. No first-match choice.
    if (addressIds.has(address) && addressIds.get(address) !== c.admission.telematikId) throw new Error('KIM_CMS_RECIPIENT_IDENTITY_CONFLICT');
    addressIds.set(address, c.admission.telematikId);
    identities.add(key); return { ...c, address };
  });
  if (!entries.some(e => e.address === kimAddress(sender))) throw new Error('KIM_CMS_SENDER_RECIPIENT');
  const emails = attribute(OID.emails, set(...entries.map(e => seq(tlv(22, Buffer.from(e.address, 'ascii')), e.rid))));
  return { entries, emails };
}
function encrypt(content, entries, emails) {
  const transport = randomBytes(32), nonce = randomBytes(12);
  try {
    const cipher = createCipheriv('aes-256-gcm', transport, nonce, { authTagLength: 16 });
    const encrypted = Buffer.concat([cipher.update(content), cipher.final()]);
    const keys = entries.map(e => seq(integer(0), e.rid, seq(id(OID.ecies)), octets(encryptEciesKey(transport, e.cert.publicKey))));
    const envelope = seq(integer(0), set(...keys), seq(id(OID.data), seq(id(OID.aes256gcm), seq(octets(nonce), integer(16))), tlv(128, encrypted)),
      octets(cipher.getAuthTag()), tlv(162, emails));
    const result = seq(id(OID.authEnvelope), tlv(160, envelope));
    if (result.length > MAX_CMS) throw new Error('KIM_CMS_SIZE');
    return result;
  } finally { transport.fill(0); }
}
function decrypt(bytes, recipientCertificate, privateKey, address) {
  let transport, pending;
  try {
    const parsed = readKimEnvelope(inputBytes(bytes, MAX_CMS), [address]);
    const recipient = certificate(recipientCertificate, 'enc'), rid = recipient.rid.toString('hex');
    if (!privateKey || privateKey.type !== 'private' || !recipient.cert.checkPrivateKey(privateKey)
      || !parsed.mappings.some(e => e.rid === rid && e.address === kimAddress(address))) throw new Error();
    const key = parsed.keys.find(k => k.rid === rid);
    if (!key || key.encryption !== OID.ecies) throw new Error();
    transport = decryptEciesKey(key.encryptedKey, privateKey);
    const decipher = createDecipheriv('aes-256-gcm', transport, parsed.nonce, { authTagLength: 16 });
    decipher.setAuthTag(parsed.tag);
    // No plaintext is exposed until GCM authentication has completed.
    pending = decipher.update(parsed.ciphertext);
    const content = Buffer.concat([pending, decipher.final()]);
    return { content, recipientEmails: parsed.recipientEmails };
  } catch { throw new Error('KIM_CMS_DECRYPT_REJECTED'); }
  finally { transport?.fill(0); pending?.fill(0); }
}
function timeAttribute(now) {
  if (!Number.isSafeInteger(now)) throw new Error('KIM_CMS_TIME');
  const iso = new Date(now).toISOString();
  if (!/^\d{4}-/.test(iso) || iso.slice(0, 4) < '1950') throw new Error('KIM_CMS_TIME');
  const value = iso.replace(/[-:T]/g, '').slice(0, 14) + 'Z';
  return tlv(iso.slice(0, 4) < '2050' ? 23 : 24, Buffer.from(iso.slice(0, 4) < '2050' ? value.slice(2) : value));
}
function signedContent(content, emails, signingCertificate, signingKey, now) {
  const c = certificate(signingCertificate, 'osig', now);
  if (!signingKey || signingKey.type !== 'private' || !c.cert.checkPrivateKey(signingKey)) throw new Error('KIM_CMS_SIGNING_KEY');
  brainpoolPublicKey(createPublicKey(signingKey));
  const attrs = set(attribute(OID.contentType, id(OID.data)), attribute(OID.messageDigest, octets(digest(content))),
    attribute(OID.signingTime, timeAttribute(now)), attribute(OID.signingCertificateV2, seq(seq(seq(octets(digest(c.cert.raw)))))), emails);
  const signature = sign('sha256', attrs, { key: signingKey, dsaEncoding: 'der' });
  const signerInfo = seq(integer(1), c.rid, sha256(), tlv(160, der(attrs).value), seq(id(OID.ecdsaSha256)), octets(signature));
  return seq(id(OID.signed), tlv(160, seq(integer(1), set(sha256()), seq(id(OID.data), tlv(160, octets(content))), tlv(160, c.cert.raw), set(signerInfo))));
}
function signedParts(bytes) {
  const ci = fields(der(inputBytes(bytes, MAX_CMS)), 48, 2); oid(ci[0], OID.signed);
  const data = fields(fields(ci[1], 160, 1)[0], 48, 5);
  const encapsulated = fields(data[2], 48, 2); oid(encapsulated[0], OID.data);
  const content = fields(encapsulated[1], 160, 1)[0];
  if (content.tag !== 4) throw new Error('KIM_CMS_PROFILE');
  return { data, content };
}
/** Verify the supported signed attributes and mathematical ECDSA signature against an explicit leaf.
 * This is NOT a certificate trust/OCSP validator or a general CAdES conformance check.
 */
export function verifyEccKimSignedContent({ bytes, recipientEmails, expectedSignerCertificate, now = Date.now() }) {
  try {
    const { data, content } = signedParts(bytes);
    if (data[0].tag !== 2 || data[0].value.toString('hex') !== '01') throw new Error();
    hashAlgorithm(fields(data[1], 49, 1)[0]);
    const embedded = fields(data[3], 160, 1)[0].raw, signer = certificate(expectedSignerCertificate, 'osig', now);
    if (!timingSafeEqual(digest(embedded), digest(signer.cert.raw)) || !embedded.equals(signer.cert.raw)) throw new Error();
    const info = fields(fields(data[4], 49, 1)[0], 48, 6);
    if (info[0].tag !== 2 || info[0].value.toString('hex') !== '01' || !info[1].raw.equals(signer.rid)) throw new Error();
    hashAlgorithm(info[2]); oid(fields(info[4], 48, 1)[0], OID.ecdsaSha256);
    const attrs = fields(info[3], 160, 5), byOid = new Map();
    if (!isOrdered(attrs)) throw new Error();
    for (const a of attrs) {
      const f = fields(a, 48, 2), key = f[0].value.toString('hex');
      if (f[0].tag !== 6 || byOid.has(key)) throw new Error();
      byOid.set(key, { node: a, value: fields(f[1], 49, 1)[0] });
    }
    oid(byOid.get(OID.contentType)?.value, OID.data);
    const hash = byOid.get(OID.messageDigest)?.value;
    if (hash?.tag !== 4 || hash.value.length !== 32 || !timingSafeEqual(hash.value, digest(content.value))) throw new Error();
    if (!(recipientEmails instanceof Uint8Array) || !byOid.get(OID.emails)?.node.raw.equals(Buffer.from(recipientEmails))) throw new Error();
    // ESS SigningCertificateV2: one certificate hash, default SHA-256, no extra policy entries.
    const ess = fields(fields(fields(byOid.get(OID.signingCertificateV2)?.value, 48, 1)[0], 48, 1)[0], 48, 1)[0];
    if (ess.tag !== 4 || ess.value.length !== 32 || !timingSafeEqual(ess.value, digest(signer.cert.raw))) throw new Error();
    const time = byOid.get(OID.signingTime)?.value, text = time?.value.toString('ascii');
    if (!time || time.value.some(b => b > 127) || !((time.tag === 23 && /^\d{12}Z$/.test(text)) || (time.tag === 24 && /^\d{14}Z$/.test(text)))) throw new Error();
    const full = time.tag === 23 ? (Number(text.slice(0, 2)) >= 50 ? '19' : '20') + text : text;
    const timestamp = Date.parse(`${full.slice(0, 4)}-${full.slice(4, 6)}-${full.slice(6, 8)}T${full.slice(8, 10)}:${full.slice(10, 12)}:${full.slice(12, 14)}Z`);
    if (!Number.isSafeInteger(timestamp) || !timeAttribute(timestamp).equals(time.raw)) throw new Error();
    if (info[5].tag !== 4 || info[5].value.length < 8 || info[5].value.length > 72) throw new Error();
    // Native ECDSA verifies the DER signature, including range checks for r and s.
    if (!verify('sha256', tlv(49, info[3].value), signer.cert.publicKey, info[5].value)) throw new Error();
    return { content: Buffer.from(content.value), signerSha256: digest(signer.cert.raw).toString('hex'),
      claimedSigningTime: timestamp, identityStatus: 'unverified' };
  } catch { throw new Error('KIM_CMS_SIGNATURE_REJECTED'); }
}
/** Low-level ECC CMS codec. Software KeyObjects permit local verification; this is not an
 * SMC-B/Konnektor adapter. Input is an RFC822 message, whose MIME/business semantics remain unchecked.
 * TSL, VZD/address binding, revocation and outer/inner header comparison remain required before use.
 */
export function sealEccKimPayload({ message, sender, recipients, signingCertificate, signingKey, now = Date.now() }) {
  const content = Buffer.concat([messageMime, inputBytes(message, MAX_CONTENT)]);
  let signed;
  try {
    const prepared = recipientsFor(sender, recipients, now);
    signed = signedContent(content, prepared.emails, signingCertificate, signingKey, now);
    const inner = Buffer.concat([signedMime, signed]);
    try { return encrypt(inner, prepared.entries, prepared.emails); }
    finally { inner.fill(0); }
  } finally { content.fill(0); signed?.fill(0); }
}
export function openEccKimPayload({ bytes, address, recipientCertificate, privateKey, expectedSignerCertificate, now = Date.now() }) {
  const result = inspectEccKimPayload({ bytes, address, recipientCertificate, privateKey, expectedSignerCertificate, now });
  if (result.signatureStatus !== 'verified') {
    result.message?.fill(0); throw new Error('KIM_CMS_SIGNATURE_REJECTED');
  }
  const { signatureStatus, ...opened } = result; return opened;
}
/** Internal diagnostic path for receive-error MIME. GCM MUST authenticate first.
 * A rejected signature can yield UNTRUSTED candidate bytes solely for an explicitly
 * configured diagnostic attachment. The strict open API above never returns them.
 * This status never asserts certificate trust; consumers must inspect signatureStatus.
 */
export function inspectEccKimPayload({ bytes, address, recipientCertificate, privateKey, expectedSignerCertificate, now = Date.now() }) {
  const result = decrypt(bytes, recipientCertificate, privateKey, address);
  let signed, decoded, candidate;
  try {
    decoded = decodeKimMimeEntity(result.content, { type: 'application/pkcs7-mime', smimeType: 'signed-data' });
    try {
      signed = verifyEccKimSignedContent({ bytes: decoded, recipientEmails: result.recipientEmails, expectedSignerCertificate, now });
    } catch {
      // Parse only the bounded SignedData eContent shape. No signature/authenticity
      // claim follows from this extraction, even when the MIME itself is well formed.
      try { candidate = decodeKimMimeEntity(signedParts(decoded).content.value, { type: 'message/rfc822' }); } catch { /* No recoverable RFC822 candidate. */ }
      return { ...(candidate ? { message: Buffer.from(candidate) } : {}), signatureStatus: 'rejected', identityStatus: 'unverified' };
    }
    candidate = decodeKimMimeEntity(signed.content, { type: 'message/rfc822' });
    return { message: Buffer.from(candidate), signerSha256: signed.signerSha256,
      claimedSigningTime: signed.claimedSigningTime, signatureStatus: 'verified', identityStatus: 'unverified' };
  } finally { result.content.fill(0); signed?.content.fill(0); decoded?.fill(0); candidate?.fill(0); }
}
