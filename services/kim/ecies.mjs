import { ECDH, createPublicKey, createHash, generateKeyPairSync, diffieHellman, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';
import { der, fields, oid } from '../gkv/der.mjs';
import { aesBlock, isoPad, aes256Cmac } from './cmac.mjs';
import { OID, objectId, sequence, tlv } from './cms-codec.mjs';

const curve = 'brainpoolP256r1';
// gemSpec_COS N085.068.b.7: DOA6(oid, 7F49(86(point)), 86(02||cipher), 8E(mac)).
// This codec handles ONLY the 32-byte transport key required by gemSpec_Krypt A_17220.
const prefix = Buffer.from('a6818e06092b24030302080101077f49438641', 'hex');
const cipherPrefix = Buffer.from('863102', 'hex'), macPrefix = Buffer.from('8e08', 'hex');

export function brainpoolPublicKey(key) {
  if (!key || key.type !== 'public' || key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== curve) throw new Error('KIM_ECIES_KEY');
  const parts = fields(der(key.export({ type: 'spki', format: 'der' })), 48, 2);
  const algorithm = fields(parts[0], 48, 2); oid(algorithm[0], OID.ecPublicKey); oid(algorithm[1], OID.brainpool);
  if (parts[1].tag !== 3 || parts[1].value.length !== 66 || parts[1].value[0] !== 0) throw new Error('KIM_ECIES_KEY');
  const point = parts[1].value.subarray(1);
  if (point[0] !== 4 || !ECDH.convertKey(point, curve, undefined, undefined, 'uncompressed').equals(point)) throw new Error('KIM_ECIES_KEY');
  return Buffer.from(point);
}
/** Structural validation only; the FD has no private key and cannot check the CMAC. */
export function inspectEciesKey(bytes) {
  try {
    if (!(bytes instanceof Uint8Array) || bytes.length !== 145) throw new Error();
    const value = Buffer.from(bytes);
    if (!value.subarray(0, 19).equals(prefix) || !value.subarray(84, 87).equals(cipherPrefix) || !value.subarray(135, 137).equals(macPrefix)) throw new Error();
    const point = value.subarray(19, 84);
    if (point[0] !== 4 || !ECDH.convertKey(point, curve, undefined, undefined, 'uncompressed').equals(point)) throw new Error();
    return { point, ciphertext: value.subarray(87, 135), tag: value.subarray(137) };
  } catch { throw new Error('KIM_ECIES_REJECTED'); }
}
function derive(privateKey, publicKey) {
  // brainpoolP256r1 has cofactor 1: native ECDH is COS ECKAvalue (N004.492).
  const shared = diffieHellman({ privateKey, publicKey });
  try {
    if (shared.length !== 32) throw new Error('KIM_ECIES_REJECTED');
    return [1, 2].map(counter => createHash('sha256').update(shared).update(Buffer.from([0, 0, 0, counter])).digest());
  } finally { shared.fill(0); }
}
export function encryptEciesKey(transportKey, recipientKey) {
  let enc, mac, iv, padded, fullTag;
  try {
    if (!(transportKey instanceof Uint8Array) || transportKey.length !== 32) throw new Error();
    brainpoolPublicKey(recipientKey);
    const ephemeral = generateKeyPairSync('ec', { namedCurve: curve });
    [enc, mac] = derive(ephemeral.privateKey, recipientKey);
    iv = aesBlock(enc, Buffer.alloc(16)); padded = isoPad(transportKey);
    const cipher = createCipheriv('aes-256-cbc', enc, iv); cipher.setAutoPadding(false);
    const ciphertext = Buffer.concat([cipher.update(padded), cipher.final()]);
    // ISO padding is applied even when C is already a multiple of the block size.
    fullTag = aes256Cmac(mac, isoPad(ciphertext));
    return Buffer.concat([prefix, brainpoolPublicKey(ephemeral.publicKey), cipherPrefix, ciphertext, macPrefix, fullTag.subarray(0, 8)]);
  } catch { throw new Error('KIM_ECIES_REJECTED'); }
  finally { for (const bytes of [enc, mac, iv, padded, fullTag]) bytes?.fill(0); }
}
export function decryptEciesKey(bytes, privateKey) {
  let enc, mac, iv, fullTag, clear;
  try {
    if (!privateKey || privateKey.type !== 'private') throw new Error();
    brainpoolPublicKey(createPublicKey(privateKey));
    const { point, ciphertext, tag } = inspectEciesKey(bytes);
    const publicKey = createPublicKey({ key: sequence(sequence(objectId(OID.ecPublicKey), objectId(OID.brainpool)), tlv(3, Buffer.concat([Buffer.from([0]), point]))), type: 'spki', format: 'der' });
    [enc, mac] = derive(privateKey, publicKey);
    fullTag = aes256Cmac(mac, isoPad(ciphertext));
    if (!timingSafeEqual(fullTag.subarray(0, 8), tag)) throw new Error();
    iv = aesBlock(enc, Buffer.alloc(16));
    const decipher = createDecipheriv('aes-256-cbc', enc, iv); decipher.setAutoPadding(false);
    clear = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    // The plaintext is exactly 32 octets; ISO 7816-4 adds one complete 16-byte block.
    if (clear.length !== 48 || !timingSafeEqual(clear.subarray(32), Buffer.from('80000000000000000000000000000000', 'hex'))) throw new Error();
    return Buffer.from(clear.subarray(0, 32));
  } catch { throw new Error('KIM_ECIES_REJECTED'); }
  finally { for (const bytes of [enc, mac, iv, fullTag, clear]) bytes?.fill(0); }
}
