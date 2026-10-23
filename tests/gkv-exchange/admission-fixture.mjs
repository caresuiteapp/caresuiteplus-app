// Synthetic local Admission bytes. No real person, institution or TI identity.
import { X509Certificate, sign, constants } from 'node:crypto';
import { certificateParts, fields } from '../../services/gkv/der.mjs';
import { tlv, sequence as seq, objectId as id, octets } from '../../services/kim/cms-codec.mjs';

export function fixtureOid(value) {
  const arcs = value.split('.').map(BigInt), encoded = [];
  for (let arc of [40n * arcs[0] + arcs[1], ...arcs.slice(2)]) {
    const bytes = [Number(arc & 127n)];
    while ((arc >>= 7n)) bytes.unshift(Number(arc & 127n) | 128);
    encoded.push(...bytes);
  }
  return tlv(6, Buffer.from(encoded));
}
export function professionDer({ professionOid = '1.2.276.0.76.4.245', professionItem = 'Betriebsstätte Gesundheits-, Kranken- und Altenpflege',
  telematikId = '10-LOCAL-TEST', naming = [], extra = [] } = {}) {
  return seq(...naming, seq(tlv(12, Buffer.from(professionItem))), seq(fixtureOid(professionOid)),
    ...(telematikId === null ? [] : [tlv(19, Buffer.from(telematikId))]), ...extra);
}
export const admissionDer = (options = {}) => seq(seq(seq(seq(professionDer(options)))));
export const defaultAdmission = policy => admissionDer(['1.2.276.0.76.4.74', '1.2.276.0.76.4.75'].includes(policy)
  ? { professionOid: '1.2.276.0.76.4.234', professionItem: 'Pflegefachfrauen und Pflegefachmänner' } : {});
export function withAdmission(certificate, encoded, rootKey, { critical = false, duplicate = false } = {}) {
  const p = certificateParts(new X509Certificate(certificate).raw);
  const extension = seq(id('2b24080303'), ...(critical ? [tlv(1, Buffer.from([255]))] : []), octets(encoded ?? Buffer.alloc(0)));
  const tbs = seq(...p.tbs.map(n => n.tag !== 163 ? n.raw : tlv(163, seq(...fields(fields(n, 163, 1)[0], 48)
    .filter(e => fields(e, 48)[0].value.toString('hex') !== '2b24080303').map(e => e.raw),
    ...(encoded === undefined ? [] : duplicate ? [extension, extension] : [extension])))));
  const signature = sign('sha256', tbs, { key: rootKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 });
  return seq(tbs, p.signatureAlgorithm.raw, tlv(3, Buffer.concat([Buffer.from([0]), signature])));
}
