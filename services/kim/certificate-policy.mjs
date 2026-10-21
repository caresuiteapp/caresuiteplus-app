import { der, fields } from '../gkv/der.mjs';

// gemSpec_OID Tab_PKI_405. These are certificate types, not Admission roles.
export const KIM_CERTIFICATE_TYPES = Object.freeze({
  signing: Object.freeze(['1.2.276.0.76.4.78']),
  authentication: Object.freeze(['1.2.276.0.76.4.75', '1.2.276.0.76.4.77']),
  encryption: Object.freeze(['1.2.276.0.76.4.74', '1.2.276.0.76.4.76']),
});
const knownTypes = new Set(Object.values(KIM_CERTIFICATE_TYPES).flat());
export class CertificatePolicyError extends Error {
  constructor(code) { super(code); this.name = 'CertificatePolicyError'; this.code = code; }
}
const fail = code => { throw new CertificatePolicyError(code); };

export function canonicalOid(value) {
  if (typeof value !== 'string' || value.length > 256 || !/^(?:0|1|2)(?:\.(?:0|[1-9][0-9]*)){1,31}$/.test(value)) return false;
  const arcs = value.split('.').map(BigInt);
  return arcs.every(a => a <= 0x7fffffffffffffffn) && (arcs[0] === 2n || arcs[1] <= 39n);
}
function oidText(node) {
  if (node?.tag !== 6 || !node.value.length || node.value.length > 128) fail('KIM_CERT_POLICY_FORMAT');
  const values = []; let value = 0n, start = true;
  for (const byte of node.value) {
    if (start && byte === 128) fail('KIM_CERT_POLICY_FORMAT'); // Non-minimal base-128 arc.
    value = (value << 7n) | BigInt(byte & 127);
    if (value > 0x7fffffffffffffffn) fail('KIM_CERT_POLICY_FORMAT');
    if (!(byte & 128)) { values.push(value); value = 0n; start = true; } else start = false;
  }
  if (!start || !values.length) fail('KIM_CERT_POLICY_FORMAT');
  const first = values.shift(), arc = first < 40n ? 0n : first < 80n ? 1n : 2n;
  const result = [arc, first - arc * 40n, ...values].join('.');
  if (!canonicalOid(result)) fail('KIM_CERT_POLICY_FORMAT');
  return result;
}

/** Selects a type from a caller's nonempty policy list. No CA authorization,
 * signature, Admission/Telematik-ID, role permission or network lookup here.
 */
export function selectCertificateType(encoded, policyList) {
  try {
    if (!Array.isArray(policyList) || !policyList.length || policyList.length > 16
      || !Array.from(policyList).every(canonicalOid) || new Set(policyList).size !== policyList.length) fail('KIM_CERT_POLICY_CONFIGURATION');
    if (encoded === undefined) fail('KIM_CERT_POLICY_MISSING');
    if (!(encoded instanceof Uint8Array) || !encoded.length || encoded.length > 4096) fail('KIM_CERT_POLICY_FORMAT');
    const entries = fields(der(encoded), 48), seen = new Set(), matched = []; let kimTypes = 0;
    if (!entries.length || entries.length > 32) fail('KIM_CERT_POLICY_FORMAT');
    for (const entry of entries) {
      const f = fields(entry, 48);
      if (f.length < 1 || f.length > 2) fail('KIM_CERT_POLICY_FORMAT');
      const id = oidText(f[0]);
      if (seen.has(id)) fail('KIM_CERT_POLICY_FORMAT'); seen.add(id);
      if (knownTypes.has(id)) kimTypes++;
      if (f[1]) {
        if (knownTypes.has(id) || policyList.includes(id)) fail('KIM_CERT_POLICY_QUALIFIER');
        const qualifiers = fields(f[1], 48);
        if (!qualifiers.length || qualifiers.length > 16) fail('KIM_CERT_POLICY_FORMAT');
        for (const qualifier of qualifiers) { const q = fields(qualifier, 48, 2); oidText(q[0]); }
      }
      if (policyList.includes(id)) matched.push(id);
    }
    if (kimTypes > 1 || matched.length > 1) fail('KIM_CERT_POLICY_AMBIGUOUS');
    if (!matched.length) fail('KIM_CERT_POLICY_MISMATCH');
    return matched[0];
  } catch (e) { if (e instanceof CertificatePolicyError) throw e; fail('KIM_CERT_POLICY_FORMAT'); }
}
