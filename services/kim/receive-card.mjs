import { createHash, X509Certificate } from 'node:crypto';
import { KimMessageError, readEccKimTransport, inspectDecryptedEccKimMessage } from './client-message.mjs';
import { receiveReportContext, buildKimReceiveError } from './receive-error.mjs';
import { assessEccKimDirectoryInspection } from './receive-vzd.mjs';
import { KonnektorCertificateClient, takeConnectorDocumentFailure } from './connector-certificates.mjs';
import { prepareSmcbPin, assertPreparedSmcbPin } from './connector-pin.mjs';
import { cardFingerprint } from './connector-cards.mjs';
import { connectorFail, connectorSignal } from './connector-error.mjs';
import { TslOcspStatusClient } from './tsl-ocsp.mjs';
import { checkVzdConfiguration } from './vzd-bindings.mjs';
import { assessKimOcspProof } from './ocsp.mjs';
import { eccCmsCertificate } from './ecc-cms.mjs';

const pending = new WeakSet();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const copy = value => value instanceof Uint8Array ? Buffer.from(value) : value;
const fail = (code, stage) => { throw new KimMessageError('KIM_MESSAGE_' + code, stage); };
const safeCode = e => /^KIM_(?:CONNECTOR|MESSAGE|TSL|VZD|OCSP)_[A-Z_]{1,64}$/.test(e?.code ?? '') ? e.code : 'KIM_MESSAGE_PROCESSING_FAILED';
const transcriptEntry = r => Object.freeze(Object.fromEntries(['operation', 'requestSha256', 'responseSha256', 'routeSha256', 'contextSha256', 'checkedAt'].map(k => [k, r[k]])));

/** Card-backed diagnostic of a persisted INLINE ECC original. The mailbox and
 * institutional selector must come from host provisioning, not message headers.
 * No software key, PIN prompt, alternative card, retry, send or POP3 deletion.
 */
