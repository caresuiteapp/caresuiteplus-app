// Small DER writer for the explicitly supported KIM CMS profile, not a general ASN.1 codec.
export const OID = Object.freeze({
  data: '2a864886f70d010701', signed: '2a864886f70d010702', authEnvelope: '2a864886f70d0109100117',
  ecies: '2a8214004c04815e', brainpool: '2b2403030208010107', ecPublicKey: '2a8648ce3d0201',
  aes256gcm: '60864801650304012e', sha256: '608648016503040201', ecdsaSha256: '2a8648ce3d040302',
  emails: '2a8214004c04812d', contentType: '2a864886f70d010903', messageDigest: '2a864886f70d010904',
  signingTime: '2a864886f70d010905', signingCertificateV2: '2a864886f70d010910022f',
});
export function tlv(tag, value) {
  if (!Number.isInteger(tag) || tag < 0 || tag > 254 || (tag & 31) === 31 || !(value instanceof Uint8Array) || value.length > 24_000_000) throw new Error('KIM_DER_INPUT');
  const bytes = Buffer.from(value), n = bytes.length;
  const size = n < 128 ? Buffer.from([n]) : Buffer.from(n.toString(16).padStart(Math.ceil(n.toString(16).length / 2) * 2, '0'), 'hex');
  return Buffer.concat([Buffer.from([tag]), ...(n < 128 ? [size] : [Buffer.from([128 + size.length]), size]), bytes]);
}
export const sequence = (...nodes) => tlv(48, Buffer.concat(nodes));
export const sortedSet = (...nodes) => tlv(49, Buffer.concat([...nodes].sort(Buffer.compare)));
export const objectId = hex => tlv(6, Buffer.from(hex, 'hex'));
export const octets = bytes => tlv(4, bytes);
export const attribute = (id, value) => sequence(objectId(id), sortedSet(value));
export const isOrdered = nodes => nodes.every((n, i) => !i || Buffer.compare(nodes[i - 1].raw, n.raw) <= 0);
