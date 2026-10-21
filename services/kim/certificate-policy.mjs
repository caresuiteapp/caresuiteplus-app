import { der, fields } from '../gkv/der.mjs';
import { canonicalOid, oidText } from './der-oid.mjs';
export { canonicalOid } from './der-oid.mjs';

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
