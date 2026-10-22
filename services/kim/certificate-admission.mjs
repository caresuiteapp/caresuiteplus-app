import { der, fields } from '../gkv/der.mjs';
import { oidText } from './der-oid.mjs';

export const ADMISSION_EXTENSION_HEX = '2b24080303'; // 1.3.36.8.3.3
export const ADMISSION_ROLE_VERSION = 'gemSpec_OID 3.26.0';
// Tab_PKI_402 (HBA, excluding insured persons) / Tab_PKI_403 (SMC-B).
// Membership validates a supported role family, NOT a permission to send or bill.
const professional = new Set([
  ...Array.from({ length: 19 }, (_, i) => i + 30), 178,
  232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 274, 275, 276, 277,
  305, 308, 312, 313, 315, 316, 318, 319,
].map(n => `1.2.276.0.76.4.${n}`));
const institution = new Set([
  ...Array.from({ length: 10 }, (_, i) => i + 50), 187, 190, 210, 223, 224, 225, 226, 227, 228, 229, 230, 231,
  ...Array.from({ length: 16 }, (_, i) => i + 242), ...Array.from({ length: 10 }, (_, i) => i + 262),
  278, 279, 280, 281, 282, 284, 285, 286, 292, 295, 303, 304, 306, 311, 314, 317,
].map(n => `1.2.276.0.76.4.${n}`));
const families = new Map([
  ['1.2.276.0.76.4.74', professional], ['1.2.276.0.76.4.75', professional],
  ['1.2.276.0.76.4.76', institution], ['1.2.276.0.76.4.77', institution], ['1.2.276.0.76.4.78', institution],
]);
export class CertificateAdmissionError extends Error {
  constructor(code) { super(code); this.name = 'CertificateAdmissionError'; this.code = code; }
}
const fail = code => { throw new CertificateAdmissionError('KIM_ADMISSION_' + code); };
const printable = /^[A-Za-z0-9 '()+,\-./:=?]+$/;
export const validTelematikId = value => typeof value === 'string' && value.length <= 128
  && printable.test(value) && /^(?:[1-5]|[7-9]|10|11)-\S(?:.*\S)?$/.test(value);
function text(node, tag = 12, limit = 128) {
  if (node?.tag !== tag || !node.value.length || node.value.length > limit * (tag === 12 ? 4 : 1)) fail('FORMAT');
  const value = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(node.value);
  if ([...value].length > limit || /[\p{Cc}\p{Cf}]/u.test(value)
    || (tag === 19 && !printable.test(value)) || (tag === 22 && /[^\x20-\x7e]/.test(value))) fail('FORMAT');
  return value;
}
function telematikId(node) {
  const value = text(node, 19);
  // The sector owns suffix syntax. Preserve PrintableString bytes/case; no trim,
  // case folding, guessed sector-to-role mapping or identity from Subject/SAN.
  if (!validTelematikId(value)) fail('TELEMATIK_ID');
  return value;
}
function authority(node) {
  // Supported TI subset: directoryName. No URL or embedded name grants trust.
  const name = fields(fields(node, 164, 1)[0], 48);
  if (!name.length || name.length > 32) fail('FORMAT');
  for (const rdn of name) {
    const values = fields(rdn, 49);
    if (!values.length || values.length > 8) fail('FORMAT');
    for (let i = 0; i < values.length; i++) {
      if (i && Buffer.compare(values[i - 1].raw, values[i].raw) >= 0) fail('FORMAT');
      const [id, value] = fields(values[i], 48, 2); oidText(id);
      if (![12, 19, 22].includes(value.tag)) fail('FORMAT');
      text(value, value.tag, 256);
    }
  }
}
function namingAuthority(node, tag) {
  const value = fields(fields(node, tag, 1)[0], 48); let i = 0;
  if (value[i]?.tag === 6) oidText(value[i++]);
  if (value[i]?.tag === 22) text(value[i++], 22, 2048); // Opaque, never fetched.
  if (value[i]?.tag === 12) text(value[i++]);
  if (i !== value.length) fail('FORMAT');
}
function profession(node) {
  const value = fields(node, 48); let i = 0;
  if (value[i]?.tag === 160) namingAuthority(value[i++], 160);
  const professionItem = text(fields(value[i++], 48, 1)[0]);
  const professionOid = oidText(fields(value[i++], 48, 1)[0]);
  if (value[i]?.tag !== 19) fail('TELEMATIK_ID');
  const tid = telematikId(value[i++]);
  if (value[i]?.tag === 4) {
    if (value[i++].value.length > 1024) fail('FORMAT'); // addProfessionInfo stays opaque.
  }
  if (i !== value.length) fail('FORMAT');
  return Object.freeze({ professionOid, professionItem, telematikId: tid });
}

/** Strict local KIM Admission profile. Reads signed attributes, not VZD ownership,
 * CA trust, OCSP status or authorization. Unknown future roles fail closed.
 */
export function readKimAdmission(encoded, certificateTypeOid) {
  try {
    const family = families.get(certificateTypeOid);
    if (!family) fail('CONFIGURATION');
    if (encoded === undefined) fail('MISSING');
    if (!(encoded instanceof Uint8Array) || !encoded.length || encoded.length > 8192) fail('FORMAT');
    const root = fields(der(encoded), 48); let i = 0;
    if (root[i]?.tag === 164) authority(root[i++]);
    const admission = fields(fields(root[i++], 48, 1)[0], 48); let j = 0;
    if (i !== root.length) fail('FORMAT');
    if (admission[j]?.tag === 160) authority(fields(admission[j++], 160, 1)[0]);
    if (admission[j]?.tag === 161) namingAuthority(admission[j++], 161);
    const entries = fields(admission[j++], 48);
    if (j !== admission.length || !entries.length || entries.length > 16) fail('FORMAT');
    const professions = entries.map(profession), tids = new Set(professions.map(p => p.telematikId));
    const professionOids = professions.map(p => p.professionOid);
    if (new Set(professionOids).size !== professionOids.length) fail('ROLE_DUPLICATE');
    if (tids.size !== 1) fail('IDENTITY_CONFLICT');
    for (const oid of professionOids) {
      if (!professional.has(oid) && !institution.has(oid)) fail('ROLE_UNSUPPORTED');
      if (!family.has(oid)) fail('ROLE_TYPE_MISMATCH');
    }
    return Object.freeze({ telematikId: professions[0].telematikId, professionOids: Object.freeze(professionOids),
      professions: Object.freeze(professions), roleVersion: ADMISSION_ROLE_VERSION });
  } catch (e) { if (e instanceof CertificateAdmissionError) throw e; fail('FORMAT'); }
}
