import { X509Certificate, createHash, verify, constants } from 'node:crypto';
import { der, fields, certificateParts, rsaAlgorithm } from '../gkv/der.mjs';
import { tlv, sequence as seq, objectId as id, octets } from './cms-codec.mjs';

// Non-QES, current-time status evidence only. Explicit local pins are NOT a TI TSL.
const O = { basic: '2b0601050507300101', certHash: '2b2408030d', ocspSigning: '2b06010505070309',
  sha1: '2b0e03021a', sha256: '608648016503040201', sha384: '608648016503040202', sha512: '608648016503040203',
  ecdsa: '2a8648ce3d040302', pss: '2a864886f70d01010a' };
const AGE = 3_600_000, FUTURE = 300_000, MAX_RESPONSE = 262_144;
const digest = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest();
const hex = bytes => digest(bytes).toString('hex');
const fail = code => { throw new OcspError(code); };
export class OcspError extends Error {
  constructor(code) { super(code); this.name = 'OcspError'; this.code = code; }
}
function bounded(bytes, max) {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > max) fail('KIM_OCSP_SIZE');
  return Buffer.from(bytes);
}
function serial(n) {
  if (n?.tag !== 2 || !n.value.length || n.value.length > 20 || n.value.every(b => b === 0) || (n.value[0] & 128)
    || (n.value.length > 1 && n.value[0] === 0 && !(n.value[1] & 128))) fail('KIM_OCSP_FORMAT');
  return n.value.toString('hex');
}
function hashAlgorithm(node, allowed) {
  const a = fields(node, 48);
  const name = allowed.find(k => a[0]?.tag === 6 && a[0].value.toString('hex') === O[k]);
  if (!name || a.length > 2 || (a[1] && (a[1].tag !== 5 || a[1].value.length))) fail('KIM_OCSP_ALGORITHM');
  return name;
}
function extensions(node, wrapper, known = []) {
  const result = new Map();
  if (!node) return result;
  const values = fields(fields(node, wrapper, 1)[0], 48);
  if (!values.length || values.length > 32) fail('KIM_OCSP_FORMAT');
  for (const value of values) {
    const f = fields(value, 48), key = f[0]?.value.toString('hex');
    if (![2, 3].includes(f.length) || f[0]?.tag !== 6 || !f[0].value.length || f.at(-1)?.tag !== 4
      || result.has(key) || (f.length === 3 && (f[1].tag !== 1 || f[1].value.toString('hex') !== 'ff'))) fail('KIM_OCSP_FORMAT');
    if (f.length === 3 && !known.includes(key)) fail('KIM_OCSP_CRITICAL_EXTENSION');
    result.set(key, f.at(-1).value);
  }
  return result;
}
function certificate(input) {
  if (typeof input === 'string') {
    if (input.length > 20_000 || !/^\s*-----BEGIN CERTIFICATE-----[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----\s*$/.test(input)) fail('KIM_OCSP_CERTIFICATE');
  } else bounded(input, 12_000);
  const cert = new X509Certificate(input), p = certificateParts(cert.raw);
  if (cert.raw.length > 12_000 || (typeof input !== 'string' && !cert.raw.equals(Buffer.from(input)))
    || !p.tbs[2].raw.equals(p.signatureAlgorithm.raw)) fail('KIM_OCSP_CERTIFICATE');
  serial(der(p.serial));
  const nodes = p.tbs.filter(n => n.tag === 163);
  if (nodes.length !== 1) fail('KIM_OCSP_CERTIFICATE');
  // Unknown critical extensions cannot silently change the meaning of a pinned identity.
  const ext = extensions(nodes[0], 163, ['551d0f', '551d13', '551d25', '551d20']);
  const usage = der(ext.get('551d0f') ?? Buffer.alloc(0));
  if (usage.tag !== 3 || usage.value.length < 2 || usage.value.length > 3 || usage.value[0] > 7
    || (usage.value.at(-1) & ((1 << usage.value[0]) - 1))) fail('KIM_OCSP_CERTIFICATE');
  const spki = fields(p.tbs[6], 48, 2)[1];
  if (spki.tag !== 3 || spki.value[0] !== 0 || spki.value.length < 2) fail('KIM_OCSP_CERTIFICATE');
  return { cert, p, ext, usage: usage.value[1], keyBytes: spki.value.subarray(1), sha256: hex(cert.raw) };
}
const current = (c, now) => now >= c.cert.validFromDate.getTime() && now < c.cert.validToDate.getTime();
function signatureOptions(algorithm, key) {
  const a = fields(algorithm, 48), value = a[0]?.value.toString('hex');
  if (a[0]?.tag === 6 && value === O.ecdsa && a.length === 1 && key.asymmetricKeyType === 'ec'
    && key.asymmetricKeyDetails?.namedCurve === 'brainpoolP256r1') return { key, dsaEncoding: 'der' };
  if (value === O.pss && key.asymmetricKeyType === 'rsa' && key.asymmetricKeyDetails?.modulusLength >= 3072) {
    rsaAlgorithm(algorithm, 'pss');
    return { key, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 };
  }
  fail('KIM_OCSP_ALGORITHM');
}
function supportedResponderKey(key) {
  return (key.asymmetricKeyType === 'ec' && key.asymmetricKeyDetails?.namedCurve === 'brainpoolP256r1')
    || (key.asymmetricKeyType === 'rsa' && key.asymmetricKeyDetails?.modulusLength >= 3072);
}
function issuedBy(leaf, issuer) {
  if (!leaf.cert.checkIssued(issuer.cert) || !leaf.p.issuer.equals(issuer.p.subject.raw)) return false;
  signatureOptions(leaf.p.signatureAlgorithm, issuer.cert.publicKey);
  return leaf.cert.verify(issuer.cert.publicKey);
}
function certId(node) {
  const f = fields(node, 48, 4), algorithm = hashAlgorithm(f[0], ['sha1', 'sha256']);
  const length = algorithm === 'sha1' ? 20 : 32;
  if (f[1].tag !== 4 || f[2].tag !== 4 || f[1].value.length !== length || f[2].value.length !== length) fail('KIM_OCSP_FORMAT');
  return { algorithm, name: f[1].value.toString('hex'), key: f[2].value.toString('hex'), serial: serial(f[3]) };
}
const sameId = (a, b) => a.algorithm === b.algorithm && a.name === b.name && a.key === b.key && a.serial === b.serial;
function expectedId(leaf, issuer, algorithm) {
  // RFC 6960: issuerName is the checked certificate's issuer field; key hash omits BIT STRING framing.
  return seq(seq(id(O[algorithm])), octets(digest(leaf.p.issuer, algorithm)), octets(digest(issuer.keyBytes, algorithm)), leaf.p.serial);
}
function time(n) {
  if (n?.tag !== 24 || !/^[0-9]{14}Z$/.test(n.value.toString('ascii')) || n.value.some(b => b > 127)) fail('KIM_OCSP_TIME_FORMAT');
  const s = n.value.toString('ascii'), iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}.000Z`;
  const value = Date.parse(iso);
  if (!Number.isSafeInteger(value) || value < 0 || new Date(value).toISOString() !== iso) fail('KIM_OCSP_TIME_FORMAT');
  return value;
}
function singleResponse(node) {
  const f = fields(node, 48); let at = 3;
  if (f.length < 3 || f.length > 5) fail('KIM_OCSP_FORMAT');
  const identity = certId(f[0]), state = f[1]; let status, revokedAt, reason;
  if ([128, 130].includes(state.tag) && !state.value.length) status = state.tag === 128 ? 'good' : 'unknown';
  else if (state.tag === 161) {
    const rev = fields(state, 161);
    if (!rev.length || rev.length > 2) fail('KIM_OCSP_FORMAT');
    status = 'revoked'; revokedAt = time(rev[0]);
    if (rev[1]) {
      const r = fields(rev[1], 160, 1)[0];
      if (r.tag !== 10 || r.value.length !== 1 || ![0, 1, 2, 3, 4, 5, 6, 8, 9, 10].includes(r.value[0])) fail('KIM_OCSP_FORMAT');
      reason = r.value[0];
    }
  } else fail('KIM_OCSP_FORMAT');
  const thisUpdate = time(f[2]);
  const nextUpdate = f[at]?.tag === 160 ? time(fields(f[at++], 160, 1)[0]) : undefined;
  const ext = f[at] ? extensions(f[at++], 161, [O.certHash]) : new Map();
  if (at !== f.length) fail('KIM_OCSP_FORMAT');
  return { identity, status, thisUpdate, nextUpdate, revokedAt, reason, ext };
}
function responseData(bytes) {
  const r = fields(der(bounded(bytes, MAX_RESPONSE)), 48);
  if (r[0]?.tag !== 10 || r[0].value.length !== 1 || ![0, 1, 2, 3, 5, 6].includes(r[0].value[0])) fail('KIM_OCSP_FORMAT');
  if (r[0].value[0] !== 0) { if (r.length !== 1) fail('KIM_OCSP_FORMAT'); fail('KIM_OCSP_RESPONDER_ERROR'); }
  if (r.length !== 2) fail('KIM_OCSP_FORMAT');
  const response = fields(fields(r[1], 160, 1)[0], 48, 2);
  if (response[0].tag !== 6 || response[0].value.toString('hex') !== O.basic || response[1].tag !== 4) fail('KIM_OCSP_FORMAT');
  const b = fields(der(response[1].value), 48);
  if (b.length < 3 || b.length > 4 || b[2].tag !== 3 || b[2].value.length < 2 || b[2].value[0] !== 0) fail('KIM_OCSP_FORMAT');
  if (b[3]) {
    const certs = fields(fields(b[3], 160, 1)[0], 48);
    if (!certs.length || certs.length > 10) fail('KIM_OCSP_FORMAT');
    for (const c of certs) {
      if (c.raw.length > 12_000 || !new X509Certificate(c.raw).raw.equals(c.raw)) fail('KIM_OCSP_FORMAT');
    }
    // Included certificates are never a trust source or an automatic responder selection.
  }
  const data = fields(b[0], 48); // DER omits the default v1 version; other versions are unsupported.
  if (data.length < 3 || data.length > 4 || ![161, 162].includes(data[0].tag)) fail('KIM_OCSP_FORMAT');
  const producedAt = time(data[1]), nodes = fields(data[2], 48);
  if (!nodes.length || nodes.length > 100) fail('KIM_OCSP_FORMAT');
  const singles = nodes.map(singleResponse);
  if (singles.some((s, i) => singles.slice(0, i).some(v => sameId(v.identity, s.identity)))) fail('KIM_OCSP_FORMAT');
  // This non-QES request profile sends no nonce or extensions. Unknown noncritical response extensions are inert.
  extensions(data[3], 161);
  return { data: b[0].raw, algorithm: b[1], signature: b[2].value.subarray(1), responder: data[0], producedAt, singles };
}
function responderMatches(idNode, signer) {
  const n = fields(idNode, idNode.tag, 1)[0];
  return idNode.tag === 161 ? n.tag === 48 && n.raw.equals(signer.p.subject.raw)
    : n.tag === 4 && n.value.equals(digest(signer.keyBytes, 'sha1'));
}
function positiveStatement(single, leaf) {
  if (single.status === 'unknown') return; // No positive statement can be required for an unknown certificate.
  const value = single.ext.get(O.certHash);
  if (!value) fail('KIM_OCSP_CERTHASH_MISSING');
  const h = fields(der(value), 48, 2), name = hashAlgorithm(h[0], ['sha256', 'sha384', 'sha512']);
  if (h[1].tag !== 4 || !h[1].value.equals(digest(leaf.cert.raw, name))) fail('KIM_OCSP_CERTHASH_MISMATCH');
}

/** Bounded status checker with an explicit issuer->responder authorization snapshot.
 * Neither x5c/certs, the OS root store, AIA URLs nor a network response can add trust.
 * Pins must later be derived from authenticated current TI TSL service entries. This
 * class reports configured-pins/unverified even when the status is cryptographically good.
 */
export class PinnedOcspVerifier {
  #authorities; #from; #until; #clock;
  constructor({ authorities, validFrom, validUntil, clock = Date.now }) {
    try {
      if (!Array.isArray(authorities) || !authorities.length || authorities.length > 100 || typeof clock !== 'function'
        || !Number.isSafeInteger(validFrom) || validFrom < 0 || !Number.isSafeInteger(validUntil)
        || validUntil <= validFrom || validUntil - validFrom > 86_400_000) fail('KIM_OCSP_CONFIGURATION');
      this.#authorities = authorities.map(a => {
        const issuer = certificate(a.issuer.certificate), signer = certificate(a.responder.certificate);
        if (issuer.sha256 !== a.issuer.sha256 || signer.sha256 !== a.responder.sha256 || !issuer.cert.ca || !(issuer.usage & 4)
          || signer.cert.ca || !(signer.usage & 128)) fail('KIM_OCSP_CONFIGURATION');
        const eku = fields(der(signer.ext.get('551d25') ?? Buffer.alloc(0)), 48);
        if (eku.length !== 1 || eku[0].tag !== 6 || eku[0].value.toString('hex') !== O.ocspSigning) fail('KIM_OCSP_CONFIGURATION');
        // The responder is explicitly authorized by the snapshot, not by arbitrary issuer chains.
        // It may have a different issuing CA, as with TI TSL-listed OCSP service identities.
        if (!supportedResponderKey(signer.cert.publicKey)) fail('KIM_OCSP_CONFIGURATION');
        return { issuer, signer };
      });
      if (new Set(this.#authorities.map(a => a.issuer.sha256 + a.signer.sha256)).size !== authorities.length) fail('KIM_OCSP_CONFIGURATION');
      this.#from = validFrom; this.#until = validUntil; this.#clock = clock;
    } catch { fail('KIM_OCSP_CONFIGURATION'); }
  }
  #now() {
    const now = this.#clock();
    if (!Number.isSafeInteger(now) || now < this.#from || now >= this.#until) fail('KIM_OCSP_TRUST_UNAVAILABLE');
    return now;
  }
  #bindings(leaf, now) {
    if (leaf.cert.ca || !current(leaf, now)) fail('KIM_OCSP_CERTIFICATE');
    const matches = this.#authorities.filter(a => current(a.issuer, now) && current(a.signer, now) && issuedBy(leaf, a.issuer));
    if (!matches.length || new Set(matches.map(a => a.issuer.sha256)).size !== 1) fail('KIM_OCSP_ISSUER');
    return matches;
  }
  createRequest(input, { hashAlgorithm: algorithm = 'sha256' } = {}) {
    try {
      if (!['sha1', 'sha256'].includes(algorithm)) fail('KIM_OCSP_ALGORITHM');
      const leaf = certificate(input), [{ issuer }] = this.#bindings(leaf, this.#now());
      // One certificate, no requestorName, signature, nonce or identity-bearing extensions.
      return seq(seq(seq(seq(expectedId(leaf, issuer, algorithm)))));
    } catch (e) { if (e instanceof OcspError) throw e; fail('KIM_OCSP_REQUEST'); }
  }
  authorizesResponder(input, responderSha256) {
    try {
      if (typeof responderSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(responderSha256)) fail('KIM_OCSP_CONFIGURATION');
      return this.#bindings(certificate(input), this.#now()).some(a => a.signer.sha256 === responderSha256);
    } catch (e) { if (e instanceof OcspError) throw e; fail('KIM_OCSP_FORMAT'); }
  }
  verify({ certificate: input, request, response }) {
    try {
      const now = this.#now(), leaf = certificate(input), bindings = this.#bindings(leaf, now);
      const tbs = fields(fields(der(bounded(request, 4096)), 48, 1)[0], 48, 1);
      const requestId = certId(fields(fields(tbs[0], 48, 1)[0], 48, 1)[0]);
      const issuer = bindings[0].issuer;
      if (!sameId(requestId, certId(der(expectedId(leaf, issuer, requestId.algorithm))))) fail('KIM_OCSP_REQUEST_BINDING');
      const parsed = responseData(response), matches = parsed.singles.filter(s => sameId(requestId, s.identity));
      if (matches.length !== 1) fail('KIM_OCSP_RESPONSE_BINDING');
      const authorized = bindings.filter(a => responderMatches(parsed.responder, a.signer));
      if (!authorized.length) fail('KIM_OCSP_RESPONDER');
      // A rollover may list two keys with the same responder DN. Only an
      // already authorized key whose actual signature verifies can select it.
      let supported = false;
      const verified = authorized.filter(({ signer }) => {
        let options;
        try { options = signatureOptions(parsed.algorithm, signer.cert.publicKey); }
        catch (e) { if (e instanceof OcspError && e.code === 'KIM_OCSP_ALGORITHM') return false; throw e; }
        supported = true;
        return verify('sha256', parsed.data, options, parsed.signature);
      });
      if (!supported) fail('KIM_OCSP_ALGORITHM');
      if (!verified.length) fail('KIM_OCSP_SIGNATURE');
      if (verified.length !== 1) fail('KIM_OCSP_RESPONDER');
      const signer = verified[0].signer;
      if (parsed.producedAt < now - AGE || parsed.producedAt > now + FUTURE
        || !current(signer, parsed.producedAt)) fail('KIM_OCSP_STALE');
      const single = matches[0]; positiveStatement(single, leaf);
      // A_23225 uses producedAt, not thisUpdate/nextUpdate, for current non-QES freshness.
      // All times are still parsed strictly. Historical QES evaluation is not supported.
      const freshUntil = parsed.producedAt + AGE;
      const validUntil = Math.min(freshUntil + 1, this.#until, leaf.cert.validToDate.getTime(), issuer.cert.validToDate.getTime(), signer.cert.validToDate.getTime());
      return Object.freeze({ certificateSha256: leaf.sha256, issuerSha256: issuer.sha256, responderSha256: signer.sha256,
        responseSha256: hex(response), status: single.status, producedAt: parsed.producedAt, thisUpdate: single.thisUpdate,
        ...(single.nextUpdate !== undefined ? { nextUpdate: single.nextUpdate } : {}),
        ...(single.revokedAt !== undefined ? { revokedAt: single.revokedAt, ...(single.reason !== undefined ? { reason: single.reason } : {}) } : {}),
        checkedAt: now, validUntil, identityStatus: 'unverified', trustSource: 'configured-pins' });
    } catch (e) { if (e instanceof OcspError) throw e; fail('KIM_OCSP_FORMAT'); }
  }
}

/** Process-local cache for callers that actively obtain responses. No networking is hidden
 * here: obtain receives only the bounded request bytes and an AbortSignal. It must use a
 * separately configured route, never an untrusted AIA URL. Fresh entries are reused first.
 * This is not a durable TI status cache or a complete A_23225 implementation.
 */
export class OcspStatusCache {
  #verifier; #clock; #limit; #timeout; #entries = new Map(); #pending = new Map(); #timer; #closed = false;
  constructor({ verifier, clock = Date.now, maxEntries = 256, timeoutMs = 10_000 }) {
    if (!(verifier instanceof PinnedOcspVerifier) || typeof clock !== 'function' || !Number.isInteger(maxEntries)
      || maxEntries < 1 || maxEntries > 4096 || !Number.isInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 30_000) fail('KIM_OCSP_CONFIGURATION');
    this.#verifier = verifier; this.#clock = clock; this.#limit = maxEntries; this.#timeout = timeoutMs;
    this.#timer = setInterval(() => { try { this.prune(); } catch { /* Invalid clock never authorizes a cache hit. */ } }, 60_000);
    this.#timer.unref();
  }
  prune() {
    const now = this.#clock();
    if (!Number.isSafeInteger(now) || now < 0) fail('KIM_OCSP_CLOCK');
    for (const [key, entry] of this.#entries) if (now >= entry.validUntil || now < entry.producedAt - FUTURE) this.#entries.delete(key);
    return this.#entries.size;
  }
  async check({ certificate: input, obtain }) {
    if (this.#closed) fail('KIM_OCSP_CACHE_CLOSED');
    let leaf;
    try { leaf = certificate(input); } catch { fail('KIM_OCSP_CERTIFICATE'); }
    const key = leaf.sha256;
    this.prune();
    const cached = this.#entries.get(key);
    if (cached) {
      try { return Object.freeze({ ...this.#verifier.verify({ certificate: leaf.cert.raw, request: cached.request, response: cached.response }), source: 'cache' }); }
      catch (e) { this.#entries.delete(key); throw e; } // No stale/invalid-pin fallback.
    }
    if (this.#pending.has(key)) return this.#pending.get(key).promise;
    if (typeof obtain !== 'function') fail('KIM_OCSP_UNAVAILABLE');
    if (this.#entries.size + this.#pending.size >= this.#limit) fail('KIM_OCSP_CACHE_CAPACITY');
    const request = this.#verifier.createRequest(leaf.cert.raw), controller = new AbortController();
    let cancel, timer;
    const stopped = new Promise((_, reject) => {
      cancel = code => { controller.abort(); reject(new OcspError(code)); };
      timer = setTimeout(() => cancel('KIM_OCSP_TIMEOUT'), this.#timeout);
    });
    const promise = (async () => {
      try {
        const raw = await Promise.race([Promise.resolve().then(() => {
          if (this.#closed || controller.signal.aborted) fail('KIM_OCSP_CACHE_CLOSED');
          return obtain(Buffer.from(request), controller.signal);
        }), stopped]);
        if (this.#closed) fail('KIM_OCSP_CACHE_CLOSED');
        const response = bounded(raw, MAX_RESPONSE), result = this.#verifier.verify({ certificate: leaf.cert.raw, request, response });
        this.#entries.set(key, { request, response, validUntil: result.validUntil, producedAt: result.producedAt });
        return Object.freeze({ ...result, source: 'response' });
      } catch (e) { if (e instanceof OcspError) throw e; fail('KIM_OCSP_UNAVAILABLE'); }
      finally { clearTimeout(timer); this.#pending.delete(key); }
    })();
    this.#pending.set(key, { promise, cancel });
    return promise;
  }
  close() {
    this.#closed = true; clearInterval(this.#timer); this.#entries.clear();
    for (const task of this.#pending.values()) task.cancel('KIM_OCSP_CACHE_CLOSED');
    this.#pending.clear();
  }
}

/** Receive diagnostics only. Re-verify supplied response bytes against the exact OSIG/AUT
 * certificates already used by the message verifier; never accept a caller's status flag.
 */
export function assessKimOcspEvidence(proofs, certificates) {
  const { verifier, signing, authentication } = proofs ?? {};
  return Object.freeze(['signing', 'authentication'].map(purpose => {
    const input = certificates[purpose], certificateSha256 = hex(new X509Certificate(input).raw);
    try {
      if (!(verifier instanceof PinnedOcspVerifier)) fail('KIM_OCSP_CONFIGURATION');
      const proof = purpose === 'signing' ? signing : authentication;
      if (!proof) fail('KIM_OCSP_UNAVAILABLE');
      return Object.freeze({ purpose, ...verifier.verify({ certificate: input, request: proof.request, response: proof.response }) });
    } catch (e) {
      return Object.freeze({ purpose, certificateSha256, status: 'unavailable', code: e instanceof OcspError ? e.code : 'KIM_OCSP_FORMAT',
        identityStatus: 'unverified', trustSource: 'configured-pins' });
    }
  }));
}
