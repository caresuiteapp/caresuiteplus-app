// Isolated, deliberately untrusted test PKI. Never used by application configuration.
import { generateKeyPairSync, X509Certificate, createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openssl } from '../../services/gkv/openssl.mjs';

export async function testPki() {
  const dir = await mkdtemp(join(tmpdir(), 'cs-gkv-test-')), password = Buffer.from('fictional-local-test-only-2026');
  const file = async (name, data) => { const path = join(dir, name); await writeFile(path, data, { mode: 0o600 }); return path; };
  const key = async name => {
    const pair = generateKeyPairSync('rsa', { modulusLength: 4096, publicExponent: 65537, privateKeyEncoding: { type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: password } });
    return file(`${name}.key`, pair.privateKey);
  };
  const pss = ['-sigopt', 'rsa_padding_mode:pss', '-sigopt', 'rsa_pss_saltlen:32', '-sigopt', 'rsa_mgf1_md:sha256'];
  const rootKey = await key('root'), rootPath = join(dir, 'root.pem');
  await openssl(['req', '-new', '-x509', '-key', rootKey, '-passin', 'fd:3', '-sha256', ...pss, '-days', '30', '-subj', '/C=DE/O=CareSuite Test CA/CN=Not a trusted production authority', '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-out', rootPath], { password });
  await file('index', ''); await file('serial', '1000\n'); await file('crlnumber', '1000\n');
  const config = await file('ca.cnf', `[ca]\ndefault_ca=test\n[test]\ndatabase=${dir}/index\nserial=${dir}/serial\ncrlnumber=${dir}/crlnumber\nnew_certs_dir=${dir}\ncertificate=${rootPath}\nprivate_key=${rootKey}\ndefault_md=sha256\ndefault_days=7\ndefault_crl_days=2\npolicy=policy\nx509_extensions=leaf\nunique_subject=no\n[policy]\ncountryName=supplied\norganizationName=supplied\norganizationalUnitName=supplied\ncommonName=supplied\n[leaf]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid,issuer\n`);
  const issue = async (name, ik) => {
    const privateKeyPath = await key(name), req = join(dir, `${name}.csr`), cert = join(dir, `${name}.pem`);
    await openssl(['req', '-new', '-key', privateKeyPath, '-passin', 'fd:3', '-sha256', ...pss, '-subj', `/C=DE/O=ITSG TrustCenter fuer sonstige Leistungserbringer/OU=CareSuite Test/OU=IK${ik}/CN=Fictional test contact`, '-out', req], { password });
    await openssl(['ca', '-batch', '-config', config, '-passin', 'fd:3', '-in', req, '-out', cert, '-notext', ...pss], { password });
    return { privateKeyPath, certificate: await readFile(cert, 'utf8'), path: cert };
  };
  const sender = await issue('sender', '123456789'), recipient = await issue('receiver', '987654321');
  const crl = async () => openssl(['ca', '-gencrl', '-config', config, '-passin', 'fd:3', ...pss], { password });
  const roots = await readFile(rootPath, 'utf8'), rootFingerprint = createHash('sha256').update(new X509Certificate(roots).raw).digest('hex');
  // TLS uses the same isolated CA, but a separate key and SAN/EKU profile.
  const tlsKey = await key('tls'), tlsRequest = join(dir, 'tls.csr'), tlsCert = join(dir, 'tls.pem');
  await openssl(['req', '-new', '-key', tlsKey, '-passin', 'fd:3', '-subj', '/C=DE/O=CareSuite Test/OU=TLS/CN=localhost.test', '-out', tlsRequest], { password });
  const tlsExt = await file('tls.cnf', '[server]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:localhost.test\n');
  await openssl(['ca', '-batch', '-config', config, '-passin', 'fd:3', '-in', tlsRequest, '-out', tlsCert, '-notext', '-extfile', tlsExt, '-extensions', 'server', ...pss], { password });
  const issueIdentity = async ({ name, curve = 'brainpoolP256r1', policy, usage }) => {
      const pair = generateKeyPairSync(curve === 'rsa' ? 'rsa' : 'ec', { ...(curve === 'rsa' ? { modulusLength: 3072 } : { namedCurve: curve }), privateKeyEncoding: { type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: password } });
      const privateKeyPath = await file(`${name}.key`, pair.privateKey), req = join(dir, `${name}.csr`), cert = join(dir, `${name}.pem`);
      await openssl(['req', '-new', '-key', privateKeyPath, '-passin', 'fd:3', '-sha256', '-subj', '/C=DE/O=CareSuite Test/OU=Isolated KIM fixture/CN=Not a TI identity', '-out', req], { password });
      const ext = await file(`${name}.cnf`, `[aut]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,${usage}\ncertificatePolicies=${policy}\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid,issuer\n`);
      await openssl(['ca', '-batch', '-config', config, '-passin', 'fd:3', '-in', req, '-out', cert, '-notext', '-extfile', ext, '-extensions', 'aut', ...pss], { password });
      return { privateKeyPath, certificate: await readFile(cert, 'utf8'), path: cert };
  };
  return {
    dir, sender, recipient, password, roots, rootFingerprint, crls: await crl(),
    issueAut({ name = 'aut', curve = 'brainpoolP256r1', policy = '1.2.276.0.76.4.77' } = {}) {
      return issueIdentity({ name, curve, policy, usage: 'digitalSignature' });
    },
    issueKim({ name, role = 'enc', curve = 'brainpoolP256r1', policy, usage } = {}) {
      return issueIdentity({ name, curve, policy: policy ?? (role === 'osig' ? '1.2.276.0.76.4.78' : '1.2.276.0.76.4.76'), usage: usage ?? (role === 'osig' ? 'nonRepudiation' : 'keyAgreement') });
    },
    tls: { key: await readFile(tlsKey), passphrase: password.toString(), cert: await readFile(tlsCert) },
    async revokeRecipient() { await openssl(['ca', '-config', config, '-passin', 'fd:3', '-revoke', recipient.path], { password }); return crl(); },
    close: () => rm(dir, { recursive: true, force: true }),
  };
}
