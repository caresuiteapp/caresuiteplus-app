import { X509Certificate, createHash, verify, sign, randomUUID, constants } from 'node:crypto';
import { certificateParts, certificateKeyUsage, der, fields } from '../gkv/der.mjs';
import { kimAddress } from './address.mjs';
import { brainpoolPublicKey } from './ecies.mjs';
import { selectCertificateType, KIM_CERTIFICATE_TYPES } from './certificate-policy.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function base64(value, url = false) {
  if (typeof value !== 'string' || !value || !(url ? /^[A-Za-z0-9_-]+$/ : /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/).test(value)) throw new Error('KIM_AUTH_FORMAT');
  const bytes = Buffer.from(value, url ? 'base64url' : 'base64');
  if (bytes.toString(url ? 'base64url' : 'base64') !== value) throw new Error('KIM_AUTH_FORMAT');
  return bytes;
}
function json(value, allowed, arrayKey) {
  const source = new TextDecoder('utf-8', { fatal: true }).decode(base64(value, true));
  const object = JSON.parse(source);
  if (!object || typeof object !== 'object' || Array.isArray(object)) throw new Error('KIM_AUTH_FORMAT');
  // These JWT objects are deliberately flat, except the x5c string array. Detect duplicate keys,
  // including unicode escapes, before trusting JSON.parse's last-value semantics.
  const keys = [...source.matchAll(/("(?:[^"\\\x00-\x1f]|\\(?:["\\/bfnrt]|u[0-9A-Fa-f]{4}))*")\s*:/g)].map(m => JSON.parse(m[1]));
  if (keys.length !== Object.keys(object).length || new Set(keys).size !== keys.length
    || Object.entries(object).some(([k, v]) => !allowed.includes(k) || (typeof v === 'object' && (k !== arrayKey || !Array.isArray(v) || !v.every(x => typeof x === 'string'))))) throw new Error('KIM_AUTH_FORMAT');
  return object;
}
function policy(raw) {
  const extension = certificateParts(raw).tbs.find(n => n.tag === 163);
  if (!extension) return false;
  const policies = fields(fields(extension, 163, 1)[0], 48).filter(n => {
    const f = fields(n, 48); return f[0].tag === 6 && f[0].value.toString('hex') === '551d20';
  });
  if (policies.length !== 1) return false;
  const encoded = fields(policies[0], 48).at(-1);
  if (encoded.tag !== 4) return false;
  try { selectCertificateType(encoded.value, KIM_CERTIFICATE_TYPES.authentication); return true; }
  catch { return false; }
}
const validAt = (certificate, now) => now >= certificate.validFromDate.getTime() && now < certificate.validToDate.getTime();

const productVersion = '[0-9]{1,2}\\.[0-9]{1,2}\\.[0-9]{1,2}(?:-25[0-5]|-2[0-4][0-9]|-[0-1]?[0-9]?[0-9])?';
export const validCmVersion = value => typeof value === 'string' && new RegExp(`^[a-zA-Z0-9_]{1,5}_${productVersion}$`).test(value);
export const validPtVersion = value => typeof value === 'string' && new RegExp(`^${productVersion}$`).test(value);
export function unfoldAutHeader(value) {
  if (typeof value !== 'string' || value.length > 16_384 || !/^Bearer[ \t]+/i.test(value) || /[\r\n]/.test(value)) throw new Error('KIM_AUTH_REJECTED');
  return value.replace(/^Bearer[ \t]+/i, '').replace(/[ \t]/g, '');
}
function eccAutCertificate(input, now) {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error();
  if (typeof input === 'string') {
    if (input.length > 20_000 || !/^\s*-----BEGIN CERTIFICATE-----[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----\s*$/.test(input)) throw new Error();
  } else if (!(input instanceof Uint8Array) || !input.length || input.length > 12_000) throw new Error();
  const cert = new X509Certificate(input);
  if ((typeof input !== 'string' && !cert.raw.equals(Buffer.from(input))) || cert.raw.length > 12_000 || cert.ca || !validAt(cert, now)) throw new Error();
  brainpoolPublicKey(cert.publicKey);
  const nodes = certificateParts(cert.raw).tbs.filter(n => n.tag === 163), extensions = new Map();
  if (nodes.length !== 1) throw new Error();
  for (const n of fields(fields(nodes[0], 163, 1)[0], 48)) {
    const f = fields(n, 48), key = f[0]?.value.toString('hex');
    if (![2, 3].includes(f.length) || f[0]?.tag !== 6 || f.at(-1)?.tag !== 4 || extensions.has(key)
      || (f.length === 3 && (f[1].tag !== 1 || f[1].value.toString('hex') !== 'ff'))) throw new Error();
    extensions.set(key, f.at(-1).value);
  }
  const usage = der(extensions.get('551d0f') ?? Buffer.alloc(0));
  if (usage.tag !== 3 || usage.value.toString('hex') !== '0780' || !policy(cert.raw)) throw new Error();
  return cert;
}
/** Local software-key implementation of A_28582. A caller must still establish the
 * AUT certificate's TI trust and Telematik-ID/address binding, and supply an SMC-B adapter.
 * No vendor ID or admitted product version is assigned by this function.
 */
export function createEccKimAuth({ sender, certificate, privateKey, cmVersion, now = Date.now() }) {
  try {
    const cert = eccAutCertificate(certificate, now);
    if (!validCmVersion(cmVersion) || privateKey?.type !== 'private' || !cert.checkPrivateKey(privateKey)) throw new Error();
    const h = Buffer.from(JSON.stringify({ alg: 'BP256R1', typ: 'JWT', x5c: [cert.raw.toString('base64')] })).toString('base64url');
    const p = Buffer.from(JSON.stringify({ nbf: Math.floor(now / 1000), jti: randomUUID(), iss: cmVersion, sub: kimAddress(sender), aud: 'I_Message_Service' })).toString('base64url');
    const data = `${h}.${p}`, signature = sign('sha256', Buffer.from(data), { key: privateKey, dsaEncoding: 'ieee-p1363' });
    const header = `Bearer ${data}.${signature.toString('base64url')}`;
    if (header.length > 16_384) throw new Error();
    return header;
  } catch { throw new Error('KIM_AUTH_SIGNING_REJECTED'); }
}
/** Receiving-CM mathematical check, deliberately separate from the FD's TTL_MSG_AUTH.
 * Mail can be fetched much later. The expected leaf is explicit; x5c never establishes trust.
 * This limited ECC path always reports identityStatus=unverified, without TSL/OCSP/VZD.
 */
export function verifyReceivedEccKimAuth({ header, sender, expectedCertificate, cmVersion, now = Date.now() }) {
  try {
    const parts = unfoldAutHeader(header).split('.'); if (parts.length !== 3) throw new Error();
    const h = json(parts[0], ['alg', 'typ', 'x5c'], 'x5c'), p = json(parts[1], ['nbf', 'jti', 'iss', 'sub', 'aud']);
    if (h.alg !== 'BP256R1' || h.typ !== 'JWT' || !Array.isArray(h.x5c) || h.x5c.length !== 1
      || p.aud !== 'I_Message_Service' || kimAddress(p.sub) !== kimAddress(sender) || !validCmVersion(cmVersion) || p.iss !== cmVersion
      || !Number.isSafeInteger(p.nbf) || p.nbf < 0 || p.nbf > Math.floor(now / 1000)
      || typeof p.jti !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-)[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.jti)) throw new Error();
    const cert = eccAutCertificate(expectedCertificate, now), raw = base64(h.x5c[0]), signature = base64(parts[2], true);
    if (!raw.equals(cert.raw) || signature.length !== 64 || !verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), { key: cert.publicKey, dsaEncoding: 'ieee-p1363' }, signature)) throw new Error();
    return { certificateSha256: digest(raw), tokenId: p.jti, sender: kimAddress(p.sub), identityStatus: 'unverified' };
  } catch { throw new Error('KIM_AUTH_REJECTED'); }
}

