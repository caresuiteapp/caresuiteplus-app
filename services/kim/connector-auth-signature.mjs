import { verify } from 'node:crypto';
import { der, fields } from '../gkv/der.mjs';
import { connectorFail } from './connector-error.mjs';

// Order of brainpoolP256r1, RFC 5639 section 3.4. Encoding checks only;
// OpenSSL performs the signature verification against the original input.
const ORDER = 0xA9FB57DBA1EEA9BC3E660A909D838D718C397AA3B561A6F7901E0E82974856A7n;
export function verifySmcbAuthenticationSignature(signature, data, certificate) {
  try {
    if (!(signature instanceof Uint8Array) || signature.length < 8 || signature.length > 72) throw new Error();
    const scalars = fields(der(signature), 48, 2).map(node => {
      const value = node.value;
      if (node.tag !== 2 || !value.length || value.length > 33 || value[0] & 128
        || (value.length > 1 && value[0] === 0 && !(value[1] & 128))) throw new Error();
      const n = BigInt('0x' + value.toString('hex'));
      if (n === 0n || n >= ORDER) throw new Error();
      return Buffer.from(n.toString(16).padStart(64, '0'), 'hex');
    });
    const key = certificate.publicKey;
    if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'brainpoolP256r1'
      || !verify('sha256', data, { key, dsaEncoding: 'der' }, signature)) throw new Error();
    return Buffer.concat(scalars);
  } catch { connectorFail('AUTH_SIGNATURE'); }
}
