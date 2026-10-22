import { X509Certificate } from 'node:crypto';
import { KimMessageError, inspectEccKimMessageForDirectory, authenticateInspectedKimMessage,
  receiveEccKimDirectoryDiagnostic } from './client-message.mjs';
import { TslOcspStatusClient } from './tsl-ocsp.mjs';
import { TslError } from './tsl.mjs';
import { assessKimOcspProof } from './ocsp.mjs';
import { lookupVzd, revalidateVzdRecord } from './vzd.mjs';
import { checkVzdConfiguration, vzdRecordMetadata } from './vzd-bindings.mjs';
import { KonnektorCertificateClient, assertConnectorCertificate } from './connector-certificates.mjs';

const errorCode = e => /^KIM_(?:TSL|OCSP|VZD|CONNECTOR)_[A-Z_]{1,64}$/.test(e?.code ?? '') ? e.code : 'KIM_VZD_UNAVAILABLE';
const error = (code, stage = 'trust') => new KimMessageError('KIM_MESSAGE_' + code, stage);
const freeze = Object.freeze;

/** Receiving branch selection uses a current OSIG proof and an actual checked
 * directory record. AUT can supply a different sender identity, never replace
 * a broken CMS signature or negative OSIG status. Inputs are captured by the
 * public TSL facade. Every successful local branch still yields diagnosis 07.
 */
