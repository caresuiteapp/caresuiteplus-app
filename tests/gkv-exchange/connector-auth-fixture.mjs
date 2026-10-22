import { openssl } from '../../services/gkv/openssl.mjs';
import { AUTH_SERVICE, DSS, ECDSA_TYPE } from '../../services/kim/connector-xml.mjs';
import { envelope } from './connector-fixture.mjs';

export const authUrl = options => options.url.replace('/CertificateService', '/AuthSignatureService');
export const isAuthenticate = bytes => bytes.includes('<c:ExternalAuthenticate>');
export const authResponse = (signature, { type = ECDSA_TYPE, execution = 'OK' } = {}) => envelope(
  `<auth:ExternalAuthenticateResponse xmlns:auth="${AUTH_SERVICE}" xmlns:dss="${DSS}"><n:Status><n:Result>${execution}</n:Result></n:Status><dss:SignatureObject><dss:Base64Signature Type="${type}">${signature.toString('base64')}</dss:Base64Signature></dss:SignatureObject></auth:ExternalAuthenticateResponse>`);

/** Independent OpenSSL prehashed signing models the card, NOT the client.
 * Accidentally hashing the hash a second time fails the client's verification.
 */
export async function signAuthRequest(bytes, identity, pki) {
  const match = bytes.toString().match(/<dss:Base64Data MimeType="application\/octet-stream">([^<]+)<\/dss:Base64Data>/);
  if (!match) throw new Error('TEST_AUTH_REQUEST');
  const digest = Buffer.from(match[1], 'base64');
  if (digest.length !== 32) throw new Error('TEST_AUTH_DIGEST');
  return openssl(['pkeyutl', '-sign', '-inkey', identity.privateKeyPath, '-passin', 'fd:3', '-pkeyopt', 'digest:sha256'],
    { input: digest, password: pki.password, maxOutput: 72 });
}
