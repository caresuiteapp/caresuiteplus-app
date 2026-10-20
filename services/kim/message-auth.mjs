import { X509Certificate, createHash, verify, constants } from 'node:crypto';
import { certificateParts, certificateKeyUsage, der, fields } from '../gkv/der.mjs';
import { kimAddress } from './address.mjs';

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
  // gemSpec_OID: C.HP.AUT 1.2.276.0.76.4.75, C.HCI.AUT ...77.
  return fields(der(encoded.value), 48).some(n => {
    const f = fields(n, 48); return f[0].tag === 6 && ['2a8214004c044b', '2a8214004c044d'].includes(f[0].value.toString('hex'));
  });
}
const validAt = (certificate, now) => now >= certificate.validFromDate.getTime() && now < certificate.validToDate.getTime();

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