export async function receiveEccKimMessageWithDirectory(options, report, { directory, statusClient, connector, signal }) {
  checkVzdConfiguration(directory, statusClient);
  const render = assess => receiveEccKimDirectoryDiagnostic(options, report, assess);
  let inspected;
  try { inspected = inspectEccKimMessageForDirectory(options); }
  catch { return render(() => ({ error: error('TRUST_UNAVAILABLE') })); }
  const deadline = AbortSignal.timeout(30000), stop = signal ? AbortSignal.any([signal, deadline]) : deadline;
  const stopped = () => {
    if (signal?.aborted) throw new TslError('KIM_TSL_ABORTED');
    if (deadline.aborted) throw new TslError('KIM_TSL_TIMEOUT');
  };
  let signing, authentication, authCertificate, record, required = false;
  let authenticationAssessment = freeze({ state: 'not-checked', reason: 'signing-status' });
  let directoryAcquisition = freeze({ state: 'not-checked', code: 'KIM_VZD_CERTIFICATE_STATUS' });
  const failures = [];
  const connectorProofs = new Map();
  const status = async (certificate, purpose) => {
    stopped();
    let proof;
    try {
      proof = await TslOcspStatusClient.prototype.check.call(statusClient, { certificate, purpose, signal: stop });
      if (connector !== undefined && proof.status === 'good') {
        connectorProofs.set(purpose, await KonnektorCertificateClient.prototype.verifyCertificate.call(connector,
          { certificate: new X509Certificate(certificate).raw, requiredRoles: proof.admission.professionOids, signal: stop }));
      }
      return proof;
    } catch (e) { stopped(); failures.push(freeze({ purpose, code: errorCode(e) })); return proof; }
  };
  const assess = (proof, certificate, purpose) => {
    const raw = assessKimOcspProof(proof, certificate, purpose);
    if (raw.status !== 'good' || connector === undefined) return raw;
    try {
      assertConnectorCertificate(connectorProofs.get(purpose), connector,
        { certificate: new X509Certificate(certificate).raw, requiredRoles: proof.admission.professionOids });
      return raw;
    } catch (e) {
      const acquisitionError = connectorProofs.has(purpose) ? undefined : failures.find(f => f.purpose === purpose)?.code;
      return freeze({ ...raw, status: 'unavailable', code: acquisitionError ?? errorCode(e) });
    }
  };
  const signingStatus = () => assess(signing, options.expectedSignerCertificate, 'signing');
  const binding = (signingMatches, authenticationMatches) => freeze({ ...vzdRecordMetadata(record),
    state: signingMatches || authenticationMatches ? 'matched' : 'mismatch',
    matchedBy: signingMatches ? 'signing' : authenticationMatches ? 'authentication' : undefined,
    signingMatches, ...(authenticationMatches === undefined ? {} : { authenticationMatches }), identityStatus: 'unverified' });

  signing = await status(options.expectedSignerCertificate, 'signing');
  if (signingStatus().status === 'good' && signing.certificateSha256 === inspected.signerSha256) {
    authenticationAssessment = freeze({ state: 'not-checked', reason: 'directory-unavailable' });
    try {
      record = await lookupVzd(directory, inspected.sender, stop, statusClient); stopped(); revalidateVzdRecord(record);
      // An OCSP/TSL change while LDAP was pending must not even start AUT work.
      if (signingStatus().status === 'good') {
        const matches = signing.admission.telematikId === record.telematikId;
        directoryAcquisition = binding(matches);
        if (matches) authenticationAssessment = freeze({ state: 'not-required', reason: 'signing-address-match' });
        else {
          required = true;
          let parsed;
          try { parsed = authenticateInspectedKimMessage(inspected, options.expectedAuthCertificate); }
          catch { authenticationAssessment = freeze({ state: 'rejected', reason: 'token' }); }
          if (parsed) {
            authCertificate = Buffer.from(parsed.certificate);
            authentication = await status(authCertificate, 'authentication'); stopped();
            const checked = assess(authentication, authCertificate, 'authentication');
            authenticationAssessment = freeze({ state: checked.status === 'good' ? 'checked' : 'rejected',
              reason: checked.status === 'good' ? 'different-signing-identity' : 'certificate-status',
              certificateSha256: parsed.certificateSha256 });
            revalidateVzdRecord(record);
            directoryAcquisition = binding(false, checked.status === 'good'
              ? authentication.admission.telematikId === record.telematikId : undefined);
          }
        }
      } else authenticationAssessment = freeze({ state: 'not-checked', reason: 'signing-status' });
    } catch (e) {
      stopped(); directoryAcquisition = freeze({ state: 'unavailable', code: errorCode(e) });
    }
  }
  stopped();
  let certificateStatus;
  const result = render(current => {
    stopped();
    certificateStatus = freeze([signingStatus(), ...(authCertificate
      ? [assess(authentication, authCertificate, 'authentication')] : [])]);
    if (certificateStatus.some(s => s.status !== 'good')) {
      if (certificateStatus[0].status !== 'good') authenticationAssessment = freeze({ state: 'not-checked', reason: 'signing-status' });
      else authenticationAssessment = freeze({ state: 'rejected', reason: 'certificate-status',
        ...(authCertificate ? { certificateSha256: certificateStatus[1]?.certificateSha256 } : {}) });
      return { error: error('CERTIFICATE_STATUS_REJECTED'), certificateStatus };
    }
    if (current.originalSha256 !== inspected.originalSha256 || current.signerSha256 !== inspected.signerSha256
      || current.sender !== inspected.sender) return { error: error('HEADERS_REJECTED', 'headers'), certificateStatus };
    if (!record || directoryAcquisition.state === 'unavailable') return { error: error('DIRECTORY_BINDING_REJECTED'), certificateStatus };
    try { revalidateVzdRecord(record); }
    catch (e) {
      directoryAcquisition = freeze({ state: 'unavailable', code: errorCode(e) });
      if (!required) authenticationAssessment = freeze({ state: 'not-checked', reason: 'directory-unavailable' });
      return { error: error('DIRECTORY_BINDING_REJECTED'), certificateStatus };
    }
    if (required) {
      try {
        const fresh = authenticateInspectedKimMessage(current, options.expectedAuthCertificate);
        if (!authCertificate?.equals(fresh.certificate)) throw new Error();
      } catch {
        authenticationAssessment = freeze({ state: 'rejected', reason: 'token' });
        return { error: error('AUTH_REJECTED', 'auth'), certificateStatus };
      }
    }
    const signingMatches = signing.admission.telematikId === record.telematikId;
    directoryAcquisition = binding(signingMatches, required ? authentication?.admission.telematikId === record.telematikId : undefined);
    return { error: error(directoryAcquisition.state === 'matched' ? 'TRUST_UNAVAILABLE' : 'DIRECTORY_BINDING_REJECTED'), certificateStatus };
  });
  const acquired = { signing, ...(authCertificate ? { authentication } : {}) };
  const current = certificateStatus?.every(s => s.status === 'good') === true;
  return { ...result, directoryAcquisition, authenticationAssessment,
    ...(connector === undefined ? {} : { connectorAcquisition: freeze({
      source: 'configured-konnektor', identityStatus: 'unverified',
      certificates: freeze(Object.fromEntries(connectorProofs)),
    }) }),
    statusAcquisition: freeze({ state: current ? 'checked' : signing ? 'incomplete' : 'unavailable',
      ...(signing ? { tsl: signing.tsl } : {}),
      certificateTypes: freeze(Object.fromEntries(Object.entries(acquired).filter(([, p]) => p).map(([role, p]) => [role, p.certificateTypeOid]))),
      certificateAdmissions: freeze(Object.fromEntries(Object.entries(acquired).filter(([, p]) => p).map(([role, p]) => [role, p.admission]))),
      failures: freeze(failures) }) };
}