export async function receiveEccKimMessageWithCard(options, reportOptions, config = {}) {
  if (!options || Object.keys(options).some(k => !['bytes', 'address', 'expectedSignerCertificate', 'expectedAuthCertificate', 'now'].includes(k))
    || !config || Object.keys(config).some(k => !['connector', 'statusClient', 'directory', 'expectedTelematikId', 'requiredRoles', 'iccsn', 'ctId', 'slotId', 'signal'].includes(k))
    || reportOptions?.verificationReport !== undefined) connectorFail('INPUT');
  const { connector, statusClient, directory, signal } = config;
  if (!(connector instanceof KonnektorCertificateClient) || !(statusClient instanceof TslOcspStatusClient)
    || connector.environment !== statusClient.environment) connectorFail('CONFIGURATION');
  checkVzdConfiguration(directory, statusClient); connectorSignal(signal);
  if (pending.has(connector)) connectorFail('CMS_BUSY');
  const context = receiveReportContext({ ...reportOptions, bytes: options.bytes, address: options.address, now: options.now ?? Date.now() });
  const captured = { bytes: context.original, address: context.address, now: context.now,
    expectedSignerCertificate: copy(options.expectedSignerCertificate), expectedAuthCertificate: copy(options.expectedAuthCertificate) };
  const stop = AbortSignal.any([AbortSignal.timeout(120000), ...(signal ? [signal] : [])]);
  const settings = { connector, statusClient, signal: stop, allowPrompt: false, mandantWide: false,
    expectedTelematikId: config.expectedTelematikId, requiredRoles: Array.isArray(config.requiredRoles) ? [...config.requiredRoles] : config.requiredRoles,
    iccsn: config.iccsn, ctId: config.ctId, slotId: config.slotId };
  const transcript = [];
  let stage = 'mime', decrypted = false, signedMime, inspected, first, fingerprint, certHashes, signingProof, verification;
  const render = assess => {
    let current;
    try {
      current = inspectDecryptedEccKimMessage(captured, signedMime);
      const result = assess(current.inspection);
      return buildKimReceiveError(context, result.error, { message: current.message, decrypted: true, certificateStatus: result.certificateStatus });
    } finally { current?.message.fill(0); current?.cms.fill(0); }
  };
  const prepare = async () => {
    const p = await prepareSmcbPin(settings);
    if (p.state !== 'pin-verified') connectorFail('PIN_NOT_VERIFIED');
    assertPreparedSmcbPin(p, connector, statusClient);
    const card = p.bundle.selection.card, hashes = p.bundle.certificates.map(c => c.certificateSha256).join(':');
    if (first && (fingerprint !== cardFingerprint(card) || hashes !== certHashes)) connectorFail('CARD_CHANGED');
    if (!first) {
      first = p; fingerprint = cardFingerprint(card); certHashes = hashes;
      Object.assign(settings, { iccsn: card.iccsn, ctId: card.ctId, slotId: card.slotId });
    }
    return p;
  };
  const acquisition = (state, e) => Object.freeze({ source: 'configured-konnektor', state, stage,
    ...(e ? { code: safeCode(e) } : {}), transcript: Object.freeze([...transcript]),
    ...(verification ? { documentVerification: verification } : {}),
    hardwareEvidence: 'not-attested', tiEvidence: 'not-attested', identityStatus: 'unverified' });
  pending.add(connector);
  try {
    if (context.outer && !context.outer.headers.some(h => h.name === 'x-kom-le-version')) return {
      kind: 'unprotected', bytes: Buffer.from(context.original), originalSha256: context.originalSha256,
      identityStatus: 'unverified', deliveryStatus: 'unprotected',
    };
    const transport = readEccKimTransport(context.original, context.address);
    if (transport.envelope.profile !== 'ti-ecies-brainpoolp256r1-aes256gcm') fail('CMS_UNSUPPORTED', 'mime');
    // Validate the pinned sender leaf before any card operation or status I/O.
    try { captured.expectedSignerCertificate = Buffer.from(eccCmsCertificate(captured.expectedSignerCertificate, 'osig', context.now).cert.raw); }
    catch { fail('SIGNATURE_REJECTED', 'signature'); }
    stage = 'card';
    const p = await prepare(), enc = p.bundle.certificates.find(c => c.certRef === 'C.ENC');
    const recipient = eccCmsCertificate(enc.certificate, 'enc', context.now);
    if (!transport.envelope.mappings.some(m => m.address === context.address && m.rid === recipient.rid.toString('hex'))) fail('KEY_UNAVAILABLE', 'decrypt');
    stage = 'decrypt';
    const opened = await KonnektorCertificateClient.prototype.decryptSmcbDocument.call(connector, {
      status: p.status, certificate: enc.certificate, verification: enc.verification, data: transport.cms,
      address: context.address, expectedSignerCertificate: captured.expectedSignerCertificate, signal: stop,
    });
    transcript.push(transcriptEntry(opened)); decrypted = true;
    signedMime = Buffer.from(opened.data, 'base64');
    stage = 'headers';
    inspected = inspectDecryptedEccKimMessage(captured, signedMime);
    inspected.message.fill(0); // The body is reconstructed only for synchronous rendering.
    stage = 'certificate';
    signingProof = await TslOcspStatusClient.prototype.check.call(statusClient, {
      certificate: captured.expectedSignerCertificate, purpose: 'signing', signal: stop,
    });
    const assertSigning = () => {
      if (assessKimOcspProof(signingProof, captured.expectedSignerCertificate, 'signing').status !== 'good') fail('CERTIFICATE_STATUS_REJECTED', 'trust');
    };
    assertSigning();
    const proof = await KonnektorCertificateClient.prototype.verifyCertificate.call(connector, {
      certificate: new X509Certificate(captured.expectedSignerCertificate).raw,
      requiredRoles: signingProof.admission.professionOids, signal: stop,
    });
    assertSigning(); stage = 'document';
    try {
      verification = await KonnektorCertificateClient.prototype.verifySmcbDocument.call(connector, {
        data: inspected.cms, certificate: captured.expectedSignerCertificate, verification: proof,
        recipientEmails: transport.envelope.recipientEmails, signal: stop,
      });
    } catch (e) {
      const original = takeConnectorDocumentFailure(e, connector, hash(inspected.cms));
      if (original) { context.verificationReport = original.bytes; context.connectorVerification = original.metadata; transcript.push(transcriptEntry(original.metadata)); }
      throw e;
    }
    if (verification.contentSha256 !== inspected.contentSha256 || verification.signatureSha256 !== inspected.signatureSha256) connectorFail('CMS_VERIFY_BINDING');
    transcript.push(transcriptEntry(verification)); assertSigning();
    inspected.cms.fill(0);
    stage = 'directory';
    const finish = await assessEccKimDirectoryInspection(captured, { connector, statusClient, directory, signal: stop }, inspected.inspection);
    stage = 'card-recheck';
    await prepare(); connectorSignal(stop); assertSigning();
    stage = 'complete';
    const result = finish(render);
    return { ...result, cardAcquisition: acquisition('checked') };
  } catch (e) {
    connectorSignal(stop);
    if (/^KIM_RECEIVE_[A-Z_]+$/.test(e?.message ?? '')) throw e;
    const error = e instanceof KimMessageError ? e : new KimMessageError(stage === 'document' ? 'KIM_MESSAGE_DOCUMENT_VERIFICATION_REJECTED'
      : stage === 'card-recheck' ? 'KIM_MESSAGE_CARD_RECHECK_REJECTED' : stage === 'certificate' ? 'KIM_MESSAGE_CERTIFICATE_STATUS_REJECTED'
        : 'KIM_MESSAGE_DECRYPT_REJECTED', decrypted ? 'trust' : 'decrypt');
    let result;
    if (decrypted && signedMime) {
      try { result = render(() => ({ error })); }
      catch (renderError) {
        // Only rejected CMS/headers can omit plaintext. A report-size or MIME
        // generation failure must remain explicit, never silently drop evidence.
        if (!(renderError instanceof KimMessageError)) throw renderError;
      }
    }
    result ??= buildKimReceiveError(context, error, { decrypted });
    return { ...result, cardAcquisition: acquisition('rejected', e) };
  } finally {
    pending.delete(connector); signedMime?.fill(0); inspected?.message.fill(0); inspected?.cms.fill(0);
    context.original.fill(0); context.outer?.body.fill(0); context.verificationReport?.fill(0);
    captured.expectedSignerCertificate?.fill?.(0); captured.expectedAuthCertificate?.fill?.(0);
  }
}
