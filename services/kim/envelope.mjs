import { der, fields, oid, rsaAlgorithm } from '../gkv/der.mjs';
import { kimAddress } from './address.mjs';

/** Bounded OUTER CMS inspection for the RSA-OAEP/AES-256-GCM subset of gemSMIME_KOMLE.
 * The FD cannot decrypt the recipient's content. This does NOT verify the inner signature,
 * recipient-emails signed copy, VZD identity, CAdES, or medical payload. The receiving CM must.
 * ECC/BER/other supported-by-TI encodings are explicitly unavailable, never relabelled as verified.
 */
export function inspectKimEnvelope(bytes, addresses) {
  try {
    const info = fields(der(bytes), 48, 2); oid(info[0], '2a864886f70d0109100117');
    const data = fields(fields(info[1], 160, 1)[0], 48);
    if (data.some(n => n.tag === 161)) throw new Error('KIM_ENVELOPE_UNSUPPORTED');
    if (data.length !== 5) throw new Error('KIM_ENVELOPE_INVALID');
    if (data[0].tag !== 2 || data[0].value.toString('hex') !== '00') throw new Error('KIM_ENVELOPE_INVALID');
    const recipients = fields(data[1], 49);
    if (!recipients.length || recipients.length > 1000) throw new Error('KIM_ENVELOPE_INVALID');
    const ordered = nodes => nodes.every((n, i) => !i || Buffer.compare(nodes[i - 1].raw, n.raw) <= 0);
    if (!ordered(recipients)) throw new Error('KIM_ENVELOPE_INVALID');
    const identities = new Set();
    const identity = n => {
      const f = fields(n, 48, 2);
      fields(f[0], 48);
      if (f[1].tag !== 2 || !f[1].value.length || f[1].value.length > 21 || f[1].value[0] & 128
        || (f[1].value.length > 1 && f[1].value[0] === 0 && !(f[1].value[1] & 128))) throw new Error('KIM_ENVELOPE_INVALID');
      return n.raw.toString('hex');
    };
    for (const recipient of recipients) {
      if (recipient.tag === 161) throw new Error('KIM_ENVELOPE_UNSUPPORTED');
      const r = fields(recipient, 48, 4);
      if (r[0].tag !== 2 || r[0].value.toString('hex') !== '00' || r[3].tag !== 4 || r[3].value.length < 256 || r[3].value.length > 1024) throw new Error('KIM_ENVELOPE_INVALID');
      const algorithm = fields(r[2], 48);
      if (algorithm[0]?.value.toString('hex') !== '2a864886f70d010107') throw new Error('KIM_ENVELOPE_UNSUPPORTED');
      rsaAlgorithm(r[2], 'oaep');
      const rid = identity(r[1]); if (identities.has(rid)) throw new Error('KIM_ENVELOPE_INVALID'); identities.add(rid);
    }
    const content = fields(data[2], 48, 3); oid(content[0], '2a864886f70d010701');
    const algorithm = fields(content[1], 48, 2); oid(algorithm[0], '60864801650304012e');
    const gcm = fields(algorithm[1], 48, 2);
    if (gcm[0].tag !== 4 || gcm[0].value.length !== 12 || gcm[1].tag !== 2 || gcm[1].value.toString('hex') !== '10'
      || content[2].tag !== 128 || !content[2].value.length || data[3].tag !== 4 || data[3].value.length !== 16) throw new Error('KIM_ENVELOPE_INVALID');
    const attributes = fields(data[4], 162);
    if (attributes.length !== 1) throw new Error('KIM_ENVELOPE_UNSUPPORTED');
    const attribute = fields(attributes[0], 48, 2); oid(attribute[0], '2a8214004c04812d');
    const emails = fields(fields(attribute[1], 49, 1)[0], 49), associated = new Set(), found = new Set();
    if (emails.length !== identities.size || !ordered(emails)) throw new Error('KIM_ENVELOPE_INVALID');
    for (const entry of emails) {
      const e = fields(entry, 48, 2);
      if (e[0].tag !== 22 || e[0].value.some(b => b > 127)) throw new Error('KIM_ENVELOPE_INVALID');
      const address = kimAddress(e[0].value.toString('ascii')), rid = identity(e[1]);
      if (!identities.has(rid) || associated.has(rid)) throw new Error('KIM_ENVELOPE_INVALID');
      associated.add(rid); found.add(address);
    }
    if (addresses.some(address => !found.has(kimAddress(address)))) throw new Error('KIM_ENVELOPE_INVALID');
    return { profile: 'rsa-oaep-sha256-aes256gcm', recipients: found.size };
  } catch (e) {
    if (e.message === 'KIM_ENVELOPE_UNSUPPORTED') throw e;
    if (e.message === 'DER_LENGTH') throw new Error('KIM_ENVELOPE_UNSUPPORTED');
    throw new Error('KIM_ENVELOPE_INVALID');
  }
}