/** Mathematical AUT verification against explicitly pinned issuing CAs, with an expiring trust snapshot.
 * This is NOT a TSL downloader/signature verifier. Issuers must eventually come from verified current
 * TI TSL service entries. There is no OS-root, x5c-root, network URL, or unverified-token fallback.
 * The SMTP FD does not perform AUT OCSP/TID-address lookup (A_23422-01); the receiving CM still must.
 */
export class PinnedAutVerifier {
  #issuers; #validFrom; #validUntil; #ttl; #clock;
  constructor({ issuers, validFrom, validUntil, ttlMinutes = 60, clock = Date.now }) {
    if (!Array.isArray(issuers) || !issuers.length || issuers.length > 100 || !Number.isSafeInteger(validFrom) || !Number.isSafeInteger(validUntil)
      || validUntil <= validFrom || validUntil - validFrom > 86_400_000 || !Number.isInteger(ttlMinutes) || ttlMinutes < 15 || ttlMinutes > 120) throw new Error('KIM_AUTH_TRUST_CONFIGURATION');
    this.#issuers = issuers.map(entry => {
      const cert = new X509Certificate(entry.certificate);
      if (!/^[a-f0-9]{64}$/.test(entry.sha256) || digest(cert.raw) !== entry.sha256 || !cert.ca || !(certificateKeyUsage(cert.raw) & 4)) throw new Error('KIM_AUTH_TRUST_CONFIGURATION');
      return cert;
    });
    this.#validFrom = validFrom; this.#validUntil = validUntil; this.#ttl = ttlMinutes * 60; this.#clock = clock;
  }
  verify(header, sender) {
    try {
      const now = this.#clock();
      if (!Number.isSafeInteger(now) || now < this.#validFrom || now >= this.#validUntil) throw new Error('KIM_AUTH_TRUST_UNAVAILABLE');
      if (typeof header !== 'string' || header.length > 16_384 || !/^Bearer[ \t]+/i.test(header)) throw new Error('KIM_AUTH_REJECTED');
      const token = header.replace(/^Bearer[ \t]+/i, '').replace(/[ \t]/g, ''), parts = token.split('.');
      if (parts.length !== 3) throw new Error('KIM_AUTH_REJECTED');
      const h = json(parts[0], ['alg', 'typ', 'x5c'], 'x5c'), p = json(parts[1], ['nbf', 'jti', 'iss', 'sub', 'aud', 'exp']);
      if (!['PS256', 'BP256R1'].includes(h.alg) || h.typ !== 'JWT' || !Array.isArray(h.x5c) || h.x5c.length !== 1
        || p.aud !== 'I_Message_Service' || kimAddress(p.sub) !== kimAddress(sender)
        || !Number.isSafeInteger(p.nbf) || p.nbf < 0 || now < p.nbf * 1000 || now >= (p.nbf + this.#ttl) * 1000
        || (p.exp !== undefined && (!Number.isSafeInteger(p.exp) || now >= p.exp * 1000 || p.exp <= p.nbf))
        || typeof p.iss !== 'string' || !p.iss.length || p.iss.length > 128 || /[^\x21-\x7e]/.test(p.iss)
        || typeof p.jti !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-)[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.jti)) throw new Error('KIM_AUTH_REJECTED');
      const raw = base64(h.x5c[0]); if (raw.length > 12_000) throw new Error('KIM_AUTH_REJECTED');
      const cert = new X509Certificate(raw);
      if (!cert.raw.equals(raw) || cert.ca || !validAt(cert, now) || !(certificateKeyUsage(raw) & 128) || !policy(raw)
        || !this.#issuers.some(issuer => validAt(issuer, now) && cert.checkIssued(issuer) && cert.verify(issuer.publicKey))) throw new Error('KIM_AUTH_REJECTED');
      const key = cert.publicKey, signature = base64(parts[2], true);
      let options;
      if (h.alg === 'BP256R1') {
        if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'brainpoolP256r1' || signature.length !== 64) throw new Error('KIM_AUTH_REJECTED');
        options = { key, dsaEncoding: 'ieee-p1363' };
      } else {
        if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails?.modulusLength < 2048) throw new Error('KIM_AUTH_REJECTED');
        options = { key, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 };
      }
      if (!verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), options, signature)) throw new Error('KIM_AUTH_REJECTED');
      return { certificateSha256: digest(raw), tokenId: p.jti, sender: kimAddress(sender), validUntil: Math.min((p.nbf + this.#ttl) * 1000, this.#validUntil, cert.validToDate.getTime()) };
    } catch (e) {
      if (e.message === 'KIM_AUTH_TRUST_UNAVAILABLE') throw e;
      throw new Error('KIM_AUTH_REJECTED');
    }
  }
}
