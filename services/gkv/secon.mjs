import { X509Certificate, createHash, createPrivateKey } from 'node:crypto';
import { readFile, lstat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { openssl, privateWorkspace } from './openssl.mjs';
import { certificateParts, certificateKeyUsage, rsaAlgorithm, inspectEnvelope, inspectSigned } from './der.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const ik = v => /^[1-9]\d{8}$/.test(v);
const certs = pem => [...String(pem).matchAll(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g)].map(m => new X509Certificate(m[0]));
function leaf(pem, expectedIk, now) {
  const all = certs(pem);
  if (all.length !== 1 || !ik(expectedIk)) throw new Error('SECON_CERTIFICATE');
  const c = all[0], details = c.publicKey.asymmetricKeyDetails;
  if (c.ca || c.publicKey.asymmetricKeyType !== 'rsa' || details.modulusLength !== 4096 || details.publicExponent !== 65537n) throw new Error('SECON_RSA4096');
  if (!c.subject.split('\n').includes(`OU=IK${expectedIk}`) || !c.subject.split('\n').includes('C=DE')) throw new Error('SECON_CERTIFICATE_IK');
  if (now.getTime() < Date.parse(c.validFrom) || now.getTime() > Date.parse(c.validTo)) throw new Error('SECON_CERTIFICATE_TIME');
  if ((certificateKeyUsage(c.raw) & 0xa0) !== 0xa0) throw new Error('SECON_CERTIFICATE_USAGE');
  rsaAlgorithm(certificateParts(c.raw).signatureAlgorithm, 'pss');
  return c;
}
/** Server-owned trust material only. No OS/web trust fallback and no disabled revocation checks. */
export class SeconSecurity {
  #config;
  constructor(config) {
    this.#config = { ...config, rootFingerprints: [...config.rootFingerprints] };
    if (!config.rootFingerprints.length || config.rootFingerprints.some(v => !/^[a-f0-9]{64}$/.test(v))) throw new Error('SECON_TRUST_PIN');
    if (!isAbsolute(config.privateKeyPath) || typeof config.password !== 'function') throw new Error('SECON_PRIVATE_KEY');
  }
  async #material(context, now) {
    if (!Number.isFinite(now.getTime())) throw new Error('SECON_TIME');
    const c = this.#config;
    const sender = leaf(c.senderCertificate, context.senderIk, now), receiver = leaf(c.recipientCertificate, context.receiverIk, now);
    const roots = certs(c.trustRoots);
    if (!roots.length || roots.length !== c.rootFingerprints.length || roots.some(r => !r.ca || !c.rootFingerprints.includes(hash(r.raw)))) throw new Error('SECON_TRUST_PIN');
    if (!String(c.crls).includes('-----BEGIN X509 CRL-----')) throw new Error('SECON_CRL_REQUIRED');
    const stat = await lstat(c.privateKeyPath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.mode & 0o077) throw new Error('SECON_KEY_PERMISSIONS');
    const encryptedKey = await readFile(c.privateKeyPath);
    if (!encryptedKey.includes('-----BEGIN ENCRYPTED PRIVATE KEY-----')) throw new Error('SECON_KEY_ENCRYPTION');
    const password = Buffer.from(await c.password());
    try {
      const privateKey = createPrivateKey({ key: encryptedKey, passphrase: password });
      if (!sender.checkPrivateKey(privateKey)) throw new Error('SECON_KEY_MISMATCH');
      return { sender, receiver, encryptedKey, password, now };
    } catch (error) { password.fill(0); throw error; }
  }
  async #run(context, now, operation) {
    const m = await this.#material(context, now), c = this.#config;
    try {
      return await privateWorkspace(async file => {
        const sender = await file('sender.pem', m.sender.toString()), receiver = await file('receiver.pem', m.receiver.toString());
        const key = await file('key.pem', m.encryptedKey), roots = await file('roots.pem', c.trustRoots);
        const chain = c.intermediates ? await file('chain.pem', c.intermediates) : undefined;
        const signingChain = await file('signing-chain.pem', `${c.intermediates ?? ''}\n${c.trustRoots}`);
        const crls = await file('crls.pem', c.crls);
        const trust = ['-CAfile', roots, '-no-CApath', '-no-CAstore', '-crl_check_all', '-attime', String(Math.floor(now.getTime() / 1000)), '-purpose', 'any'];
        for (const path of [sender, receiver]) await openssl(['verify', ...trust, '-CRLfile', crls, ...(chain ? ['-untrusted', chain] : []), path]);
        return await operation({ ...m, senderPath: sender, receiverPath: receiver, key, chain, signingChain, file, trust, crls });
      });
    } finally { m.password.fill(0); }
  }
  async encryptAndSign(bytes, context) {
    if (!bytes.length || bytes.length > 20_000_000) throw new Error('SECON_CONTENT_SIZE');
    return this.#run(context, this.#config.now?.() ?? new Date(), async m => {
      const signed = await openssl(['cms', '-sign', '-binary', '-nodetach', '-noattr', '-md', 'sha256', '-outform', 'DER',
        '-signer', m.senderPath, '-inkey', m.key, '-passin', 'fd:3', '-keyopt', 'rsa_padding_mode:pss', '-keyopt', 'rsa_pss_saltlen:32', '-keyopt', 'rsa_mgf1_md:sha256',
        '-certfile', m.signingChain], { input: bytes, password: m.password });
      inspectSigned(signed, m.sender.raw);
      // SECON 3.2.2.3 explicitly permits an additional sender recipient for local recovery/verification.
      const recipients = m.sender.raw.equals(m.receiver.raw) ? [m.receiverPath] : [m.receiverPath, m.senderPath];
      const encrypted = await openssl(['cms', '-encrypt', '-binary', '-outform', 'DER', '-aes-256-cbc',
        ...recipients.flatMap(path => ['-recip', path, '-keyopt', 'rsa_padding_mode:oaep', '-keyopt', 'rsa_oaep_md:sha256', '-keyopt', 'rsa_mgf1_md:sha256'])], { input: signed });
      inspectEnvelope(encrypted, m.sender.raw.equals(m.receiver.raw) ? [m.receiver.raw] : [m.receiver.raw, m.sender.raw]);
      return encrypted;
    });
  }
  async verify(bytes, expected) {
    const now = this.#config.now?.() ?? new Date();
    const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(now);
    if (day !== expected.day) throw new Error('SECON_PROOF_DAY');
    return this.#run(expected, now, async m => {
      inspectEnvelope(bytes, m.sender.raw.equals(m.receiver.raw) ? [m.receiver.raw] : [m.receiver.raw, m.sender.raw]);
      const signed = await openssl(['cms', '-decrypt', '-binary', '-inform', 'DER', '-recip', m.senderPath, '-inkey', m.key, '-passin', 'fd:3'], { input: bytes, password: m.password });
      const content = inspectSigned(signed, m.sender.raw);
      // Chain and CRLs were verified above. -nointern pins the mathematical signature to THIS leaf.
      const plain = await openssl(['cms', '-verify', '-binary', '-inform', 'DER', '-nointern', '-certfile', m.senderPath, '-noverify', '-verify_retcode'], { input: signed });
      if (!plain.equals(content) || hash(plain) !== expected.plaintextSha256) throw new Error('SECON_PLAINTEXT_HASH');
      return { valid: true, format: 'PKCS#7', ciphertextSha256: hash(bytes), plaintextSha256: hash(plain), senderIk: expected.senderIk, receiverIk: expected.receiverIk };
    });
  }
}
