import { der, fields, oid, rsaAlgorithm } from '../gkv/der.mjs';
import { kimAddress } from './address.mjs';
import { inspectEciesKey } from './ecies.mjs';
import { OID, isOrdered } from './cms-codec.mjs';

/** Bounded OUTER CMS inspection for the TI-ECIES and legacy RSA-OAEP KIM subsets.
 * The FD cannot decrypt the recipient's content. This does NOT verify the inner signature,
 * recipient-emails signed copy, VZD identity, CAdES, or medical payload. The receiving CM must.
 * KeyAgreeRecipientInfo is NOT TI-ECIES: gemSpec_Krypt A_17220 uses KeyTransRecipientInfo.
 * BER/other encodings are explicitly unavailable, never relabelled as verified.
 */
export function inspectKimEnvelope(bytes, addresses) {
  const { profile, recipients } = readKimEnvelope(bytes, addresses);
  return { profile, recipients };
}
/** Internal structural decoder for the receiving codec. Returned fields are not trusted identities. */
export function readKimEnvelope(bytes, addresses = []) {
  try {
    if (!(bytes instanceof Uint8Array) || !Array.isArray(addresses) || addresses.length > 1000) throw new Error('KIM_ENVELOPE_INVALID');
    const info = fields(der(bytes), 48, 2); oid(info[0], '2a864886f70d0109100117');
    const data = fields(fields(info[1], 160, 1)[0], 48);
    if (data.some(n => n.tag === 161)) throw new Error('KIM_ENVELOPE_UNSUPPORTED');
    if (data.length !== 5) throw new Error('KIM_ENVELOPE_INVALID');
    if (data[0].tag !== 2 || data[0].value.toString('hex') !== '00') throw new Error('KIM_ENVELOPE_INVALID');
    const recipients = fields(data[1], 49);
    if (!recipients.length || recipients.length > 1000) throw new Error('KIM_ENVELOPE_INVALID');
    if (!isOrdered(recipients)) throw new Error('KIM_ENVELOPE_INVALID');
    const identities = new Set(), keys = [], profiles = new Set();
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
      if (r[0].tag !== 2 || r[0].value.toString('hex') !== '00' || r[3].tag !== 4) throw new Error('KIM_ENVELOPE_INVALID');
      const algorithm = fields(r[2], 48);
      if (algorithm[0]?.tag !== 6) throw new Error('KIM_ENVELOPE_INVALID');
      const encryption = algorithm[0].value.toString('hex');
      if (encryption === OID.ecies) {
        if (algorithm.length !== 1) throw new Error('KIM_ENVELOPE_INVALID');
        inspectEciesKey(r[3].value); profiles.add('ti-ecies-brainpoolp256r1');
      } else if (encryption === '2a864886f70d010107') {
        if (r[3].value.length < 256 || r[3].value.length > 1024) throw new Error('KIM_ENVELOPE_INVALID');
        rsaAlgorithm(r[2], 'oaep'); profiles.add('rsa-oaep-sha256');
      } else throw new Error('KIM_ENVELOPE_UNSUPPORTED');
      const rid = identity(r[1]); if (identities.has(rid)) throw new Error('KIM_ENVELOPE_INVALID'); identities.add(rid);
      keys.push({ rid, encryption, encryptedKey: r[3].value });
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
    if (emails.length !== identities.size || !isOrdered(emails)) throw new Error('KIM_ENVELOPE_INVALID');
    const mappings = [];
    for (const entry of emails) {
      const e = fields(entry, 48, 2);
      if (e[0].tag !== 22 || e[0].value.some(b => b > 127)) throw new Error('KIM_ENVELOPE_INVALID');
      const address = kimAddress(e[0].value.toString('ascii')), rid = identity(e[1]);
      if (!identities.has(rid) || associated.has(rid)) throw new Error('KIM_ENVELOPE_INVALID');
      associated.add(rid); found.add(address);
      mappings.push({ address, rid });
    }
    if (addresses.some(address => !found.has(kimAddress(address)))) throw new Error('KIM_ENVELOPE_INVALID');
    return { profile: `${profiles.size === 1 ? [...profiles][0] : 'mixed-rsa-ti-ecies'}-aes256gcm`, recipients: found.size,
      keys, mappings, recipientEmails: attributes[0].raw, nonce: gcm[0].value, ciphertext: content[2].value, tag: data[3].value };
  } catch (e) {
    if (e.message === 'KIM_ENVELOPE_UNSUPPORTED') throw e;
    if (e.message === 'DER_LENGTH') throw new Error('KIM_ENVELOPE_UNSUPPORTED');
    throw new Error('KIM_ENVELOPE_INVALID');
  }
}
