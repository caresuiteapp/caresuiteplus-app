import { generateKeyPair, createHash, createPublicKey } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdir, writeFile, lstat, rm } from 'node:fs/promises';
import { isAbsolute, join, dirname } from 'node:path';
import { openssl, privateWorkspace } from './openssl.mjs';
import { der, fields, rsaAlgorithm } from './der.mjs';

const keyPair = promisify(generateKeyPair);
const text = (v, limit) => typeof v === 'string' && v.length > 0 && v.length <= limit && v.trim() === v && /^[A-Za-z0-9/ .()-]+$/.test(v);
/** Creates a real encrypted RSA key and a SECON PKCS#10 request, never a self-issued participant certificate.
 * Submitting the request, verified organizational identity, ITSG registration and acceptance remain separate.
 */
export async function createRegistrationRequest({ directory, ik, company, contact, trustCenter = 'ITSG TrustCenter fuer sonstige Leistungserbringer', password }) {
  if (!isAbsolute(directory) || !/^[1-9]\d{8}$/.test(ik) || !text(company, 64) || !text(contact, 128) || !['ITSG TrustCenter fuer sonstige Leistungserbringer', 'DKTIG TrustCenter fuer Krankenhaeuser und Leistungserbringer PKC'].includes(trustCenter)) throw new Error('REGISTRATION_INPUT');
  if (!(password instanceof Uint8Array) || password.length < 20 || password.length > 1024 || Buffer.from(password).some(b => b === 0 || b === 10 || b === 13)) throw new Error('REGISTRATION_PASSWORD');
  const parent = await lstat(dirname(directory));
  if (!parent.isDirectory() || parent.isSymbolicLink() || parent.mode & 0o077) throw new Error('REGISTRATION_DIRECTORY');
  // Exclusive creation prevents replacing a live identity or leaving a partial update to an existing key.
  await mkdir(directory, { mode: 0o700 }); const pass = Buffer.from(password);
  try {
    const pair = await keyPair('rsa', { modulusLength: 4096, publicExponent: 65537,
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: pass },
    });
    const privateKeyPath = join(directory, 'private-key.pem');
    await writeFile(privateKeyPath, pair.privateKey, { flag: 'wx', mode: 0o600 });
    const subject = `/C=DE/O=${trustCenter}/OU=${company.replaceAll('/', '\\/')}/OU=IK${ik}/CN=${contact.replaceAll('/', '\\/')}`;
    const request = await privateWorkspace(async file => {
      // An explicit empty request configuration prevents host OpenSSL defaults injecting extensions.
      const config = await file('request.cnf', '[req]\nprompt=no\ndistinguished_name=dn\nstring_mask=default\n[dn]\nC=DE\n');
      return openssl(['req', '-new', '-config', config, '-key', privateKeyPath, '-passin', 'fd:3', '-subj', subject, '-sha256',
        '-sigopt', 'rsa_padding_mode:pss', '-sigopt', 'rsa_pss_saltlen:32', '-sigopt', 'rsa_mgf1_md:sha256', '-outform', 'DER'], { password: pass });
    });
    const csr = fields(der(request), 48, 3), info = fields(csr[0], 48, 4);
    rsaAlgorithm(csr[1], 'pss');
    if (info[3].tag !== 160 || info[3].value.length || !info[2].raw.equals(pair.publicKey)) throw new Error('REGISTRATION_CSR');
    await openssl(['req', '-inform', 'DER', '-verify', '-noout'], { input: request });
    const requestPath = join(directory, `${ik.slice(0, 8)}.p10`); await writeFile(requestPath, request, { flag: 'wx', mode: 0o600 });
    const publicKey = createPublicKey({ key: pair.publicKey, format: 'der', type: 'spki' });
    return { privateKeyPath, requestPath, request: Buffer.from(request), requestSha256: createHash('sha256').update(request).digest('hex'), keyBits: publicKey.asymmetricKeyDetails.modulusLength };
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
  finally { pass.fill(0); }
}
