// Bounded DER inspection, not a cryptographic implementation. OpenSSL verifies signatures.
// Only the SECON 2026 subset is accepted; BER/indefinite lengths are not transport DER.
export function der(input) {
  const bytes = Buffer.from(input);
  if (!bytes.length || bytes.length > 24_000_000) throw new Error('DER_SIZE');
  function node(start, limit) {
    let at = start;
    const tag = bytes[at++];
    if ((tag & 31) === 31 || at >= limit) throw new Error('DER_TAG');
    let size = bytes[at++];
    if (size & 128) {
      const count = size & 127;
      if (!count || count > 4 || at + count > limit || bytes[at] === 0) throw new Error('DER_LENGTH');
      size = 0;
      for (let i = 0; i < count; i++) size = size * 256 + bytes[at++];
      if (size < 128) throw new Error('DER_LENGTH');
    }
    const end = at + size;
    if (end > limit) throw new Error('DER_TRUNCATED');
    return { tag, raw: bytes.subarray(start, end), value: bytes.subarray(at, end), children() {
      const result = []; let p = at;
      while (p < end) {
        if (result.length >= 10_000) throw new Error('DER_CHILDREN');
        const child = node(p, end); result.push(child); p += child.raw.length;
      }
      return result;
    }};
  }
  const root = node(0, bytes.length);
  if (root.raw.length !== bytes.length) throw new Error('DER_TRAILING');
  return root;
}
export function fields(node, tag, count) {
  if (node?.tag !== tag) throw new Error('DER_STRUCTURE');
  const children = node.children();
  if (count !== undefined && children.length !== count) throw new Error('DER_FIELDS');
  return children;
}
export function oid(node, hex) {
  if (node?.tag !== 6 || node.value.toString('hex') !== hex) throw new Error('DER_OID');
}
function integer(node, value) {
  if (node?.tag !== 2 || node.value.toString('hex') !== value.toString(16).padStart(2, '0')) throw new Error('DER_INTEGER');
}
const O = {
  data: '2a864886f70d010701', signed: '2a864886f70d010702', envelope: '2a864886f70d010703',
  sha256: '608648016503040201', pss: '2a864886f70d01010a', oaep: '2a864886f70d010107',
  mgf1: '2a864886f70d010108', aes256cbc: '60864801650304012a',
};
function hashAlgorithm(node) {
  const f = fields(node, 48); oid(f[0], O.sha256);
  if (f.length > 2 || (f[1] && (f[1].tag !== 5 || f[1].value.length))) throw new Error('DER_HASH_PARAMS');
}
export function rsaAlgorithm(node, kind) {
  const f = fields(node, 48, 2); oid(f[0], O[kind]);
  const params = fields(f[1], 48, kind === 'pss' ? 3 : 2);
  hashAlgorithm(fields(params[0], 160, 1)[0]);
  const mgf = fields(fields(params[1], 161, 1)[0], 48, 2);
  oid(mgf[0], O.mgf1); hashAlgorithm(mgf[1]);
  if (kind === 'pss') integer(fields(params[2], 162, 1)[0], 32);
  // DER omits the default trailerField=1 and empty OAEP pSource (SECON Best Practice).
}
export function certificateParts(raw) {
  const cert = fields(der(raw), 48, 3), tbs = fields(cert[0], 48);
  if (tbs[0].tag !== 160) throw new Error('CERT_VERSION');
  integer(fields(tbs[0], 160, 1)[0], 2);
  return { serial: tbs[1].raw, issuer: tbs[3].raw, subject: tbs[5], signatureAlgorithm: cert[1], tbs };
}
export function certificateKeyUsage(raw) {
  const { tbs } = certificateParts(raw);
  const ext = tbs.find(n => n.tag === 163);
  if (!ext) throw new Error('CERT_KEY_USAGE');
  for (const n of fields(fields(ext, 163, 1)[0], 48)) {
    const e = fields(n, 48);
    if (e[0].tag === 6 && e[0].value.toString('hex') === '551d0f') {
      const value = e.at(-1);
      if (value.tag !== 4) break;
      const bits = der(value.value);
      if (bits.tag !== 3 || bits.value.length < 2) break;
      return bits.value[1];
    }
  }
  throw new Error('CERT_KEY_USAGE');
}
function identity(node, cert) {
  const f = fields(node, 48, 2), c = certificateParts(cert);
  return f[0].raw.equals(c.issuer) && f[1].raw.equals(c.serial);
}
function contentInfo(raw, type) {
  const f = fields(der(raw), 48, 2); oid(f[0], O[type]);
  return fields(fields(f[1], 160, 1)[0], 48);
}
export function inspectEnvelope(raw, recipientCertificates) {
  const f = contentInfo(raw, 'envelope');
  if (f.length !== 3) throw new Error('SECON_ENVELOPE_FIELDS');
  integer(f[0], 0);
  const recipients = fields(f[1], 49, recipientCertificates.length), found = new Set();
  for (const n of recipients) {
    const r = fields(n, 48, 4); integer(r[0], 0); rsaAlgorithm(r[2], 'oaep');
    const i = recipientCertificates.findIndex(c => identity(r[1], c));
    if (i < 0 || found.has(i) || r[3].tag !== 4 || r[3].value.length !== 512) throw new Error('SECON_RECIPIENT');
    found.add(i);
  }
  const e = fields(f[2], 48, 3); oid(e[0], O.data);
  const a = fields(e[1], 48, 2); oid(a[0], O.aes256cbc);
  if (a[1].tag !== 4 || a[1].value.length !== 16 || e[2].tag !== 128 || !e[2].value.length || e[2].value.length % 16) throw new Error('SECON_CIPHER');
}
export function inspectSigned(raw, signerCertificate) {
  const f = contentInfo(raw, 'signed');
  if (f.length !== 5 || f[3].tag !== 160) throw new Error('SECON_SIGNED_FIELDS');
  integer(f[0], 1); hashAlgorithm(fields(f[1], 49, 1)[0]);
  const content = fields(f[2], 48, 2); oid(content[0], O.data);
  const payload = fields(content[1], 160, 1)[0];
  if (payload.tag !== 4) throw new Error('SECON_CONTENT');
  const s = fields(fields(f[4], 49, 1)[0], 48, 5);
  integer(s[0], 1);
  if (!identity(s[1], signerCertificate)) throw new Error('SECON_SIGNER');
  hashAlgorithm(s[2]); rsaAlgorithm(s[3], 'pss');
  if (s[4].tag !== 4 || s[4].value.length !== 512) throw new Error('SECON_SIGNATURE');
  return payload.value;
}
