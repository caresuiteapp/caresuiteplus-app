import { X509Certificate, createHash, verify, constants } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isAbsolute } from 'node:path';
import { der, fields, certificateParts, rsaAlgorithm } from '../gkv/der.mjs';
import { PinnedOcspVerifier } from './ocsp.mjs';

export const TSL_SCHEMA_SHA256 = 'ffd4e6ae233c8e648ec009a55a9809fad9fcc4197f7928a48e15b5dbdde7137b';
const MAX_XML = 8 * 1024 * 1024, DAY = 86400_000, token = Symbol('verified TSL');
const CA = 'http://uri.etsi.org/TrstSvc/Svctype/CA/PKC', OCSP = 'http://uri.etsi.org/TrstSvc/Svctype/Certstatus/OCSP';
const ACTIVE = 'http://uri.etsi.org/TrstSvc/Svcstatus/inaccord', REVOKED = 'http://uri.etsi.org/TrstSvc/Svcstatus/revoked';
const O = { ecdsa: '2a8648ce3d040302', pss: '2a864886f70d01010a', tslSigning: '040091370300' };
const hash = b => createHash('sha256').update(b).digest('hex');
const fail = code => { throw new TslError(code); };
export class TslError extends Error {
  constructor(code) { super(code); this.name = 'TslError'; this.code = code; }
}
function bounded(input, limit) {
  if (!(input instanceof Uint8Array) || !input.length || input.length > limit) fail('KIM_TSL_SIZE');
  return Buffer.from(input);
}
function cert(input) {
  if (typeof input === 'string') {
    if (input.length > 20_000 || !/^\s*-----BEGIN CERTIFICATE-----[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----\s*$/.test(input)) fail('KIM_TSL_CERTIFICATE');
  } else bounded(input, 12000);
  const c = new X509Certificate(input), p = certificateParts(c.raw);
  if (c.raw.length > 12000 || (typeof input !== 'string' && !c.raw.equals(Buffer.from(input)))
    || !p.tbs[2].raw.equals(p.signatureAlgorithm.raw)) fail('KIM_TSL_CERTIFICATE');
  const extensions = p.tbs.filter(n => n.tag === 163), ext = new Map();
  if (extensions.length !== 1) fail('KIM_TSL_CERTIFICATE');
  for (const node of fields(fields(extensions[0], 163, 1)[0], 48)) {
    const f = fields(node, 48), name = f[0]?.value.toString('hex');
    if (![2, 3].includes(f.length) || f[0].tag !== 6 || !f[0].value.length || f.at(-1).tag !== 4 || ext.has(name)
      || (f.length === 3 && (f[1].tag !== 1 || f[1].value.toString('hex') !== 'ff'))) fail('KIM_TSL_CERTIFICATE');
    if (f.length === 3 && !['551d0f', '551d13', '551d25', '551d20'].includes(name)) fail('KIM_TSL_CRITICAL_CERTIFICATE_EXTENSION');
    ext.set(name, f.at(-1).value);
  }
  const usage = der(ext.get('551d0f') ?? Buffer.alloc(0));
  if (usage.tag !== 3 || usage.value.length < 2 || usage.value.length > 3 || usage.value[0] > 7
    || (usage.value.at(-1) & ((1 << usage.value[0]) - 1))) fail('KIM_TSL_CERTIFICATE');
  return { c, p, ext, usage: usage.value[1], sha256: hash(c.raw) };
}
function signatureOptions(algorithm, key) {
  const a = fields(algorithm, 48), value = a[0]?.value.toString('hex');
  if (a[0]?.tag === 6 && value === O.ecdsa && a.length === 1 && key.asymmetricKeyType === 'ec'
    && key.asymmetricKeyDetails?.namedCurve === 'brainpoolP256r1') return { key, dsaEncoding: 'der' };
  if (value === O.pss && key.asymmetricKeyType === 'rsa' && key.asymmetricKeyDetails?.modulusLength >= 3072) {
    rsaAlgorithm(algorithm, 'pss');
    return { key, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 };
  }
  fail('KIM_TSL_ALGORITHM');
}
const current = (c, now) => now >= c.c.validFromDate.getTime() && now < c.c.validToDate.getTime();
function issuedBy(leaf, issuer) {
  if (!leaf.p.issuer.equals(issuer.p.subject.raw) || !leaf.c.checkIssued(issuer.c)) return false;
  signatureOptions(leaf.p.signatureAlgorithm, issuer.c.publicKey);
  return leaf.c.verify(issuer.c.publicKey);
}
function detached(input) {
  const [algorithm, value, signerNode] = fields(der(input), 48, 3), signer = cert(signerNode.raw);
  const options = signatureOptions(algorithm, signer.c.publicKey);
  let signature;
  if (value.tag === 3 && value.value.length > 1 && value.value[0] === 0) signature = value.value.subarray(1);
  // gematik's published ECC sample encodes ECDSA-Sig-Value directly, unlike
  // the RSA BIT STRING. Also accept the explicitly wrapped DER ECC form.
  else if (value.tag === 48 && options.dsaEncoding === 'der') signature = value.raw;
  else fail('KIM_TSL_DETACHED_FORMAT');
  if (options.dsaEncoding === 'der') {
    for (const n of fields(der(signature), 48, 2)) {
      if (n.tag !== 2 || !n.value.length || n.value.length > 33 || (n.value[0] & 128) || n.value.every(b => b === 0)
        || (n.value.length > 1 && n.value[0] === 0 && !(n.value[1] & 128))) fail('KIM_TSL_DETACHED_FORMAT');
    }
  }
  return { signer, options, signature };
}
function checkSignal(signal) {
  if (signal !== undefined && !(signal instanceof AbortSignal)) fail('KIM_TSL_CONFIGURATION');
  if (signal?.aborted) fail('KIM_TSL_ABORTED');
}
function signerOcspUrls(signer) {
  const value = signer.ext.get('2b06010505070101');
  if (!value) return Object.freeze([]);
  const entries = fields(der(value), 48), urls = [];
  if (!entries.length || entries.length > 8) fail('KIM_TSL_SIGNER_AIA');
  for (const entry of entries) {
    const [method, location] = fields(entry, 48, 2);
    if (method.tag !== 6) fail('KIM_TSL_SIGNER_AIA');
    if (method.value.toString('hex') !== '2b06010505073001') continue;
    if (location.tag !== 134 || !location.value.length || location.value.length > 2048
      || location.value.some(b => b < 33 || b > 126)) fail('KIM_TSL_SIGNER_AIA');
    let url; try { url = new URL(location.value.toString('ascii')); } catch { fail('KIM_TSL_SIGNER_AIA'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || urls.includes(url.href)) fail('KIM_TSL_SIGNER_AIA');
    urls.push(url.href);
  }
  return Object.freeze(urls);
}
function inspectXml(xml, python, signal) {
  checkSignal(signal);
  return new Promise((resolve, reject) => {
    const child = spawn(python, ['-I', fileURLToPath(new URL('./tsl-xml.py', import.meta.url))], {
      stdio: ['pipe', 'pipe', 'pipe'], shell: false, env: { PATH: process.env.PATH, LANG: 'C.UTF-8' },
    });
    let done = false, size = 0; const chunks = [];
    const timer = setTimeout(() => stop('KIM_TSL_XML_TIMEOUT'), 10_000);
    const aborted = () => stop('KIM_TSL_ABORTED');
    signal?.addEventListener('abort', aborted, { once: true });
    function stop(code) {
      if (done) return; done = true; clearTimeout(timer); signal?.removeEventListener('abort', aborted); child.kill('SIGKILL'); reject(new TslError(code));
    }
    child.on('error', () => stop('KIM_TSL_XML_UNAVAILABLE'));
    child.stdin.on('error', () => {}); child.stderr.resume();
    child.stdout.on('data', chunk => {
      size += chunk.length;
      if (size > 4 * 1024 * 1024) return stop('KIM_TSL_XML_LIMIT');
      chunks.push(chunk);
    });
    child.on('close', code => {
      if (done) return;
      if (code !== 0) return stop('KIM_TSL_XML_REJECTED');
      try {
        const result = JSON.parse(Buffer.concat(chunks));
        if (result.error) return stop(/^KIM_TSL_[A-Z_]{1,40}$/.test(result.error) ? result.error : 'KIM_TSL_XML_REJECTED');
        done = true; clearTimeout(timer); signal?.removeEventListener('abort', aborted); resolve(result);
      } catch { stop('KIM_TSL_XML_REJECTED'); }
    });
    child.stdin.end(xml);
  });
}
function verifyInner(parsed, signer) {
  if (!Buffer.from(parsed.signer, 'base64').equals(signer.c.raw)) fail('KIM_TSL_SIGNER_BINDING');
  const key = signer.c.publicKey; let options;
  if (parsed.signatureMethod === 'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256'
    && key.asymmetricKeyType === 'ec' && key.asymmetricKeyDetails?.namedCurve === 'brainpoolP256r1') {
    options = { key, dsaEncoding: 'ieee-p1363' };
    if (Buffer.from(parsed.signature, 'base64').length !== 64) fail('KIM_TSL_XML_SIGNATURE');
  } else if (parsed.signatureMethod === 'http://www.w3.org/2007/05/xmldsig-more#sha256-rsa-MGF1'
    && key.asymmetricKeyType === 'rsa' && key.asymmetricKeyDetails?.modulusLength >= 3072) {
    options = { key, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 };
  } else fail('KIM_TSL_XML_ALGORITHM');
  if (!verify('sha256', Buffer.from(parsed.signedInfo, 'base64'), options, Buffer.from(parsed.signature, 'base64'))) fail('KIM_TSL_XML_SIGNATURE');
}

/** Authentication against explicitly provisioned TSL-signer CA pins. Provisioning
 * itself is NOT authenticated TI bootstrap. No roots, URLs or OCSP authorization
 * are learned from an unverified list. Every import needs current signer status.
 */
export class TslVerifier {
  #anchors; #status; #clock; #from; #until; #environment; #profile; #python; #binding;
  constructor({ anchors, signerStatusVerifier, environment, profile = 'ecc-rsa', validFrom, validUntil, clock = Date.now, python = 'python3' }) {
    try {
      if (!['test', 'reference', 'production'].includes(environment) || !['ecc-rsa', 'rsa'].includes(profile)
        || !Array.isArray(anchors) || !anchors.length || anchors.length > 4 || !(signerStatusVerifier instanceof PinnedOcspVerifier)
        || typeof clock !== 'function' || !Number.isSafeInteger(validFrom) || validFrom < 0 || !Number.isSafeInteger(validUntil)
        || validUntil <= validFrom || validUntil - validFrom > 366 * DAY || typeof python !== 'string'
        || (python !== 'python3' && !isAbsolute(python)) || python.includes('\0')) fail('KIM_TSL_CONFIGURATION');
      this.#anchors = anchors.map(pin => {
        const anchor = cert(pin.certificate);
        if (anchor.sha256 !== pin.sha256 || !anchor.c.ca || !(anchor.usage & 4)) fail('KIM_TSL_CONFIGURATION');
        return anchor;
      });
      const pins = this.#anchors.map(a => a.sha256).sort();
      if (new Set(pins).size !== pins.length) fail('KIM_TSL_CONFIGURATION');
      this.#status = signerStatusVerifier; this.#clock = clock; this.#from = validFrom; this.#until = validUntil;
      this.#environment = environment; this.#profile = profile; this.#python = python;
      this.#binding = hash(JSON.stringify({ version: 1, environment, profile, pins, schema: TSL_SCHEMA_SHA256 }));
    } catch { fail('KIM_TSL_CONFIGURATION'); }
    Object.freeze(this);
  }
  get bindingSha256() { return this.#binding; }
  get environment() { return this.#environment; }
  get profile() { return this.#profile; }
  #now() {
    const now = this.#clock();
    if (!Number.isSafeInteger(now) || now < this.#from || now >= this.#until) fail('KIM_TSL_ANCHOR_EXPIRED');
    return now;
  }
  #authenticate(xml, signature) {
    const result = detached(signature), { signer, options, signature: value } = result;
    const before = this.#now(), matches = this.#anchors.filter(a => current(a, before) && issuedBy(signer, a));
    if (matches.length !== 1 || !current(signer, before) || signer.c.ca || signer.usage !== 64) fail('KIM_TSL_SIGNER');
    const eku = fields(der(signer.ext.get('551d25') ?? Buffer.alloc(0)), 48);
    if (eku.length !== 1 || eku[0].tag !== 6 || eku[0].value.toString('hex') !== O.tslSigning) fail('KIM_TSL_SIGNER');
    if ((this.#profile === 'rsa') === Boolean(options.dsaEncoding)) fail('KIM_TSL_ALGORITHM');
    if (!verify('sha256', xml, options, value)) fail('KIM_TSL_DETACHED_SIGNATURE');
    return { signer, anchor: matches[0], before };
  }
  prepareSignerStatus({ xml, detachedSignature }) {
    try {
      const bytes = bounded(xml, MAX_XML);
      const { signer } = this.#authenticate(bytes, bounded(detachedSignature, 16000));
      // This only prepares an OCSP lookup; it never authorizes TSL services.
      return Object.freeze({ certificate: Buffer.from(signer.c.raw), certificateSha256: signer.sha256, xmlSha256: hash(bytes),
        request: this.#status.createRequest(signer.c.raw), ocspUrls: signerOcspUrls(signer), identityStatus: 'unverified' });
    } catch (error) { if (error instanceof TslError) throw error; fail('KIM_TSL_REJECTED'); }
  }
  async verify({ xml: input, detachedSignature: suppliedSignature, signerStatus }, { signal } = {}) {
    try {
      checkSignal(signal);
      const xml = bounded(input, MAX_XML), signature = bounded(suppliedSignature, 16000);
      const proof = { request: bounded(signerStatus?.request, 4096), response: bounded(signerStatus?.response, 262144) };
      const { signer, anchor, before } = this.#authenticate(xml, signature);
      const status = () => {
        const result = this.#status.verify({ certificate: signer.c.raw, ...proof });
        if (result.status !== 'good' || result.issuerSha256 !== anchor.sha256) fail('KIM_TSL_SIGNER_STATUS');
        return result;
      };
      status(); // Authenticate the exact bytes and signer status before any XML parsing.
      const parsed = await inspectXml(xml, this.#python, signal);
      checkSignal(signal);
      verifyInner(parsed, signer);
      const now = this.#now(), evidence = status();
      if (now < before || !current(signer, now) || !current(anchor, now)) fail('KIM_TSL_TIME');
      if (evidence.producedAt < now - 3600_000 || evidence.producedAt > now + 300_000) fail('KIM_TSL_SIGNER_STATUS');
      if (parsed.schemaSha256 !== TSL_SCHEMA_SHA256 || (this.#profile === 'ecc-rsa' ? parsed.sequence < 10000 : parsed.sequence >= 10000)) fail('KIM_TSL_PROFILE');
      if (parsed.issuedAt > now || parsed.nextUpdate <= now || parsed.nextUpdate <= parsed.issuedAt
        || parsed.nextUpdate - parsed.issuedAt > 30 * DAY) fail('KIM_TSL_TIME');
      const seen = new Set();
      for (const s of parsed.services.filter(s => [CA, OCSP].includes(s.type))) {
        const identity = s.type + ':' + hash(Buffer.from(s.certificates[0], 'base64'));
        if (seen.has(identity)) fail('KIM_TSL_SERVICE_DUPLICATE');
        seen.add(identity);
      }
      const validUntil = Math.min(this.#until, parsed.nextUpdate, signer.c.validToDate.getTime(), anchor.c.validToDate.getTime(), evidence.validUntil);
      if (now >= validUntil) fail('KIM_TSL_TIME');
      return new TslTrustSnapshot(token, { xml, signature, services: parsed.services, clock: this.#clock,
        metadata: { id: parsed.id, sequence: parsed.sequence, issuedAt: parsed.issuedAt, nextUpdate: parsed.nextUpdate,
          xmlSha256: hash(xml), signerSha256: signer.sha256, anchorSha256: anchor.sha256, schemaSha256: TSL_SCHEMA_SHA256,
          bindingSha256: this.#binding, environment: this.#environment, profile: this.#profile,
          signerStatus: evidence, checkedAt: now, validUntil, trustSource: 'configured-tsl-anchors', identityStatus: 'unverified' } });
    } catch (error) { if (error instanceof TslError) throw error; fail('KIM_TSL_REJECTED'); }
  }
}

/** Immutable, short-lived service snapshot; callers cannot forge successful imports. */
export class TslTrustSnapshot {
  #xml; #signature; #clock; #metadata; #services;
  constructor(key, { xml, signature, services, clock, metadata } = {}) {
    if (key !== token) fail('KIM_TSL_UNVERIFIED');
    this.#xml = xml; this.#signature = signature; this.#clock = clock;
    this.#metadata = Object.freeze(metadata);
    this.#services = Object.freeze(services.map(s => Object.freeze({ ...s, certificates: Object.freeze([...s.certificates]), supplyPoints: Object.freeze([...s.supplyPoints]) })));
    Object.freeze(this);
  }
  get metadata() { return this.#metadata; }
  get services() { return this.#services; }
  #now() {
    const now = this.#clock();
    if (!Number.isSafeInteger(now) || now < this.#metadata.checkedAt || now >= this.#metadata.validUntil) fail('KIM_TSL_SNAPSHOT_EXPIRED');
    return now;
  }
  exportBundle() { this.#now(); return { xml: Buffer.from(this.#xml), detachedSignature: Buffer.from(this.#signature) }; }
  ocspVerifierFor(input, { model = 'current', isCurrent } = {}) {
    try {
      if (!['current', 'nonqes-compromise'].includes(model)) fail('KIM_TSL_VALIDATION_MODEL');
      if (isCurrent !== undefined && typeof isCurrent !== 'function') fail('KIM_TSL_CONFIGURATION');
      const clock = () => {
        if (isCurrent && isCurrent() !== true) fail('KIM_TSL_SUPERSEDED');
        return this.#now();
      };
      const now = clock(), inputs = Array.isArray(input) ? input : [input];
      if (!inputs.length || inputs.length > 16) fail('KIM_TSL_SERVICE_LIMIT');
      const active = this.#services.filter(s => s.statusStartingTime <= now);
      const issuers = new Map();
      for (const inputCertificate of inputs) {
        const leaf = cert(inputCertificate);
        const matches = active.filter(s => s.type === CA && (s.status === ACTIVE
          || (model === 'nonqes-compromise' && s.status === REVOKED && leaf.c.validFromDate.getTime() < s.statusStartingTime)))
          .map(s => cert(Buffer.from(s.certificates[0], 'base64'))).filter(c => current(c, now) && issuedBy(leaf, c));
        if (matches.length !== 1) fail('KIM_TSL_ISSUER');
        issuers.set(matches[0].sha256, matches[0]);
      }
      const responders = active.filter(s => s.type === OCSP && s.status === ACTIVE)
        .map(s => cert(Buffer.from(s.certificates[0], 'base64'))).filter(c => current(c, now));
      if (!responders.length || responders.length * issuers.size > 100) fail('KIM_TSL_RESPONDER');
      const pin = c => ({ certificate: c.c.raw, sha256: c.sha256 });
      return new PinnedOcspVerifier({ authorities: [...issuers.values()].flatMap(c => responders.map(r => ({ issuer: pin(c), responder: pin(r) }))),
        validFrom: this.#metadata.checkedAt, validUntil: this.#metadata.validUntil, clock });
    } catch (error) { if (error instanceof TslError) throw error; fail('KIM_TSL_SERVICE_CERTIFICATE'); }
  }
}
