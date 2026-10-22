import { X509Certificate, createHash } from 'node:crypto';
import { kimAddress } from './address.mjs';
import { VzdLdapsDirectory, lookupVzd } from './vzd.mjs';
import { vzdFail } from './vzd-ldap.mjs';
import { TslOcspStatusClient } from './tsl-ocsp.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (client, certificate, signal) => TslOcspStatusClient.prototype.check.call(client, { certificate, purpose: 'encryption', signal });
export function checkVzdConfiguration(directory, statusClient) {
  if (!(directory instanceof VzdLdapsDirectory) || !(statusClient instanceof TslOcspStatusClient)
    || directory.environment !== statusClient.environment) vzdFail('CONFIGURATION');
}
export const vzdRecordMetadata = record => Object.freeze({ address: record.address, telematikId: record.telematikId,
  version: record.version, appTags: record.appTags, checkedAt: record.checkedAt, environment: record.environment,
  routeSha256: record.routeSha256, serverSha256: record.serverSha256, trustSource: record.trustSource });

/** Obtain actual directory ENC bytes and match their TSL-checked Admission IDs.
 * Results are local inputs for createEccKimMessage, never delivery permissions.
 * Every raw OCSP proof is reverified after the last wait, including TSL guards.
 */
export async function resolveVzdRecipients({ addresses, directory, statusClient, signal }) {
  checkVzdConfiguration(directory, statusClient);
  if (!Array.isArray(addresses) || !addresses.length || addresses.length > 101
    || (signal !== undefined && !(signal instanceof AbortSignal))) vzdFail('CONFIGURATION');
  let targets;
  try { targets = addresses.map(kimAddress); } catch { vzdFail('ADDRESS'); }
  if (new Set(targets).size !== targets.length) vzdFail('ADDRESS');
  if (targets.some(a => (directory.environment === 'production') === a.endsWith('.telematik-test'))) vzdFail('ENVIRONMENT');
  if (signal?.aborted) vzdFail('ABORTED');
  const deadline = AbortSignal.timeout(30000), stop = signal ? AbortSignal.any([signal, deadline]) : deadline;
  const records = [], proofs = [], recipients = [];
  try {
    for (const address of targets) {
      const record = await lookupVzd(directory, address, stop); records.push(vzdRecordMetadata(record));
      if (recipients.length + record.certificates.length > 1000) vzdFail('CERTIFICATES');
      for (const bytes of record.certificates) {
        // Exact DER from the binary LDAP attribute, not a base64/PEM fallback.
        let certificate;
        try { certificate = new X509Certificate(bytes); if (!certificate.raw.equals(bytes)) throw new Error(); }
        catch { vzdFail('CERTIFICATES'); }
        const proof = await check(statusClient, bytes, stop);
        if (proof.certificateSha256 !== hash(bytes) || proof.status !== 'good') vzdFail('CERTIFICATE_STATUS');
        if (proof.admission.telematikId !== record.telematikId) vzdFail('CERTIFICATE_IDENTITY');
        const copy = Buffer.from(bytes); recipients.push(Object.freeze({ address, certificate: copy }));
        proofs.push({ certificate: Buffer.from(bytes), proof });
      }
    }
    const revalidate = () => {
      if (stop.aborted) vzdFail(signal?.aborted ? 'ABORTED' : 'TIMEOUT');
      for (let i = 0; i < proofs.length; i++) {
        const { certificate, proof } = proofs[i];
        if (!certificate.equals(recipients[i].certificate)) vzdFail('CERTIFICATES');
        if (proof.verifier.verify({ certificate, request: proof.request, response: proof.response }).status !== 'good') vzdFail('CERTIFICATE_STATUS');
      }
    };
    revalidate();
    return Object.freeze({ recipients: Object.freeze(recipients), directoryEvidence: Object.freeze(records), revalidate,
      identityStatus: 'unverified', trustSource: 'configured-tsl-anchors-and-ldaps-peer' });
  } catch (e) {
    if (signal?.aborted) vzdFail('ABORTED');
    if (deadline.aborted) vzdFail('TIMEOUT');
    throw e;
  }
}

/** Compare only the signed/checked certificate Admissions supplied by the receive
 * adapter. This comparison does not replace message signature or OCSP verification.
 */
export async function matchVzdSender(directory, address, evidence, signal) {
  const record = await lookupVzd(directory, address, signal);
  const signing = evidence.certificateAdmissions.signing.telematikId === record.telematikId;
  const authentication = evidence.certificateAdmissions.authentication.telematikId === record.telematikId;
  return Object.freeze({ state: signing || authentication ? 'matched' : 'mismatch',
    matchedBy: signing ? 'signing' : authentication ? 'authentication' : undefined,
    signingMatches: signing, authenticationMatches: authentication,
    ...vzdRecordMetadata(record), identityStatus: 'unverified' });
}
