import { der, fields } from '../gkv/der.mjs';
import { oidText } from './der-oid.mjs';
import { readVzdAdmission, CertificateAdmissionError, ADMISSION_EXTENSION_HEX } from './certificate-admission.mjs';
import { hostName } from './address.mjs';

export class VzdCertificateError extends Error {
  constructor(code) { super(code); this.name = 'VzdCertificateError'; this.code = code; }
}
const fail = code => { throw new VzdCertificateError('KIM_TSL_SERVER_' + code); };
const issuancePolicy = '1.2.276.0.76.4.163', serverAuth = '1.3.6.1.5.5.7.3.1';
const allowed = new Set(['551d0e', '551d0f', '551d11', '551d13', '551d20', '551d1f', '2b06010505070101', '551d23', ADMISSION_EXTENSION_HEX, '551d25']);
const required = [...allowed].filter(id => id !== '551d1f');
function text(node, limit = 256) {
  if (!node || ![12, 19].includes(node.tag) || !node.value.length || node.value.length > limit) fail('SUBJECT');
  const value = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(node.value);
  if (/[\p{Cc}\p{Cf}]/u.test(value)) fail('SUBJECT');
  if (node.tag === 19 && !/^[A-Za-z0-9 '()+,\-./:=?]+$/.test(value)) fail('SUBJECT');
  return value;
}

/** Pure supported ECC C.ZD.TLS-S profile inspection. The caller must separately
 * verify actual CA signature/type authorization, time, OCSP and TLS hostname.
 * No arbitrary technical role, participant ID, RSA fallback or trust assertion.
 */
export function readVzdTlsProfile({ c, p, ext }) {
  try {
    if (c.ca) fail('CONSTRAINTS');
    const critical = new Set();
    for (const node of fields(fields(p.tbs.find(n => n.tag === 163), 163, 1)[0], 48)) {
      const f = fields(node, 48), name = f[0].value.toString('hex');
      if (!allowed.has(name)) fail('EXTENSIONS');
      if (f.length === 3) critical.add(name);
    }
    if (required.some(id => !ext.has(id)) || critical.size !== 2 || !critical.has('551d0f') || !critical.has('551d13')) fail('EXTENSIONS');
    if (fields(der(ext.get('551d13')), 48).length) fail('CONSTRAINTS');
    const curve = c.publicKey.asymmetricKeyDetails?.namedCurve;
    if (c.publicKey.asymmetricKeyType !== 'ec' || !['brainpoolP256r1', 'prime256v1'].includes(curve)) fail('KEY');
    const [algorithm, point] = fields(p.tbs[6], 48, 2), [ec, domain] = fields(algorithm, 48, 2);
    if (oidText(ec) !== '1.2.840.10045.2.1' || oidText(domain) !== (curve === 'prime256v1' ? '1.2.840.10045.3.1.7' : '1.3.36.3.3.2.8.1.1.7')
      || point.tag !== 3 || point.value.length !== 66 || point.value[0] !== 0 || point.value[1] !== 4) fail('KEY');
    const usage = der(ext.get('551d0f'));
    if (usage.tag !== 3 || usage.value.toString('hex') !== '0780') fail('KEY_USAGE');
    const eku = fields(der(ext.get('551d25')), 48, 1);
    if (oidText(eku[0]) !== serverAuth) fail('EXTENDED_KEY_USAGE');
    const ski = der(ext.get('551d0e'));
    if (ski.tag !== 4 || !ski.value.length || ski.value.length > 64) fail('KEY_IDENTIFIER');
    const subject = new Map();
    for (const rdn of fields(p.subject, 48)) {
      const [id, value] = fields(fields(rdn, 49, 1)[0], 48, 2), name = oidText(id);
      if (!['2.5.4.3', '2.5.4.10', '2.5.4.6', '2.5.4.5'].includes(name) || subject.has(name)) fail('SUBJECT');
      subject.set(name, text(value));
    }
    const dnsName = subject.get('2.5.4.3')?.toLowerCase();
    if (!dnsName || !hostName(dnsName) || !subject.has('2.5.4.10') || !/^[A-Z]{2}$/.test(subject.get('2.5.4.6') ?? '')) fail('SUBJECT');
    const [san] = fields(der(ext.get('551d11')), 48, 1);
    if (san.tag !== 130 || san.value.some(b => b > 127) || san.value.toString('ascii').toLowerCase() !== dnsName) fail('DNS_NAME');
    const policies = fields(der(ext.get('551d20')), 48).map(e => fields(e, 48));
    if (policies.length !== 2 || !policies.some(p => oidText(p[0]) === issuancePolicy)) fail('ISSUANCE_POLICY');
    const cps = policies.find(p => oidText(p[0]) === issuancePolicy)[1];
    if (cps) {
      const [id, url] = fields(fields(cps, 48, 1)[0], 48, 2);
      if (oidText(id) !== '1.3.6.1.5.5.7.2.1' || url.tag !== 22 || url.value.toString() !== 'http://www.gematik.de/go/policies') fail('ISSUANCE_POLICY');
    }
    const aia = fields(der(ext.get('2b06010505070101')), 48);
    if (aia.length !== 1) fail('AIA');
    const [method, location] = fields(aia[0], 48, 2);
    if (oidText(method) !== '1.3.6.1.5.5.7.48.1' || location.tag !== 134 || !location.value.length || location.value.length > 2048
      || location.value.some(b => b < 33 || b > 126)) fail('AIA');
    const url = new URL(location.value.toString('ascii'));
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hash) fail('AIA');
    // AIA is structurally inspected, never used to create a status route.
    const admission = readVzdAdmission(ext.get(ADMISSION_EXTENSION_HEX));
    return Object.freeze({ admission, curve, dnsName, issuancePolicyOid: issuancePolicy,
      keyUsage: Object.freeze(['digitalSignature']), extendedKeyUsage: Object.freeze([serverAuth]) });
  } catch (e) {
    if (e instanceof VzdCertificateError || e instanceof CertificateAdmissionError) throw e;
    fail('FORMAT');
  }
}
